/**
 * Server Configuration & Constants
 * Raspberry Pi Task Manager — Unified Backend
 */

require('dotenv').config();

const parseNumber = (val, defaultValue) => {
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

module.exports = {
  port: parseNumber(process.env.PORT, 5000),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Real-Time SSE Stream Configuration
  stream: {
    defaultIntervalMs: parseNumber(process.env.STREAM_DEFAULT_INTERVAL_MS, 1000),
    minIntervalMs: parseNumber(process.env.STREAM_MIN_INTERVAL_MS, 200),
    heartbeatIntervalMs: parseNumber(process.env.STREAM_HEARTBEAT_INTERVAL_MS, 15000),
  },

  // CORS Configuration
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Rate Limiting
  rateLimit: {
    windowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 60 * 1000), // 1 minute
    maxRequests: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 120),
    maxMutationRequests: parseNumber(process.env.RATE_LIMIT_MUTATION_MAX_REQUESTS, 30),
  },

  // Process States
  PROCESS_STATES: {
    RUNNING: 'running',
    SLEEPING: 'sleeping',
    STOPPED: 'stopped',
    ZOMBIE: 'zombie',
    IDLE: 'idle',
    UNKNOWN: 'unknown',
  },

  // Priority Range
  PRIORITY: {
    MIN: -20,
    MAX: 19,
    DEFAULT: 0,
  },

  // Signals
  ALLOWED_SIGNALS: ['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGSTOP', 'SIGCONT'],

  // Protected PIDs
  PROTECTED_PIDS: [0, 1],

  // Protected Process Names
  PROTECTED_PROCESS_NAMES: [
    'init',
    'systemd',
    'kthreadd',
    'sshd',
    'cron',
    'dbus-daemon',
    'systemd-journald',
    'systemd-udevd',
    'node',
  ],

  // Process Sorting Fields
  ALLOWED_SORT_FIELDS: [
    'pid',
    'ppid',
    'name',
    'command',
    'username',
    'cpu',
    'memory',
    'memoryUsage',
    'state',
    'startTime',
  ],
};
