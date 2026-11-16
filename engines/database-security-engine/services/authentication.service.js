/**
 * Authentication Business Service
 * Orchestrates Linux PAM credential verification, session creation, and audit recording.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const pamAdapter = require('../adapters/pamAuthenticationAdapter');
const sessionService = require('./session.service');
const auditService = require('../audit/audit.service');
const { dseLogger } = require('../../../shared/logger/engineLogger');
const { UnauthorizedError } = require('../../../shared/errors/AppError');
const { ERROR_CODES } = require('../../../shared/errors/errorCodes');

class AuthenticationService {
  /**
   * Authenticate Linux user credentials and create an application session
   * @param {string} username - Linux username
   * @param {string} password - Linux password
   * @param {object} [meta] - Client request metadata { ip, userAgent, requestId }
   */
  async login(username, password, meta = {}) {
    dseLogger.info('[DSE] Authentication service invoked');

    try {
      // 1. Authenticate via Linux PAM adapter
      const authResult = await pamAdapter.authenticate(username, password);

      // 2. Establish secure application session
      const { token, csrfToken, session } = await sessionService.createSession(
        authResult.username,
        meta
      );

      // 3. Record successful login in persistent SQLite audit log
      await auditService.recordAuditEvent({
        username: authResult.username,
        action: 'auth:login',
        status: 'SUCCESS',
        ip_address: meta.ip || '127.0.0.1',
        request_id: meta.requestId || null,
        details: {
          authMethod: 'PAM',
          role: session.role,
        },
      });

      return {
        token,
        csrfToken,
        user: {
          username: authResult.username,
          role: session.role,
        },
        session,
      };
    } catch (err) {
      // Record failed login audit event (never recording password or secret)
      await auditService.recordAuditEvent({
        username: username || 'unknown',
        action: 'auth:login',
        status: 'FAILURE',
        ip_address: meta.ip || '127.0.0.1',
        request_id: meta.requestId || null,
        details: {
          authMethod: 'PAM',
          reason: 'Authentication rejected',
        },
      });

      if (err.statusCode && err.statusCode < 500) {
        throw new UnauthorizedError('Invalid username or password', ERROR_CODES.INVALID_CREDENTIALS);
      }
      throw err;
    }
  }

  /**
   * Validate current session token
   * @param {string} token
   */
  async validateSession(token) {
    return sessionService.validateSession(token);
  }

  /**
   * Revoke active session (Logout)
   * @param {string} token
   * @param {object} [meta]
   */
  async logout(token, meta = {}) {
    dseLogger.info('[DSE] Logout invoked');

    let username = 'anonymous';
    try {
      const activeSession = await sessionService.validateSession(token);
      username = activeSession.username;
    } catch (e) {
      // Session might already be expired
    }

    const revoked = await sessionService.revokeSession(token);

    await auditService.recordAuditEvent({
      username,
      action: 'auth:logout',
      status: 'SUCCESS',
      ip_address: meta.ip || '127.0.0.1',
      request_id: meta.requestId || null,
      details: { revoked },
    });

    return { revoked };
  }
}

module.exports = new AuthenticationService();
