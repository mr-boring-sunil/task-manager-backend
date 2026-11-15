/**
 * Database Configuration (SQLite)
 * Raspberry Pi Task Manager — Unified Backend
 */

require('dotenv').config();
const path = require('path');

const defaultDbPath = path.resolve(__dirname, '..', 'data', 'task_manager.db');

module.exports = {
  dbPath: process.env.DATABASE_FILE ? path.resolve(process.env.DATABASE_FILE) : defaultDbPath,
  walMode: process.env.DATABASE_WAL_MODE !== 'false',
  timeout: 5000,
  initialAdmin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'change_this_admin_password_in_production',
    email: process.env.ADMIN_EMAIL || 'admin@raspberrypi.local',
  },
};
