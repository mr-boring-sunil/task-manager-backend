# Raspberry Pi Task Manager — Backend Architecture

## 1. System Overview

The Raspberry Pi Task Manager backend is an enterprise-grade Linux system monitoring and process management application engineered specifically for low-overhead execution on single-board computers (Raspberry Pi OS / Linux) running Node.js.

The backend integrates three decoupled, single-responsibility engines inside a single, unified Node.js process:
1. **Communication & Execution Engine (CEE)**: API Gateway, routing, request validation, Server-Sent Events (SSE) telemetry streaming, and cross-engine orchestration.
2. **Scheduling Engine (SE)**: Linux process management (`/proc`, `child_process`), signal dispatching (`SIGTERM`, `SIGKILL`, `SIGSTOP`, `SIGCONT`), priority adjustment (`renice`), and hardware telemetry collection (CPU, memory, disk, network, thermal).
3. **Database & Security Engine (DSE)**: Persistent storage with SQLite, password hashing (`crypto.scrypt`), session token & API key authentication, Role-Based Access Control (RBAC), protected PID guarding, and structured audit logging.

```
+-----------------------------------------------------------------------------------+
|                            UNIFIED NODE.JS PROCESS                                |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                 Communication & Execution Engine (CEE)                      |  |
|  |  Express Router  |  Controllers  |  Validators  |  SSE Telemetry Streams     |  |
|  |                                                                             |  |
|  |  [Process Orchestrator] <-------------> [Adapters & Response Envelopes]     |  |
|  +------------------------\-----------------------------/----------------------+  |
|                            \ Direct JS Function Calls  /                          |
|                             \                         /                           |
|       +----------------------v-----------------------v-----------------------+    |
|       |                                                                      |    |
|       |   [Interaction Logger] Logs [CEE -> SE], [SE -> CEE],                |    |
|       |                        [CEE -> DSE], [DSE -> CEE]                    |    |
|       |                                                                      |    |
|       +----------------------/-----------------------\-----------------------+    |
|                             /                         \                           |
|  +-------------------------v----------+     +----------v-----------------------+  |
|  |     Scheduling Engine (SE)         |     | Database & Security Engine (DSE) |  |
|  |  - Process Manager & Lifecycle     |     |  - SQLite (WAL Mode, node:sqlite)|  |
|  |  - Signal Operations (SIGTERM/KILL)|     |  - User Repository & Passwords   |  |
|  |  - Priority Manager (renice)       |     |  - RBAC (Admin, Standard, Viewer)|  |
|  |  - Telemetry (CPU, RAM, Disk, Net) |     |  - Audit Service (Redacted Logs) |  |
|  +------------------------------------+     +----------------------------------+  |
|                   |                                            |                  |
|                   v                                            v                  |
|          Linux Kernel / /proc                         SQLite task_manager.db      |
+-----------------------------------------------------------------------------------+
```

---

## 2. Directory Structure & Responsibilities

The codebase follows the master specification folder layout:

```text
task-manager/
├── backend/
│   ├── server.js                          # Unified bootstrap & graceful shutdown orchestrator
│   ├── app.js                             # Express application factory & middleware pipeline
│   ├── package.json                       # Dependencies & npm scripts
│   ├── .env.example                       # Documented environment configuration template
│   ├── config/
│   │   ├── database.config.js             # SQLite path, WAL mode, admin bootstrap config
│   │   ├── server.config.js               # Port, host, CORS, rate limits, protected PIDs
│   │   └── security.config.js             # Salt lengths, hash params, token TTLs, allowlists
│   ├── shared/
│   │   ├── logger/
│   │   │   ├── engineLogger.js            # Engine prefix loggers: [CEE], [SE], [DSE]
│   │   │   └── interactionLogger.js       # Mandatory inter-engine interaction logger
│   │   ├── errors/
│   │   │   ├── AppError.js                # Unified custom error hierarchy
│   │   │   └── errorCodes.js              # Standard machine-readable error codes
│   │   └── utils/
│   │       ├── asyncHandler.js            # Express async route wrapper
│   │       └── generateRequestId.js       # Nanoid/crypto request correlation ID generator
│   ├── engines/
│   │   ├── communication-execution-engine/# CEE root
│   │   │   ├── index.js                   # CEE initialization & engine interface
│   │   │   ├── routes/                    # REST route declarations
│   │   │   ├── controllers/               # HTTP request/response handlers
│   │   │   ├── orchestrators/             # Cross-engine transaction coordinator
│   │   │   ├── adapters/                  # SE and DSE communication adapters
│   │   │   ├── services/                  # SSE streams & telemetry services
│   │   │   ├── middleware/                # Auth, validation, rate limiting, error handling
│   │   │   ├── validators/                # Joi request schema validation
│   │   │   └── utils/response.js          # Standardized JSend-compliant envelope
│   │   ├── scheduling-engine/             # SE root
│   │   │   ├── index.js                   # SE initialization & public interface
│   │   │   ├── interface/                 # Interface definition & method signatures
│   │   │   ├── managers/                  # Process and priority coordinator managers
│   │   │   ├── modules/                   # Low-level process info, lifecycle, and state
│   │   │   ├── operations/                # Linux signal execution (SIGTERM, SIGKILL, etc.)
│   │   │   ├── collectors/                # CPU, Memory, Disk, Network, Thermal collectors
│   │   │   ├── monitoring/                # System telemetry aggregator
│   │   │   ├── validation/                # Command allowlisting & parameter validation
│   │   │   └── utils/proc.reader.js       # Linux /proc filesystem direct reader
│   │   └── database-security-engine/      # DSE root
│   │       ├── index.js                   # DSE initialization & public interface
│   │       ├── interface/                 # Security interface definition
│   │       ├── database/
│   │       │   ├── connection.js          # SQLite connection manager (node:sqlite)
│   │       │   ├── schema.sql             # SQL schema (users, audit_logs, migrations)
│   │       │   ├── migrations/            # Migration runner
│   │       │   └── repositories/          # User and Audit SQL query encapsulation
│   │       ├── authentication/            # scrypt password hasher & token generator
│   │       ├── authorization/             # RBAC and protected PID enforcement
│   │       ├── audit/                     # Audit logger with automated secret redaction
│   │       ├── services/                  # User service business logic
│   │       └── validators/                # User input validator
│   ├── docs/                              # Architectural & operational documentation
│   ├── tests/
│   │   ├── unit/                          # Unit tests for CEE, SE, DSE
│   │   ├── integration/                   # Cross-engine function call & logging tests
│   │   └── end-to-end/                    # Full REST API & SSE test suites
│   └── scripts/
│       └── seedAdmin.js                   # CLI tool to seed/reset administrator account
└── README.md
```

---

## 3. Request Lifecycle

Every client interaction follows a strict hierarchical lifecycle without bypassing architectural boundaries:

```
[HTTP Client / React Dashboard]
             |
             v (HTTP REST / SSE)
     [app.js: Middleware]
  (Helmet, CORS, Rate Limit, Auth, RequestId)
             |
             v
       [Route Handler]
             |
             v (Joi Validation)
      [Controller Layer]
             |
             v
 [CEE: Process Orchestrator]
       /                   \
      /                     \ Direct JS Calls
     v                       v
[Security Adapter]       [Scheduling Adapter]
     |                       |
     v [Interaction Logger]  v [Interaction Logger]
 [DSE Interface]         [SE Interface]
  - RBAC Verification     - Command Allowlist
  - Protected PID Guard   - /proc inspection
  - SQLite Audit Log      - POSIX Signal Dispatch
```

1. **Ingress & Security Gate**: Express receives the HTTP request, assigns a unique `x-request-id`, applies CORS and security headers, and verifies identity via `auth.middleware.js` (Bearer token or `x-api-key`).
2. **Controller & Validation**: The controller invokes Joi schemas to validate query parameters or JSON payloads, rejecting malformed requests with `422 Unprocessable Entity`.
3. **Orchestration**: The controller delegates business logic to `ProcessOrchestrator`.
4. **Cross-Engine Coordination**:
   - The orchestrator first calls `securityAdapter.authorizeAction(user, action, resource)`.
   - `DSE` evaluates RBAC roles and prevents actions on protected PIDs (e.g., PID 1, server PID).
   - If authorized, the orchestrator invokes `schedulingAdapter.<operation>()`.
   - `SE` executes Linux process or telemetry operations.
   - On completion, the orchestrator calls `securityAdapter.recordAuditEvent()` to record the event in SQLite.
5. **Standardized Response**: The controller formats output via `response.js`:
   `{ success: true, data: { ... }, meta: { timestamp, requestId } }`.

---

## 4. Process Management & Linux Systems Design

- **POSIX Signal Escalation**: Graceful termination dispatches `SIGTERM`. If the process remains active after 3000ms (`TERMINATION_TIMEOUT_MS`), `SE` escalates to `SIGKILL`.
- **Protected Process Defense**: PIDs `1` (systemd/init), `0`, `process.pid` (the backend server itself), and `process.ppid` are hardcoded as protected and cannot be paused, reniced, or terminated.
- **Process Spawning Allowlist**: Commands are checked against `ALLOWED_COMMANDS` (`node`, `python3`, `bash`, `sh`, `htop`, etc.). Arguments are strictly validated to prevent shell injection (`;&|><$` operators are rejected).
- **Process Priority**: Priority adjustments map to Linux `nice` values (`-20` to `19`). Negative nice values require `CAP_SYS_NICE` capabilities.

---

## 5. Security Architecture

1. **Zero-Plaintext Storage**: Passwords are cryptographically hashed using Node's native `crypto.scryptSync` with a unique 32-byte cryptographically random salt per user (16,384 iterations, memory cost 8, parallelization 1).
2. **Constant-Time Verification**: Password verification uses `crypto.timingSafeEqual` to defeat timing attacks.
3. **Automated Secret Redaction**: Audit log details automatically redact sensitive keys (`password`, `token`, `apiKey`, `secret`, `salt`, `password_hash`).
4. **Role-Based Access Control**:
   - `admin`: Full administrative access to all endpoints.
   - `standard`: Read metrics, manage non-protected processes.
   - `viewer`: Read-only access to processes and telemetry.
