/**
 * Inter-Engine Interaction Logger
 * Mandatory structured logging for every cross-engine function call.
 * Format strictly conforms to Section 8 of the Master Specification.
 * Raspberry Pi Task Manager — Unified Backend
 */

const generateRequestId = require('../utils/generateRequestId');

class InteractionLogger {
  constructor() {
    this.enabled = process.env.LOG_INTERACTIONS !== 'false';
  }

  /**
   * Check if interaction logging is active
   */
  isEnabled() {
    if (process.env.ENABLE_TEST_LOGS === 'true') {
      return true;
    }
    if (process.env.NODE_ENV === 'test') {
      return false;
    }
    return process.env.LOG_INTERACTIONS !== 'false';
  }

  /**
   * Log outgoing inter-engine request
   * @param {string} source - e.g. 'CEE'
   * @param {string} target - e.g. 'SE' or 'DSE'
   * @param {string} operation - e.g. 'listProcesses'
   * @param {string} requestId
   */
  logRequest(source, target, operation, requestId) {
    if (!this.isEnabled()) return;

    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}]\n[${source} -> ${target}]\n[REQUEST]\nOperation: ${operation}\nRequest ID: ${requestId}\nStatus: Started\n`
    );
  }

  /**
   * Log successful inter-engine response
   * @param {string} source - e.g. 'SE'
   * @param {string} target - e.g. 'CEE'
   * @param {string} operation
   * @param {string} requestId
   * @param {number} durationMs
   */
  logResponse(source, target, operation, requestId, durationMs) {
    if (!this.isEnabled()) return;

    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}]\n[${source} -> ${target}]\n[RESPONSE]\nOperation: ${operation}\nRequest ID: ${requestId}\nStatus: Success\nDuration: ${durationMs}ms\n`
    );
  }

  /**
   * Log inter-engine failure or error
   * @param {string} source - e.g. 'SE'
   * @param {string} target - e.g. 'CEE'
   * @param {string} operation
   * @param {string} requestId
   * @param {string|Error} error
   * @param {number} durationMs
   */
  logError(source, target, operation, requestId, error, durationMs) {
    if (!this.isEnabled()) return;

    const timestamp = new Date().toISOString();
    const errorCode = (error && (error.code || error.name)) || 'ERROR';
    const errorMessage = (error && error.message) || String(error);

    console.log(
      `[${timestamp}]\n[${source} -> ${target}]\n[ERROR]\nOperation: ${operation}\nRequest ID: ${requestId}\nError: ${errorCode} (${errorMessage})\nDuration: ${durationMs}ms\n`
    );
  }

  /**
   * High-order wrapper to execute and log an inter-engine async operation
   * @param {string} sourceEngine - Calling engine (e.g. 'CEE')
   * @param {string} targetEngine - Target engine (e.g. 'SE' or 'DSE')
   * @param {string} operation - Method name
   * @param {Function} asyncFn - Async execution function
   * @param {string} [customRequestId] - Optional correlation ID
   */
  async execute(sourceEngine, targetEngine, operation, asyncFn, customRequestId = null) {
    const requestId = customRequestId || generateRequestId('req');
    const startTime = Date.now();

    this.logRequest(sourceEngine, targetEngine, operation, requestId);

    try {
      const result = await asyncFn(requestId);
      const duration = Date.now() - startTime;
      this.logResponse(targetEngine, sourceEngine, operation, requestId, duration);
      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      this.logError(targetEngine, sourceEngine, operation, requestId, err, duration);
      throw err;
    }
  }
}

module.exports = new InteractionLogger();
