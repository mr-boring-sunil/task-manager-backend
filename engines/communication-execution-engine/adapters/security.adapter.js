/**
 * Database & Security Engine Adapter (CEE -> DSE)
 * Inter-engine communication adapter calling DSE with mandatory interaction logging.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const interactionLogger = require('../../../shared/logger/interactionLogger');
const defaultDse = require('../../database-security-engine');

class SecurityAdapter {
  constructor(dseInstance = defaultDse) {
    this.dse = dseInstance;
  }

  setEngine(dseInstance) {
    this.dse = dseInstance;
  }

  async login(username, password, meta = {}, requestId = null) {
    return interactionLogger.execute('CEE', 'DSE', 'login', async () => {
      return this.dse.login(username, password, meta);
    }, requestId);
  }

  async validateSession(token, requestId = null) {
    return interactionLogger.execute('CEE', 'DSE', 'validateSession', async () => {
      return this.dse.validateSession(token);
    }, requestId);
  }

  async logout(token, meta = {}, requestId = null) {
    return interactionLogger.execute('CEE', 'DSE', 'logout', async () => {
      return this.dse.logout(token, meta);
    }, requestId);
  }

  getPermissionsForRole(role) {
    return this.dse.getPermissionsForRole(role);
  }

  async authenticateUser(credentialsOrReq, requestId = null) {
    return interactionLogger.execute('CEE', 'DSE', 'authenticateUser', async () => {
      return this.dse.authenticateUser(credentialsOrReq);
    }, requestId);
  }

  async authorizeAction(user, action, resource = null, requestId = null) {
    return interactionLogger.execute('CEE', 'DSE', 'authorizeAction', async () => {
      return this.dse.authorizeAction(user, action, resource);
    }, requestId);
  }

  async recordAuditEvent(event, requestId = null) {
    return interactionLogger.execute('CEE', 'DSE', 'recordAuditEvent', async () => {
      return this.dse.recordAuditEvent(event);
    }, requestId);
  }
}

module.exports = new SecurityAdapter();
