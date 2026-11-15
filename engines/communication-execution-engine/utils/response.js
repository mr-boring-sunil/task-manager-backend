/**
 * Standard API Response Formatters
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const { HTTP_STATUS } = require('../../../shared/errors/errorCodes');

/**
 * Format and send a successful standard JSON response
 */
const sendSuccess = (res, data = null, message = 'Operation successful', statusCode = HTTP_STATUS.OK) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Format and send an error standard JSON response
 */
const sendError = (
  res,
  message = 'An unexpected error occurred',
  code = 'INTERNAL_ERROR',
  details = null,
  statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: {
      code,
      details,
    },
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  sendSuccess,
  sendError,
};
