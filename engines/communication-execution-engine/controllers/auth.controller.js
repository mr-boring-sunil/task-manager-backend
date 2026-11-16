/**
 * Authentication REST Controller
 * Handles user login, session validation, user context, and logout.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const securityAdapter = require('../adapters/security.adapter');
const { sendSuccess } = require('../utils/response');
const { ceeLogger } = require('../../../shared/logger/engineLogger');
const { HTTP_STATUS } = require('../../../shared/errors/errorCodes');

const SESSION_COOKIE_NAME = 'taskmgr_session';
const CSRF_COOKIE_NAME = 'taskmgr_csrf';

class AuthController {
  /**
   * POST /api/v1/auth/login
   * Authenticate Linux user credentials and establish session
   */
  async login(req, res, next) {
    try {
      ceeLogger.info('[CEE] Authentication request received');

      const { username, password } = req.body || {};
      const meta = {
        ip: req.ip || (req.socket && req.socket.remoteAddress) || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'unknown',
        requestId: req.headers['x-request-id'] || null,
      };

      const result = await securityAdapter.login(username, password, meta);
      const isProduction = process.env.NODE_ENV === 'production';
      const cookieMaxAgeMs = (result.session.expiresIn || 3600) * 1000;

      // 1. Set HttpOnly session cookie
      res.cookie(SESSION_COOKIE_NAME, result.token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: cookieMaxAgeMs,
      });

      // 2. Set CSRF token cookie (accessible by client JavaScript for x-csrf-token header)
      res.cookie(CSRF_COOKIE_NAME, result.csrfToken, {
        httpOnly: false,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: cookieMaxAgeMs,
      });

      // Retrieve permissions for the assigned role
      const permissions = securityAdapter.getPermissionsForRole(result.user.role);

      ceeLogger.info('[CEE] Authentication response returned');

      return sendSuccess(
        res,
        {
          user: {
            username: result.user.username,
            role: result.user.role,
            permissions,
          },
          session: {
            authenticated: true,
            expiresIn: result.session.expiresIn,
            expiresAt: result.session.expiresAt,
          },
          csrfToken: result.csrfToken,
        },
        'Authentication successful',
        HTTP_STATUS.OK
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/auth/session
   * Validate current session status
   */
  async getSession(req, res, next) {
    try {
      const user = req.user;
      const permissions = securityAdapter.getPermissionsForRole(user.role);

      return sendSuccess(
        res,
        {
          authenticated: true,
          user: {
            username: user.username,
            role: user.role,
            permissions,
          },
          session: {
            authenticated: true,
            expiresIn: user.expiresIn,
            expiresAt: user.expiresAt,
          },
          csrfToken: user.csrfToken,
        },
        'Session is valid',
        HTTP_STATUS.OK
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/auth/me
   * Get current authenticated user details and assigned permissions
   */
  async getMe(req, res, next) {
    try {
      const user = req.user;
      const permissions = securityAdapter.getPermissionsForRole(user.role);

      return sendSuccess(
        res,
        {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions,
          authMethod: user.authMethod,
        },
        'User profile retrieved',
        HTTP_STATUS.OK
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/logout
   * Terminate and revoke active application session
   */
  async logout(req, res, next) {
    try {
      const cookies = req.cookies || {};
      const token = cookies[SESSION_COOKIE_NAME];
      const meta = {
        ip: req.ip || (req.socket && req.socket.remoteAddress) || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'unknown',
      };

      if (token) {
        await securityAdapter.logout(token, meta);
      }

      // Clear session & CSRF cookies
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });

      return sendSuccess(
        res,
        { authenticated: false },
        'Logout successful',
        HTTP_STATUS.OK
      );
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
