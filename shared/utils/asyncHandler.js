/**
 * Async Route Handler Wrapper
 * Automatically forwards rejected promises to Express next() error handler
 * Raspberry Pi Task Manager — Unified Backend
 */

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
