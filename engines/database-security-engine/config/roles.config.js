/**
 * Application Roles Configuration
 * Defines application roles and mapping for Linux accounts.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

require('dotenv').config();

const ROLES = {
  ADMIN: 'admin',
  STANDARD: 'standard',
};

// Configurable admin Linux accounts (comma-separated usernames)
// By default, common Raspberry Pi administrative users or configured users
const parseAdminUsers = () => {
  const envUsers = process.env.ADMIN_USERS || `${process.env.ADMIN_USERNAME || 'admin'},pi,root`;
  return envUsers
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);
};

module.exports = {
  ROLES,
  getAdminUsers: parseAdminUsers,
};
