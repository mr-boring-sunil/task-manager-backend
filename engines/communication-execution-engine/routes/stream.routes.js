/**
 * Stream Routes
 * Real-time Server-Sent Events (SSE) connections for dashboard updates.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const express = require('express');
const router = express.Router();

const streamController = require('../controllers/stream.controller');

// GET /api/v1/stream/metrics - Real-time system performance SSE stream
router.get('/metrics', (req, res) => {
  streamController.streamMetrics(req, res);
});

// GET /api/v1/stream/processes - Real-time process monitoring SSE stream
router.get('/processes', (req, res) => {
  streamController.streamProcesses(req, res);
});

// GET /api/v1/stream/status - SSE stream status
router.get('/status', (req, res) => {
  streamController.getStatus(req, res);
});

module.exports = router;
