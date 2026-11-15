/**
 * Token and Authentication Manager
 * Issues and validates signed session tokens (HMAC-SHA256) and API keys.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const crypto = require('crypto');
const securityConfig = require('../../../config/security.config');
const { UnauthorizedError } = require('../../../shared/errors/AppError');

class TokenService {
  constructor() {
    this.secret = securityConfig.jwtSecret;
  }

  /**
   * Create base64url encoded string
   */
  base64UrlEncode(str) {
    return Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  /**
   * Decode base64url string
   */
  base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  /**
   * Generate signed session token
   * @param {object} payload
   * @returns {string} token
   */
  generateToken(payload) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + securityConfig.jwtExpirationHours * 3600;

    const fullPayload = {
      ...payload,
      iat: issuedAt,
      exp: expiresAt,
    };

    const headerEncoded = this.base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = this.base64UrlEncode(JSON.stringify(fullPayload));

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${headerEncoded}.${payloadEncoded}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${headerEncoded}.${payloadEncoded}.${signature}`;
  }

  /**
   * Verify and decode signed token
   * @param {string} token
   * @returns {object} payload
   */
  verifyToken(token) {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedError('Token is missing or invalid');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedError('Malformed token structure');
    }

    const [headerEncoded, payloadEncoded, signatureProvided] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(`${headerEncoded}.${payloadEncoded}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (
      signatureProvided.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signatureProvided), Buffer.from(expectedSignature))
    ) {
      throw new UnauthorizedError('Invalid token signature');
    }

    try {
      const payload = JSON.parse(this.base64UrlDecode(payloadEncoded));
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp < now) {
        throw new UnauthorizedError('Token has expired');
      }

      return payload;
    } catch (e) {
      if (e instanceof UnauthorizedError) throw e;
      throw new UnauthorizedError('Invalid token payload encoding');
    }
  }

  /**
   * Validate API key or Bearer token from incoming request
   * @param {object} req
   */
  authenticateRequest(req) {
    const authHeader = req.headers ? req.headers.authorization : null;
    const apiKeyHeader = req.headers ? req.headers['x-api-key'] : null;

    let token = null;
    if (apiKeyHeader) {
      token = apiKeyHeader;
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 1. Check API Key matching configured API_KEY
    if (token && token === securityConfig.apiKey) {
      return {
        id: 'api-key-user',
        username: 'api-key-client',
        role: 'admin',
        authMethod: 'apiKey',
      };
    }

    // 2. Check signed JWT token
    if (token) {
      try {
        const payload = this.verifyToken(token);
        return {
          id: payload.id || payload.sub,
          username: payload.username,
          role: payload.role || 'standard',
          authMethod: 'token',
        };
      } catch (err) {
        throw new UnauthorizedError(`Authentication failed: ${err.message}`);
      }
    }

    // 3. Fallback for Development Mode
    if (securityConfig.devMode) {
      return {
        id: 'dev-user-0',
        username: 'pi-developer',
        role: 'admin',
        authMethod: 'devFallback',
        isDevFallback: true,
      };
    }

    throw new UnauthorizedError('Authentication token or x-api-key header required');
  }
}

module.exports = new TokenService();
