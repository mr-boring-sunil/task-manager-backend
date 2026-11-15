/**
 * Database & Security Engine Unit Tests
 * Raspberry Pi Task Manager — Unified Backend
 */

const dse = require('../../../engines/database-security-engine');
const { ConflictError, UnauthorizedError, ForbiddenError } = require('../../../shared/errors/AppError');

describe('Database & Security Engine Unit Tests', () => {
  beforeAll(async () => {
    // Connect to in-memory SQLite database for test isolation
    await dse.init(':memory:');
  });

  afterAll(() => {
    dse.close();
  });

  describe('User Management & Password Hashing', () => {
    test('creates user with salted hash and does not store plaintext password', async () => {
      const user = await dse.createUser({
        username: 'testuser',
        password: 'securePassword123',
        role: 'standard',
      });

      expect(user).toHaveProperty('id');
      expect(user.username).toBe('testuser');
      expect(user.role).toBe('standard');
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('password_hash');
    });

    test('rejects duplicate username with ConflictError', async () => {
      await expect(
        dse.createUser({
          username: 'testuser',
          password: 'anotherPassword123',
        })
      ).rejects.toThrow(ConflictError);
    });

    test('authenticates valid credentials successfully', async () => {
      const authResult = await dse.authenticateUser({
        username: 'testuser',
        password: 'securePassword123',
      });

      expect(authResult).toHaveProperty('user');
      expect(authResult.user.username).toBe('testuser');
      expect(authResult).toHaveProperty('token');
      expect(typeof authResult.token).toBe('string');
    });

    test('rejects invalid password with UnauthorizedError', async () => {
      await expect(
        dse.authenticateUser({
          username: 'testuser',
          password: 'wrongPassword!',
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    test('rejects non-existent username with UnauthorizedError', async () => {
      await expect(
        dse.authenticateUser({
          username: 'nonexistent',
          password: 'password123',
        })
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('RBAC Authorization', () => {
    test('authorizes admin role for any action', async () => {
      const admin = { id: 'admin-1', username: 'admin', role: 'admin' };
      const allowed = await dse.authorizeAction(admin, 'process:terminate', { pid: 1050 });
      expect(allowed).toBe(true);
    });

    test('permits viewer role only for read operations', async () => {
      const viewer = { id: 'v-1', username: 'guest', role: 'viewer' };

      expect(await dse.authorizeAction(viewer, 'metrics:read', null)).toBe(true);
      await expect(dse.authorizeAction(viewer, 'process:terminate', { pid: 1050 })).rejects.toThrow(ForbiddenError);
    });

    test('rejects action on protected PID 1 with ForbiddenError', async () => {
      const admin = { id: 'admin-1', username: 'admin', role: 'admin' };
      await expect(dse.authorizeAction(admin, 'process:terminate', { pid: 1 })).rejects.toThrow(ForbiddenError);
    });
  });

  describe('Audit Logging', () => {
    test('persists audit event and redacts secrets from details', async () => {
      const event = {
        username: 'testuser',
        action: 'process:create',
        resource: 'python3',
        status: 'SUCCESS',
        details: {
          command: 'python3',
          password: 'should_be_redacted',
          apiKey: 'secret_key',
        },
      };

      const saved = await dse.recordAuditEvent(event);
      expect(saved).toHaveProperty('id');
      expect(saved.action).toBe('process:create');

      const logs = await dse.getAuditLogs(10);
      expect(logs.length).toBeGreaterThan(0);

      const parsedDetails = JSON.parse(logs[0].details);
      expect(parsedDetails.password).toBe('[REDACTED]');
      expect(parsedDetails.apiKey).toBe('[REDACTED]');
      expect(parsedDetails.command).toBe('python3');
    });
  });
});
