/**
 * User Role SQLite Repository
 * Encapsulates role mapping for authenticated Linux accounts.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const dbConn = require('../connection');
const { getAdminUsers, ROLES } = require('../../config/roles.config');
const { DatabaseError } = require('../../../../shared/errors/AppError');

class UserRoleRepository {
  /**
   * Determine application role for a Linux username
   * Checks database mapping first, then configurable administrator list.
   * @param {string} username
   * @returns {string} 'admin' or 'standard'
   */
  getRoleForUsername(username) {
    if (!username) return ROLES.STANDARD;

    const normalized = username.trim().toLowerCase();

    // 1. Check user_roles table
    try {
      const stmt = dbConn.prepare('SELECT role FROM user_roles WHERE username = ?');
      const row = stmt.get(normalized);
      if (row && row.role) {
        return row.role;
      }
    } catch (err) {
      // If table query fails, fallback to config
    }

    // 2. Check configurable administrative users
    const adminUsers = getAdminUsers();
    if (adminUsers.includes(normalized)) {
      return ROLES.ADMIN;
    }

    return ROLES.STANDARD;
  }

  /**
   * Set or update application role for a user
   * @param {string} username
   * @param {string} role
   */
  setRoleForUsername(username, role) {
    const normalized = username.trim().toLowerCase();
    const targetRole = role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.STANDARD;
    const now = new Date().toISOString();

    try {
      const stmt = dbConn.prepare(`
        INSERT INTO user_roles (username, role, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(username) DO UPDATE SET role = excluded.role, updated_at = excluded.updated_at
      `);
      stmt.run(normalized, targetRole, now);
      return targetRole;
    } catch (err) {
      throw new DatabaseError(`Failed to set role for user ${username}: ${err.message}`);
    }
  }
}

module.exports = new UserRoleRepository();
