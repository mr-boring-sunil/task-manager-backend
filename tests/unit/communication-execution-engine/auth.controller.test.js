/**
 * Authentication Controller Unit Tests
 * Raspberry Pi Task Manager — Unified Backend
 */

const authController = require('../../../engines/communication-execution-engine/controllers/auth.controller');
const securityAdapter = require('../../../engines/communication-execution-engine/adapters/security.adapter');
const dse = require('../../../engines/database-security-engine');

describe('Auth Controller Unit Tests', () => {
  let mockRes;
  let mockNext;

  beforeAll(async () => {
    await dse.init(':memory:');
  });

  afterAll(() => {
    dse.close();
  });

  beforeEach(() => {
    mockRes = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  test('login sets session cookie, csrf cookie, and returns user payload', async () => {
    const mockReq = {
      body: {
        username: 'pi',
        password: 'raspberry',
      },
      headers: {},
      ip: '127.0.0.1',
    };

    await authController.login(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.cookie).toHaveBeenCalledWith('taskmgr_session', expect.any(String), expect.objectContaining({
      httpOnly: true,
      path: '/',
    }));
    expect(mockRes.cookie).toHaveBeenCalledWith('taskmgr_csrf', expect.any(String), expect.objectContaining({
      httpOnly: false,
      path: '/',
    }));
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        user: expect.objectContaining({
          username: 'pi',
          role: 'admin',
        }),
      }),
    }));
  });

  test('login with invalid credentials calls next with UnauthorizedError', async () => {
    const mockReq = {
      body: {
        username: 'pi',
        password: 'incorrect_password',
      },
      headers: {},
      ip: '127.0.0.1',
    };

    await authController.login(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
  });

  test('logout clears cookies and returns authenticated: false', async () => {
    const mockReq = {
      cookies: { taskmgr_session: 'some_active_token' },
      headers: {},
      ip: '127.0.0.1',
    };

    await authController.logout(mockReq, mockRes, mockNext);

    expect(mockRes.clearCookie).toHaveBeenCalledWith('taskmgr_session', { path: '/' });
    expect(mockRes.clearCookie).toHaveBeenCalledWith('taskmgr_csrf', { path: '/' });
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: { authenticated: false },
    }));
  });
});
