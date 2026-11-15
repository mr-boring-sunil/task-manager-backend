/**
 * Process Priority Operations
 * Low-level interface with os.getPriority / os.setPriority
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const os = require('os');
const { ForbiddenError, NotFoundError, AppError } = require('../../../../shared/errors/AppError');
const { ERROR_CODES } = require('../../../../shared/errors/errorCodes');

class PriorityOperations {
  /**
   * Get priority (nice value) of a process
   * @param {number} pid
   * @returns {number|null}
   */
  getPriority(pid) {
    try {
      return os.getPriority(pid);
    } catch (e) {
      return null;
    }
  }

  /**
   * Change priority (nice value) of a process
   * @param {number} pid
   * @param {number} priority
   * @returns {number} updated priority
   */
  setPriority(pid, priority) {
    try {
      os.setPriority(pid, priority);
      return os.getPriority(pid);
    } catch (err) {
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        throw new ForbiddenError(
          `Permission denied to change priority of PID ${pid}. Negative nice values require CAP_SYS_NICE or root permissions.`,
          ERROR_CODES.PERMISSION_DENIED,
          { pid, requestedPriority: priority }
        );
      }
      if (err.code === 'ESRCH') {
        throw new NotFoundError(`Process with PID ${pid} not found`, ERROR_CODES.PROCESS_NOT_FOUND, { pid });
      }
      throw new AppError(`Failed to change process priority: ${err.message}`, 500, ERROR_CODES.INTERNAL_ERROR);
    }
  }
}

module.exports = new PriorityOperations();
