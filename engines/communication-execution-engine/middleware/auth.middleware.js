/**
 * Authentication & Authorization Middleware
 * Connects routes to the Database & Security Engine Adapter.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const securityAdapter = require('../adapters/security.adapter');
const { UnauthorizedError, ForbiddenError } = require('../../../shared/errors/AppError');
const { ERROR_CODES } = require('../../../shared/errors/errorCodes');

/**
 * Reusable helper to parse cookies from request headers
 */
const parseCookies = (cookieHeader) => {
  if (!cookieHeader || typeof cookieHeader !== 'string') return {};
  const cookies = {};
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.trim().split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      cookies[key] = decodeURIComponent(val);
    }
  });
  return cookies;
};

/**
 * Authenticate incoming request via session cookie or Authorization header
 */
const authenticate = async (req, res, next) => {
  try {
    // Populate req.cookies if not already parsed
    if (!req.cookies && req.headers.cookie) {
      req.cookies = parseCookies(req.headers.cookie);
    }

    const user = await securityAdapter.authenticateUser(req);
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Optional authentication: populates req.user if valid credentials exist,
 * but allows unauthenticated requests to continue with req.user = null.
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    if (!req.cookies && req.headers.cookie) {
      req.cookies = parseCookies(req.headers.cookie);
    }

    const user = await securityAdapter.authenticateUser(req);
    req.user = user;
  } catch (err) {
    req.user = null;
  }
  next();
};

/**
 * Require a specific permission for the endpoint
 * @param {string} permission - e.g. 'process.terminate'
 */
const authorize = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required', ERROR_CODES.UNAUTHORIZED);
      }
      const resource = req.params.pid || req.body || null;
      await securityAdapter.authorizeAction(req.user, permission, resource);
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Require a specific application role
 * @param {string} role - 'admin' or 'standard'
 */
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required', ERROR_CODES.UNAUTHORIZED));
    }
    if (req.user.role !== role && req.user.role !== 'admin') {
      return next(
        new ForbiddenError(
          `Operation requires '${role}' role`,
          ERROR_CODES.PERMISSION_DENIED,
          { requiredRole: role, currentRole: req.user.role }
        )
      );
    }
    next();
  };
};

/**
 * Verify CSRF token for state-changing requests using cookie authentication
 */
const verifyCsrf = (req, res, next) => {
  // Safe read-only HTTP methods do not require CSRF
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Only enforce CSRF for session cookie authentication
  if (req.user && req.user.authMethod === 'session') {
    const providedToken = req.headers['x-csrf-token'];
    const expectedToken = req.user.csrfToken;

    if (!providedToken || !expectedToken || providedToken !== expectedToken) {
      return next(
        new ForbiddenError(
          'CSRF token validation failed. Include x-csrf-token header with requests.',
          ERROR_CODES.PERMISSION_DENIED
        )
      );
    }
  }

  next();
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireAuthentication: authenticate,
  authorize,
  requirePermission: authorize,
  requireRole,
  verifyCsrf,
  parseCookies,
};
