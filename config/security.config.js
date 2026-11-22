/**
 * Security Configuration
 * Raspberry Pi Task Manager — Unified Backend
 */

require('dotenv').config();

const parseArray = (val, defaultArray) => {
  if (!val) return defaultArray;
  return val.split(',').map((item) => item.trim()).filter(Boolean);
};

const DEFAULT_ALLOWED_EXECUTABLES = [
  'node',
  'python3',
  'python',
  'bash',
  'sh',
  'ls',
  'ping',
  'top',
  'uptime',
  'cat',
  'echo',
  'sleep',
  'raspistill',
  'vcgencmd',
];

module.exports = {
  allowedExecutables: parseArray(process.env.ALLOWED_EXECUTABLES, DEFAULT_ALLOWED_EXECUTABLES),
  allowedWorkingDirs: parseArray(process.env.ALLOWED_WORKING_DIRS, ['/home/pi', '/tmp', '/opt/task-manager']),
  devMode: process.env.SECURITY_DEV_MODE === 'true' && process.env.NODE_ENV !== 'production',
  apiKey: process.env.API_KEY || 'dev-task-manager-key-change-in-production',
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production_123456',
  jwtExpirationHours: parseInt(process.env.JWT_EXPIRATION_HOURS, 10) || 24,
  saltBytes: 16,
  hashKeyLength: 64,
};
