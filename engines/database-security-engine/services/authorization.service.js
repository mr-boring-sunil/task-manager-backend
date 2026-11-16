/**
 * Authorization Business Service
 * Enforces role-based permissions, protected process boundaries, and audit trail for denied actions.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const { ROLE_PERMISSIONS, normalizePermission } = require('../config/permissions.config');
const { PROTECTED_PIDS } = require('../../../config/server.config');
const auditService = require('../audit/audit.service');
const { dseLogger } = require('../../../shared/logger/engineLogger');
const { ForbiddenError, UnauthorizedError } = require('../../../shared/errors/AppError');
const { ERROR_CODES } = require('../../../shared/errors/errorCodes');

class AuthorizationService {
  /**
   * Check if a role possesses a given permission
   * @param {string} role - 'admin' or 'standard'
   * @param {string} permission - e.g. 'process.terminate'
   * @returns {boolean}
   */
  hasPermission(role, permission) {
    if (!role) return false;
    const permissions = ROLE_PERMISSIONS[role] || [];
    if (permissions.includes('*')) return true;

    const normalized = normalizePermission(permission);
    return permissions.includes(normalized);
  }

  /**
   * Retrieve all permissions granted to a role
   * @param {string} role
   * @returns {string[]}
   */
  getPermissionsForRole(role) {
    const perms = ROLE_PERMISSIONS[role] || [];
    if (perms.includes('*')) {
      return [
        'system.read',
        'process.read',
        'process.create',
        'process.terminate',
        'process.pause',
        'process.resume',
        'process.priority',
        'user.manage',
        'role.manage',
      ];
    }
    return [...perms];
  }

  /**
   * Authorize a user action against a target resource
   * @param {object} user - Authenticated user context
   * @param {string} action - Action identifier (e.g. 'process.terminate')
   * @param {object|string|number} [resource] - Resource context (e.g. PID)
   * @param {object} [meta] - Request metadata
   */
  async authorizeAction(user, action, resource = null, meta = {}) {
    dseLogger.debug(`[DSE] Authorizing action '${action}' for user '${user ? user.username : 'anonymous'}'`);

    if (!user) {
      throw new UnauthorizedError('Authentication context required for authorization', ERROR_CODES.UNAUTHORIZED);
    }

    const role = user.role || 'standard';
    const isPermitted = this.hasPermission(role, action);

    if (!isPermitted) {
      dseLogger.warn(`[DSE] Permission denied: User '${user.username}' (${role}) attempted '${action}'`);

      // Record audit event for permission denied
      await auditService.recordAuditEvent({
        username: user.username,
        action: `auth:permission_denied:${action}`,
        status: 'DENIED',
        ip_address: meta.ip || '127.0.0.1',
        request_id: meta.requestId || null,
        details: { action, role },
      });

      throw new ForbiddenError(
        `User '${user.username}' with role '${role}' is not authorized to perform '${action}'`,
        ERROR_CODES.PERMISSION_DENIED,
        { action, role }
      );
    }

    // Additional check on protected PIDs for process operations
    if (resource) {
      const pid = typeof resource === 'object' ? resource.pid : parseInt(resource, 10);
      if (pid && (PROTECTED_PIDS.includes(pid) || pid === process.pid || pid === process.ppid)) {
        dseLogger.warn(`[DSE] Blocked operation '${action}' on protected PID ${pid}`);
        throw new ForbiddenError(
          `Operation '${action}' forbidden on protected system process (PID: ${pid})`,
          ERROR_CODES.PROTECTED_PROCESS,
          { pid, action }
        );
      }
    }

    return true;
  }
}

module.exports = new AuthorizationService();
