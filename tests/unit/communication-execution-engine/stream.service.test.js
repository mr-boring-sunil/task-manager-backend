/**
 * Stream Service Unit Tests (SSE)
 * Raspberry Pi Task Manager — Unified Backend
 */

const streamService = require('../../../engines/communication-execution-engine/services/stream.service');
const si = require('systeminformation');
const {
  mockProcesses,
  mockCurrentLoad,
  mockMem,
  mockFsSize,
  mockCpuTemperatureAvailable,
} = require('../../mocks/systeminformation.mock');
const EventEmitter = require('events');

jest.mock('systeminformation');

describe('StreamService Unit Tests', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    si.processes.mockResolvedValue(mockProcesses);
    si.currentLoad.mockResolvedValue(mockCurrentLoad);
    si.mem.mockResolvedValue(mockMem);
    si.fsSize.mockResolvedValue(mockFsSize);
    si.cpuTemperature.mockResolvedValue(mockCpuTemperatureAvailable);

    mockReq = new EventEmitter();
    mockReq.ip = '127.0.0.1';
    mockReq.socket = { remoteAddress: '127.0.0.1' };

    mockRes = new EventEmitter();
    mockRes.writeHead = jest.fn();
    mockRes.write = jest.fn();
    mockRes.end = jest.fn();
    mockRes.flushHeaders = jest.fn();
    mockRes.writableEnded = false;
  });

  afterEach(() => {
    streamService.closeAll();
  });

  test('registers client, sets SSE headers and dispatches initial connection event', () => {
    const client = streamService.registerClient('metrics', mockReq, mockRes);

    expect(client).toBeDefined();
    expect(mockRes.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      })
    );

    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('event: connected'));
  });

  test('shared polling loop starts on first client and stops on disconnection', () => {
    const channel = streamService.channels.metrics;
    expect(channel.intervalTimer).toBeNull();

    streamService.registerClient('metrics', mockReq, mockRes);
    expect(channel.clients.size).toBe(1);
    expect(channel.intervalTimer).not.toBeNull();

    mockReq.emit('close');
    expect(channel.clients.size).toBe(0);
    expect(channel.intervalTimer).toBeNull();
  });

  test('multiple clients share the single polling loop', () => {
    const channel = streamService.channels.metrics;

    const mockReq2 = new EventEmitter();
    mockReq2.ip = '127.0.0.2';
    mockReq2.socket = { remoteAddress: '127.0.0.2' };
    const mockRes2 = new EventEmitter();
    mockRes2.writeHead = jest.fn();
    mockRes2.write = jest.fn();
    mockRes2.end = jest.fn();
    mockRes2.writableEnded = false;

    streamService.registerClient('metrics', mockReq, mockRes);
    streamService.registerClient('metrics', mockReq2, mockRes2);

    expect(channel.clients.size).toBe(2);

    streamService.broadcast('metrics', 'testEvent', { hello: 'world' });

    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('event: testEvent'));
    expect(mockRes2.write).toHaveBeenCalledWith(expect.stringContaining('event: testEvent'));

    mockReq.emit('close');
    expect(channel.clients.size).toBe(1);
    expect(channel.intervalTimer).not.toBeNull();

    mockReq2.emit('close');
    expect(channel.clients.size).toBe(0);
    expect(channel.intervalTimer).toBeNull();
  });

  test('closeAll terminates all active connections and clears timers', () => {
    streamService.registerClient('metrics', mockReq, mockRes);
    expect(streamService.channels.metrics.clients.size).toBe(1);

    streamService.closeAll();

    expect(streamService.channels.metrics.clients.size).toBe(0);
    expect(mockRes.end).toHaveBeenCalled();
  });
});
