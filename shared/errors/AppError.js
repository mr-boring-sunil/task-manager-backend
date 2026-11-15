/**
 * Application Error Hierarchy
 * Raspberry Pi Task Manager — Unified Backend
 */

const { HTTP_STATUS, ERROR_CODES } = require('./errorCodes');

class AppError extends Error {
  constructor(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, code = ERROR_CODES.INTERNAL_ERROR, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, ERROR_CODES.VALIDATION_ERROR, details);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Invalid request', details = null) {
    super(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = ERROR_CODES.PROCESS_NOT_FOUND, details = null) {
    super(message, HTTP_STATUS.NOT_FOUND, code, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details = null) {
    super(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, details);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Permission denied', code = ERROR_CODES.PERMISSION_DENIED, details = null) {
    super(message, HTTP_STATUS.FORBIDDEN, code, details);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Operation conflict', code = ERROR_CODES.USER_ALREADY_EXISTS, details = null) {
    super(message, HTTP_STATUS.CONFLICT, code, details);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Required service unavailable', details = null) {
    super(message, HTTP_STATUS.SERVICE_UNAVAILABLE, ERROR_CODES.SERVICE_UNAVAILABLE, details);
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details = null) {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.DATABASE_ERROR, details);
  }
}

module.exports = {
  AppError,
  ValidationError,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ServiceUnavailableError,
  DatabaseError,
};
