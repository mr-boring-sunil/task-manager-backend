/**
 * SQLite Database Connection Manager
 * Manages database lifecycle, WAL mode, prepared statements, and directory creation.
 * Uses Node.js native node:sqlite (DatabaseSync) with zero external compilation dependencies.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const fs = require('fs');
const path = require('path');
const dbConfig = require('../../../config/database.config');
const { dseLogger } = require('../../../shared/logger/engineLogger');
const { DatabaseError } = require('../../../shared/errors/AppError');

class DatabaseConnection {
  constructor() {
    this.db = null;
    this.isOpen = false;
  }

  /**
   * Open or initialize database connection
   * @param {string} [customPath]
   */
  connect(customPath = null) {
    if (this.isOpen && this.db) {
      return this.db;
    }

    const targetPath = customPath || dbConfig.dbPath;

    try {
      // If path is not :memory:, ensure directory exists
      if (targetPath !== ':memory:') {
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      // 1. Primary Driver: node:sqlite (Node 22.5.0+, Node 24+)
      try {
        const { DatabaseSync } = require('node:sqlite');
        this.db = new DatabaseSync(targetPath);
        this.driver = 'node:sqlite';
      } catch (nodeSqliteErr) {
        // 2. Fallback to better-sqlite3 if present
        try {
          const BetterSqlite = require('better-sqlite3');
          this.db = new BetterSqlite(targetPath);
          this.driver = 'better-sqlite3';
        } catch (betterErr) {
          throw new DatabaseError(
            `No compatible SQLite driver found. Node.js >= 22.5.0 with node:sqlite or better-sqlite3 is required: ${nodeSqliteErr.message}`
          );
        }
      }

      this.isOpen = true;

      // Configure SQLite pragmas for performance and data safety on Raspberry Pi
      if (targetPath !== ':memory:') {
        if (dbConfig.walMode) {
          this.db.exec('PRAGMA journal_mode = WAL;');
        }
        this.db.exec('PRAGMA synchronous = NORMAL;');
      }
      this.db.exec('PRAGMA foreign_keys = ON;');

      dseLogger.info(`Connected to SQLite database at ${targetPath} (driver: ${this.driver})`);
      return this.db;
    } catch (err) {
      this.isOpen = false;
      this.db = null;
      dseLogger.error(`Failed to connect to database at ${targetPath}`, err);
      throw new DatabaseError(`Database connection failed: ${err.message}`, { path: targetPath });
    }
  }

  /**
   * Execute raw SQL (e.g. DDL scripts)
   * @param {string} sql
   */
  exec(sql) {
    if (!this.isOpen || !this.db) {
      this.connect();
    }
    return this.db.exec(sql);
  }

  /**
   * Prepare a statement for execution
   * @param {string} sql
   */
  prepare(sql) {
    if (!this.isOpen || !this.db) {
      this.connect();
    }
    return this.db.prepare(sql);
  }

  /**
   * Close the database connection cleanly
   */
  close() {
    if (this.isOpen && this.db) {
      try {
        this.db.close();
        dseLogger.info('SQLite database connection closed successfully');
      } catch (err) {
        dseLogger.error('Error closing database connection', err);
      } finally {
        this.isOpen = false;
        this.db = null;
      }
    }
  }
}

module.exports = new DatabaseConnection();
