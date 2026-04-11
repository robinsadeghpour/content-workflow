#!/usr/bin/env node
'use strict';

/**
 * db-write-draft.js — persist a draft row to data/content.db
 *
 * Used by /generate-content orchestrator (Phase 06.1 Plan 02) to write each
 * platform draft with its metadata + Phase 06.1 flags (D-05, D-12).
 *
 * Usage:
 *   node scripts/db-write-draft.js \
 *     --id <draft_id> \
 *     --idea-id <idea_id> \
 *     --platform <tiktok_en|tiktok_de|instagram|linkedin> \
 *     --content <text | @path/to/file.md> \
 *     [--status draft] \
 *     [--visual-approach <text>] \
 *     [--media-dir <path>] \
 *     [--topic-category <text>] \
 *     [--original-content <text | @path>] \
 *     [--research-thin] \
 *     [--did-not-pass]
 *
 * Flag semantics:
 *   --research-thin   persisted as research_thin = 1      (D-05)
 *   --did-not-pass    persisted as did_not_pass_critic = 1 (D-12)
 * Absent flags default to 0 (backward compatible).
 *
 * Exits 0 on success, non-zero on error. Prints the written draft id.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ---- arg parsing ---------------------------------------------------------

const argv = process.argv.slice(2);

function getFlag(name) {
  return argv.includes(`--${name}`);
}

function getArg(name) {
  const idx = argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  const val = argv[idx + 1];
  if (val === undefined || val.startsWith('--')) return '';
  return val;
}

// @file.md → read file contents
function resolveContent(val) {
  if (!val) return val;
  if (val.startsWith('@')) {
    const p = val.slice(1);
    return fs.readFileSync(p, 'utf8');
  }
  return val;
}

if (argv.includes('--help') || argv.includes('-h')) {
  console.log('Usage: node scripts/db-write-draft.js --id <id> --idea-id <idea_id> --platform <p> --content <text|@file> [flags]');
  console.log('Flags: --research-thin, --did-not-pass, --status, --visual-approach, --media-dir, --topic-category, --original-content');
  process.exit(0);
}

const id = getArg('id');
const ideaId = getArg('idea-id');
const platform = getArg('platform');
const contentRaw = getArg('content');
const status = getArg('status') || 'draft';
const visualApproach = getArg('visual-approach') || null;
const mediaDir = getArg('media-dir') || null;
const topicCategory = getArg('topic-category') || null;
const originalContentRaw = getArg('original-content');

// Phase 06.1 flags
const researchThin = getFlag('research-thin') ? 1 : 0;
const didNotPass = getFlag('did-not-pass') ? 1 : 0;

// When invoked with zero args (e.g., `node scripts/db-write-draft.js`) we want
// backward-compatible no-op behavior rather than a hard throw — the plan's
// acceptance criterion #6 exercises exactly this.
if (argv.length === 0) {
  console.log('db-write-draft.js: no args provided (no-op). Run with --help for usage.');
  process.exit(0);
}

if (!id || !ideaId || !platform) {
  console.error('error: --id, --idea-id, and --platform are required');
  process.exit(1);
}

const content = resolveContent(contentRaw) || null;
const originalContent = resolveContent(originalContentRaw) || null;

// ---- db ------------------------------------------------------------------

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'content.db');

if (!fs.existsSync(DB_PATH)) {
  console.error(`error: ${DB_PATH} not found. Run 'node scripts/init-db.js' first.`);
  process.exit(2);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Upsert: INSERT OR REPLACE so repeated writes during writer-critic loop overwrite
const stmt = db.prepare(`
  INSERT INTO drafts (
    id, idea_id, platform, content, status,
    visual_approach, media_dir, topic_category, original_content,
    research_thin, did_not_pass_critic,
    created_at, updated_at
  ) VALUES (
    @id, @idea_id, @platform, @content, @status,
    @visual_approach, @media_dir, @topic_category, @original_content,
    @research_thin, @did_not_pass_critic,
    COALESCE((SELECT created_at FROM drafts WHERE id = @id), datetime('now')),
    datetime('now')
  )
  ON CONFLICT(id) DO UPDATE SET
    idea_id             = excluded.idea_id,
    platform            = excluded.platform,
    content             = excluded.content,
    status              = excluded.status,
    visual_approach     = excluded.visual_approach,
    media_dir           = excluded.media_dir,
    topic_category      = excluded.topic_category,
    original_content    = excluded.original_content,
    research_thin       = excluded.research_thin,
    did_not_pass_critic = excluded.did_not_pass_critic,
    updated_at          = datetime('now')
`);

stmt.run({
  id,
  idea_id: ideaId,
  platform,
  content,
  status,
  visual_approach: visualApproach,
  media_dir: mediaDir,
  topic_category: topicCategory,
  original_content: originalContent,
  research_thin: researchThin,
  did_not_pass_critic: didNotPass,
});

console.log(JSON.stringify({
  ok: true,
  id,
  idea_id: ideaId,
  platform,
  status,
  research_thin: researchThin,
  did_not_pass_critic: didNotPass,
}));

db.close();
