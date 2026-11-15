/**
 * Authentication & Authorization Middleware
 * Connects routes to the Database & Security Engine Adapter.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const securityAdapter = require('../adapters/security.adapter');

const authenticate = async (req, res, next) => {
  try {
    const user = await securityAdapter.authenticateUser(req);
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

const authorize = (action) => {
  return async (req, res, next) => {
    try {
      const resource = req.params.pid || req.body || null;
      await securityAdapter.authorizeAction(req.user, action, resource);
      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = {
  authenticate,
  authorize,
};
