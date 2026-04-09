#!/usr/bin/env node
'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const args = process.argv.slice(2);
const idIdx = args.indexOf('--id');
const statusIdx = args.indexOf('--status');

if (idIdx === -1 || statusIdx === -1 || !args[idIdx + 1] || !args[statusIdx + 1]) {
  console.error('Usage: node scripts/review-update.js --id <idea_id> --status <kept|skipped|starred>');
  process.exit(1);
}

const id = args[idIdx + 1];
const status = args[statusIdx + 1];
const VALID_STATUSES = ['kept', 'skipped', 'starred'];

if (!VALID_STATUSES.includes(status)) {
  console.error(`Invalid status "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`);
  process.exit(1);
}

const DB_PATH = path.join(__dirname, '..', 'data', 'content.db');
const db = new Database(DB_PATH);
const result = db.prepare('UPDATE ideas SET status = ? WHERE id = ?').run(status, id);
db.close();

if (result.changes === 0) {
  console.error(`No idea found with id "${id}"`);
  process.exit(1);
}

console.log(`Updated idea ${id} -> ${status}`);
