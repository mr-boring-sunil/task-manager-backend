/**
 * End-to-End Metrics & Stream API Tests
 * Raspberry Pi Task Manager — Unified Backend
 */

const request = require('supertest');
const createApp = require('../../app');
const dse = require('../../engines/database-security-engine');
const se = require('../../engines/scheduling-engine');
const cee = require('../../engines/communication-execution-engine');
const si = require('systeminformation');
const {
  mockCurrentLoad,
  mockMem,
  mockFsSize,
  mockCpu,
  mockNetworkStats,
  mockNetworkInterfaces,
  mockCpuTemperatureAvailable,
  mockCpuTemperatureUnavailable,
} = require('../mocks/systeminformation.mock');

jest.mock('systeminformation');

describe('Metrics & SSE Stream End-to-End', () => {
  let app;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await dse.init(':memory:');
    await se.init();
    await cee.init(se.interface, dse.interface);
    app = createApp();
  });

  afterAll(() => {
    dse.close();
    cee.streamService.closeAll();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    si.currentLoad.mockResolvedValue(mockCurrentLoad);
    si.mem.mockResolvedValue(mockMem);
    si.fsSize.mockResolvedValue(mockFsSize);
    si.cpu.mockResolvedValue(mockCpu);
    si.networkStats.mockResolvedValue(mockNetworkStats);
    si.networkInterfaces.mockResolvedValue(mockNetworkInterfaces);
    si.cpuTemperature.mockResolvedValue(mockCpuTemperatureAvailable);
  });

  test('GET /api/v1/metrics/overview returns system overview', async () => {
    const res = await request(app).get('/api/v1/metrics/overview').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('cpuUtilization');
    expect(res.body.data).toHaveProperty('totalRam');
    expect(res.body.data).toHaveProperty('cpuTemperature', 48.5);
    expect(res.body.data).toHaveProperty('networkRxBytesPerSec', 2048);
    expect(res.body.data).toHaveProperty('networkTxBytesPerSec', 512);
  });

  test('GET /api/v1/metrics/cpu returns CPU core details', async () => {
    const res = await request(app).get('/api/v1/metrics/cpu').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('perCoreUtilization');
  });

  test('GET /api/v1/metrics/temperature reports unavailable when sensor is missing', async () => {
    si.cpuTemperature.mockResolvedValue(mockCpuTemperatureUnavailable);
    const res = await request(app).get('/api/v1/metrics/temperature').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.celsius).toBeNull();
    expect(res.body.data.status).toBe('unavailable');
  });

  test('GET /api/v1/stream/metrics establishes SSE stream with valid headers', (done) => {
    let completed = false;
    const safeDone = (err) => {
      if (!completed) {
        completed = true;
        done(err);
      }
    };

    const req = request(app)
      .get('/api/v1/stream/metrics')
      .expect('Content-Type', /text\/event-stream/)
      .expect('Cache-Control', /no-cache/)
      .expect('Connection', /keep-alive/)
      .expect(200);

    req.buffer(false).parse((res) => {
      res.on('data', (chunk) => {
        const text = chunk.toString();
        if (text.includes('event: connected') || text.includes('event: metrics')) {
          res.destroy();
          safeDone();
        }
      });
      res.on('error', () => {});
    });

    req.end((err) => {
      if (err) safeDone(err);
    });
  });

  test('GET /api/v1/stream/status reports active subscribers', async () => {
    const res = await request(app).get('/api/v1/stream/status').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('metricsClientsCount');
    expect(res.body.data).toHaveProperty('processesClientsCount');
  });
});
