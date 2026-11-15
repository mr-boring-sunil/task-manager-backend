/**
 * Process Information Collector
 * Queries operating system and /proc filesystem for running processes.
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const si = require('systeminformation');
const { mapProcessState } = require('../process-state/state.mapper');
const procReader = require('../../utils/proc.reader');
const priorityOps = require('../priority/priority.ops');
const signalOps = require('../../operations/signal.operations');
const { NotFoundError, AppError } = require('../../../../shared/errors/AppError');
const { ERROR_CODES } = require('../../../../shared/errors/errorCodes');

class ProcessInfoCollector {
  /**
   * Get formatted list of all running processes
   * @returns {Promise<Array<object>>}
   */
  async getAllProcesses() {
    try {
      const data = await si.processes();
      const list = data.list || [];

      return list.map((p) => ({
        pid: p.pid,
        ppid: p.parentPid || 0,
        name: p.name || 'unknown',
        command: p.command || p.name || '',
        username: p.user || 'unknown',
        cpu: typeof p.cpu === 'number' ? Math.round(p.cpu * 100) / 100 : 0,
        memory: typeof p.mem === 'number' ? Math.round(p.mem * 100) / 100 : 0,
        memoryUsage: typeof p.memRss === 'number' ? p.memRss * 1024 : 0, // In bytes
        state: mapProcessState(p.state),
        startTime: p.started || null,
        priority: p.priority !== undefined ? p.priority : null,
      }));
    } catch (err) {
      throw new AppError(
        `Failed to retrieve process list: ${err.message}`,
        500,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  /**
   * Get detailed information for a single process
   * @param {number} pid
   * @returns {Promise<object>}
   */
  async getProcessById(pid) {
    const processes = await this.getAllProcesses();
    const found = processes.find((p) => p.pid === pid);

    if (!found) {
      if (!signalOps.processExists(pid)) {
        throw new NotFoundError(`Process with PID ${pid} not found`, ERROR_CODES.PROCESS_NOT_FOUND, { pid });
      }
      throw new NotFoundError(`Process with PID ${pid} details could not be read`, ERROR_CODES.PROCESS_NOT_FOUND, { pid });
    }

    // Try reading nice priority
    const priority = priorityOps.getPriority(pid);
    if (priority !== null) {
      found.priority = priority;
    }

    // On Linux, augment with /proc/[pid]/status
    const procStatus = procReader.readProcessStatus(pid);
    if (procStatus) {
      if (procStatus.threads !== undefined) found.threads = procStatus.threads;
      if (procStatus.fdSize !== undefined) found.fdSize = procStatus.fdSize;
      if (procStatus.vmSize !== undefined) found.vmSize = procStatus.vmSize;
      if (procStatus.vmRss !== undefined) found.vmRss = procStatus.vmRss;
    }

    return found;
  }
}

module.exports = new ProcessInfoCollector();
