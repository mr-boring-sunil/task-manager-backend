/**
 * Session Service Unit Tests
 * Raspberry Pi Task Manager — Unified Backend
 */

const dse = require('../../../engines/database-security-engine');
const sessionService = require('../../../engines/database-security-engine/services/session.service');
const sessionRepo = require('../../../engines/database-security-engine/database/repositories/session.repository');
const { UnauthorizedError } = require('../../../shared/errors/AppError');

describe('Session Service Unit Tests', () => {
  beforeAll(async () => {
    await dse.init(':memory:');
  });

  afterAll(() => {
    dse.close();
  });

  test('creates session with opaque token and stores only SHA-256 hash in database', async () => {
    const { token, csrfToken, session } = await sessionService.createSession('sunil', {
      ip: '192.168.1.50',
      userAgent: 'Mozilla/5.0',
    });

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBe(64); // 32 bytes hex
    expect(csrfToken).toBeDefined();
    expect(session.username).toBe('sunil');
    expect(session.role).toBe('standard');

    // Verify database record has hashed token, NOT plaintext token
    const tokenHash = sessionService.hashToken(token);
    const dbRecord = sessionRepo.findByTokenHash(tokenHash);
    expect(dbRecord).toBeDefined();
    expect(dbRecord.session_token_hash).toBe(tokenHash);
    expect(dbRecord.session_token_hash).not.toBe(token);
    expect(dbRecord.csrf_token).toBe(csrfToken);
  });

  test('validates active session successfully', async () => {
    const { token, session } = await sessionService.createSession('admin');
    const validated = await sessionService.validateSession(token);

    expect(validated.username).toBe('admin');
    expect(validated.role).toBe('admin');
    expect(validated.id).toBe(session.id);
  });

  test('rejects non-existent or invalid session token', async () => {
    await expect(sessionService.validateSession('invalid_token_12345')).rejects.toThrow(
      UnauthorizedError
    );
  });

  test('rejects and revokes session on logout', async () => {
    const { token } = await sessionService.createSession('pi');
    const validatedBefore = await sessionService.validateSession(token);
    expect(validatedBefore.username).toBe('pi');

    const revoked = await sessionService.revokeSession(token);
    expect(revoked).toBe(true);

    await expect(sessionService.validateSession(token)).rejects.toThrow(UnauthorizedError);
  });

  test('rejects expired session', async () => {
    const { token, session } = await sessionService.createSession('expiring_user');
    const pastDate = new Date(Date.now() - 10000).toISOString();

    // Manually force expiration timestamp to past
    sessionRepo.updateLastActivity(session.id, pastDate);

    await expect(sessionService.validateSession(token)).rejects.toThrow(UnauthorizedError);
  });
});
