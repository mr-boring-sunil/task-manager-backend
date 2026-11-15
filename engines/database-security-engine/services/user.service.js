/**
 * User Business Service
 * Manages user lifecycle, registration, password hashing, and authentication.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const crypto = require('crypto');
const userRepo = require('../database/repositories/user.repository');
const passwordHasher = require('../authentication/password.hasher');
const userValidator = require('../validators/user.validator');
const { ConflictError, UnauthorizedError, NotFoundError } = require('../../../shared/errors/AppError');
const { ERROR_CODES } = require('../../../shared/errors/errorCodes');
const { dseLogger } = require('../../../shared/logger/engineLogger');

class UserService {
  /**
   * Register a new user
   * @param {object} param0
   */
  async createUser({ username, password, role = 'standard' }) {
    const validUsername = userValidator.validateUsername(username);
    const validPassword = userValidator.validatePassword(password);
    const validRole = userValidator.validateRole(role);

    const existing = userRepo.findByUsername(validUsername);
    if (existing) {
      throw new ConflictError(`User '${validUsername}' already exists`, ERROR_CODES.USER_ALREADY_EXISTS, {
        username: validUsername,
      });
    }

    const { hash, salt } = passwordHasher.hashPassword(validPassword);
    const id = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    const created = userRepo.create({
      id,
      username: validUsername,
      password_hash: hash,
      salt,
      role: validRole,
      is_active: 1,
      created_at: now,
      updated_at: now,
    });

    dseLogger.info(`Created user '${validUsername}' with role '${validRole}'`);
    return this.sanitizeUser(created);
  }

  /**
   * Authenticate credentials
   * @param {string} username
   * @param {string} password
   */
  async authenticate(username, password) {
    if (!username || !password) {
      throw new UnauthorizedError('Username and password are required', { code: ERROR_CODES.INVALID_CREDENTIALS });
    }

    const user = userRepo.findByUsername(username);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials', { code: ERROR_CODES.INVALID_CREDENTIALS });
    }

    if (!user.is_active) {
      throw new UnauthorizedError('User account is inactive', { code: ERROR_CODES.USER_INACTIVE });
    }

    const isMatch = passwordHasher.verifyPassword(password, user.password_hash, user.salt);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials', { code: ERROR_CODES.INVALID_CREDENTIALS });
    }

    userRepo.updateLastLogin(user.id);
    return this.sanitizeUser(user);
  }

  /**
   * Retrieve sanitized user by username
   * @param {string} username
   */
  async getUserByUsername(username) {
    const user = userRepo.findByUsername(username);
    if (!user) return null;
    return this.sanitizeUser(user);
  }

  /**
   * Retrieve sanitized user by ID
   * @param {string} id
   */
  async getUserById(id) {
    const user = userRepo.findById(id);
    if (!user) return null;
    return this.sanitizeUser(user);
  }

  /**
   * Seed initial administrator if no users exist
   * @param {object} adminConfig
   */
  async seedAdminIfEmpty(adminConfig) {
    const count = userRepo.count();
    if (count === 0 && adminConfig && adminConfig.username) {
      dseLogger.info(`No users found. Seeding initial administrative account: ${adminConfig.username}`);
      await this.createUser({
        username: adminConfig.username,
        password: adminConfig.password,
        role: 'admin',
      });
    }
  }

  /**
   * Strip sensitive fields from user object
   * @param {object} user
   */
  sanitizeUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      is_active: Boolean(user.is_active),
      created_at: user.created_at,
      last_login: user.last_login,
    };
  }
}

module.exports = new UserService();
