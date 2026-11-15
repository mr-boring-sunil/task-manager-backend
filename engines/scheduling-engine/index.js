/**
 * Scheduling Engine (SE)
 * Public entry point for Linux process management and hardware telemetry.
 * Raspberry Pi Task Manager
 */

const schedulingInterface = require('./interface/scheduling.interface');
const { seLogger } = require('../../shared/logger/engineLogger');

const init = async () => {
  seLogger.info('Scheduling Engine initialized');
  return schedulingInterface;
};

module.exports = {
  init,
  interface: schedulingInterface,
  // Direct export of interface methods for convenient direct JS calls
  listProcesses: (options) => schedulingInterface.listProcesses(options),
  getProcess: (pid) => schedulingInterface.getProcess(pid),
  createProcess: (options) => schedulingInterface.createProcess(options),
  terminateProcess: (pid, options) => schedulingInterface.terminateProcess(pid, options),
  pauseProcess: (pid) => schedulingInterface.pauseProcess(pid),
  resumeProcess: (pid) => schedulingInterface.resumeProcess(pid),
  changePriority: (pid, priority) => schedulingInterface.changePriority(pid, priority),
  getSystemMetrics: () => schedulingInterface.getSystemMetrics(),
  getCpuMetrics: () => schedulingInterface.getCpuMetrics(),
  getMemoryMetrics: () => schedulingInterface.getMemoryMetrics(),
  getDiskMetrics: () => schedulingInterface.getDiskMetrics(),
  getNetworkMetrics: () => schedulingInterface.getNetworkMetrics(),
  getTemperatureMetrics: () => schedulingInterface.getTemperatureMetrics(),
};
