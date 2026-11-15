/**
 * Linux /proc Filesystem Direct Reader
 * Efficiently extracts low-level kernel process metadata without shell wrappers.
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const fs = require('fs');

class ProcReader {
  constructor() {
    this.isLinux = process.platform === 'linux';
  }

  /**
   * Read /proc/[pid]/status for detailed memory & thread metadata
   * @param {number} pid
   * @returns {object|null}
   */
  readProcessStatus(pid) {
    if (!this.isLinux) return null;

    try {
      const procPath = `/proc/${pid}/status`;
      if (!fs.existsSync(procPath)) return null;

      const content = fs.readFileSync(procPath, 'utf8');
      const lines = content.split('\n');
      const data = {};

      lines.forEach((line) => {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.substring(0, colonIdx).trim();
          const val = line.substring(colonIdx + 1).trim();
          data[key] = val;
        }
      });

      return {
        threads: data.Threads ? parseInt(data.Threads, 10) : undefined,
        fdSize: data.FDSize ? parseInt(data.FDSize, 10) : undefined,
        vmSize: data.VmSize || undefined,
        vmRss: data.VmRSS || undefined,
      };
    } catch (e) {
      // Ephemeral process or permissions issue
      return null;
    }
  }

  /**
   * Check if process exists in /proc
   * @param {number} pid
   * @returns {boolean}
   */
  checkProcExists(pid) {
    if (!this.isLinux) return false;
    return fs.existsSync(`/proc/${pid}`);
  }
}

module.exports = new ProcReader();
