/**
 * Cryptographic Password Hasher
 * Uses Node.js native crypto scrypt with random salts and timing-safe equality verification.
 * Zero external native dependencies required.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const crypto = require('crypto');
const securityConfig = require('../../../config/security.config');

class PasswordHasher {
  /**
   * Hash a plain password with a random cryptographically secure salt
   * @param {string} password
   * @returns {{ hash: string, salt: string }}
   */
  hashPassword(password) {
    if (!password || typeof password !== 'string' || password.length === 0) {
      throw new Error('Password must be a non-empty string');
    }

    const salt = crypto.randomBytes(securityConfig.saltBytes).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, securityConfig.hashKeyLength);
    const hash = derivedKey.toString('hex');

    return { hash, salt };
  }

  /**
   * Verify password against stored hash and salt in constant time
   * @param {string} password
   * @param {string} storedHash
   * @param {string} salt
   * @returns {boolean}
   */
  verifyPassword(password, storedHash, salt) {
    if (!password || !storedHash || !salt) return false;

    try {
      const derivedKey = crypto.scryptSync(password, salt, securityConfig.hashKeyLength);
      const storedBuffer = Buffer.from(storedHash, 'hex');

      if (derivedKey.length !== storedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(derivedKey, storedBuffer);
    } catch (e) {
      return false;
    }
  }
}

module.exports = new PasswordHasher();
