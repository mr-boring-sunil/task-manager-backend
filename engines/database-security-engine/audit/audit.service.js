/**
 * Audit Logging Service
 * Records security-sensitive operations persistently into SQLite.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const crypto = require('crypto');
const auditRepo = require('../database/repositories/audit.repository');
const userRepo = require('../database/repositories/user.repository');
const { dseLogger } = require('../../../shared/logger/engineLogger');

class AuditService {
  /**
   * Sanitize event details to prevent secrets from being logged
   * @param {object} details
   */
  sanitizeDetails(details) {
    if (!details || typeof details !== 'object') return details;

    const copy = Array.isArray(details) ? [...details] : { ...details };
    const forbiddenKeys = ['password', 'token', 'apiKey', 'secret', 'password_hash', 'salt'];

    if (typeof copy === 'object' && !Array.isArray(copy)) {
      forbiddenKeys.forEach((key) => {
        if (copy[key] !== undefined) {
          copy[key] = '[REDACTED]';
        }
      });
    }

    return copy;
  }

  /**
   * Record structured audit event
   * @param {object} event
   */
  async recordAuditEvent(event) {
    const id = `aud_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const sanitizedDetails = this.sanitizeDetails(event.details);

    let userId = event.user_id || (event.user && event.user.id) || null;
    if (userId) {
      try {
        const existing = userRepo.findById(userId);
        if (!existing) {
          userId = null;
        }
      } catch (e) {
        userId = null;
      }
    }

    const entry = {
      id,
      user_id: userId,
      username: event.username || (event.user && event.user.username) || 'system',
      action: event.action,
      resource_type: event.resource_type || (event.resource ? typeof event.resource : null),
      resource_id: event.resource_id || (typeof event.resource === 'object' ? event.resource.pid : event.resource),
      status: event.status || (event.success === false ? 'FAILURE' : 'SUCCESS'),
      ip_address: event.ip_address || event.ip || '127.0.0.1',
      request_id: event.request_id || null,
      details: sanitizedDetails,
      created_at: event.created_at || new Date().toISOString(),
    };

    // Write to persistent SQLite repository
    const saved = auditRepo.create(entry);
    dseLogger.info(`Audit: [${entry.action}] by ${entry.username} - Status: ${entry.status}`);
    return saved;
  }

  /**
   * Retrieve recent audit logs
   */
  async getAuditLogs(limit = 100) {
    return auditRepo.findRecent(limit);
  }
}

module.exports = new AuditService();
