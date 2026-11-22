/**
 * Scheduling Engine Adapter (CEE -> SE)
 * Inter-engine communication adapter calling SE with mandatory interaction logging.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const interactionLogger = require('../../../shared/logger/interactionLogger');
const defaultSe = require('../../scheduling-engine');

class SchedulingAdapter {
  constructor(seInstance = defaultSe) {
    this.se = seInstance;
  }

  setEngine(seInstance) {
    this.se = seInstance;
  }

  async listProcesses(options = {}, requestId = null) {
    return interactionLogger.execute('CEE', 'SE', 'listProcesses', async () => {
      return this.se.listProcesses(options);
    }, requestId);
  }

  async getActiveUsers(requestId = null) {
    return interactionLogger.execute('CEE', 'SE', 'getActiveUsers', async () => {
      return this.se.getActiveUsers();
    }, requestId);
  }

  async getProcess(pid, requestId = null) {
    return interactionLogger.execute('CEE', 'SE', 'getProcess', async () => {
      return this.se.getProcess(pid);
    }, requestId);
  }

  async createProcess(options, requestId = null) {
    return interactionLogger.execute('CEE', 'SE', 'createProcess', async () => {
      return this.se.createProcess(options);
    }, requestId);
  }

  async terminateProcess(pid, options, requestId = null) {
    return interactionLogger.execute('CEE', 'SE', 'terminateProcess', async () => {
      return this.se.terminateProcess(pid, options);
    }, requestId);
  }

  async pauseProcess(pid, requestId = null) {
    return interactionLogger.execute('CEE', 'SE', 'pauseProcess', async () => {
      return this.se.pauseProcess(pid);
    }, requestId);
  }

  async resumeProcess(pid, requestId = null) {
    return interactionLogger.execute('CEE', 'SE', 'resumeProcess', async () => {
      return this.se.resumeProcess(pid);
    }, requestId);
  }

  async changePriority(pid, priority, requestId = null) {
    return interactionLogger.execute('CEE', 'SE', 'changePriority', async () => {
      return this.se.changePriority(pid, priority);
    }, requestId);
  }

  async getSystemMetrics(requestId = null) {
    return interactionLogger.execute('CEE', 'SE', 'getSystemMetrics', async () => {
      return this.se.getSystemMetrics();
    }, requestId);
  }

  async getCpuMetrics(requestId = null) {
    return interactionLogger.execute('CEE', 'SE', 'getCpuMetrics', async () => {
      return this.se.getCpuMetrics();
    }, requestId);
  }

  async getMemoryMetrics(requestId = null) {
    return interactionLogger.execute('CEE', 'SE', 'getMemoryMetrics', async () => {
      return this.se.getMemoryMetrics();
    }, requestId);
  }

  async getDiskMetrics(requestId = null) {
    return interactionLogger.execute('CEE', 'SE', 'getDiskMetrics', async () => {
      return this.se.getDiskMetrics();
    }, requestId);
  }

  async getNetworkMetrics(requestId = null) {
    return interactionLogger.execute('CEE', 'SE', 'getNetworkMetrics', async () => {
      return this.se.getNetworkMetrics();
    }, requestId);
  }

  async getTemperatureMetrics(requestId = null) {
    return interactionLogger.execute('CEE', 'SE', 'getTemperatureMetrics', async () => {
      return this.se.getTemperatureMetrics();
    }, requestId);
  }
}

module.exports = new SchedulingAdapter();
