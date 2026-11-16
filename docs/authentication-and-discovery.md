# Authentication & Raspberry Pi Device Discovery Specification

## 1. Architecture Overview

The authentication and device discovery features are integrated directly into the unified 3-engine architecture:
- **React Dashboard Engine**: Frontend UI with mDNS/hostname device discovery, device selection persistence, login interface, session tracking, and permission-based controls.
- **Communication & Execution Engine (CEE)**: Express REST routes for `/api/v1/auth/*`, cookie parsing, CSRF protection, and inter-engine communication adapters.
- **Database & Security Engine (DSE)**: Isolated Linux PAM authentication adapter, cryptographically secure hashed session management in SQLite (`node:sqlite`), role-based access control (RBAC), and audit logging.
- **Scheduling Engine (SE)**: Linux process management and system monitoring, preserving POSIX OS process ownership and signal capabilities.

Communication between backend engines strictly executes via **direct JavaScript in-memory function calls** with structured inter-engine interaction logging.

---

## 2. PAM Credential Verification & Privilege Separation

### Linux PAM Helper (`pam_authenticator.py`)
- Location: `backend/engines/database-security-engine/adapters/pam-helper/pam_authenticator.py`
- Operates with minimum required privileges. The Node.js server does NOT run as root.
- Protocol:
  - Input via STDIN: `{"username": "<user>", "password": "<pass>", "service": "login"}`
  - Invokes POSIX `libpam.so.0` via `ctypes` (`pam_start`, `pam_authenticate`, `pam_acct_mgmt`, `pam_end`).
  - Output via STDOUT: `{"success": true, "username": "<user>"}` or `{"success": false, "error": "AUTH_FAILED"}`.
  - Zero command execution, zero shell injection risk, zero direct `/etc/shadow` file reads.
  - Immediately wipes memory buffers holding credentials after verification.

### Setup on Raspberry Pi OS:
```bash
# Ensure Python 3 and PAM development libraries are installed
sudo apt-get update
sudo apt-get install -y python3 libpam0g-dev

# Ensure the helper has execute permissions
chmod +x backend/engines/database-security-engine/adapters/pam-helper/pam_authenticator.py
```

---

## 3. Session Management

- **Token Generation**: 32-byte cryptographically secure random opaque token (`crypto.randomBytes(32)`).
- **Storage**: Only the SHA-256 hash of the token (`crypto.createHash('sha256')`) is stored in the SQLite `sessions` table.
- **Cookies**:
  - `taskmgr_session`: `HttpOnly`, `SameSite: Lax`, `Path: /`, `Secure` (in production).
  - `taskmgr_csrf`: Double-submit CSRF cookie (`HttpOnly: false`) validated via `x-csrf-token` header on mutating requests (`POST`, `PATCH`, `DELETE`).
- **Lifecycle**: Configurable expiration (default 3600 seconds / 1 hour), session revocation on logout, automatic expired session cleanup.

---

## 4. Role-Based Access Control (RBAC) Matrix

| Operation | Standard User | Administrator | Permission Key |
|---|:---:|:---:|---|
| View system metrics | Yes | Yes | `system.read` |
| View process list | Yes | Yes | `process.read` |
| View process details | Yes | Yes | `process.read` |
| Create process | **No** | **Yes** | `process.create` |
| Terminate process | **No** | **Yes** | `process.terminate` |
| Pause process | **No** | **Yes** | `process.pause` |
| Resume process | **No** | **Yes** | `process.resume` |
| Change process priority | **No** | **Yes** | `process.priority` |
| View system information | Yes | Yes | `system.read` |
| Manage application users/roles | **No** | **Yes** | `user.manage`, `role.manage` |

---

## 5. Device Discovery & Avahi mDNS

1. **Avahi Service Definition**:
   File: `backend/config/avahi/taskmanager.service`
   Copy to `/etc/avahi/services/taskmanager.service` on the Raspberry Pi:
   ```bash
   sudo cp backend/config/avahi/taskmanager.service /etc/avahi/services/
   sudo systemctl restart avahi-daemon
   ```
2. **Browser Discovery Mechanism**:
   - Probes `task-manager.local:5000`, `raspberrypi.local:5000`, `localhost:5000`, and remembered devices using `GET /health`.
   - Validates response payload (`status === "healthy"`).
   - Provides manual IP/hostname entry as fallback.
