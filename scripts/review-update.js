#!/usr/bin/env node
'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const args = process.argv.slice(2);
const idIdx = args.indexOf('--id');
const statusIdx = args.indexOf('--status');
const visualApproachIdx = args.indexOf('--visual-approach');

if (idIdx === -1 || statusIdx === -1 || !args[idIdx + 1] || !args[statusIdx + 1]) {
  console.error('Usage: node scripts/review-update.js --id <idea_id> --status <kept|skipped|starred> [--visual-approach <photo|ai>]');
  process.exit(1);
}

const id = args[idIdx + 1];
const status = args[statusIdx + 1];
const VALID_STATUSES = ['kept', 'skipped', 'starred'];

if (!VALID_STATUSES.includes(status)) {
  console.error(`Invalid status "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`);
  process.exit(1);
}

// Optional --visual-approach argument (D-02: captured at KEEP time)
let visualApproach = null;
if (visualApproachIdx !== -1 && args[visualApproachIdx + 1]) {
  visualApproach = args[visualApproachIdx + 1];
  const VALID_APPROACHES = ['photo', 'ai'];
  if (!VALID_APPROACHES.includes(visualApproach)) {
    console.error(`Invalid visual-approach "${visualApproach}". Must be one of: ${VALID_APPROACHES.join(', ')}`);
    process.exit(1);
  }
}

const DB_PATH = path.join(__dirname, '..', 'data', 'content.db');
const db = new Database(DB_PATH);

let result;
if (visualApproach !== null) {
  // Ensure visual_approach column exists (idempotent)
  try { db.exec('ALTER TABLE ideas ADD COLUMN visual_approach TEXT'); } catch (e) { if (!e.message.includes('duplicate column')) throw e; }
  result = db.prepare('UPDATE ideas SET status = ?, visual_approach = ? WHERE id = ?').run(status, visualApproach, id);
} else {
  result = db.prepare('UPDATE ideas SET status = ? WHERE id = ?').run(status, id);
}
db.close();

if (result.changes === 0) {
  console.error(`No idea found with id "${id}"`);
  process.exit(1);
}

const approachNote = visualApproach ? ` (visual_approach: ${visualApproach})` : '';
console.log(`Updated idea ${id} -> ${status}${approachNote}`);
