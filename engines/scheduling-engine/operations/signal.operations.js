/**
 * Process Signal Operations
 * Manages low-level signal delivery and process existence testing.
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const { NotFoundError, ForbiddenError, AppError } = require('../../../shared/errors/AppError');
const { ERROR_CODES } = require('../../../shared/errors/errorCodes');

class SignalOperations {
  /**
   * Check if process exists using signal 0
   * @param {number} pid
   * @returns {boolean}
   */
  processExists(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return err.code === 'EPERM'; // Process exists but owned by another user
    }
  }

  /**
   * Send a POSIX signal to a process
   * @param {number} pid
   * @param {string} signal - e.g. 'SIGTERM', 'SIGKILL', 'SIGSTOP', 'SIGCONT'
   */
  sendSignal(pid, signal) {
    if (!this.processExists(pid)) {
      throw new NotFoundError(`Process with PID ${pid} does not exist`, ERROR_CODES.PROCESS_NOT_FOUND, { pid });
    }

    try {
      process.kill(pid, signal);
      return true;
    } catch (err) {
      if (err.code === 'ESRCH') {
        throw new NotFoundError(`Process with PID ${pid} not found`, ERROR_CODES.PROCESS_NOT_FOUND, { pid });
      }
      if (err.code === 'EPERM') {
        throw new ForbiddenError(
          `Permission denied to send ${signal} to process ${pid}`,
          ERROR_CODES.PERMISSION_DENIED,
          { pid, signal }
        );
      }
      throw new AppError(`Failed to signal process ${pid}: ${err.message}`, 500, ERROR_CODES.SIGNAL_FAILED);
    }
  }
}

module.exports = new SignalOperations();
