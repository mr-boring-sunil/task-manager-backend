/**
 * System Metrics Routes
 * Exposes endpoints for hardware and OS performance metrics.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const express = require('express');
const router = express.Router();

const metricsController = require('../controllers/metrics.controller');

// GET /api/v1/metrics/overview - System overview
router.get('/overview', (req, res, next) => {
  metricsController.getOverview(req, res, next);
});

// GET /api/v1/metrics/cpu - Detailed CPU usage & per-core
router.get('/cpu', (req, res, next) => {
  metricsController.getCpu(req, res, next);
});

// GET /api/v1/metrics/memory - Detailed RAM & Swap
router.get('/memory', (req, res, next) => {
  metricsController.getMemory(req, res, next);
});

// GET /api/v1/metrics/disk - Filesystem mounts and storage capacity
router.get('/disk', (req, res, next) => {
  metricsController.getDisk(req, res, next);
});

// GET /api/v1/metrics/network - Network interface stats & transfer rates
router.get('/network', (req, res, next) => {
  metricsController.getNetwork(req, res, next);
});

// GET /api/v1/metrics/temperature - Raspberry Pi CPU thermal readings
router.get('/temperature', (req, res, next) => {
  metricsController.getTemperature(req, res, next);
});

module.exports = router;
