/**
 * End-to-End Process REST API Tests
 * Raspberry Pi Task Manager — Unified Backend
 */

// ⚠ Set env vars BEFORE any require() so security.config.js reads the correct values.
// Disabling devMode ensures unauthenticated requests correctly return 401.
process.env.SECURITY_DEV_MODE = 'false';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const createApp = require('../../app');
const dse = require('../../engines/database-security-engine');
const se = require('../../engines/scheduling-engine');
const cee = require('../../engines/communication-execution-engine');
const si = require('systeminformation');
const { mockProcesses } = require('../mocks/systeminformation.mock');

jest.mock('systeminformation');

// The default dev API key (from security.config.js)
const TEST_API_KEY = 'dev-task-manager-key-change-in-production';

describe('Process REST API End-to-End', () => {
  let app;

  beforeAll(async () => {
    // env vars set at module top (before require) so security.config picks them up.
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
    // BUG FIX: Authenticated routes require an API key header.
    // Previously these tests sent no credentials and received 401 instead of the
    // expected 201/403/422 responses, causing the entire create-process test suite to fail.

    test('returns 401 Unauthorized when no credentials are provided', async () => {
      const res = await request(app)
        .post('/api/v1/processes')
        .send({ command: 'node', arguments: ['-v'] })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    test('spawns permitted process from allowlist with 201 Created', async () => {
      const res = await request(app)
        .post('/api/v1/processes')
        .set('x-api-key', TEST_API_KEY)
        .send({
          command: 'node',
          arguments: ['-v'],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('pid');
      expect(res.body.data.status).toBe('running');
    });

    test('spawns process without workingDirectory (omitting invalid default path)', async () => {
      // BUG FIX: Sending an empty / absent workingDirectory must succeed.
      // The old CreateProcessDialog default of '/home/pi' caused validateCwd() to
      // throw ValidationError("Working directory does not exist") on non-Pi hosts.
      const res = await request(app)
        .post('/api/v1/processes')
        .set('x-api-key', TEST_API_KEY)
        .send({ command: 'node' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('pid');
      expect(res.body.data.name).toBe('node');
    });

    test('passes arguments array correctly to spawn', async () => {
      const res = await request(app)
        .post('/api/v1/processes')
        .set('x-api-key', TEST_API_KEY)
        .send({ command: 'node', arguments: ['-e', 'console.log(1)'] })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.command).toContain('node');
    });

    test('returns 403 Forbidden for non-allowlisted command', async () => {
      const res = await request(app)
        .post('/api/v1/processes')
        .set('x-api-key', TEST_API_KEY)
        .send({ command: 'disallowed_binary' })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('COMMAND_NOT_ALLOWED');
    });

    test('returns 422 for shell injection attempts', async () => {
      const res = await request(app)
        .post('/api/v1/processes')
        .set('x-api-key', TEST_API_KEY)
        .send({ command: 'node; rm -rf /' })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 422 when command field is missing', async () => {
      const res = await request(app)
        .post('/api/v1/processes')
        .set('x-api-key', TEST_API_KEY)
        .send({ arguments: ['-v'] })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 422 when arguments contain null bytes (control characters)', async () => {
      const res = await request(app)
        .post('/api/v1/processes')
        .set('x-api-key', TEST_API_KEY)
        .send({ command: 'node', arguments: ['arg\0injected'] })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 4xx when workingDirectory does not exist or is outside allowed dirs', async () => {
      // On Linux/Pi:  validateCwd → fs.existsSync fails → ValidationError → 422
      // On Windows:   allowedDirs check fires first (path not in [/home/pi, /tmp, …]) → ForbiddenError → 403
      // Both are correct rejections of an invalid path.
      const res = await request(app)
        .post('/api/v1/processes')
        .set('x-api-key', TEST_API_KEY)
        .send({ command: 'node', workingDirectory: '/this/path/does/not/exist/at/all' });

      expect([403, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/processes/:pid', () => {
    test('returns 401 Unauthorized when no credentials are provided', async () => {
      const res = await request(app).delete('/api/v1/processes/1001').expect(401);
      expect(res.body.success).toBe(false);
    });

    test('returns 403 Forbidden when targeting protected PID 1', async () => {
      const res = await request(app)
        .delete('/api/v1/processes/1')
        .set('x-api-key', TEST_API_KEY)
        .expect(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROTECTED_PROCESS');
    });

    test('returns 403 Forbidden when targeting server process.pid', async () => {
      const res = await request(app)
        .delete(`/api/v1/processes/${process.pid}`)
        .set('x-api-key', TEST_API_KEY)
        .expect(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROTECTED_PROCESS');
    });
  });

  describe('PATCH /api/v1/processes/:pid/priority', () => {
    test('returns 401 Unauthorized when no credentials are provided', async () => {
      const res = await request(app)
        .patch('/api/v1/processes/1001/priority')
        .send({ priority: 5 })
        .expect(401);
      expect(res.body.success).toBe(false);
    });

    test('returns 422 when priority is out of range', async () => {
      const res = await request(app)
        .patch('/api/v1/processes/1001/priority')
        .set('x-api-key', TEST_API_KEY)
        .send({ priority: 30 })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/processes/users and activeUsers metadata', () => {
    test('GET /api/v1/processes includes users array in data', async () => {
      const res = await request(app)
        .get('/api/v1/processes?limit=10&page=1')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(res.body.data.users.length).toBeGreaterThan(0);
    });

    test('GET /api/v1/processes/users returns distinct active system users', async () => {
      const res = await request(app)
        .get('/api/v1/processes/users')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(res.body.data.users.length).toBeGreaterThan(0);
    });
  });
});
