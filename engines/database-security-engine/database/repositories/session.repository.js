/**
 * Session SQLite Repository
 * Encapsulates all SQL queries for the sessions table.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const dbConn = require('../connection');
const { DatabaseError } = require('../../../../shared/errors/AppError');

class SessionRepository {
  /**
   * Insert new session record
   * @param {object} session
   */
  create(session) {
    try {
      const stmt = dbConn.prepare(`
        INSERT INTO sessions (id, session_token_hash, username, role, csrf_token, created_at, expires_at, last_activity_at, is_revoked, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        session.id,
        session.session_token_hash,
        session.username,
        session.role || 'standard',
        session.csrf_token,
        session.created_at || new Date().toISOString(),
        session.expires_at,
        session.last_activity_at || new Date().toISOString(),
        session.is_revoked || 0,
        session.ip_address || null,
        session.user_agent || null
      );

      return this.findById(session.id);
    } catch (err) {
      throw new DatabaseError(`Failed to persist session: ${err.message}`, {
        sessionId: session.id,
      });
    }
  }

  /**
   * Find session by hashed token
   * @param {string} tokenHash
   */
  findByTokenHash(tokenHash) {
    try {
      const stmt = dbConn.prepare('SELECT * FROM sessions WHERE session_token_hash = ?');
      const row = stmt.get(tokenHash);
      return row || null;
    } catch (err) {
      throw new DatabaseError(`Failed to query session by token hash: ${err.message}`);
    }
  }

  /**
   * Find session by primary ID
   * @param {string} id
   */
  findById(id) {
    try {
      const stmt = dbConn.prepare('SELECT * FROM sessions WHERE id = ?');
      const row = stmt.get(id);
      return row || null;
    } catch (err) {
      throw new DatabaseError(`Failed to query session by ID: ${err.message}`, { id });
    }
  }

  /**
   * Update last activity timestamp and optionally extend expiration
   * @param {string} id
   * @param {string} [newExpiresAt]
   */
  updateLastActivity(id, newExpiresAt = null) {
    try {
      const now = new Date().toISOString();
      if (newExpiresAt) {
        const stmt = dbConn.prepare('UPDATE sessions SET last_activity_at = ?, expires_at = ? WHERE id = ?');
        stmt.run(now, newExpiresAt, id);
      } else {
        const stmt = dbConn.prepare('UPDATE sessions SET last_activity_at = ? WHERE id = ?');
        stmt.run(now, id);
      }
    } catch (err) {
      // Non-fatal, log
    }
  }

  /**
   * Mark session as revoked
   * @param {string} id
   */
  revokeById(id) {
    try {
      const stmt = dbConn.prepare('UPDATE sessions SET is_revoked = 1 WHERE id = ?');
      stmt.run(id);
      return true;
    } catch (err) {
      throw new DatabaseError(`Failed to revoke session ${id}: ${err.message}`);
    }
  }

  /**
   * Revoke all active sessions for a username
   * @param {string} username
   */
  revokeByUsername(username) {
    try {
      const stmt = dbConn.prepare('UPDATE sessions SET is_revoked = 1 WHERE username = ?');
      stmt.run(username);
      return true;
    } catch (err) {
      throw new DatabaseError(`Failed to revoke sessions for user ${username}: ${err.message}`);
    }
  }

  /**
   * Remove expired sessions from SQLite
   */
  deleteExpired() {
    try {
      const now = new Date().toISOString();
      const stmt = dbConn.prepare('DELETE FROM sessions WHERE expires_at < ? OR is_revoked = 1');
      stmt.run(now);
    } catch (err) {
      // Non-fatal cleanup
    }
  }
}

module.exports = new SessionRepository();
