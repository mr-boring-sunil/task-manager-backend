/**
 * Stream API Request Controller
 * Manages Server-Sent Events (SSE) streaming connections for the dashboard.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const streamService = require('../services/stream.service');
const { sendSuccess } = require('../utils/response');
const { HTTP_STATUS } = require('../../../shared/errors/errorCodes');

class StreamController {
  streamMetrics(req, res) {
    const requestedInterval = req.query.interval ? parseInt(req.query.interval, 10) : null;
    streamService.registerClient('metrics', req, res, requestedInterval);
  }

  streamProcesses(req, res) {
    const requestedInterval = req.query.interval ? parseInt(req.query.interval, 10) : null;
    streamService.registerClient('processes', req, res, requestedInterval);
  }

  getStatus(req, res) {
    const status = streamService.getStatus();
    return sendSuccess(res, status, 'Stream service status retrieved', HTTP_STATUS.OK);
  }
}

module.exports = new StreamController();
