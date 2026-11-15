/**
 * Database & Security Engine Public Interface
 * Defines the public contract exposed by DSE to other engines.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const tokenService = require('../authentication/token.service');
const userService = require('../services/user.service');
const rbacService = require('../authorization/rbac.service');
const auditService = require('../audit/audit.service');
const { dseLogger } = require('../../../shared/logger/engineLogger');

class DatabaseSecurityEngineInterface {
  /**
   * Authenticate user credentials or HTTP request
   * @param {object} credentialsOrReq - { username, password } or Express req
   */
  async authenticateUser(credentialsOrReq) {
    dseLogger.debug('authenticateUser invoked');

    // Case 1: Incoming Express Request object
    if (credentialsOrReq && (credentialsOrReq.headers || credentialsOrReq.get)) {
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
   * @param {string} action - e.g. 'process:terminate'
   * @param {object|string|number} [resource] - e.g. { pid: 100 }
   */
  async authorizeAction(user, action, resource = null) {
    dseLogger.debug('authorizeAction invoked', { action, username: user && user.username });
    return rbacService.authorizeAction(user, action, resource);
  }

  /**
   * Record structured audit event persistently
   * @param {object} event
   */
  async recordAuditEvent(event) {
    dseLogger.debug('recordAuditEvent invoked', { action: event.action });
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
