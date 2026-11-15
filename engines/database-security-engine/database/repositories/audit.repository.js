/**
 * Audit Log SQLite Repository
 * Encapsulates all SQL persistence for security-sensitive operations.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const dbConn = require('../connection');
const { DatabaseError } = require('../../../../shared/errors/AppError');

class AuditRepository {
  /**
   * Insert audit log entry
   */
  create(entry) {
    try {
      const stmt = dbConn.prepare(`
        INSERT INTO audit_logs (id, user_id, username, action, resource_type, resource_id, status, ip_address, request_id, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        entry.id,
        entry.user_id || null,
        entry.username || 'anonymous',
        entry.action,
        entry.resource_type || null,
        entry.resource_id !== undefined && entry.resource_id !== null ? String(entry.resource_id) : null,
        entry.status || 'SUCCESS',
        entry.ip_address || '127.0.0.1',
        entry.request_id || null,
        typeof entry.details === 'object' ? JSON.stringify(entry.details) : (entry.details || null),
        entry.created_at || new Date().toISOString()
      );

      return entry;
    } catch (err) {
      throw new DatabaseError(`Failed to persist audit log: ${err.message}`, { action: entry.action });
    }
  }

  /**
   * Find recent audit logs
   */
  findRecent(limit = 100) {
    try {
      const stmt = dbConn.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?');
      return stmt.all(limit);
    } catch (err) {
      throw new DatabaseError(`Failed to retrieve audit logs: ${err.message}`);
    }
  }

  /**
   * Find audit logs for a specific user
   */
  findByUser(username, limit = 50) {
    try {
      const stmt = dbConn.prepare('SELECT * FROM audit_logs WHERE username = ? ORDER BY created_at DESC LIMIT ?');
      return stmt.all(username, limit);
    } catch (err) {
      throw new DatabaseError(`Failed to retrieve audit logs for user ${username}: ${err.message}`);
    }
  }
}

module.exports = new AuditRepository();
