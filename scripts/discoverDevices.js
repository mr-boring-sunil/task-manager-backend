#!/usr/bin/env node
/**
 * Raspberry Pi Task Manager — Native Device Discovery CLI
 * Probes local network or known hostnames via HTTP /health verification.
 */

const http = require('http');

const CANDIDATE_HOSTS = [
  'task-manager.local',
  'raspberrypi.local',
  'localhost',
  '127.0.0.1',
];
const PORT = 5000;
const TIMEOUT_MS = 2500;

function checkDevice(host, port) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host,
        port,
        path: '/health',
        timeout: TIMEOUT_MS,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            if (json.success && json.data && json.data.status === 'healthy') {
              resolve({
                host,
                port,
                online: true,
                uptime: json.data.uptime,
                message: json.message,
              });
              return;
            }
          } catch (e) {
            // non-json response
          }
          resolve({ host, port, online: false });
        });
      }
    );

    req.on('error', () => resolve({ host, port, online: false }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ host, port, online: false, error: 'TIMEOUT' });
    });
  });
}

async function main() {
  console.log('Scanning for Raspberry Pi Task Manager devices...');
  const results = await Promise.all(
    CANDIDATE_HOSTS.map((host) => checkDevice(host, PORT))
  );

  const found = results.filter((r) => r.online);
  if (found.length === 0) {
    console.log('No devices responding on known hostnames. Use manual IP entry.');
  } else {
    console.log(`Discovered ${found.length} device(s):`);
    found.forEach((d) => {
      console.log(` - http://${d.host}:${d.port} (uptime: ${d.uptime}s)`);
    });
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkDevice, CANDIDATE_HOSTS };
