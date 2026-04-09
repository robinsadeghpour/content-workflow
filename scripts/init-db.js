#!/usr/bin/env node
'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'content.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  -- ideas table: populated by Phase 2 (pulse/discovery)
  CREATE TABLE IF NOT EXISTS ideas (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    summary      TEXT,
    source_url   TEXT,
    source_type  TEXT,
    score        REAL DEFAULT 0,
    status       TEXT DEFAULT 'new',
    dedup_hash   TEXT UNIQUE,
    scraped_at   TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  -- drafts table: populated by Phase 3 (content generation)
  CREATE TABLE IF NOT EXISTS drafts (
    id           TEXT PRIMARY KEY,
    idea_id      TEXT REFERENCES ideas(id),
    platform     TEXT NOT NULL,
    content      TEXT,
    status       TEXT DEFAULT 'draft',
    postiz_id    TEXT,
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT DEFAULT (datetime('now'))
  );

  -- performance table: populated by Phase 4 (analytics)
  CREATE TABLE IF NOT EXISTS performance (
    id           TEXT PRIMARY KEY,
    draft_id     TEXT REFERENCES drafts(id),
    platform     TEXT NOT NULL,
    views        INTEGER DEFAULT 0,
    likes        INTEGER DEFAULT 0,
    comments     INTEGER DEFAULT 0,
    shares       INTEGER DEFAULT 0,
    score        REAL DEFAULT 0,
    checked_at   TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );
`);

// Phase 2: add transcript column to ideas table (idempotent)
try {
  db.exec('ALTER TABLE ideas ADD COLUMN transcript TEXT');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

// Phase 3: add visual_approach and media_dir columns to drafts table (idempotent)
try {
  db.exec('ALTER TABLE drafts ADD COLUMN visual_approach TEXT');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}
try {
  db.exec('ALTER TABLE drafts ADD COLUMN media_dir TEXT');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

// Phase 3: add visual_approach column to ideas table for Robin's KEEP-time choice (D-02)
try {
  db.exec('ALTER TABLE ideas ADD COLUMN visual_approach TEXT');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

// Phase 4: add topic_category column to drafts for performance tracking (D-09)
try {
  db.exec('ALTER TABLE drafts ADD COLUMN topic_category TEXT');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

// Phase 4 gap closure: store pre-humanizer content for before/after diff (PUBL-05)
try {
  db.exec('ALTER TABLE drafts ADD COLUMN original_content TEXT');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}

// Verify tables exist
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('content.db initialized at:', DB_PATH);
console.log('Tables:', tables.map(t => t.name).join(', '));

db.close();
