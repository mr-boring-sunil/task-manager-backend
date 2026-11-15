/**
 * Administrative User Bootstrap Script
 * Allows manually bootstrapping an administrator user account with a secure password.
 * Usage: node scripts/seedAdmin.js <username> <password>
 * Raspberry Pi Task Manager — Unified Backend
 */

require('dotenv').config();
const dse = require('../engines/database-security-engine');
const dbConfig = require('../config/database.config');

const run = async () => {
  const username = process.argv[2] || dbConfig.initialAdmin.username;
  const password = process.argv[3] || dbConfig.initialAdmin.password;

  console.log(`Initializing Database & Security Engine for administrative seeding...`);
  await dse.init();

  try {
    const existing = await dse.getUserByUsername(username);
    if (existing) {
      console.log(`User '${username}' already exists (ID: ${existing.id}, Role: ${existing.role}).`);
    } else {
      const created = await dse.createUser({
        username,
        password,
        role: 'admin',
      });
      console.log(`Successfully created administrator account: ${created.username} (ID: ${created.id})`);
    }
  } catch (err) {
    console.error(`Admin bootstrap failed: ${err.message}`);
    process.exit(1);
  } finally {
    dse.close();
    process.exit(0);
  }
};

run();
