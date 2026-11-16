/**
 * Database & Security Engine Public Interface
 * Defines the public contract exposed by DSE to other engines.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const tokenService = require('../authentication/token.service');
const userService = require('../services/user.service');
const authenticationService = require('../services/authentication.service');
const authorizationService = require('../services/authorization.service');
const auditService = require('../audit/audit.service');
const { dseLogger } = require('../../../shared/logger/engineLogger');

class DatabaseSecurityEngineInterface {
  /**
   * Authenticate Linux user credentials and create application session
   * @param {string} username
   * @param {string} password
   * @param {object} [meta]
   */
  async login(username, password, meta = {}) {
    dseLogger.debug('[DSE] Interface: login invoked');
    return authenticationService.login(username, password, meta);
  }

  /**
   * Validate session token
   * @param {string} token
   */
  async validateSession(token) {
    dseLogger.debug('[DSE] Interface: validateSession invoked');
    return authenticationService.validateSession(token);
  }

  /**
   * Revoke session (Logout)
   * @param {string} token
   * @param {object} [meta]
   */
  async logout(token, meta = {}) {
    dseLogger.debug('[DSE] Interface: logout invoked');
    return authenticationService.logout(token, meta);
  }

  /**
   * Get permissions for an application role
   * @param {string} role
   */
  getPermissionsForRole(role) {
    return authorizationService.getPermissionsForRole(role);
  }

  /**
   * Check if role has a specific permission
   * @param {string} role
   * @param {string} permission
   */
  hasPermission(role, permission) {
    return authorizationService.hasPermission(role, permission);
  }

  /**
   * Authenticate user credentials or HTTP request
   * @param {object} credentialsOrReq - { username, password } or Express req
   */
  async authenticateUser(credentialsOrReq) {
    dseLogger.debug('[DSE] Interface: authenticateUser invoked');

    // Case 1: Incoming Express Request object
    if (credentialsOrReq && (credentialsOrReq.headers || credentialsOrReq.get || credentialsOrReq.cookies)) {
      // Check session cookie first
      const cookieHeader = credentialsOrReq.headers ? credentialsOrReq.headers.cookie : null;
      let sessionToken = null;

      if (credentialsOrReq.cookies && credentialsOrReq.cookies.taskmgr_session) {
        sessionToken = credentialsOrReq.cookies.taskmgr_session;
      } else if (cookieHeader) {
        const match = cookieHeader.match(/(?:^|;\s*)taskmgr_session=([^;]+)/);
        if (match) {
          sessionToken = decodeURIComponent(match[1]);
        }
      }

      if (sessionToken) {
        try {
          const sessionUser = await authenticationService.validateSession(sessionToken);
          return {
            id: sessionUser.id,
            username: sessionUser.username,
            role: sessionUser.role,
            authMethod: 'session',
            csrfToken: sessionUser.csrfToken,
            expiresIn: sessionUser.expiresIn,
          };
        } catch (sessionErr) {
          // If session token was provided but invalid/expired, throw
          throw sessionErr;
        }
      }

      // Check Bearer / API key or development fallback
      return tokenService.authenticateRequest(credentialsOrReq);
    }

    // Case 2: Credentials payload { username, password }
    if (credentialsOrReq && credentialsOrReq.username && credentialsOrReq.password) {
      const user = await userService.authenticate(credentialsOrReq.username, credentialsOrReq.password);
      const token = tokenService.generateToken({
        id: user.id,
        username: user.username,
        role: user.role,
      });
      return {
        user,
        token,
      };
    }

    // Case 3: Empty/invalid credentials
    return tokenService.authenticateRequest({ headers: {} });
  }

  /**
   * Authorize user action against a target resource
   * @param {object} user - Authenticated user context
   * @param {string} action - e.g. 'process:terminate' or 'process.terminate'
   * @param {object|string|number} [resource] - e.g. { pid: 100 }
   * @param {object} [meta] - Request metadata
   */
  async authorizeAction(user, action, resource = null, meta = {}) {
    dseLogger.debug(`[DSE] Interface: authorizeAction invoked for action '${action}'`);
    return authorizationService.authorizeAction(user, action, resource, meta);
  }

  /**
   * Record structured audit event persistently
   * @param {object} event
   */
  async recordAuditEvent(event) {
    dseLogger.debug('[DSE] Interface: recordAuditEvent invoked', { action: event.action });
    return auditService.recordAuditEvent(event);
  }

  /**
   * Create a new user account
   */
  async createUser(userData) {
    return userService.createUser(userData);
  }

  /**
   * Get user details by username
   */
  async getUserByUsername(username) {
    return userService.getUserByUsername(username);
  }

  /**
   * Retrieve recent audit logs
   */
  async getAuditLogs(limit) {
    return auditService.getAuditLogs(limit);
  }
}

module.exports = new DatabaseSecurityEngineInterface();
