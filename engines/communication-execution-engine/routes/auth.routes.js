/**
 * Authentication Routes
 * Exposes endpoints for PAM login, session validation, user profile, and logout.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

// POST /api/v1/auth/login - Authenticate Linux user and create session
router.post('/login', (req, res, next) => {
  authController.login(req, res, next);
});

// GET /api/v1/auth/session - Validate current session
router.get('/session', authenticate, (req, res, next) => {
  authController.getSession(req, res, next);
});

// GET /api/v1/auth/me - Get current user and permissions
router.get('/me', authenticate, (req, res, next) => {
  authController.getMe(req, res, next);
});

// POST /api/v1/auth/logout - Revoke session and clear cookies
router.post('/logout', (req, res, next) => {
  authController.logout(req, res, next);
});

module.exports = router;
