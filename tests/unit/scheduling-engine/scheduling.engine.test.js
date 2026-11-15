/**
 * Scheduling Engine Unit Tests
 * Raspberry Pi Task Manager — Unified Backend
 */

const se = require('../../../engines/scheduling-engine');
const si = require('systeminformation');
const {
  mockProcesses,
  mockCurrentLoad,
  mockMem,
  mockFsSize,
  mockCpu,
  mockNetworkStats,
  mockNetworkInterfaces,
  mockCpuTemperatureAvailable,
  mockCpuTemperatureUnavailable,
} = require('../../mocks/systeminformation.mock');
const { ValidationError, ForbiddenError, NotFoundError } = require('../../../shared/errors/AppError');

jest.mock('systeminformation');

describe('Scheduling Engine Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    si.processes.mockResolvedValue(mockProcesses);
    si.currentLoad.mockResolvedValue(mockCurrentLoad);
    si.mem.mockResolvedValue(mockMem);
    si.fsSize.mockResolvedValue(mockFsSize);
    si.cpu.mockResolvedValue(mockCpu);
    si.networkStats.mockResolvedValue(mockNetworkStats);
    si.networkInterfaces.mockResolvedValue(mockNetworkInterfaces);
    si.cpuTemperature.mockResolvedValue(mockCpuTemperatureAvailable);
  });

  describe('Process List & Inspection', () => {
    test('listProcesses returns paginated and formatted process list', async () => {
      const result = await se.listProcesses({ page: 1, limit: 10 });
      expect(result).toHaveProperty('processes');
      expect(result).toHaveProperty('pagination');
      expect(result.processes.length).toBeGreaterThan(0);
      expect(result.processes[0]).toHaveProperty('pid');
      expect(result.processes[0]).toHaveProperty('name');
      expect(result.processes[0]).toHaveProperty('state');
    });

    test('listProcesses filters by username', async () => {
      const result = await se.listProcesses({ username: 'www-data' });
      expect(result.processes).toHaveLength(1);
      expect(result.processes[0].username).toBe('www-data');
    });

    test('getProcess returns process details for valid existing PID', async () => {
      const proc = await se.getProcess(1001);
      expect(proc.pid).toBe(1001);
      expect(proc.name).toBe('node');
    });

    test('getProcess throws NotFoundError for non-existent PID', async () => {
      await expect(se.getProcess(999999)).rejects.toThrow(NotFoundError);
    });

    test('getProcess throws ValidationError for invalid non-integer PID', async () => {
      await expect(se.getProcess('not-a-number')).rejects.toThrow(ValidationError);
    });
  });

  describe('Process Creation & Security Allowlist', () => {
    test('createProcess spawns permitted executable from allowlist', async () => {
      const result = await se.createProcess({ command: 'node', args: ['-v'] });
      expect(result).toHaveProperty('pid');
      expect(result.status).toBe('running');
    });

    test('createProcess rejects non-allowlisted command with ForbiddenError', async () => {
      await expect(se.createProcess({ command: 'forbidden_binary' })).rejects.toThrow(ForbiddenError);
    });

    test('createProcess rejects shell injection operators with ValidationError', async () => {
      await expect(se.createProcess({ command: 'node; rm -rf /' })).rejects.toThrow(ValidationError);
    });

    test('createProcess rejects invalid arguments containing control characters', async () => {
      await expect(
        se.createProcess({ command: 'node', args: ['arg1\0injected'] })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Protected PID Handling & Termination', () => {
    test('terminateProcess rejects terminating PID 1 with ForbiddenError', async () => {
      await expect(se.terminateProcess(1)).rejects.toThrow(ForbiddenError);
    });

    test('terminateProcess rejects terminating current server PID with ForbiddenError', async () => {
      await expect(se.terminateProcess(process.pid)).rejects.toThrow(ForbiddenError);
    });

    test('pauseProcess and resumeProcess validate PID', async () => {
      await expect(se.pauseProcess(1)).rejects.toThrow(ForbiddenError);
      await expect(se.resumeProcess(1)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('Priority Management', () => {
    test('changePriority rejects out-of-bounds priority with ValidationError', async () => {
      await expect(se.changePriority(1001, 25)).rejects.toThrow(ValidationError);
      await expect(se.changePriority(1001, -30)).rejects.toThrow(ValidationError);
    });

    test('changePriority rejects missing priority with ValidationError', async () => {
      await expect(se.changePriority(1001, null)).rejects.toThrow(ValidationError);
    });
  });

  describe('System Telemetry Collection', () => {
    test('getSystemMetrics returns comprehensive overview', async () => {
      const overview = await se.getSystemMetrics();
      expect(overview).toHaveProperty('cpuUtilization');
      expect(overview).toHaveProperty('totalRam');
      expect(overview).toHaveProperty('usedRam');
      expect(overview).toHaveProperty('availableRam');
      expect(overview).toHaveProperty('diskTotal');
      expect(overview).toHaveProperty('cpuTemperature', 48.5);
      expect(overview).toHaveProperty('cpuTemperatureStatus', 'available');
      expect(overview).toHaveProperty('systemUptime');
    });

    test('getTemperatureMetrics accurately marks missing sensor as unavailable (not fabricated)', async () => {
      si.cpuTemperature.mockResolvedValue(mockCpuTemperatureUnavailable);
      const temp = await se.getTemperatureMetrics();
      expect(temp.status).toBe('unavailable');
      expect(temp.celsius).toBeNull();
    });

    test('getCpuMetrics returns per-core load and model', async () => {
      const cpu = await se.getCpuMetrics();
      expect(cpu).toHaveProperty('overallCpuUtilization');
      expect(cpu).toHaveProperty('perCoreUtilization');
      expect(cpu.perCoreUtilization).toHaveLength(4);
    });

    test('getMemoryMetrics, getDiskMetrics, getNetworkMetrics return valid arrays', async () => {
      const mem = await se.getMemoryMetrics();
      const disk = await se.getDiskMetrics();
      const net = await se.getNetworkMetrics();

      expect(mem.total).toBe(1073741824);
      expect(Array.isArray(disk)).toBe(true);
      expect(Array.isArray(net)).toBe(true);
    });
  });
});
