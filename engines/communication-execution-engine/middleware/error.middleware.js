/**
 * Centralized Error Handling Middleware
 * Ensures every error returns a standard, predictable JSON response.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const { HTTP_STATUS, ERROR_CODES } = require('../../../shared/errors/errorCodes');
const { AppError } = require('../../../shared/errors/AppError');
const { sendError } = require('../utils/response');
const { ceeLogger } = require('../../../shared/logger/engineLogger');

/**
 * Handle 404 Not Found for unregistered routes
 */
const notFoundHandler = (req, res, next) => {
  return sendError(
    res,
    `Route not found: ${req.method} ${req.originalUrl}`,
    ERROR_CODES.INTERNAL_ERROR,
    null,
    HTTP_STATUS.NOT_FOUND
  );
};

/**
 * Centralized application error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Handle custom AppErrors
  if (err instanceof AppError) {
    return sendError(res, err.message, err.code, err.details, err.statusCode);
  }

  // Handle Express / Body-Parser JSON syntax errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendError(
      res,
      'Malformed JSON syntax in request body',
      ERROR_CODES.VALIDATION_ERROR,
      { syntaxError: err.message },
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Handle URI malformed errors
  if (err instanceof URIError) {
    return sendError(
      res,
      'Malformed URL path or parameters',
      ERROR_CODES.VALIDATION_ERROR,
      null,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Unhandled / unexpected internal error
  const isProduction = process.env.NODE_ENV === 'production';
  const details = isProduction ? null : { stack: err.stack, originalMessage: err.message };

  ceeLogger.error('Unhandled internal server error', err);

  return sendError(
    res,
    'An internal server error occurred',
    ERROR_CODES.INTERNAL_ERROR,
    details,
    HTTP_STATUS.INTERNAL_SERVER_ERROR
  );
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
