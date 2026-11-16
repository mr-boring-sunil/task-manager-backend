/**
 * Session Management Service
 * Manages cryptographically secure random opaque session tokens,
 * hashed SQLite storage, session expiration, and session revocation.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const crypto = require('crypto');
const sessionRepo = require('../database/repositories/session.repository');
const userRoleRepo = require('../database/repositories/userRole.repository');
const { dseLogger } = require('../../../shared/logger/engineLogger');
const { UnauthorizedError } = require('../../../shared/errors/AppError');
const { ERROR_CODES } = require('../../../shared/errors/errorCodes');

class SessionService {
  constructor() {
    // Configurable session lifetime (defaults to 3600 seconds / 1 hour)
    this.sessionLifetimeSeconds = parseInt(process.env.SESSION_EXPIRATION_SECONDS, 10) || 3600;
  }

  /**
   * Hash a raw session token using SHA-256
   * Server strictly stores only the hash, never the plaintext token.
   * @param {string} token
   * @returns {string} hex hash
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Create a new secure authenticated application session
   * @param {string} username - Authenticated Linux username
   * @param {object} [meta] - Client metadata { ip, userAgent }
   * @returns {Promise<{ token: string, csrfToken: string, session: object }>}
   */
  async createSession(username, meta = {}) {
    dseLogger.info('[DSE] Session creation invoked');

    // Generate cryptographically secure random opaque tokens
    const rawToken = crypto.randomBytes(32).toString('hex');
    const csrfToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    // Determine application role for the Linux account
    const role = userRoleRepo.getRoleForUsername(username);

    const sessionId = `sess_${crypto.randomBytes(12).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionLifetimeSeconds * 1000);

    const sessionRecord = {
      id: sessionId,
      session_token_hash: tokenHash,
      username,
      role,
      csrf_token: csrfToken,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      last_activity_at: now.toISOString(),
      is_revoked: 0,
      ip_address: meta.ip || null,
      user_agent: meta.userAgent || null,
    };

    sessionRepo.create(sessionRecord);
    dseLogger.info(`[DSE] Session created for user '${username}' (role: ${role})`);

    return {
      token: rawToken,
      csrfToken,
      session: {
        id: sessionId,
        username,
        role,
        expiresIn: this.sessionLifetimeSeconds,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  /**
   * Validate session token from cookie/header
   * @param {string} rawToken
   * @returns {Promise<object>} Authenticated session user context
   */
  async validateSession(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new UnauthorizedError('Session token is missing', ERROR_CODES.UNAUTHORIZED);
    }

    const tokenHash = this.hashToken(rawToken);
    const session = sessionRepo.findByTokenHash(tokenHash);

    if (!session) {
      throw new UnauthorizedError('Session not found or invalid', ERROR_CODES.UNAUTHORIZED);
    }

    if (session.is_revoked === 1) {
      dseLogger.warn(`[DSE] Attempted use of revoked session ${session.id} by ${session.username}`);
      throw new UnauthorizedError('Session has been revoked', ERROR_CODES.UNAUTHORIZED);
    }

    const now = Date.now();
    const expiryTime = new Date(session.expires_at).getTime();

    if (expiryTime <= now) {
      dseLogger.warn(`[DSE] Session ${session.id} for user ${session.username} has expired`);
      throw new UnauthorizedError('Session has expired', ERROR_CODES.UNAUTHORIZED);
    }

    // Refresh last activity timestamp
    sessionRepo.updateLastActivity(session.id);

    return {
      id: session.id,
      username: session.username,
      role: session.role,
      csrfToken: session.csrf_token,
      expiresAt: session.expires_at,
      expiresIn: Math.max(0, Math.floor((expiryTime - now) / 1000)),
    };
  }

  /**
   * Revoke an active session (logout)
   * @param {string} rawToken
   */
  async revokeSession(rawToken) {
    if (!rawToken) return false;
    try {
      const tokenHash = this.hashToken(rawToken);
      const session = sessionRepo.findByTokenHash(tokenHash);
      if (session) {
        sessionRepo.revokeById(session.id);
        dseLogger.info(`[DSE] Session ${session.id} revoked for user '${session.username}'`);
        return true;
      }
    } catch (err) {
      dseLogger.warn('[DSE] Error revoking session:', err.message);
    }
    return false;
  }

  /**
   * Revoke all sessions for a user
   * @param {string} username
   */
  async revokeUserSessions(username) {
    return sessionRepo.revokeByUsername(username);
  }

  /**
   * Periodic or on-demand session cleanup
   */
  cleanupExpiredSessions() {
    return sessionRepo.deleteExpired();
  }
}

module.exports = new SessionService();
