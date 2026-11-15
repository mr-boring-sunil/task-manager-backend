/**
 * CPU Telemetry Collector
 * Collects total load, per-core load, clock speed, and processor model.
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const os = require('os');
const si = require('systeminformation');

class CpuCollector {
  async getCpuMetrics() {
    const [load, cpuInfo] = await Promise.all([
      si.currentLoad(),
      si.cpu(),
    ]);

    const perCore = (load.cpus || []).map((coreLoad, idx) => ({
      core: idx,
      load: Math.round((coreLoad.load || 0) * 10) / 10,
    }));

    return {
      overallCpuUtilization: Math.round((load.currentLoad || 0) * 10) / 10,
      perCoreUtilization: perCore,
      cpuModel: cpuInfo.brand || cpuInfo.manufacturer || 'ARM Processor',
      cores: cpuInfo.cores || os.cpus().length,
      frequencyGhz: cpuInfo.speed || null,
    };
  }
}

module.exports = new CpuCollector();
