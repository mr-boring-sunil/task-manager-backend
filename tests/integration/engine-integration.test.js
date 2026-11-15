/**
 * Engine Integration Tests
 * Verifies direct function call communication, interaction logging,
 * authorization checks, and audit logging across CEE, SE, and DSE.
 * Raspberry Pi Task Manager — Unified Backend
 */

const dse = require('../../engines/database-security-engine');
const se = require('../../engines/scheduling-engine');
const cee = require('../../engines/communication-execution-engine');
const interactionLogger = require('../../shared/logger/interactionLogger');
const si = require('systeminformation');
const { mockProcesses } = require('../mocks/systeminformation.mock');

jest.mock('systeminformation');

describe('Cross-Engine Integration Tests', () => {
  let logSpy;

  beforeAll(async () => {
    // 1. Initialise DSE with in-memory database
    await dse.init(':memory:');

    // 2. Initialise SE
    await se.init();

    // 3. Initialise CEE with SE and DSE injected
    await cee.init(se.interface, dse.interface);

    // Enable interaction logs for testing
    process.env.ENABLE_TEST_LOGS = 'true';
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    logSpy.mockRestore();
    delete process.env.ENABLE_TEST_LOGS;
    dse.close();
    cee.streamService.closeAll();
  });

  beforeEach(() => {
    logSpy.mockClear();
    si.processes.mockResolvedValue(mockProcesses);
  });

  test('CEE communicates with SE to list processes with interaction logging [CEE -> SE] and [SE -> CEE]', async () => {
    const result = await cee.schedulingAdapter.listProcesses({ limit: 5 });

    expect(result).toHaveProperty('processes');
    expect(result.processes.length).toBeGreaterThan(0);

    // Verify interaction logs
    const loggedCalls = logSpy.mock.calls.map((call) => call[0]);
    const requestLog = loggedCalls.find((text) => text.includes('[CEE -> SE]') && text.includes('[REQUEST]'));
    const responseLog = loggedCalls.find((text) => text.includes('[SE -> CEE]') && text.includes('[RESPONSE]'));

    expect(requestLog).toBeDefined();
    expect(requestLog).toContain('Operation: listProcesses');
    expect(responseLog).toBeDefined();
    expect(responseLog).toContain('Status: Success');
  });

  test('CEE communicates with DSE to authenticate user with interaction logging [CEE -> DSE] and [DSE -> CEE]', async () => {
    const mockReq = {
      headers: {
        'x-api-key': 'dev-task-manager-key-change-in-production',
      },
    };

    const user = await cee.securityAdapter.authenticateUser(mockReq);
    expect(user.role).toBe('admin');

    const loggedCalls = logSpy.mock.calls.map((call) => call[0]);
    const requestLog = loggedCalls.find((text) => text.includes('[CEE -> DSE]') && text.includes('[REQUEST]'));
    const responseLog = loggedCalls.find((text) => text.includes('[DSE -> CEE]') && text.includes('[RESPONSE]'));

    expect(requestLog).toBeDefined();
    expect(requestLog).toContain('Operation: authenticateUser');
    expect(responseLog).toBeDefined();
    expect(responseLog).toContain('Status: Success');
  });

  test('Full Cross-Engine Flow: Create Process (DSE Authorize -> SE Spawn -> DSE Audit)', async () => {
    const adminUser = { id: 'admin-1', username: 'admin', role: 'admin' };
    const processOrchestrator = require('../../engines/communication-execution-engine/orchestrators/process.orchestrator');

    const created = await processOrchestrator.createProcess({ command: 'node', args: ['-v'] }, adminUser);

    expect(created).toHaveProperty('pid');
    expect(created.status).toBe('running');

    // Verify Audit log in DSE
    const auditLogs = await dse.getAuditLogs(1);
    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0].action).toBe('process:create');
    expect(auditLogs[0].username).toBe('admin');
  });

  test('Inter-engine error produces [ERROR] log and does not crash server', async () => {
    const adminUser = { id: 'admin-1', username: 'admin', role: 'admin' };
    const processOrchestrator = require('../../engines/communication-execution-engine/orchestrators/process.orchestrator');

    // Attempting to terminate protected PID 1 (blocked by DSE authorization)
    await expect(
      processOrchestrator.terminateProcess(1, 'SIGTERM', adminUser)
    ).rejects.toThrow();

    let loggedCalls = logSpy.mock.calls.map((call) => call[0]);
    const dseErrorLog = loggedCalls.find((text) => text.includes('[ERROR]') && text.includes('authorizeAction'));

    expect(dseErrorLog).toBeDefined();
    expect(dseErrorLog).toContain('PROTECTED_PROCESS');

    // SE error logging directly via scheduling adapter
    await expect(
      cee.schedulingAdapter.getProcess(999999)
    ).rejects.toThrow();

    loggedCalls = logSpy.mock.calls.map((call) => call[0]);
    const seErrorLog = loggedCalls.find((text) => text.includes('[SE -> CEE]') && text.includes('[ERROR]') && text.includes('getProcess'));

    expect(seErrorLog).toBeDefined();
    expect(seErrorLog).toContain('PROCESS_NOT_FOUND');
  });
});
