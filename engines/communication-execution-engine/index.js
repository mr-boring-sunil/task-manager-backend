/**
 * Communication & Execution Engine (CEE)
 * Public entry point for API Gateway, Route management, and SSE Streaming.
 * Raspberry Pi Task Manager
 */

const schedulingAdapter = require('./adapters/scheduling.adapter');
const securityAdapter = require('./adapters/security.adapter');
const streamService = require('./services/stream.service');
const processRoutes = require('./routes/process.routes');
const metricsRoutes = require('./routes/metrics.routes');
const streamRoutes = require('./routes/stream.routes');
const { ceeLogger } = require('../../shared/logger/engineLogger');

/**
 * Initialize Communication & Execution Engine
 * Injects references to SE and DSE into adapters.
 * @param {object} [schedulingEngine]
 * @param {object} [databaseSecurityEngine]
 */
const init = async (schedulingEngine = null, databaseSecurityEngine = null) => {
  ceeLogger.info('Initializing Communication & Execution Engine...');

  if (schedulingEngine) {
    schedulingAdapter.setEngine(schedulingEngine);
  }

  if (databaseSecurityEngine) {
    securityAdapter.setEngine(databaseSecurityEngine);
  }

  ceeLogger.info('Communication & Execution Engine initialized.');

  return {
    routes: {
      processes: processRoutes,
      metrics: metricsRoutes,
      stream: streamRoutes,
    },
    streamService,
  };
};

module.exports = {
  init,
  routes: {
    processes: processRoutes,
    metrics: metricsRoutes,
    stream: streamRoutes,
  },
  streamService,
  schedulingAdapter,
  securityAdapter,
};
