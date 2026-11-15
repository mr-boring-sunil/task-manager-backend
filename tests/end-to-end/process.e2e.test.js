/**
 * End-to-End Process REST API Tests
 * Raspberry Pi Task Manager — Unified Backend
 */

const request = require('supertest');
const createApp = require('../../app');
const dse = require('../../engines/database-security-engine');
const se = require('../../engines/scheduling-engine');
const cee = require('../../engines/communication-execution-engine');
const si = require('systeminformation');
const { mockProcesses } = require('../mocks/systeminformation.mock');

jest.mock('systeminformation');

describe('Process REST API End-to-End', () => {
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
    si.processes.mockResolvedValue(mockProcesses);
  });

  describe('GET /health', () => {
    test('returns healthy status and uptime', async () => {
      const res = await request(app).get('/health').expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
    });
  });

  describe('GET /api/v1/processes', () => {
    test('returns process list and pagination metadata', async () => {
      const res = await request(app)
        .get('/api/v1/processes?limit=10&page=1')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('processes');
      expect(res.body.data).toHaveProperty('pagination');
      expect(res.body.data.processes.length).toBeGreaterThan(0);
    });

    test('filters by username query parameter', async () => {
      const res = await request(app)
        .get('/api/v1/processes?username=www-data')
        .expect(200);

      expect(res.body.data.processes).toHaveLength(1);
      expect(res.body.data.processes[0].username).toBe('www-data');
    });

    test('filters by state query parameter', async () => {
      const res = await request(app)
        .get('/api/v1/processes?state=running')
        .expect(200);

      expect(res.body.data.processes.every((p) => p.state === 'running')).toBe(true);
    });
  });

  describe('GET /api/v1/processes/:pid', () => {
    test('returns process details for valid existing PID', async () => {
      const res = await request(app).get('/api/v1/processes/1001').expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pid).toBe(1001);
      expect(res.body.data.name).toBe('node');
    });

    test('returns 422 for invalid non-integer PID', async () => {
      const res = await request(app).get('/api/v1/processes/invalid_pid').expect(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 404 for non-existent PID', async () => {
      const res = await request(app).get('/api/v1/processes/999999').expect(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROCESS_NOT_FOUND');
    });
  });

  describe('POST /api/v1/processes', () => {
    test('spawns permitted process from allowlist with 201 Created', async () => {
      const res = await request(app)
        .post('/api/v1/processes')
        .send({
          command: 'node',
          arguments: ['-v'],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('pid');
      expect(res.body.data.status).toBe('running');
    });

    test('returns 403 Forbidden for non-allowlisted command', async () => {
      const res = await request(app)
        .post('/api/v1/processes')
        .send({ command: 'disallowed_binary' })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('COMMAND_NOT_ALLOWED');
    });

    test('returns 422 for shell injection attempts', async () => {
      const res = await request(app)
        .post('/api/v1/processes')
        .send({ command: 'node; rm -rf /' })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/v1/processes/:pid', () => {
    test('returns 403 Forbidden when targeting protected PID 1', async () => {
      const res = await request(app).delete('/api/v1/processes/1').expect(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROTECTED_PROCESS');
    });

    test('returns 403 Forbidden when targeting server process.pid', async () => {
      const res = await request(app).delete(`/api/v1/processes/${process.pid}`).expect(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROTECTED_PROCESS');
    });
  });

  describe('PATCH /api/v1/processes/:pid/priority', () => {
    test('returns 422 when priority is out of range', async () => {
      const res = await request(app)
        .patch('/api/v1/processes/1001/priority')
        .send({ priority: 30 })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
