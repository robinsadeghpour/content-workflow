#!/usr/bin/env node
'use strict';

/**
 * Thin CLI utility to read an idea from content.db by UUID.
 * Used by Claude Code agents (content-orchestrator) instead of inline DB queries.
 *
 * Usage:
 *   node scripts/db-read-idea.js --id <uuid>
 *
 * Output:
 *   JSON object of the idea row on stdout, or exits 1 with error on stderr.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ------------------------------------------------------------------ args
const args = process.argv.slice(2);
const idIdx = args.indexOf('--id');
if (idIdx === -1 || !args[idIdx + 1]) {
  console.error('Usage: node db-read-idea.js --id <uuid>');
  process.exit(1);
}
const ideaId = args[idIdx + 1];

// T-03-11: validate UUID format before using in queries
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(ideaId)) {
  console.error(`Invalid UUID format: ${ideaId}`);
  process.exit(1);
}

// ------------------------------------------------------------------ db
const DB_PATH = path.join(__dirname, '..', 'data', 'content.db');
if (!fs.existsSync(DB_PATH)) {
  console.error(`Database not found at ${DB_PATH} -- run: node scripts/init-db.js`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Optional --status flag to filter by status (default: 'kept')
const statusIdx = args.indexOf('--status');
const status = statusIdx !== -1 && args[statusIdx + 1] ? args[statusIdx + 1] : 'kept';

const idea = db.prepare('SELECT * FROM ideas WHERE id = ? AND status = ?').get(ideaId, status);
db.close();

if (!idea) {
  console.error(`Idea not found with id="${ideaId}" and status="${status}"`);
  process.exit(1);
}

console.log(JSON.stringify(idea));
