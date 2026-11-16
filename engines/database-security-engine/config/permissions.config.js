/**
 * Application Permissions Configuration
 * Formal permission definitions and role-permission matrices.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const PERMISSIONS = {
  SYSTEM_READ: 'system.read',
  PROCESS_READ: 'process.read',
  PROCESS_CREATE: 'process.create',
  PROCESS_TERMINATE: 'process.terminate',
  PROCESS_PAUSE: 'process.pause',
  PROCESS_RESUME: 'process.resume',
  PROCESS_PRIORITY: 'process.priority',
  USER_MANAGE: 'user.manage',
  ROLE_MANAGE: 'role.manage',
};

// Aliases for compatibility between dot and colon notation
const PERMISSION_ALIASES = {
  'metrics:read': 'system.read',
  'system:read': 'system.read',
  'process:read': 'process.read',
  'process:create': 'process.create',
  'process:terminate': 'process.terminate',
  'process:pause': 'process.pause',
  'process:resume': 'process.resume',
  'process:priority': 'process.priority',
  'user:manage': 'user.manage',
  'role:manage': 'role.manage',
};

// Role-to-Permissions Mapping strictly conforming to the Section 6 specification
const ROLE_PERMISSIONS = {
  admin: [
    '*', // Administrator possesses all permissions
    PERMISSIONS.SYSTEM_READ,
    PERMISSIONS.PROCESS_READ,
    PERMISSIONS.PROCESS_CREATE,
    PERMISSIONS.PROCESS_TERMINATE,
    PERMISSIONS.PROCESS_PAUSE,
    PERMISSIONS.PROCESS_RESUME,
    PERMISSIONS.PROCESS_PRIORITY,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.ROLE_MANAGE,
  ],
  standard: [
    PERMISSIONS.SYSTEM_READ,
    PERMISSIONS.PROCESS_READ,
    // Standard User CANNOT: process.create, process.terminate, process.pause, process.resume, process.priority, user.manage, role.manage
  ],
  // Legacy / read-only viewer role
  viewer: [
    PERMISSIONS.SYSTEM_READ,
    PERMISSIONS.PROCESS_READ,
  ],
};

const normalizePermission = (perm) => {
  if (!perm) return perm;
  return PERMISSION_ALIASES[perm] || perm;
};

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  normalizePermission,
};
