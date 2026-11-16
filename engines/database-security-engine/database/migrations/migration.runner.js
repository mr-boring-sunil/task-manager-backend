/**
 * Database Migration Runner
 * Applies schema DDL scripts and runs database migrations.
 * Raspberry Pi Task Manager — Database & Security Engine
 */

const fs = require('fs');
const path = require('path');
const dbConn = require('../connection');
const { dseLogger } = require('../../../../shared/logger/engineLogger');

class MigrationRunner {
  /**
   * Run schema initialization and baseline migrations
   */
  async runMigrations() {
    dseLogger.info('Running database migrations...');

    // Ensure connection is established
    dbConn.connect();

    // 1. Create migrations tracking table
    dbConn.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    // 2. Read and apply schema.sql if not yet applied
    const migrationName = '001_initial_schema';
    const checkStmt = dbConn.prepare('SELECT id FROM _migrations WHERE name = ?');
    const existing = checkStmt.get(migrationName);

    if (!existing) {
      const schemaPath = path.resolve(__dirname, '..', 'schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      dbConn.exec(schemaSql);

      const recordStmt = dbConn.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');
      recordStmt.run(migrationName, new Date().toISOString());

      dseLogger.info(`Applied migration: ${migrationName}`);
    } else {
      dseLogger.debug(`Migration ${migrationName} already applied.`);
    }

    // 3. Apply 002_sessions_and_roles migration if not yet applied
    const migration2Name = '002_sessions_and_roles';
    const existing2 = checkStmt.get(migration2Name);

    if (!existing2) {
      const migration2Path = path.resolve(__dirname, '002_sessions_and_roles.sql');
      if (fs.existsSync(migration2Path)) {
        const migration2Sql = fs.readFileSync(migration2Path, 'utf8');
        dbConn.exec(migration2Sql);
        const recordStmt = dbConn.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');
        recordStmt.run(migration2Name, new Date().toISOString());
        dseLogger.info(`Applied migration: ${migration2Name}`);
      }
    } else {
      dseLogger.debug(`Migration ${migration2Name} already applied.`);
    }

    return true;
  }
}

module.exports = new MigrationRunner();
