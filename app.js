/**
 * Express Application Gateway
 * Orchestrates middleware, CEE routes, Swagger UI, and error handling.
 * Raspberry Pi Task Manager — Unified Backend
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const serverConfig = require('./config/server.config');
const { generalRateLimiter } = require('./engines/communication-execution-engine/middleware/rate-limit.middleware');
const { notFoundHandler, errorHandler } = require('./engines/communication-execution-engine/middleware/error.middleware');
const { sendSuccess } = require('./engines/communication-execution-engine/utils/response');

// Import CEE routes
const processRoutes = require('./engines/communication-execution-engine/routes/process.routes');
const metricsRoutes = require('./engines/communication-execution-engine/routes/metrics.routes');
const streamRoutes = require('./engines/communication-execution-engine/routes/stream.routes');

const createApp = () => {
  const app = express();

  // Trust proxy for accurate client IP behind reverse proxy / Nginx
  app.set('trust proxy', 1);

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Permissive for Swagger UI
      crossOriginEmbedderPolicy: false,
    })
  );

  // Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: serverConfig.corsOrigin === '*' ? '*' : serverConfig.corsOrigin.split(','),
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    })
  );

  // Request Body Parsing with strict size limits
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  // Apply General Rate Limiting to all /api endpoints
  app.use('/api', generalRateLimiter);

  // Health Check Endpoint
  app.get('/health', (req, res) => {
    return sendSuccess(res, { status: 'healthy', uptime: process.uptime() }, 'Engine healthy');
  });

  // Swagger OpenAPI Documentation UI
  try {
    const openapiPath = path.join(__dirname, 'engines', 'communication-execution-engine', 'docs', 'openapi.yaml');
    const swaggerDocument = YAML.load(openapiPath);
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  } catch (err) {
    console.warn(`[SWAGGER] Could not load openapi.yaml: ${err.message}`);
  }

  // Mount API v1 Routes
  app.use('/api/v1/processes', processRoutes);
  app.use('/api/v1/metrics', metricsRoutes);
  app.use('/api/v1/stream', streamRoutes);

  // 404 Catch-All Handler
  app.use(notFoundHandler);

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
