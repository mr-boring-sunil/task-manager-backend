/**
 * Application Server Entry Point
 * Orchestrates unified 3-engine startup: DSE -> SE -> CEE -> Express HTTP listener.
 * Manages port binding, graceful shutdown, and resource cleanup.
 * Raspberry Pi Task Manager — Unified Backend
 */

const http = require('http');
const serverConfig = require('./config/server.config');
const dse = require('./engines/database-security-engine');
const se = require('./engines/scheduling-engine');
const cee = require('./engines/communication-execution-engine');
const createApp = require('./app');
const { ceeLogger } = require('./shared/logger/engineLogger');

let server = null;
let isShuttingDown = false;

const startServer = async () => {
  try {
    console.log('================================================================');
    console.log('  Raspberry Pi Task Manager — Unified 3-Engine Backend Server   ');
    console.log('================================================================');

    // Step 1: Initialise Database & Security Engine (DSE)
    await dse.init();

    // Step 2: Initialise Scheduling Engine (SE)
    await se.init();

    // Step 3: Initialise Communication & Execution Engine (CEE) with SE & DSE injected
    await cee.init(se.interface, dse.interface);

    // Step 4: Create Express Gateway Application
    const app = createApp();
    server = http.createServer(app);

    // Step 5: Start One HTTP Server Listener
    server.listen(serverConfig.port, serverConfig.host, () => {
      console.log(`[SERVER] Environment: ${serverConfig.nodeEnv}`);
      console.log(`[SERVER] Listening on: http://${serverConfig.host}:${serverConfig.port}`);
      console.log(`[SERVER] API Base URL: http://${serverConfig.host}:${serverConfig.port}/api/v1`);
      console.log(`[SERVER] Swagger Docs: http://${serverConfig.host}:${serverConfig.port}/api/docs`);
      console.log(`[SERVER] Health Check: http://${serverConfig.host}:${serverConfig.port}/health`);
      console.log('================================================================\n');
    });

    return server;
  } catch (err) {
    console.error('[FATAL] Failed to start backend server:', err);
    process.exit(1);
  }
};

/**
 * Graceful Shutdown Handler
 */
const gracefulShutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\nReceived ${signal}. Starting graceful shutdown of all engines...`);

  // 1. Close all active SSE stream connections and sampling loops
  try {
    cee.streamService.closeAll();
    console.log('[CEE] Closed all SSE connections and paused polling loops.');
  } catch (e) {
    console.error('Error closing SSE streams:', e.message);
  }

  // 2. Stop accepting new HTTP connections
  if (server) {
    server.close((err) => {
      if (err) {
        console.error('Error closing HTTP server:', err);
      } else {
        console.log('[SERVER] HTTP server closed.');
      }

      // 3. Close SQLite database connection
      try {
        dse.close();
        console.log('[DSE] SQLite database connection closed.');
      } catch (dbErr) {
        console.error('Error closing database:', dbErr.message);
      }

      console.log('Unified backend shutdown complete.');
      process.exit(0);
    });

    // Forced exit timeout
    setTimeout(() => {
      console.error('Forced shutdown due to timeout.');
      process.exit(1);
    }, 5000).unref();
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Promise Rejection:', reason);
});

// Auto-start if invoked directly via node server.js
if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
  gracefulShutdown,
};
