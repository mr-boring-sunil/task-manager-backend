/**
 * Network Telemetry Collector
 * Collects interface status, total transmitted/received bytes, and bandwidth transfer rates.
 * Raspberry Pi Task Manager — Scheduling Engine
 */

const si = require('systeminformation');

class NetworkCollector {
  async getNetworkMetrics() {
    const [stats, ifaces] = await Promise.all([
      si.networkStats(),
      si.networkInterfaces(),
    ]);

    const ifaceMap = {};
    if (Array.isArray(ifaces)) {
      ifaces.forEach((iface) => {
        ifaceMap[iface.iface] = iface.operstate || 'unknown';
      });
    }

    return (stats || []).map((net) => ({
      interface: net.iface,
      receivedBytes: Math.max(0, net.rx_bytes || 0),
      transmittedBytes: Math.max(0, net.tx_bytes || 0),
      receiveRateBytesPerSec: Math.max(0, Math.round(net.rx_sec || 0)),
      transmitRateBytesPerSec: Math.max(0, Math.round(net.tx_sec || 0)),
      status: ifaceMap[net.iface] || (net.operstate || 'up'),
    }));
  }
}

module.exports = new NetworkCollector();
