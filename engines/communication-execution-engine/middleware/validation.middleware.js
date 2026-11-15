/**
 * Request Validation Middleware
 * Validates request parameters and payloads before reaching controllers.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const { ValidationError } = require('../../../shared/errors/AppError');
const { ALLOWED_SORT_FIELDS } = require('../../../config/server.config');

const validatePidParam = (req, res, next) => {
  try {
    const rawPid = req.params.pid;
    const pid = parseInt(rawPid, 10);
    if (Number.isNaN(pid) || !Number.isInteger(pid) || pid <= 0) {
      throw new ValidationError('Process ID must be a positive integer', { pid: rawPid });
    }
    req.validatedPid = pid;
    next();
  } catch (err) {
    next(err);
  }
};

const validateCreateProcessBody = (req, res, next) => {
  const { command } = req.body || {};

  if (!command || typeof command !== 'string' || command.trim().length === 0) {
    return next(new ValidationError("Field 'command' is required and must be a non-empty string"));
  }

  next();
};

const validatePriorityBody = (req, res, next) => {
  const { priority } = req.body || {};

  if (priority === undefined || priority === null || priority === '') {
    return next(new ValidationError('Priority value is required', { priority }));
  }

  const parsed = parseInt(priority, 10);
  if (Number.isNaN(parsed) || !Number.isInteger(parsed)) {
    return next(new ValidationError('Priority must be an integer between -20 and 19', { priority }));
  }

  if (parsed < -20 || parsed > 19) {
    return next(new ValidationError('Priority must be between -20 and 19', { priority: parsed }));
  }

  req.validatedPriority = parsed;
  next();
};

const validateProcessListQuery = (req, res, next) => {
  try {
    let { page, limit, sortBy, order } = req.query;

    let p = parseInt(page, 10);
    let l = parseInt(limit, 10);
    if (Number.isNaN(p) || p < 1) p = 1;
    if (Number.isNaN(l) || l < 1) l = 50;
    if (l > 100) l = 100;

    const s = sortBy && ALLOWED_SORT_FIELDS.includes(sortBy.toLowerCase()) ? sortBy.toLowerCase() : 'pid';
    const o = order && ['asc', 'desc'].includes(order.toLowerCase()) ? order.toLowerCase() : 'asc';

    req.query.page = p;
    req.query.limit = l;
    req.query.sortBy = s;
    req.query.order = o;

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  validatePidParam,
  validateCreateProcessBody,
  validatePriorityBody,
  validateProcessListQuery,
};
