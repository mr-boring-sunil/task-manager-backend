/**
 * Disk Filesystem Telemetry Collector
 * Collects mounted partitions, mount points, storage capacities, and utilization percentage.
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const si = require('systeminformation');

class DiskCollector {
  async getDiskMetrics() {
    const fsList = await si.fsSize();

    return (fsList || []).map((fsItem) => ({
      filesystem: fsItem.fs || 'unknown',
      mountPoint: fsItem.mount || '/',
      totalCapacity: fsItem.size || 0,
      usedCapacity: fsItem.used || 0,
      availableCapacity: fsItem.available || 0,
      utilizationPercentage: typeof fsItem.use === 'number' ? Math.round(fsItem.use * 10) / 10 : 0,
    }));
  }
}

module.exports = new DiskCollector();
