/**
 * Process Lifecycle Operations
 * Creates, pauses, resumes, and terminates processes using POSIX signals.
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const { spawn } = require('child_process');
const signalOps = require('../../operations/signal.operations');
const { PROCESS_STATES } = require('../../../../config/server.config');
const { AppError, NotFoundError } = require('../../../../shared/errors/AppError');
const { ERROR_CODES } = require('../../../../shared/errors/errorCodes');

class ProcessLifecycle {
  /**
   * Spawn a new background process, optionally running under targetUsername's identity
   * @param {string} command
   * @param {string[]} args
   * @param {string|null} cwd
   * @param {object} env
   * @param {string|null} targetUsername
   * @returns {Promise<{ pid: number, name: string, command: string, status: string, startTime: string }>}
   */
  async spawnProcess(command, args = [], cwd = null, env = {}, targetUsername = null) {
    return new Promise((resolve, reject) => {
      try {
        const combinedEnv = { ...process.env, ...env };

        // Look up Linux UID and GID for the target user if running on Linux
        let userUid = null;
        let userGid = null;

        if (
          targetUsername &&
          process.platform === 'linux' &&
          /^[a-zA-Z0-9_\-\.]+$/.test(targetUsername)
        ) {
          try {
            const { execFileSync } = require('child_process');
            const uStr = execFileSync('id', ['-u', targetUsername], {
              encoding: 'utf8',
              timeout: 1500,
              stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
            const gStr = execFileSync('id', ['-g', targetUsername], {
              encoding: 'utf8',
              timeout: 1500,
              stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
            const parsedUid = parseInt(uStr, 10);
            const parsedGid = parseInt(gStr, 10);
            if (!Number.isNaN(parsedUid) && !Number.isNaN(parsedGid)) {
              userUid = parsedUid;
              userGid = parsedGid;
              combinedEnv.USER = targetUsername;
              combinedEnv.LOGNAME = targetUsername;
              combinedEnv.HOME = targetUsername === 'root' ? '/root' : `/home/${targetUsername}`;
            }
          } catch (idErr) {
            // Non-fatal: if lookup fails, proceed with default execution context
          }
        }

        const spawnOpts = {
          cwd: cwd || (userUid !== null && combinedEnv.HOME ? combinedEnv.HOME : process.cwd()),
          env: combinedEnv,
          shell: false, // Security: Never execute through shell
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        };

        if (userUid !== null && userGid !== null) {
          spawnOpts.uid = userUid;
          spawnOpts.gid = userGid;
        }

        const child = spawn(command, args, spawnOpts);

        child.on('error', (err) => {
          reject(
            new AppError(
              `Failed to start process '${command}': ${err.message}`,
              500,
              ERROR_CODES.PROCESS_SPAWN_FAILED,
              { command, args, error: err.message, targetUser: targetUsername }
            )
          );
        });

        if (child.pid) {
          child.unref(); // Detach from parent

          // Wait briefly so the OS registers the new PID in /proc before
          // the caller queries the process list.
          const spawnResult = {
            pid: child.pid,
            name: command,
            command: [command, ...args].join(' '),
            status: PROCESS_STATES.RUNNING,
            startTime: new Date().toISOString(),
          };

          setTimeout(() => resolve(spawnResult), 300);
        }
      } catch (err) {
        reject(
          new AppError(
            `Process creation failed: ${err.message}`,
            500,
            ERROR_CODES.PROCESS_SPAWN_FAILED,
            { error: err.message }
          )
        );
      }
    });
  }

  /**
   * Terminate a process with graceful escalation (SIGTERM -> SIGKILL)
   * @param {number} pid
   * @param {string} signal
   * @param {boolean} graceful
   * @param {number} timeoutMs
   * @returns {Promise<{ pid: number, terminated: boolean, signal: string, escalated: boolean }>}
   */
  async terminateProcess(pid, signal = 'SIGTERM', graceful = true, timeoutMs = 2000) {
    signalOps.sendSignal(pid, signal);

    // If graceful SIGTERM was sent, verify whether process exited or requires SIGKILL escalation
    if (graceful && signal === 'SIGTERM') {
      await new Promise((resolve) => setTimeout(resolve, Math.min(timeoutMs, 500)));
      if (signalOps.processExists(pid)) {
        try {
          process.kill(pid, 'SIGKILL');
          return { pid, terminated: true, signal: 'SIGKILL', escalated: true };
        } catch (killErr) {
          if (killErr.code !== 'ESRCH') {
            if (!signalOps.processExists(pid)) {
              return { pid, terminated: true, signal, escalated: false };
            }
          }
        }
      }
    }

    return { pid, terminated: true, signal, escalated: false };
  }

  /**
   * Pause a process (SIGSTOP)
   * @param {number} pid
   * @returns {Promise<{ pid: number, state: string, signal: string }>}
   */
  async pauseProcess(pid) {
    signalOps.sendSignal(pid, 'SIGSTOP');
    return { pid, state: PROCESS_STATES.STOPPED, signal: 'SIGSTOP' };
  }

  /**
   * Resume a paused process (SIGCONT)
   * @param {number} pid
   * @returns {Promise<{ pid: number, state: string, signal: string }>}
   */
  async resumeProcess(pid) {
    signalOps.sendSignal(pid, 'SIGCONT');
    return { pid, state: PROCESS_STATES.RUNNING, signal: 'SIGCONT' };
  }
}

module.exports = new ProcessLifecycle();
