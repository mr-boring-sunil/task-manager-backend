/**
 * Thermal Sensor Collector
 * Reads Raspberry Pi / Linux hardware CPU temperature.
 * Missing sensor data is strictly reported as unavailable, never fabricated.
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const fs = require('fs');
const si = require('systeminformation');

class ThermalCollector {
  constructor() {
    this.isLinux = process.platform === 'linux';
    this.rpiThermalPath = '/sys/class/thermal/thermal_zone0/temp';
  }

  /**
   * Read CPU temperature in Celsius
   * @returns {Promise<{ celsius: number|null, status: 'available'|'unavailable' }>}
   */
  async getCpuTemperature() {
    // 1. Direct Raspberry Pi thermal zone read
    if (this.isLinux) {
      try {
        if (fs.existsSync(this.rpiThermalPath)) {
          const raw = fs.readFileSync(this.rpiThermalPath, 'utf8').trim();
          const millidegrees = parseInt(raw, 10);
          if (!Number.isNaN(millidegrees) && millidegrees > 0) {
            return {
              celsius: Math.round((millidegrees / 1000) * 10) / 10,
              status: 'available',
            };
          }
        }
      } catch (e) {
        // Fall back to systeminformation
      }
    }

    // 2. Fall back to systeminformation.cpuTemperature()
    try {
      const temp = await si.cpuTemperature();
      if (temp && typeof temp.main === 'number' && temp.main > 0) {
        return {
          celsius: Math.round(temp.main * 10) / 10,
          status: 'available',
        };
      }
    } catch (e) {
      // Sensor not present or query failed
    }

    // 3. Sensor unavailable
    return {
      celsius: null,
      status: 'unavailable',
    };
  }
}

module.exports = new ThermalCollector();
