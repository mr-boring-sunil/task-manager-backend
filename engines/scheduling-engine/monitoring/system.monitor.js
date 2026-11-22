/**
 * System Telemetry Monitor
 * Aggregates overall system performance metrics with lightweight 500ms caching.
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const os = require('os');
const si = require('systeminformation');
const thermalCollector = require('../collectors/thermal.collector');
const cpuCollector = require('../collectors/cpu.collector');
const memoryCollector = require('../collectors/memory.collector');
const diskCollector = require('../collectors/disk.collector');
const networkCollector = require('../collectors/network.collector');

class SystemMonitor {
  constructor() {
    this.cache = new Map();
    this.cacheTtlMs = 500; // 500ms cache to prevent CPU thrashing on Raspberry Pi 3B
  }

  async getCached(key, fetcher) {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.cacheTtlMs) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(key, { timestamp: now, data });
    return data;
  }

  async getOverviewMetrics() {
    return this.getCached('overview', async () => {
      const [load, mem, fsList, temp, netList] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        thermalCollector.getCpuTemperature(),
        this.getNetworkMetrics().catch(() => []),
      ]);

      const rootFs = (fsList || []).find((f) => f.mount === '/' || f.mount === 'C:') || (fsList && fsList[0]) || {};
      const totalDisk = rootFs.size || 0;
      const usedDisk = rootFs.used || 0;
      const availableDisk = rootFs.available || (totalDisk - usedDisk);
      const diskPercentage = totalDisk > 0 ? Math.round((usedDisk / totalDisk) * 1000) / 10 : 0;

      const totalRam = mem.total || 0;
      const usedRam = mem.active || mem.used || 0;
      const availableRam = mem.available || mem.free || 0;
      const ramPercentage = totalRam > 0 ? Math.round((usedRam / totalRam) * 1000) / 10 : 0;

      // Filter out loopback 'lo' so internal localhost traffic doesn't distort bandwidth
      const nonLoopback = Array.isArray(netList)
        ? netList.filter((n) => n.interface && !n.interface.toLowerCase().startsWith('lo'))
        : [];
      const candidateNets = nonLoopback.length > 0 ? nonLoopback : (Array.isArray(netList) ? netList : []);
      const totalRxRate = candidateNets.reduce((sum, n) => sum + Math.max(0, n.receiveRateBytesPerSec || 0), 0);
      const totalTxRate = candidateNets.reduce((sum, n) => sum + Math.max(0, n.transmitRateBytesPerSec || 0), 0);

      return {
        cpuUtilization: Math.round((load.currentLoad || 0) * 10) / 10,
        totalRam,
        usedRam,
        availableRam,
        ramUtilizationPercentage: ramPercentage,
        diskTotal: totalDisk,
        diskUsed: usedDisk,
        diskAvailable: availableDisk,
        diskUtilizationPercentage: diskPercentage,
        cpuTemperature: temp.celsius,
        cpuTemperatureStatus: temp.status,
        systemUptime: Math.round(os.uptime()),
        networkRxBytesPerSec: totalRxRate,
        networkTxBytesPerSec: totalTxRate,
      };
    });
  }

  async getCpuMetrics() {
    return this.getCached('cpu', () => cpuCollector.getCpuMetrics());
  }

  async getMemoryMetrics() {
    return this.getCached('memory', () => memoryCollector.getMemoryMetrics());
  }

  async getDiskMetrics() {
    return this.getCached('disk', () => diskCollector.getDiskMetrics());
  }

  async getNetworkMetrics() {
    return this.getCached('network', () => networkCollector.getNetworkMetrics());
  }

  async getTemperatureMetrics() {
    return this.getCached('temperature', () => thermalCollector.getCpuTemperature());
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = new SystemMonitor();
