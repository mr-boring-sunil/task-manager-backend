/**
 * System Metrics API Request Controller
 * Handles HTTP requests for system performance telemetry.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const metricsService = require('../services/metrics.service');
const { sendSuccess } = require('../utils/response');
const { HTTP_STATUS } = require('../../../shared/errors/errorCodes');

class MetricsController {
  async getOverview(req, res, next) {
    try {
      const data = await metricsService.getOverview();
      return sendSuccess(res, data, 'System overview metrics retrieved successfully', HTTP_STATUS.OK);
    } catch (err) {
      next(err);
    }
  }

  async getCpu(req, res, next) {
    try {
      const data = await metricsService.getCpuMetrics();
      return sendSuccess(res, data, 'CPU metrics retrieved successfully', HTTP_STATUS.OK);
    } catch (err) {
      next(err);
    }
  }

  async getMemory(req, res, next) {
    try {
      const data = await metricsService.getMemoryMetrics();
      return sendSuccess(res, data, 'Memory metrics retrieved successfully', HTTP_STATUS.OK);
    } catch (err) {
      next(err);
    }
  }

  async getDisk(req, res, next) {
    try {
      const data = await metricsService.getDiskMetrics();
      return sendSuccess(res, data, 'Disk metrics retrieved successfully', HTTP_STATUS.OK);
    } catch (err) {
      next(err);
    }
  }

  async getNetwork(req, res, next) {
    try {
      const data = await metricsService.getNetworkMetrics();
      return sendSuccess(res, data, 'Network metrics retrieved successfully', HTTP_STATUS.OK);
    } catch (err) {
      next(err);
    }
  }

  async getTemperature(req, res, next) {
    try {
      const data = await metricsService.getTemperatureMetrics();
      return sendSuccess(res, data, 'Temperature metrics retrieved successfully', HTTP_STATUS.OK);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MetricsController();
