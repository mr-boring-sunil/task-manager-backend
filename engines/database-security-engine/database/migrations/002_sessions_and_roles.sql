-- ========================================================
-- Raspberry Pi Task Manager — Sessions and Roles Schema
-- Database & Security Engine Migration 002
-- ========================================================

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    session_token_hash TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'standard' CHECK(role IN ('admin', 'standard')),
    csrf_token TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_activity_at TEXT NOT NULL,
    is_revoked INTEGER NOT NULL DEFAULT 0 CHECK(is_revoked IN (0, 1)),
    ip_address TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_roles (
    username TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK(role IN ('admin', 'standard')),
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_roles_username ON user_roles(username);
