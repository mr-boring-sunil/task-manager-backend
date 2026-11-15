/**
 * User SQLite Repository
 * Encapsulates all SQL queries for the users table.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const dbConn = require('../connection');
const { DatabaseError } = require('../../../../shared/errors/AppError');

class UserRepository {
  /**
   * Insert new user
   */
  create(user) {
    try {
      const stmt = dbConn.prepare(`
        INSERT INTO users (id, username, password_hash, salt, role, is_active, created_at, updated_at, last_login)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        user.id,
        user.username,
        user.password_hash,
        user.salt,
        user.role || 'standard',
        user.is_active !== undefined ? user.is_active : 1,
        user.created_at || new Date().toISOString(),
        user.updated_at || new Date().toISOString(),
        user.last_login || null
      );
      return this.findById(user.id);
    } catch (err) {
      throw new DatabaseError(`Failed to create user '${user.username}': ${err.message}`, {
        username: user.username,
      });
    }
  }

  /**
   * Find user by username
   */
  findByUsername(username) {
    try {
      const stmt = dbConn.prepare('SELECT * FROM users WHERE username = ?');
      const row = stmt.get(username);
      return row || null;
    } catch (err) {
      throw new DatabaseError(`Failed to query user by username: ${err.message}`, { username });
    }
  }

  /**
   * Find user by primary ID
   */
  findById(id) {
    try {
      const stmt = dbConn.prepare('SELECT * FROM users WHERE id = ?');
      const row = stmt.get(id);
      return row || null;
    } catch (err) {
      throw new DatabaseError(`Failed to query user by ID: ${err.message}`, { id });
    }
  }

  /**
   * Update last login timestamp
   */
  updateLastLogin(id) {
    try {
      const stmt = dbConn.prepare('UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?');
      const now = new Date().toISOString();
      stmt.run(now, now, id);
    } catch (err) {
      // Non-fatal, log
    }
  }

  /**
   * Count total registered users
   */
  count() {
    try {
      const stmt = dbConn.prepare('SELECT COUNT(*) as count FROM users');
      const result = stmt.get();
      return result ? result.count : 0;
    } catch (err) {
      return 0;
    }
  }
}

module.exports = new UserRepository();
