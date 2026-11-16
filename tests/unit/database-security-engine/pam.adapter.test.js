/**
 * Linux PAM Authentication Adapter Unit Tests
 * Raspberry Pi Task Manager — Unified Backend
 */

const pamAdapter = require('../../../engines/database-security-engine/adapters/pamAuthenticationAdapter');
const { UnauthorizedError } = require('../../../shared/errors/AppError');

describe('PAM Authentication Adapter Unit Tests', () => {
  beforeEach(() => {
    pamAdapter.setTestHandler(null);
  });

  test('rejects empty or missing credentials', async () => {
    await expect(pamAdapter.authenticate('', 'password')).rejects.toThrow(UnauthorizedError);
    await expect(pamAdapter.authenticate('pi', '')).rejects.toThrow(UnauthorizedError);
    await expect(pamAdapter.authenticate(null, null)).rejects.toThrow(UnauthorizedError);
  });

  test('authenticates valid credentials via registered test handler', async () => {
    pamAdapter.setTestHandler(async (user, pass) => {
      return user === 'testpi' && pass === 'validpass123';
    });

    const result = await pamAdapter.authenticate('testpi', 'validpass123');
    expect(result.success).toBe(true);
    expect(result.username).toBe('testpi');
  });

  test('rejects invalid password via test handler with generic UnauthorizedError', async () => {
    pamAdapter.setTestHandler(async (user, pass) => {
      return user === 'testpi' && pass === 'correct';
    });

    await expect(pamAdapter.authenticate('testpi', 'wrongpass')).rejects.toThrow(UnauthorizedError);
  });

  test('authenticates standard dev accounts in non-Linux test mode when no test handler set', async () => {
    const result = await pamAdapter.authenticate('pi', 'raspberry');
    expect(result.success).toBe(true);
    expect(result.username).toBe('pi');
  });

  test('rejects non-existent account with generic UnauthorizedError without leaking user existence', async () => {
    await expect(pamAdapter.authenticate('nonexistent_user', 'somepass')).rejects.toThrow(UnauthorizedError);
  });
});
