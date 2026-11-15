/**
 * Memory Telemetry Collector
 * Collects physical memory (RAM) and swap statistics.
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const si = require('systeminformation');

class MemoryCollector {
  async getMemoryMetrics() {
    const mem = await si.mem();

    return {
      total: mem.total || 0,
      used: mem.active || mem.used || 0,
      free: mem.free || 0,
      available: mem.available || mem.free || 0,
      swap: {
        total: mem.swaptotal || 0,
        used: mem.swapused || 0,
        free: mem.swapfree || 0,
      },
    };
  }
}

module.exports = new MemoryCollector();
