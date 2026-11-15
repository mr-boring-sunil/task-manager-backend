/**
 * Process Manager
 * Coordinates process validation, lifecycle operations, and process information.
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const processInfo = require('../modules/process-information/process.info');
const processLifecycle = require('../modules/process-lifecycle/process.lifecycle');
const priorityManager = require('./priority.manager');
const validator = require('../validation/process.validator');
const { ALLOWED_SORT_FIELDS } = require('../../../config/server.config');

class ProcessManager {
  /**
   * List running processes with filtering, sorting, and pagination
   * @param {object} options
   */
  async listProcesses(options = {}) {
    const { username, state, search, sortBy, order, page, limit } = options;

    let validPage = parseInt(page, 10);
    let validLimit = parseInt(limit, 10);
    if (Number.isNaN(validPage) || validPage < 1) validPage = 1;
    if (Number.isNaN(validLimit) || validLimit < 1) validLimit = 50;
    if (validLimit > 100) validLimit = 100;

    const offset = (validPage - 1) * validLimit;

    const validSort = (sortBy && ALLOWED_SORT_FIELDS.includes(sortBy.toLowerCase())) ? sortBy.toLowerCase() : 'pid';
    const validOrder = (order && ['asc', 'desc'].includes(order.toLowerCase())) ? order.toLowerCase() : 'asc';

    const allProcesses = await processInfo.getAllProcesses();

    // 1. Filtering
    let filtered = allProcesses.filter((proc) => {
      if (username && proc.username.toLowerCase() !== username.toLowerCase()) {
        return false;
      }
      if (state && proc.state.toLowerCase() !== state.toLowerCase()) {
        return false;
      }
      if (search) {
        const searchTerm = search.toLowerCase();
        const matchesName = (proc.name || '').toLowerCase().includes(searchTerm);
        const matchesCmd = (proc.command || '').toLowerCase().includes(searchTerm);
        if (!matchesName && !matchesCmd) return false;
      }
      return true;
    });

    // 2. Sorting
    filtered.sort((a, b) => {
      let valA = a[validSort];
      let valB = b[validSort];

      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (typeof valA === 'string' && typeof valB === 'string') {
        const comp = valA.localeCompare(valB);
        return validOrder === 'desc' ? -comp : comp;
      }

      const numA = Number(valA);
      const numB = Number(valB);
      return validOrder === 'desc' ? numB - numA : numA - numB;
    });

    // 3. Pagination
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + validLimit);
    const totalPages = Math.ceil(total / validLimit) || 1;

    return {
      processes: paginated,
      pagination: {
        total,
        page: validPage,
        limit: validLimit,
        totalPages,
        hasNextPage: validPage < totalPages,
        hasPrevPage: validPage > 1,
      },
    };
  }

  /**
   * Get single process details
   * @param {number|string} rawPid
   */
  async getProcess(rawPid) {
    const pid = validator.validatePid(rawPid);
    return processInfo.getProcessById(pid);
  }

  /**
   * Create process subject to security policy
   * @param {object} options
   */
  async createProcess(options = {}) {
    const { command, arguments: rawArgs, args: altArgs, workingDirectory, cwd: altCwd, env: rawEnv } = options;

    const validCommand = validator.validateCommand(command);
    const validArgs = validator.validateArgs(rawArgs || altArgs || []);
    const validCwd = validator.validateCwd(workingDirectory || altCwd);
    const validEnv = validator.validateEnv(rawEnv);

    return processLifecycle.spawnProcess(validCommand, validArgs, validCwd, validEnv);
  }

  /**
   * Terminate process
   * @param {number|string} rawPid
   * @param {object|string} [options]
   */
  async terminateProcess(rawPid, options = {}) {
    const pid = validator.validatePid(rawPid);
    const signal = typeof options === 'string' ? options : (options.signal || 'SIGTERM');
    const graceful = typeof options === 'object' && options.graceful !== undefined ? options.graceful : true;

    return processLifecycle.terminateProcess(pid, signal, graceful);
  }

  /**
   * Pause process
   * @param {number|string} rawPid
   */
  async pauseProcess(rawPid) {
    const pid = validator.validatePid(rawPid);
    return processLifecycle.pauseProcess(pid);
  }

  /**
   * Resume process
   * @param {number|string} rawPid
   */
  async resumeProcess(rawPid) {
    const pid = validator.validatePid(rawPid);
    return processLifecycle.resumeProcess(pid);
  }

  /**
   * Change priority
   * @param {number|string} rawPid
   * @param {number|string} rawPriority
   */
  async changePriority(rawPid, rawPriority) {
    return priorityManager.changePriority(rawPid, rawPriority);
  }
}

module.exports = new ProcessManager();
