/**
 * User Validator
 * Validates credentials, usernames, and roles.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const { ValidationError } = require('../../../shared/errors/AppError');

class UserValidator {
  validateUsername(username) {
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      throw new ValidationError('Username must be a string with at least 3 characters', { username });
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(username.trim())) {
      throw new ValidationError('Username can only contain alphanumeric characters, underscores, dashes, and dots', {
        username,
      });
    }
    return username.trim();
  }

  validatePassword(password) {
    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new ValidationError('Password must be a string with at least 8 characters');
    }
    return password;
  }

  validateRole(role) {
    const validRoles = ['admin', 'standard', 'viewer'];
    const normalized = (role || 'standard').toLowerCase();
    if (!validRoles.includes(normalized)) {
      throw new ValidationError(`Invalid role '${role}'. Allowed roles: ${validRoles.join(', ')}`);
    }
    return normalized;
  }
}

module.exports = new UserValidator();
