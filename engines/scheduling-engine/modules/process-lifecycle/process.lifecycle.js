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
   * Spawn a new background process
   * @param {string} command
   * @param {string[]} args
   * @param {string|null} cwd
   * @param {object} env
   * @returns {Promise<{ pid: number, name: string, command: string, status: string, startTime: string }>}
   */
  async spawnProcess(command, args = [], cwd = null, env = {}) {
    return new Promise((resolve, reject) => {
      try {
        const combinedEnv = { ...process.env, ...env };
        const child = spawn(command, args, {
          cwd: cwd || process.cwd(),
          env: combinedEnv,
          shell: false, // Security: Never execute through shell
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        child.on('error', (err) => {
          reject(
            new AppError(
              `Failed to start process '${command}': ${err.message}`,
              500,
              ERROR_CODES.PROCESS_SPAWN_FAILED,
              { command, args, error: err.message }
            )
          );
        });

        if (child.pid) {
          child.unref(); // Detach from parent

          // FIX: Wait briefly so the OS registers the new PID in /proc before
          // the caller queries the process list. Without this delay, si.processes()
          // returns a snapshot that pre-dates the new entry.
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
