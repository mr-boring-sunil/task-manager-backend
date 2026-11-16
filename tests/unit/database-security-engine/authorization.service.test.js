/**
 * Authorization & Permission Matrix Unit Tests
 * Raspberry Pi Task Manager — Unified Backend
 */

const authorizationService = require('../../../engines/database-security-engine/services/authorization.service');
const { ForbiddenError, UnauthorizedError } = require('../../../shared/errors/AppError');

describe('Authorization Service Unit Tests', () => {
  const adminUser = { username: 'pi', role: 'admin' };
  const standardUser = { username: 'john', role: 'standard' };

  test('admin user possesses all permissions', async () => {
    expect(authorizationService.hasPermission('admin', 'system.read')).toBe(true);
    expect(authorizationService.hasPermission('admin', 'process.read')).toBe(true);
    expect(authorizationService.hasPermission('admin', 'process.create')).toBe(true);
    expect(authorizationService.hasPermission('admin', 'process.terminate')).toBe(true);
    expect(authorizationService.hasPermission('admin', 'process.pause')).toBe(true);
    expect(authorizationService.hasPermission('admin', 'process.resume')).toBe(true);
    expect(authorizationService.hasPermission('admin', 'process.priority')).toBe(true);
    expect(authorizationService.hasPermission('admin', 'user.manage')).toBe(true);
    expect(authorizationService.hasPermission('admin', 'role.manage')).toBe(true);

    await expect(authorizationService.authorizeAction(adminUser, 'process.terminate', 500)).resolves.toBe(true);
  });

  test('standard user has read-only permissions and cannot mutate processes or manage users', async () => {
    // Permitted
    expect(authorizationService.hasPermission('standard', 'system.read')).toBe(true);
    expect(authorizationService.hasPermission('standard', 'process.read')).toBe(true);
    await expect(authorizationService.authorizeAction(standardUser, 'system.read')).resolves.toBe(true);
    await expect(authorizationService.authorizeAction(standardUser, 'process.read')).resolves.toBe(true);

    // Forbidden
    expect(authorizationService.hasPermission('standard', 'process.create')).toBe(false);
    expect(authorizationService.hasPermission('standard', 'process.terminate')).toBe(false);
    expect(authorizationService.hasPermission('standard', 'process.pause')).toBe(false);
    expect(authorizationService.hasPermission('standard', 'process.resume')).toBe(false);
    expect(authorizationService.hasPermission('standard', 'process.priority')).toBe(false);
    expect(authorizationService.hasPermission('standard', 'user.manage')).toBe(false);

    await expect(authorizationService.authorizeAction(standardUser, 'process.terminate', 500)).rejects.toThrow(ForbiddenError);
    await expect(authorizationService.authorizeAction(standardUser, 'process.create')).rejects.toThrow(ForbiddenError);
    await expect(authorizationService.authorizeAction(standardUser, 'process.priority', 500)).rejects.toThrow(ForbiddenError);
  });

  test('rejects operation on protected PID 1 even for admin', async () => {
    await expect(
      authorizationService.authorizeAction(adminUser, 'process.terminate', 1)
    ).rejects.toThrow(ForbiddenError);
  });

  test('unauthenticated context throws UnauthorizedError', async () => {
    await expect(
      authorizationService.authorizeAction(null, 'process.read')
    ).rejects.toThrow(UnauthorizedError);
  });
});
