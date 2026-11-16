/**
 * Database & Security Engine (DSE)
 * Public entry point for SQLite persistence, authentication, authorization, and auditing.
 * Raspberry Pi Task Manager
 */

const dbConn = require('./database/connection');
const migrationRunner = require('./database/migrations/migration.runner');
const userService = require('./services/user.service');
const securityInterface = require('./interface/security.interface');
const dbConfig = require('../../config/database.config');
const { dseLogger } = require('../../shared/logger/engineLogger');

/**
 * Initialize Database & Security Engine
 * Opens SQLite connection, applies migrations, and bootstraps initial admin user.
 */
const init = async (customDbPath = null) => {
  dseLogger.info('Initializing Database & Security Engine...');

  // 1. Establish SQLite connection
  dbConn.connect(customDbPath);

  // 2. Execute schema migrations
  await migrationRunner.runMigrations();

  // 3. Seed initial admin user if database is empty
  await userService.seedAdminIfEmpty(dbConfig.initialAdmin);

  dseLogger.info('Database & Security Engine initialized successfully.');
  return securityInterface;
};

/**
 * Close database connection
 */
const close = () => {
  dbConn.close();
};

module.exports = {
  init,
  close,
  interface: securityInterface,
  // Direct export of interface methods
  login: (username, password, meta) => securityInterface.login(username, password, meta),
  validateSession: (token) => securityInterface.validateSession(token),
  logout: (token, meta) => securityInterface.logout(token, meta),
  getPermissionsForRole: (role) => securityInterface.getPermissionsForRole(role),
  hasPermission: (role, permission) => securityInterface.hasPermission(role, permission),
  authenticateUser: (credentialsOrReq) => securityInterface.authenticateUser(credentialsOrReq),
  authorizeAction: (user, action, resource, meta) => securityInterface.authorizeAction(user, action, resource, meta),
  recordAuditEvent: (event) => securityInterface.recordAuditEvent(event),
  createUser: (userData) => securityInterface.createUser(userData),
  getUserByUsername: (username) => securityInterface.getUserByUsername(username),
  getAuditLogs: (limit) => securityInterface.getAuditLogs(limit),
};
