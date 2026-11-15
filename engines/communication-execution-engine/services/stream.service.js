/**
 * Real-Time Communication Manager (Server-Sent Events)
 * Manages SSE connections for metrics and process streaming with shared polling loops,
 * heartbeats, and client disconnect cleanup to prevent memory leaks and high CPU usage.
 * Raspberry Pi Task Manager — Communication & Execution Engine
 */

const serverConfig = require('../../../config/server.config');
const metricsService = require('./metrics.service');
const processService = require('./process.service');
const { ceeLogger } = require('../../../shared/logger/engineLogger');

class StreamService {
  constructor() {
    this.channels = {
      metrics: {
        clients: new Set(),
        intervalTimer: null,
        intervalMs: serverConfig.stream.defaultIntervalMs,
        isPolling: false,
      },
      processes: {
        clients: new Set(),
        intervalTimer: null,
        intervalMs: serverConfig.stream.defaultIntervalMs,
        isPolling: false,
      },
    };

    this.heartbeatTimer = null;
    this.clientIdCounter = 1;

    // Start global heartbeat timer
    this.startHeartbeat();
  }

  /**
   * Register a new client for an SSE channel
   * @param {'metrics'|'processes'} channelName
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {number} [requestedIntervalMs]
   */
  registerClient(channelName, req, res, requestedIntervalMs = null) {
    const channel = this.channels[channelName];
    if (!channel) {
      throw new Error(`Invalid streaming channel: ${channelName}`);
    }

    const clientId = `client_${this.clientIdCounter++}_${Date.now()}`;

    // Setup SSE Headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in Nginx if reverse proxied
      'Access-Control-Allow-Origin': serverConfig.corsOrigin,
    });

    if (res.flushHeaders) {
      res.flushHeaders();
    }

    const client = {
      id: clientId,
      req,
      res,
      connectedAt: new Date().toISOString(),
      remoteAddress: req.ip || (req.socket && req.socket.remoteAddress) || '127.0.0.1',
    };

    channel.clients.add(client);
    ceeLogger.info(`[SSE] Client ${clientId} connected to channel '${channelName}' (Total: ${channel.clients.size})`);

    // Send initial welcome/connected event
    this.sendToClient(client, 'connected', {
      clientId,
      channel: channelName,
      intervalMs: channel.intervalMs,
      timestamp: new Date().toISOString(),
    });

    // Immediately push initial data packet
    this.dispatchInitialData(channelName, client);

    // If this is the first client, start shared collector loop
    if (channel.clients.size === 1) {
      if (requestedIntervalMs && requestedIntervalMs >= serverConfig.stream.minIntervalMs) {
        channel.intervalMs = requestedIntervalMs;
      }
      this.startSharedLoop(channelName);
    }

    // Handle client disconnect
    const cleanup = () => {
      this.removeClient(channelName, client);
    };

    req.on('close', cleanup);
    req.on('end', cleanup);
    res.on('close', cleanup);
    res.on('error', (err) => {
      ceeLogger.warn(`[SSE] Client ${clientId} connection error: ${err.message}`);
      cleanup();
    });

    return client;
  }

  /**
   * Remove client and stop shared collector if no clients remain
   * @param {'metrics'|'processes'} channelName
   * @param {object} client
   */
  removeClient(channelName, client) {
    const channel = this.channels[channelName];
    if (!channel) return;

    if (channel.clients.has(client)) {
      channel.clients.delete(client);
      ceeLogger.info(`[SSE] Client ${client.id} disconnected from '${channelName}' (Remaining: ${channel.clients.size})`);

      try {
        if (!client.res.writableEnded) {
          client.res.end();
        }
      } catch (e) {
        // Ignored
      }
    }

    // If no active clients remain on channel, stop polling loop to save CPU
    if (channel.clients.size === 0) {
      this.stopSharedLoop(channelName);
    }
  }

  /**
   * Dispatch initial payload immediately upon connection
   */
  async dispatchInitialData(channelName, client) {
    try {
      if (channelName === 'metrics') {
        const data = await metricsService.getOverview();
        this.sendToClient(client, 'metrics', data);
      } else if (channelName === 'processes') {
        const data = await processService.listProcesses({ limit: 50, sortBy: 'cpu', order: 'desc' });
        this.sendToClient(client, 'processes', data);
      }
    } catch (err) {
      this.sendToClient(client, 'error', { message: err.message });
    }
  }

  /**
   * Start shared polling loop for a channel
   * Avoids running multiple timers for multiple clients.
   * @param {'metrics'|'processes'} channelName
   */
  startSharedLoop(channelName) {
    const channel = this.channels[channelName];
    if (!channel || channel.intervalTimer) return;

    ceeLogger.info(`[SSE] Starting shared polling loop for '${channelName}' (${channel.intervalMs}ms)`);

    channel.intervalTimer = setInterval(async () => {
      if (channel.isPolling) return; // Prevent overlapping ticks
      channel.isPolling = true;

      try {
        if (channelName === 'metrics') {
          const metrics = await metricsService.getOverview();
          this.broadcast(channelName, 'metrics', metrics);
        } else if (channelName === 'processes') {
          const result = await processService.listProcesses({ limit: 50, sortBy: 'cpu', order: 'desc' });
          this.broadcast(channelName, 'processes', result);
        }
      } catch (err) {
        this.broadcast(channelName, 'error', { message: 'Monitoring collection failed: ' + err.message });
      } finally {
        channel.isPolling = false;
      }
    }, channel.intervalMs);

    if (channel.intervalTimer.unref) {
      channel.intervalTimer.unref();
    }
  }

  /**
   * Stop shared polling loop when no clients are listening
   * @param {'metrics'|'processes'} channelName
   */
  stopSharedLoop(channelName) {
    const channel = this.channels[channelName];
    if (!channel) return;

    if (channel.intervalTimer) {
      clearInterval(channel.intervalTimer);
      channel.intervalTimer = null;
      ceeLogger.info(`[SSE] Stopped shared polling loop for '${channelName}' (0 subscribers)`);
    }
  }

  /**
   * Format and send an SSE frame to a single client
   */
  sendToClient(client, event, data) {
    if (!client || !client.res || client.res.writableEnded) return;

    try {
      const payload = JSON.stringify(data);
      client.res.write(`event: ${event}\ndata: ${payload}\n\n`);
    } catch (err) {
      ceeLogger.warn(`[SSE] Failed writing to client ${client.id}: ${err.message}`);
    }
  }

  /**
   * Broadcast an event to all connected clients on a channel
   */
  broadcast(channelName, event, data) {
    const channel = this.channels[channelName];
    if (!channel || channel.clients.size === 0) return;

    const payload = JSON.stringify(data);
    const frame = `event: ${event}\ndata: ${payload}\n\n`;

    for (const client of channel.clients) {
      if (client.res && !client.res.writableEnded) {
        try {
          client.res.write(frame);
        } catch (err) {
          this.removeClient(channelName, client);
        }
      } else {
        this.removeClient(channelName, client);
      }
    }
  }

  /**
   * Send heartbeat comments periodically to keep connections alive
   */
  startHeartbeat() {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      const ping = `: ping - ${new Date().toISOString()}\n\n`;

      Object.values(this.channels).forEach((channel) => {
        for (const client of channel.clients) {
          if (client.res && !client.res.writableEnded) {
            try {
              client.res.write(ping);
            } catch (err) {
              // Socket might be dead
            }
          }
        }
      });
    }, serverConfig.stream.heartbeatIntervalMs);

    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  /**
   * Get active connection stats
   */
  getStatus() {
    return {
      metricsClientsCount: this.channels.metrics.clients.size,
      processesClientsCount: this.channels.processes.clients.size,
      metricsIntervalMs: this.channels.metrics.intervalMs,
      processesIntervalMs: this.channels.processes.intervalMs,
    };
  }

  /**
   * Close all active SSE connections cleanly (for graceful shutdown)
   */
  closeAll() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    Object.keys(this.channels).forEach((name) => {
      this.stopSharedLoop(name);
      const channel = this.channels[name];
      for (const client of channel.clients) {
        try {
          this.sendToClient(client, 'shutdown', { message: 'Server is shutting down' });
          client.res.end();
        } catch (e) {
          // Ignore
        }
      }
      channel.clients.clear();
    });
  }
}

module.exports = new StreamService();
