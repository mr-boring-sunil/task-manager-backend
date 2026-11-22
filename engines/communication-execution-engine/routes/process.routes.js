/**
 * Process Routes
 * Exposes endpoints for managing Linux processes.
 * Contains no business logic or shell execution.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const express = require('express');
const router = express.Router();

const processController = require('../controllers/process.controller');
const {
  validatePidParam,
  validateCreateProcessBody,
  validatePriorityBody,
  validateProcessListQuery,
} = require('../middleware/validation.middleware');
const { mutationRateLimiter } = require('../middleware/rate-limit.middleware');
const { authenticate, authorize, optionalAuthenticate } = require('../middleware/auth.middleware');

// GET /api/v1/processes/users - Distinct list of active users running processes
router.get('/users', optionalAuthenticate, (req, res, next) => {
  processController.listActiveUsers(req, res, next);
});

// GET /api/v1/processes - List processes with filtering & pagination
router.get('/', optionalAuthenticate, validateProcessListQuery, (req, res, next) => {
  processController.listProcesses(req, res, next);
});

// GET /api/v1/processes/:pid - Get single process details
router.get('/:pid', validatePidParam, (req, res, next) => {
  processController.getProcessById(req, res, next);
});

// POST /api/v1/processes - Launch a permitted process
router.post(
  '/',
  authenticate,
  authorize('process:create'),
  mutationRateLimiter,
  validateCreateProcessBody,
  (req, res, next) => {
    processController.createProcess(req, res, next);
  }
);

// DELETE /api/v1/processes/:pid - Terminate a process
router.delete(
  '/:pid',
  authenticate,
  authorize('process:terminate'),
  mutationRateLimiter,
  validatePidParam,
  (req, res, next) => {
    processController.terminateProcess(req, res, next);
  }
);

// POST /api/v1/processes/:pid/pause - Pause a process (SIGSTOP)
router.post(
  '/:pid/pause',
  authenticate,
  authorize('process:pause'),
  mutationRateLimiter,
  validatePidParam,
  (req, res, next) => {
    processController.pauseProcess(req, res, next);
  }
);

// POST /api/v1/processes/:pid/resume - Resume a paused process (SIGCONT)
router.post(
  '/:pid/resume',
  authenticate,
  authorize('process:resume'),
  mutationRateLimiter,
  validatePidParam,
  (req, res, next) => {
    processController.resumeProcess(req, res, next);
  }
);

// PATCH /api/v1/processes/:pid/priority - Change process nice priority
router.patch(
  '/:pid/priority',
  authenticate,
  authorize('process:priority'),
  mutationRateLimiter,
  validatePidParam,
  validatePriorityBody,
  (req, res, next) => {
    processController.changePriority(req, res, next);
  }
);

module.exports = router;
