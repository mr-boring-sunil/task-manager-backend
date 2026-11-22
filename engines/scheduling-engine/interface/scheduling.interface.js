/**
 * Scheduling Engine Public Interface
 * Defines the public contract exposed by the Scheduling Engine to other engines.
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const processManager = require('../managers/process.manager');
const systemMonitor = require('../monitoring/system.monitor');
const { seLogger } = require('../../../shared/logger/engineLogger');

class SchedulingEngineInterface {
  async listProcesses(options = {}) {
    seLogger.debug('listProcesses invoked', { options });
    return processManager.listProcesses(options);
  }

  async getActiveUsers() {
    seLogger.debug('getActiveUsers invoked');
    return processManager.getActiveUsers();
  }

  async getProcess(pid) {
    seLogger.debug('getProcess invoked', { pid });
    return processManager.getProcess(pid);
  }

  async createProcess(options = {}) {
    seLogger.info('createProcess invoked', { command: options.command });
    return processManager.createProcess(options);
  }

  async terminateProcess(pid, options = {}) {
    seLogger.info('terminateProcess invoked', { pid });
    return processManager.terminateProcess(pid, options);
  }

  async pauseProcess(pid) {
    seLogger.info('pauseProcess invoked', { pid });
    return processManager.pauseProcess(pid);
  }

  async resumeProcess(pid) {
    seLogger.info('resumeProcess invoked', { pid });
    return processManager.resumeProcess(pid);
  }

  async changePriority(pid, priority) {
    seLogger.info('changePriority invoked', { pid, priority });
    return processManager.changePriority(pid, priority);
  }

  async getSystemMetrics() {
    seLogger.debug('getSystemMetrics invoked');
    return systemMonitor.getOverviewMetrics();
  }

  async getCpuMetrics() {
    seLogger.debug('getCpuMetrics invoked');
    return systemMonitor.getCpuMetrics();
  }

  async getMemoryMetrics() {
    seLogger.debug('getMemoryMetrics invoked');
    return systemMonitor.getMemoryMetrics();
  }

  async getDiskMetrics() {
    seLogger.debug('getDiskMetrics invoked');
    return systemMonitor.getDiskMetrics();
  }

  async getNetworkMetrics() {
    seLogger.debug('getNetworkMetrics invoked');
    return systemMonitor.getNetworkMetrics();
  }

  async getTemperatureMetrics() {
    seLogger.debug('getTemperatureMetrics invoked');
    return systemMonitor.getTemperatureMetrics();
  }
}

module.exports = new SchedulingEngineInterface();
