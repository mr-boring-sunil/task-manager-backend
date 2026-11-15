/**
 * System Metrics API Service
 * Coordinates system telemetry retrieval via the Scheduling Engine Adapter.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const schedulingAdapter = require('../adapters/scheduling.adapter');

class MetricsService {
  constructor(adapter = schedulingAdapter) {
    this.adapter = adapter;
  }

  async getOverview() {
    return this.adapter.getSystemMetrics();
  }

  async getCpuMetrics() {
    return this.adapter.getCpuMetrics();
  }

  async getMemoryMetrics() {
    return this.adapter.getMemoryMetrics();
  }

  async getDiskMetrics() {
    return this.adapter.getDiskMetrics();
  }

  async getNetworkMetrics() {
    return this.adapter.getNetworkMetrics();
  }

  async getTemperatureMetrics() {
    return this.adapter.getTemperatureMetrics();
  }
}

module.exports = new MetricsService();
