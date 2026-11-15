# Setup & Deployment Guide

## 1. Prerequisites

- **Operating System**: Raspberry Pi OS (Debian-based), Ubuntu 20.04+, Debian 11+, or Windows/macOS for development.
- **Node.js**: Version `18.0.0` or higher (Version `20.x` or `24.x` recommended; Node 24 includes built-in `node:sqlite`).
- **npm**: Version `8.0.0` or higher.
- **Linux Packages** (for production Raspberry Pi deployment):
  ```bash
  sudo apt-get update
  sudo apt-get install -y procps coreutils
  ```

---

## 2. Quick Start Installation

1. Navigate to the backend directory:
   ```bash
   cd task-manager/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

4. Seed the initial administrative user (optional; auto-seeded on first run):
   ```bash
   node scripts/seedAdmin.js admin AdminPassword123!
   ```

5. Start the backend server:
   ```bash
   npm start
   ```

The server will be reachable at `http://localhost:5000`.

---

## 3. Environment Configuration (`.env`)

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `5000` | HTTP listening port |
| `HOST` | `0.0.0.0` | HTTP interface binding (0.0.0.0 for LAN access) |
| `NODE_ENV` | `development` | Runtime environment (`development`, `production`, `test`) |
| `DB_PATH` | `./data/task_manager.db` | SQLite database file location (`:memory:` for testing) |
| `DB_WAL_MODE` | `true` | Enable SQLite Write-Ahead Logging |
| `JWT_SECRET` | `dev-secret-key-change-in-production` | Secret key for session tokens |
| `API_KEY` | `dev-task-manager-key-change-in-production` | Direct API key for React frontend / automated clients |
| `CORS_ORIGIN` | `*` | Allowed CORS origins (e.g. `http://localhost:3000`) |
| `LOG_INTERACTIONS`| `true` | Enable structured inter-engine interaction logging |
| `ADMIN_USERNAME` | `admin` | Initial admin username |
| `ADMIN_PASSWORD` | `AdminPassword123!` | Initial admin password |

---

## 4. Running Tests

The test suite covers unit tests for each individual engine, cross-engine integration tests, and full end-to-end REST/SSE tests:

```bash
# Run all test suites
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run end-to-end tests only
npm run test:e2e
```

---

## 5. Raspberry Pi Production Considerations

### Running Non-Root with Linux Capabilities
Running Node.js as `root` is a security risk. To allow the `pi` or non-root `taskmanager` user to adjust negative process nice values (`-20` to `-1`) without `sudo`, grant `CAP_SYS_NICE`:

```bash
# Grant CAP_SYS_NICE to the Node.js executable
sudo setcap 'cap_sys_nice=+ep' $(which node)
```

### Running as a systemd Service

Create a systemd unit file at `/etc/systemd/system/task-manager.service`:

```ini
[Unit]
Description=Raspberry Pi Task Manager Backend
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/Task-Manager/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
AmbientCapabilities=CAP_SYS_NICE

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable task-manager
sudo systemctl start task-manager
```

Inspect service logs:
```bash
journalctl -u task-manager -f
```

---

## 6. Common Troubleshooting

### 1. `EADDRINUSE: address already in use :::5000`
Another process is using port 5000. Either change `PORT=5001` in `.env` or terminate the blocking process:
```bash
sudo lsof -i :5000
sudo kill -9 <PID>
```

### 2. Temperature shows `null` / `available: false`
This indicates the hardware does not expose a thermal sensor (e.g., standard PC virtual machine) or `/sys/class/thermal/thermal_zone0/temp` is not accessible. As per specification, missing sensor values are accurately reported as unavailable rather than fabricated.

### 3. Missing `node:sqlite` on Node < 22
Node.js 22+ and 24+ provide built-in `node:sqlite`. For older Node.js versions (e.g. Node 18 or 20), install `better-sqlite3`:
```bash
npm install better-sqlite3
```
The connection manager (`database/connection.js`) automatically detects and uses `better-sqlite3` when `node:sqlite` is unavailable.
