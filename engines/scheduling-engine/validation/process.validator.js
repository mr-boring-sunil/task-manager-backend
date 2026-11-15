/**
 * Scheduling Engine Request Validator
 * Validates process operations, arguments, permissions, and security policies.
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const path = require('path');
const fs = require('fs');
const { PROTECTED_PIDS, PRIORITY } = require('../../../config/server.config');
const { securityConfig } = require('../../../config/security.config');
const { ValidationError, ForbiddenError } = require('../../../shared/errors/AppError');
const { ERROR_CODES } = require('../../../shared/errors/errorCodes');

const DANGEROUS_CHARS_REGEX = /[;&|`$<>\r\n]/;

const DISALLOWED_ENV_KEYS = new Set([
  'LD_PRELOAD',
  'LD_LIBRARY_PATH',
  'NODE_OPTIONS',
  'BASH_ENV',
  'ENV',
  'IFS',
  'PYTHONSTARTUP',
  'PYTHONPATH',
  'PERLLIB',
  'RUBYLIB',
]);

class ProcessValidator {
  /**
   * Validate process ID
   * @param {string|number} rawPid
   * @returns {number}
   */
  validatePid(rawPid) {
    const pid = parseInt(rawPid, 10);
    if (Number.isNaN(pid) || !Number.isInteger(pid) || pid <= 0) {
      throw new ValidationError('Process ID must be a positive integer', { pid: rawPid });
    }

    if (PROTECTED_PIDS.includes(pid) || pid === process.pid || pid === process.ppid) {
      throw new ForbiddenError(
        `Cannot perform operations on protected process (PID: ${pid})`,
        ERROR_CODES.PROTECTED_PROCESS,
        { pid }
      );
    }

    return pid;
  }

  /**
   * Validate priority (-20 to 19)
   * @param {string|number} rawPriority
   * @returns {number}
   */
  validatePriority(rawPriority) {
    if (rawPriority === undefined || rawPriority === null || rawPriority === '') {
      throw new ValidationError('Priority value is required', { priority: rawPriority });
    }

    const priority = parseInt(rawPriority, 10);
    if (Number.isNaN(priority) || !Number.isInteger(priority)) {
      throw new ValidationError('Priority must be an integer between -20 and 19', { priority: rawPriority });
    }

    if (priority < PRIORITY.MIN || priority > PRIORITY.MAX) {
      throw new ValidationError(
        `Priority must be between ${PRIORITY.MIN} (highest) and ${PRIORITY.MAX} (lowest)`,
        { priority, min: PRIORITY.MIN, max: PRIORITY.MAX }
      );
    }

    return priority;
  }

  /**
   * Validate executable against allowlist and shell injection
   * @param {string} command
   * @param {string[]} [allowedList]
   * @returns {string}
   */
  validateCommand(command, allowedList = null) {
    if (!command || typeof command !== 'string' || command.trim().length === 0) {
      throw new ValidationError('Command is required and must be a non-empty string');
    }

    const trimmed = command.trim();

    if (DANGEROUS_CHARS_REGEX.test(trimmed)) {
      throw new ValidationError('Command contains forbidden characters or shell operators', { command: trimmed });
    }

    const list = allowedList || require('../../../config/security.config').allowedExecutables;
    const baseName = path.basename(trimmed);
    const isAllowed = list.some(
      (allowed) => allowed.toLowerCase() === baseName.toLowerCase() || allowed.toLowerCase() === trimmed.toLowerCase()
    );

    if (!isAllowed) {
      throw new ForbiddenError(
        `Command '${baseName}' is not in the allowed executables list`,
        ERROR_CODES.COMMAND_NOT_ALLOWED,
        { command: baseName, allowed: list }
      );
    }

    return trimmed;
  }

  /**
   * Validate arguments list
   * @param {string[]} args
   * @returns {string[]}
   */
  validateArgs(args = []) {
    if (!Array.isArray(args)) {
      throw new ValidationError('Arguments must be an array of strings', { args });
    }

    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (typeof arg !== 'string') {
        throw new ValidationError(`Argument at index ${i} must be a string`, { index: i, value: arg });
      }
      if (/[\0\r\n]/.test(arg)) {
        throw new ValidationError(`Argument at index ${i} contains forbidden control characters`, { index: i });
      }
    }

    return args;
  }

  /**
   * Validate working directory
   * @param {string} cwd
   * @param {string[]} [allowedDirs]
   * @returns {string|null}
   */
  validateCwd(cwd, allowedDirs = null) {
    if (!cwd) return null;

    if (typeof cwd !== 'string') {
      throw new ValidationError('Working directory must be a string');
    }

    const resolved = path.resolve(cwd);
    const permittedDirs = allowedDirs || require('../../../config/security.config').allowedWorkingDirs;

    if (permittedDirs && permittedDirs.length > 0) {
      const isWithinAllowed = permittedDirs.some((allowed) => {
        const resolvedAllowed = path.resolve(allowed);
        return resolved === resolvedAllowed || resolved.startsWith(resolvedAllowed + path.sep);
      });

      if (!isWithinAllowed) {
        throw new ForbiddenError(
          'Working directory is outside of permitted paths',
          ERROR_CODES.PERMISSION_DENIED,
          { cwd: resolved, allowedDirs: permittedDirs }
        );
      }
    }

    if (!fs.existsSync(resolved)) {
      throw new ValidationError(`Working directory does not exist: ${resolved}`, { cwd: resolved });
    }

    return resolved;
  }

  /**
   * Validate environment variables
   * @param {object} env
   * @returns {object}
   */
  validateEnv(env) {
    if (!env) return {};

    if (typeof env !== 'object' || Array.isArray(env)) {
      throw new ValidationError('Environment variables must be a key-value object', { env });
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(env)) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        throw new ValidationError('Environment variable keys and values must be strings', { key, value });
      }

      if (DISALLOWED_ENV_KEYS.has(key.toUpperCase())) {
        throw new ForbiddenError(
          `Setting security-sensitive environment variable '${key}' is forbidden`,
          ERROR_CODES.PERMISSION_DENIED,
          { key }
        );
      }

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        throw new ValidationError(`Invalid environment variable key format: ${key}`, { key });
      }

      sanitized[key] = value;
    }

    return sanitized;
  }
}

module.exports = new ProcessValidator();
