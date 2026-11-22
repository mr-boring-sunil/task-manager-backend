/**
 * Process API Service
 * Coordinates HTTP process requests with the ProcessOrchestrator.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const processOrchestrator = require('../orchestrators/process.orchestrator');

class ProcessService {
  constructor(orchestrator = processOrchestrator) {
    this.orchestrator = orchestrator;
  }

  async listProcesses(query = {}, user = null) {
    return this.orchestrator.listProcesses(query, user);
  }

  async listActiveUsers() {
    return this.orchestrator.listActiveUsers();
  }

  async getProcess(pid) {
    return this.orchestrator.getProcess(pid);
  }

  async createProcess(body = {}, user = null) {
    return this.orchestrator.createProcess(body, user);
  }

  async terminateProcess(pid, signal = 'SIGTERM', user = null) {
    return this.orchestrator.terminateProcess(pid, signal, user);
  }

  async pauseProcess(pid, user = null) {
    return this.orchestrator.pauseProcess(pid, user);
  }

  async resumeProcess(pid, user = null) {
    return this.orchestrator.resumeProcess(pid, user);
  }

  async changePriority(pid, priority, user = null) {
    return this.orchestrator.changePriority(pid, priority, user);
  }
}

module.exports = new ProcessService();
