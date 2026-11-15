/**
 * Request & Correlation ID Generator
 * Raspberry Pi Task Manager — Unified Backend
 */

let counter = 100;

/**
 * Generate a unique correlation request ID for inter-engine operations
 * @param {string} prefix
 * @returns {string} e.g. "req_101_1730000000"
 */
const generateRequestId = (prefix = 'req') => {
  counter += 1;
  const timestamp = Date.now().toString(36);
  return `${prefix}_${counter}_${timestamp}`;
};

module.exports = generateRequestId;
