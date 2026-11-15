# Database Design & Security Specification

## 1. Storage Engine Overview

The backend uses **SQLite** as its persistent storage engine, leveraging Node.js 24's native `node:sqlite` (`DatabaseSync`) module with automatic fallback to `better-sqlite3`.

### Key Engine Advantages
- **Zero External Daemon**: Runs in-process with minimal memory footprint (vital for Raspberry Pi SBCs).
- **Zero Native Build Toolchain**: Node.js 24 embeds SQLite directly, eliminating compilation issues on ARMv7/ARMv8/AArch64 Raspberry Pi architectures.
- **WAL Mode (Write-Ahead Logging)**: Enabled on file-backed databases (`PRAGMA journal_mode = WAL;`) allowing concurrent read operations without blocking writes.
- **Foreign Key Enforcement**: `PRAGMA foreign_keys = ON;` is explicitly executed on connection initialization to guarantee referential integrity.

---

## 2. Relational Schema Definition

The relational database consists of three core tables: `users`, `audit_logs`, and `schema_migrations`.

```sql
-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'standard' CHECK(role IN ('admin', 'standard', 'viewer')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login TEXT
);

-- 2. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('SUCCESS', 'FAILURE')),
    ip_address TEXT NOT NULL,
    request_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 3. Schema Migrations Table
CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 3. Performance Indexes

Dedicated indexes are maintained to accelerate common query patterns:

```sql
-- Fast username lookups during authentication
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Audit query performance for recent log inspection
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Fast audit queries filtered by user
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- Fast audit queries filtered by operational action
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
```

---

## 4. Migration System

Migrations are managed programmatically by `engines/database-security-engine/database/migrations/migration.runner.js`:
- Each migration is tracked in `schema_migrations`.
- Applied migrations are never re-run.
- On startup, `dse.init()` automatically checks and applies pending migrations before any other engine queries the database.
- If no users exist after initial migration, `DSE` automatically provisions an initial administrative user using credentials from environment variables (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).

---

## 5. Security & Cryptographic Implementation

### Password Hashing (`password.hasher.js`)
- **Algorithm**: `scrypt` (via Node's native `crypto.scryptSync`).
- **Salt Generation**: 32 cryptographically strong pseudo-random bytes (`crypto.randomBytes(32)`).
- **Cost Parameters**:
  - `cost (N)`: `16384` (CPU/memory cost parameter)
  - `blockSize (r)`: `8`
  - `parallelization (p)`: `1`
  - `keylen`: `64` bytes
- **Storage Format**: Hex-encoded hash and hex-encoded salt stored in separate columns (`password_hash`, `salt`).

### Constant-Time Verification
To prevent timing attacks that leak password length or partial match information, password comparison is executed with:
```javascript
crypto.timingSafeEqual(computedHashBuffer, storedHashBuffer);
```

### Audit Log Sanitization
Before saving any event details to `audit_logs.details`, `audit.service.js` automatically strips or redacts sensitive keys:
- `password`
- `token`
- `apiKey`
- `secret`
- `salt`
- `password_hash`
Redacted values are replaced with `'[REDACTED]'`.
