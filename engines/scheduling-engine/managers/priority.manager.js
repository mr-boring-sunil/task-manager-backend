/**
 * Priority Manager
 * Validates requested priority and executes nice level adjustments.
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const priorityOps = require('../modules/priority/priority.ops');
const validator = require('../validation/process.validator');
const signalOps = require('../operations/signal.operations');
const { NotFoundError } = require('../../../shared/errors/AppError');
const { ERROR_CODES } = require('../../../shared/errors/errorCodes');

class PriorityManager {
  /**
   * Change process priority
   * @param {number} rawPid
   * @param {number} rawPriority
   * @returns {Promise<{ pid: number, priority: number }>}
   */
  async changePriority(rawPid, rawPriority) {
    const pid = validator.validatePid(rawPid);
    const priority = validator.validatePriority(rawPriority);

    if (!signalOps.processExists(pid)) {
      throw new NotFoundError(`Process with PID ${pid} does not exist`, ERROR_CODES.PROCESS_NOT_FOUND, { pid });
    }

    const updatedPriority = priorityOps.setPriority(pid, priority);
    return {
      pid,
      priority: updatedPriority,
    };
  }

  /**
   * Read priority for process
   * @param {number} pid
   * @returns {number|null}
   */
  getPriority(pid) {
    return priorityOps.getPriority(pid);
  }
}

module.exports = new PriorityManager();
