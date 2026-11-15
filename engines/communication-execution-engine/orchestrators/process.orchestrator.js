/**
 * Process Service Orchestrator
 * Coordinates cross-engine flows between Scheduling Engine and Database & Security Engine.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const schedulingAdapter = require('../adapters/scheduling.adapter');
const securityAdapter = require('../adapters/security.adapter');
const generateRequestId = require('../../../shared/utils/generateRequestId');

class ProcessOrchestrator {
  constructor(seAdapter = schedulingAdapter, dseAdapter = securityAdapter) {
    this.se = seAdapter;
    this.dse = dseAdapter;
  }

  /**
   * Flow A: Retrieve process list
   */
  async listProcesses(options = {}) {
    const reqId = generateRequestId('proc_list');
    return this.se.listProcesses(options, reqId);
  }

  /**
   * Retrieve single process details
   */
  async getProcess(pid) {
    const reqId = generateRequestId('proc_get');
    return this.se.getProcess(pid, reqId);
  }

  /**
   * Flow C: Create a permitted process with authorization and auditing
   */
  async createProcess(options, user = null) {
    const reqId = generateRequestId('proc_create');

    // 1. Authorize with DSE
    await this.dse.authorizeAction(user, 'process:create', options.command, reqId);

    try {
      // 2. Spawn via SE
      const result = await this.se.createProcess(options, reqId);

      // 3. Record Audit event via DSE
      await this.dse.recordAuditEvent({
        user,
        action: 'process:create',
        resource: options.command,
        resource_id: result.pid,
        status: 'SUCCESS',
        request_id: reqId,
        details: { command: options.command, args: options.args, pid: result.pid },
      }, reqId);

      return result;
    } catch (err) {
      await this.dse.recordAuditEvent({
        user,
        action: 'process:create',
        resource: options.command,
        status: 'FAILURE',
        request_id: reqId,
        details: { error: err.message },
      }, reqId).catch(() => {});
      throw err;
    }
  }

  /**
   * Flow B: Terminate a process with authorization and auditing
   */
  async terminateProcess(pid, signal = 'SIGTERM', user = null) {
    const reqId = generateRequestId('proc_term');

    // 1. Authorize with DSE
    await this.dse.authorizeAction(user, 'process:terminate', { pid }, reqId);

    try {
      // 2. Signal via SE
      const result = await this.se.terminateProcess(pid, { signal, graceful: true }, reqId);

      // 3. Audit via DSE
      await this.dse.recordAuditEvent({
        user,
        action: 'process:terminate',
        resource: pid,
        resource_id: pid,
        status: 'SUCCESS',
        request_id: reqId,
        details: { signal: result.signal, escalated: result.escalated },
      }, reqId);

      return result;
    } catch (err) {
      await this.dse.recordAuditEvent({
        user,
        action: 'process:terminate',
        resource: pid,
        resource_id: pid,
        status: 'FAILURE',
        request_id: reqId,
        details: { error: err.message },
      }, reqId).catch(() => {});
      throw err;
    }
  }

  /**
   * Pause a process (SIGSTOP)
   */
  async pauseProcess(pid, user = null) {
    const reqId = generateRequestId('proc_pause');

    await this.dse.authorizeAction(user, 'process:pause', { pid }, reqId);

    try {
      const result = await this.se.pauseProcess(pid, reqId);

      await this.dse.recordAuditEvent({
        user,
        action: 'process:pause',
        resource: pid,
        resource_id: pid,
        status: 'SUCCESS',
        request_id: reqId,
      }, reqId);

      return result;
    } catch (err) {
      await this.dse.recordAuditEvent({
        user,
        action: 'process:pause',
        resource: pid,
        resource_id: pid,
        status: 'FAILURE',
        request_id: reqId,
        details: { error: err.message },
      }, reqId).catch(() => {});
      throw err;
    }
  }

  /**
   * Resume a process (SIGCONT)
   */
  async resumeProcess(pid, user = null) {
    const reqId = generateRequestId('proc_resume');

    await this.dse.authorizeAction(user, 'process:resume', { pid }, reqId);

    try {
      const result = await this.se.resumeProcess(pid, reqId);

      await this.dse.recordAuditEvent({
        user,
        action: 'process:resume',
        resource: pid,
        resource_id: pid,
        status: 'SUCCESS',
        request_id: reqId,
      }, reqId);

      return result;
    } catch (err) {
      await this.dse.recordAuditEvent({
        user,
        action: 'process:resume',
        resource: pid,
        resource_id: pid,
        status: 'FAILURE',
        request_id: reqId,
        details: { error: err.message },
      }, reqId).catch(() => {});
      throw err;
    }
  }

  /**
   * Flow D: Change process priority with authorization and auditing
   */
  async changePriority(pid, priority, user = null) {
    const reqId = generateRequestId('proc_prio');

    await this.dse.authorizeAction(user, 'process:priority', { pid, priority }, reqId);

    try {
      const result = await this.se.changePriority(pid, priority, reqId);

      await this.dse.recordAuditEvent({
        user,
        action: 'process:priority',
        resource: pid,
        resource_id: pid,
        status: 'SUCCESS',
        request_id: reqId,
        details: { priority: result.priority },
      }, reqId);

      return result;
    } catch (err) {
      await this.dse.recordAuditEvent({
        user,
        action: 'process:priority',
        resource: pid,
        resource_id: pid,
        status: 'FAILURE',
        request_id: reqId,
        details: { error: err.message },
      }, reqId).catch(() => {});
      throw err;
    }
  }
}

module.exports = new ProcessOrchestrator();
