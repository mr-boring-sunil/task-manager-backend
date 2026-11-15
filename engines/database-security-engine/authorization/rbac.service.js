/**
 * Role-Based Access Control (RBAC) Service
 * Evaluates user permissions for actions and resources.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const { ForbiddenError, UnauthorizedError } = require('../../../shared/errors/AppError');
const { ERROR_CODES } = require('../../../shared/errors/errorCodes');
const { PROTECTED_PIDS } = require('../../../config/server.config');

const ROLE_PERMISSIONS = {
  admin: ['*'], // Full administrative capabilities
  standard: [
    'process:read',
    'process:create',
    'process:terminate',
    'process:pause',
    'process:resume',
    'process:priority',
    'metrics:read',
  ],
  viewer: [
    'process:read',
    'metrics:read',
  ],
};

class RbacService {
  /**
   * Authorize user action against a resource
   * @param {object} user - Authenticated user context
   * @param {string} action - Action name (e.g. 'process:terminate')
   * @param {object|string|number} [resource] - Target resource (e.g. { pid: 100 })
   * @returns {boolean}
   */
  authorizeAction(user, action, resource = null) {
    if (!user) {
      throw new UnauthorizedError('Authentication context required for authorization');
    }

    const role = user.role || 'viewer';
    const permissions = ROLE_PERMISSIONS[role] || [];

    // Check action permission
    const hasPermission = permissions.includes('*') || permissions.includes(action);
    if (!hasPermission) {
      throw new ForbiddenError(
        `User '${user.username}' with role '${role}' is not authorized to perform '${action}'`,
        ERROR_CODES.PERMISSION_DENIED,
        { action, role }
      );
    }

    // Additional check on protected PIDs for terminating/pausing/renicing
    if (resource) {
      const pid = typeof resource === 'object' ? resource.pid : parseInt(resource, 10);
      if (pid && (PROTECTED_PIDS.includes(pid) || pid === process.pid || pid === process.ppid)) {
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

module.exports = new RbacService();
