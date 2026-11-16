/**
 * Linux PAM Authentication Adapter
 * Interfaces with Linux PAM through an isolated privilege-separated helper.
 * Strictly adheres to POSIX credential validation and zero credential logging.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const path = require('path');
const { spawn } = require('child_process');
const { dseLogger } = require('../../../shared/logger/engineLogger');
const { UnauthorizedError, ServiceUnavailableError } = require('../../../shared/errors/AppError');
const { ERROR_CODES } = require('../../../shared/errors/errorCodes');

class PamAuthenticationAdapter {
  constructor() {
    this.helperPath = path.resolve(__dirname, 'pam-helper', 'pam_authenticator.py');
    this.serviceName = process.env.PAM_SERVICE_NAME || 'login';
    this.timeoutMs = 5000;
    this.testAuthHandler = null; // Can be set during unit/integration tests
  }

  /**
   * Set a custom test authentication handler for automated testing
   * @param {Function} handler - async (username, password) => boolean
   */
  setTestHandler(handler) {
    this.testAuthHandler = handler;
  }

  /**
   * Check if running on native Linux OS
   */
  isLinux() {
    return process.platform === 'linux';
  }

  /**
   * Authenticate a Linux user account via PAM
   * @param {string} username - Linux username
   * @param {string} password - Linux password
   * @returns {Promise<{ success: boolean, username: string }>}
   */
  async authenticate(username, password) {
    dseLogger.info('[DSE] PAM adapter invoked');

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      dseLogger.warn('[DSE] Authentication rejected: Empty or invalid credential structure');
      throw new UnauthorizedError('Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS);
    }

    const cleanUsername = username.trim();

    // 1. If custom test handler is active (e.g. in test suite)
    if (this.testAuthHandler) {
      dseLogger.debug('[DSE] Invoking registered test authentication handler');
      const testResult = await this.testAuthHandler(cleanUsername, password);
      if (testResult) {
        dseLogger.info(`[DSE] Linux authentication successful (test mode) for user '${cleanUsername}'`);
        return { success: true, username: cleanUsername };
      }
      dseLogger.warn(`[DSE] Linux authentication failed (test mode) for user '${cleanUsername}'`);
      throw new UnauthorizedError('Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS);
    }

    // 2. Fallback for non-Linux platforms (e.g. Windows development / test environment)
    if (!this.isLinux()) {
      const isTestOrDev = process.env.NODE_ENV === 'test' || process.env.SECURITY_DEV_MODE !== 'false';
      if (isTestOrDev) {
        dseLogger.warn(
          `[DSE] Non-Linux environment (${process.platform}) detected. Using dev/test user fallback.`
        );

        // In dev/test on non-Linux, support standard test accounts (e.g. 'pi'/'raspberry', 'admin'/'AdminPassword123!')
        const devAccounts = {
          pi: 'raspberry',
          admin: 'AdminPassword123!',
          developer: 'devpassword',
          testuser: 'testpassword',
          standarduser: 'standardpassword',
        };

        if (devAccounts[cleanUsername] && devAccounts[cleanUsername] === password) {
          dseLogger.info(`[DSE] Linux authentication successful (dev fallback) for user '${cleanUsername}'`);
          return { success: true, username: cleanUsername };
        }

        // Check if user exists in SQLite user repository
        try {
          const userRepo = require('../database/repositories/user.repository');
          const passwordHasher = require('../authentication/password.hasher');
          const existingUser = userRepo.findByUsername(cleanUsername);
          if (existingUser && passwordHasher.verifyPassword(password, existingUser.password_hash, existingUser.salt)) {
            dseLogger.info(`[DSE] Linux authentication successful (db fallback) for user '${cleanUsername}'`);
            return { success: true, username: cleanUsername };
          }
        } catch (e) {
          // Ignore DB fallback error
        }

        dseLogger.warn(`[DSE] Linux authentication failed for user '${cleanUsername}'`);
        throw new UnauthorizedError('Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS);
      } else {
        dseLogger.error('[DSE] Linux PAM is unavailable on non-Linux OS in production');
        throw new ServiceUnavailableError(
          'PAM authentication is only supported on Linux operating systems.'
        );
      }
    }

    // 3. Native Linux PAM Execution via Isolated Helper
    return new Promise((resolve, reject) => {
      const pythonExecutable = process.env.PYTHON_PATH || 'python3';
      let child;

      try {
        child = spawn(pythonExecutable, [this.helperPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
        });
      } catch (spawnErr) {
        dseLogger.error('[DSE] Failed to spawn PAM helper process:', spawnErr.message);
        return reject(
          new ServiceUnavailableError('Authentication service helper unavailable')
        );
      }

      let stdoutData = '';
      let stderrData = '';
      let timer = null;

      timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch (e) {}
        dseLogger.error('[DSE] PAM authentication helper timed out');
        reject(new ServiceUnavailableError('Authentication service timed out'));
      }, this.timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString('utf8');
      });

      child.stderr.on('data', (chunk) => {
        stderrData += chunk.toString('utf8');
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        dseLogger.error('[DSE] PAM helper process error:', err.message);
        reject(new ServiceUnavailableError('Authentication helper execution failed'));
      });

      child.on('close', (code) => {
        clearTimeout(timer);

        try {
          const result = JSON.parse(stdoutData.trim());
          if (result.success) {
            dseLogger.info(`[DSE] Linux authentication successful for user '${cleanUsername}'`);
            return resolve({ success: true, username: cleanUsername });
          }

          if (result.error === 'PAM_UNAVAILABLE') {
            dseLogger.error('[DSE] PAM library unavailable on SBC:', result.message);
            return reject(new ServiceUnavailableError('Linux PAM subsystem is not configured or available'));
          }

          dseLogger.warn(`[DSE] Linux authentication rejected for user '${cleanUsername}'`);
          return reject(new UnauthorizedError('Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS));
        } catch (parseErr) {
          dseLogger.error('[DSE] Invalid output received from PAM helper:', stderrData || stdoutData);
          return reject(new UnauthorizedError('Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS));
        }
      });

      // Write payload to stdin securely and close stdin
      const payload = JSON.stringify({
        username: cleanUsername,
        password: password,
        service: this.serviceName,
      });

      child.stdin.write(payload + '\n');
      child.stdin.end();
    });
  }
}

module.exports = new PamAuthenticationAdapter();
