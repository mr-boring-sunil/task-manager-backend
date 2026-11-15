/**
 * Process API Request Controller
 * Handles HTTP requests and coordinates with ProcessService.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const processService = require('../services/process.service');
const { sendSuccess } = require('../utils/response');
const { HTTP_STATUS } = require('../../../shared/errors/errorCodes');

class ProcessController {
  async listProcesses(req, res, next) {
    try {
      const result = await processService.listProcesses(req.query);
      return sendSuccess(res, result, 'Processes retrieved successfully', HTTP_STATUS.OK);
    } catch (err) {
      next(err);
    }
  }

  async getProcessById(req, res, next) {
    try {
      const pid = req.validatedPid || req.params.pid;
      const processData = await processService.getProcess(pid);
      return sendSuccess(res, processData, 'Process retrieved successfully', HTTP_STATUS.OK);
    } catch (err) {
      next(err);
    }
  }

  async createProcess(req, res, next) {
    try {
      const result = await processService.createProcess(req.body, req.user);
      return sendSuccess(res, result, 'Process started successfully', HTTP_STATUS.CREATED);
    } catch (err) {
      next(err);
    }
  }

  async terminateProcess(req, res, next) {
    try {
      const pid = req.validatedPid || req.params.pid;
      const signal = req.query.signal || 'SIGTERM';
      const result = await processService.terminateProcess(pid, signal, req.user);
      return sendSuccess(res, result, 'Process terminated successfully', HTTP_STATUS.OK);
    } catch (err) {
      next(err);
    }
  }

  async pauseProcess(req, res, next) {
    try {
      const pid = req.validatedPid || req.params.pid;
      const result = await processService.pauseProcess(pid, req.user);
      return sendSuccess(res, result, 'Process paused successfully', HTTP_STATUS.OK);
    } catch (err) {
      next(err);
    }
  }

  async resumeProcess(req, res, next) {
    try {
      const pid = req.validatedPid || req.params.pid;
      const result = await processService.resumeProcess(pid, req.user);
      return sendSuccess(res, result, 'Process resumed successfully', HTTP_STATUS.OK);
    } catch (err) {
      next(err);
    }
  }

  async changePriority(req, res, next) {
    try {
      const pid = req.validatedPid || req.params.pid;
      const priority = req.validatedPriority !== undefined ? req.validatedPriority : req.body.priority;
      const result = await processService.changePriority(pid, priority, req.user);
      return sendSuccess(res, result, 'Process priority updated successfully', HTTP_STATUS.OK);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProcessController();
