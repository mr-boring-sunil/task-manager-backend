/**
 * Systeminformation Mock Data for Unit & Integration Testing
 * Raspberry Pi Task Manager — Unified Backend
 */

const mockProcesses = {
  all: 5,
  running: 2,
  blocked: 0,
  sleeping: 3,
  list: [
    {
      pid: 1001,
      parentPid: 1,
      name: 'node',
      cpu: 4.5,
      mem: 2.1,
      memRss: 25000,
      priority: 0,
      started: '2026-11-01 10:00:00',
      state: 'running',
      user: 'pi',
      command: 'node /app/server.js',
    },
    {
      pid: 1002,
      parentPid: 1,
      name: 'python3',
      cpu: 1.2,
      mem: 1.5,
      memRss: 15000,
      priority: 10,
      started: '2026-11-01 10:05:00',
      state: 'sleeping',
      user: 'pi',
      command: 'python3 worker.py',
    },
    {
      pid: 1003,
      parentPid: 1,
      name: 'nginx',
      cpu: 0.1,
      mem: 0.8,
      memRss: 8000,
      priority: 0,
      started: '2026-11-01 09:00:00',
      state: 'sleeping',
      user: 'www-data',
      command: 'nginx: master process',
    },
    {
      pid: 1004,
      parentPid: 1,
      name: 'bash',
      cpu: 0.0,
      mem: 0.3,
      memRss: 3000,
      priority: 0,
      started: '2026-11-01 10:30:00',
      state: 'stopped',
      user: 'pi',
      command: '/bin/bash',
    },
  ],
};

const mockCurrentLoad = {
  currentLoad: 15.4,
  cpus: [
    { load: 20.1 },
    { load: 12.3 },
    { load: 18.0 },
    { load: 11.2 },
  ],
};

const mockMem = {
  total: 1073741824, // 1 GB
  free: 322122547,
  used: 751619277,
  active: 751619277,
  available: 644245095,
  swaptotal: 536870912,
  swapused: 1048576,
  swapfree: 535822336,
};

const mockFsSize = [
  {
    fs: '/dev/mmcblk0p2',
    type: 'ext4',
    size: 31200000000,
    used: 8400000000,
    available: 22800000000,
    use: 26.9,
    mount: '/',
  },
];

const mockCpu = {
  manufacturer: 'Raspberry Pi Foundation',
  brand: 'BCM2837 ARMv8 (Cortex-A53)',
  speed: 1.4,
  cores: 4,
  physicalCores: 4,
};

const mockNetworkStats = [
  {
    iface: 'wlan0',
    operstate: 'up',
    rx_bytes: 4500000,
    tx_bytes: 1200000,
    rx_sec: 2048,
    tx_sec: 512,
  },
];

const mockNetworkInterfaces = [
  {
    iface: 'wlan0',
    operstate: 'up',
    ip4: '192.168.1.50',
  },
];

const mockCpuTemperatureAvailable = {
  main: 48.5,
  cores: [48.5],
  max: 48.5,
};

const mockCpuTemperatureUnavailable = {
  main: null,
  cores: [],
  max: null,
};

module.exports = {
  mockProcesses,
  mockCurrentLoad,
  mockMem,
  mockFsSize,
  mockCpu,
  mockNetworkStats,
  mockNetworkInterfaces,
  mockCpuTemperatureAvailable,
  mockCpuTemperatureUnavailable,
};
