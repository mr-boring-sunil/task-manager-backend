/**
 * Authentication REST API End-to-End Tests
 * Tests login, session validation, /me, and logout.
 * Raspberry Pi Task Manager — Unified Backend
 */

const request = require('supertest');
const createApp = require('../../app');
const dse = require('../../engines/database-security-engine');
const se = require('../../engines/scheduling-engine');
const cee = require('../../engines/communication-execution-engine');

describe('Auth REST API End-to-End Tests', () => {
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

  describe('POST /api/v1/auth/login', () => {
    test('authenticates valid credentials and sets HttpOnly session cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'pi', password: 'raspberry' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.username).toBe('pi');
      expect(res.body.data.user.role).toBe('admin');
      expect(res.body.data.session.authenticated).toBe(true);
      expect(res.body.data.csrfToken).toBeDefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const sessionCookie = cookies.find((c) => c.startsWith('taskmgr_session='));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
    });

    test('rejects invalid password with 401 Unauthorized without leaking details', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'pi', password: 'wrongpassword' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid username or password');
    });
  });

  describe('GET /api/v1/auth/session & /me', () => {
    test('validates active session and retrieves user permissions', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'pi', password: 'raspberry' });

      const cookies = loginRes.headers['set-cookie'];

      const sessionRes = await request(app)
        .get('/api/v1/auth/session')
        .set('Cookie', cookies)
        .expect(200);

      expect(sessionRes.body.success).toBe(true);
      expect(sessionRes.body.data.authenticated).toBe(true);
      expect(sessionRes.body.data.user.username).toBe('pi');

      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', cookies)
        .expect(200);

      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.username).toBe('pi');
      expect(meRes.body.data.role).toBe('admin');
      expect(meRes.body.data.permissions).toContain('process.terminate');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    test('revokes session and clears cookies', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'pi', password: 'raspberry' });

      const cookies = loginRes.headers['set-cookie'];

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', cookies)
        .expect(200);

      expect(logoutRes.body.success).toBe(true);
      expect(logoutRes.body.data.authenticated).toBe(false);

      // Session is now revoked, subsequent session check fails
      await request(app)
        .get('/api/v1/auth/session')
        .set('Cookie', cookies)
        .expect(401);
    });
  });
});
