/**
 * In-Memory Rate Limiting Middleware
 * Protects endpoints from abuse and DoS on resource-constrained Raspberry Pi hardware.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const { ERROR_CODES, HTTP_STATUS } = require('../../../shared/errors/errorCodes');
const { sendError } = require('../utils/response');
const serverConfig = require('../../../config/server.config');

const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || serverConfig.rateLimit.windowMs;
  const maxRequests = options.maxRequests || serverConfig.rateLimit.maxRequests;
  const message = options.message || 'Rate limit exceeded. Please try again later.';

  const hits = new Map();

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hits.entries()) {
      const activeTimestamps = timestamps.filter((time) => now - time < windowMs);
      if (activeTimestamps.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, activeTimestamps);
      }
    }
  }, 2 * 60 * 1000);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req, res, next) => {
    if (serverConfig.isTest && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const now = Date.now();

    const clientHits = hits.get(ip) || [];
    const windowStart = now - windowMs;
    const activeHits = clientHits.filter((time) => time > windowStart);

    if (activeHits.length >= maxRequests) {
      const oldestHit = activeHits[0];
      const resetTimeMs = windowMs - (now - oldestHit);

      res.setHeader('Retry-After', Math.ceil(resetTimeMs / 1000));
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);

      return sendError(
        res,
        message,
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        { retryAfterSeconds: Math.ceil(resetTimeMs / 1000) },
        HTTP_STATUS.TOO_MANY_REQUESTS
      );
    }

    activeHits.push(now);
    hits.set(ip, activeHits);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - activeHits.length));

    next();
  };
};

const generalRateLimiter = createRateLimiter({
  windowMs: serverConfig.rateLimit.windowMs,
  maxRequests: serverConfig.rateLimit.maxRequests,
  message: 'Too many API requests. Please slow down.',
});

const mutationRateLimiter = createRateLimiter({
  windowMs: serverConfig.rateLimit.windowMs,
  maxRequests: serverConfig.rateLimit.maxMutationRequests,
  message: 'Too many process modification requests. Please wait before retrying.',
});

module.exports = {
  createRateLimiter,
  generalRateLimiter,
  mutationRateLimiter,
};
