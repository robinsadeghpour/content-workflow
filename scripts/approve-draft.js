#!/usr/bin/env node
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { setHours, setMinutes, addDays, isBefore } = require('date-fns');
const { TZDate } = require('@date-fns/tz');

// ------------------------------------------------------------------ constants

const DB_PATH = path.join(__dirname, '..', 'data', 'content.db');
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'schedule-defaults.json');

// ------------------------------------------------------------------ state machine

const VALID_TRANSITIONS = {
  'draft':            ['critic-approved'],
  'critic-approved':  ['user-approved', 'rejected'],
  'user-approved':    ['scheduled', 'pending-schedule'],
  'pending-schedule': ['scheduled'],
  'scheduled':        ['published'],
  'published':        ['tracked'],
};

function transitionDraft(db, draftId, toStatus) {
  const draft = db.prepare('SELECT status FROM drafts WHERE id = ?').get(draftId);
  if (!draft) throw new Error(`Draft ${draftId} not found`);
  const allowed = VALID_TRANSITIONS[draft.status] || [];
  if (!allowed.includes(toStatus)) {
    throw new Error(`Invalid transition: ${draft.status} -> ${toStatus} for draft ${draftId}`);
  }
  db.prepare("UPDATE drafts SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(toStatus, draftId);
}

// ------------------------------------------------------------------ helpers

function safeJsonParse(text, label) {
  let clean = (text || '').trim();
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(clean);
  } catch (err) {
    throw new Error(`[${label}] JSON parse failed: ${err.message}\nRaw (first 300 chars): ${String(text).slice(0, 300)}`);
  }
}

function getDisplayText(draft) {
  if (!draft.content) return '';
  try {
    const parsed = safeJsonParse(draft.content, 'display');
    if (draft.platform === 'linkedin') {
      return parsed.post_text || parsed.caption || '';
    }
    return parsed.caption || parsed.post_text || '';
  } catch {
    return String(draft.content).slice(0, 200);
  }
}

function getOriginalDisplayText(draft) {
  if (!draft.original_content) return null;
  try {
    const content = safeJsonParse(draft.original_content, 'original_content');
    if (draft.platform === 'linkedin') {
      return content.post_text || content.text || JSON.stringify(content).slice(0, 500);
    }
    return content.caption || content.text || JSON.stringify(content).slice(0, 500);
  } catch {
    return null;
  }
}

function getVoiceScore(draft) {
  if (!draft.content) return null;
  try {
    const parsed = safeJsonParse(draft.content, 'voice_score');
    return parsed.voice_score !== undefined ? parsed.voice_score : null;
  } catch {
    return null;
  }
}

function getSlideCount(draft) {
  if (!draft.content) return null;
  try {
    const parsed = safeJsonParse(draft.content, 'slide_count');
    if (Array.isArray(parsed.slides)) return parsed.slides.length;
    return null;
  } catch {
    return null;
  }
}

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

// ------------------------------------------------------------------ schedule slot

function nextSlotForPlatform(platform) {
  const config = loadConfig();
  const platformConfig = config.platforms[platform];
  if (!platformConfig) throw new Error(`Unknown platform: ${platform}`);
  const { default_hour, default_minute, timezone } = platformConfig;

  const nowInTz = new TZDate(new Date(), timezone);
  let candidate = setMinutes(setHours(nowInTz, default_hour), default_minute);
  if (isBefore(candidate, nowInTz)) {
    candidate = addDays(candidate, 1);
  }
  return candidate.toISOString();
}

// ------------------------------------------------------------------ media upload

function uploadMediaFiles(mediaDir) {
  if (!mediaDir || !fs.existsSync(mediaDir)) return [];

  const slideFiles = fs.readdirSync(mediaDir)
    .filter(f => /^slide-\d+\.(png|jpg|webp)$/i.test(f))
    .sort();

  const cdnUrls = [];
  for (const file of slideFiles) {
    const filePath = path.join(mediaDir, file);
    const result = spawnSync('npx', ['postiz', 'upload', filePath], {
      encoding: 'utf-8',
      env: process.env,
    });

    if (result.error || result.status !== 0) {
      const errMsg = result.error ? result.error.message : (result.stderr || 'unknown error');
      throw new Error(`Failed to upload ${file}: ${errMsg}`);
    }

    const uploadResult = safeJsonParse(result.stdout, `upload ${file}`);
    if (!uploadResult.path) throw new Error(`No path returned from upload for ${file}`);
    cdnUrls.push(uploadResult.path);
  }

  return cdnUrls;
}

// ------------------------------------------------------------------ scheduling

function scheduleOnPostiz(draft, scheduleISO, cdnUrls) {
  const config = loadConfig();
  const platformConfig = config.platforms[draft.platform];
  if (!platformConfig) throw new Error(`No config for platform: ${draft.platform}`);

  const integrationId = platformConfig.integration_id;
  if (!integrationId || integrationId === 'FILL_AT_SETUP') {
    throw new Error(`Integration ID not configured for ${draft.platform}. Run 'postiz integrations:list' and update config/schedule-defaults.json.`);
  }

  let contentText;
  try {
    const parsed = safeJsonParse(draft.content, 'schedule content parse');
    contentText = draft.platform === 'linkedin'
      ? (parsed.post_text || parsed.caption || '')
      : (parsed.caption || parsed.post_text || '');
  } catch (err) {
    throw new Error(`Cannot parse draft content: ${err.message}`);
  }

  const args = ['postiz', 'posts:create', '-c', contentText, '-s', scheduleISO, '-i', integrationId];
  if (cdnUrls && cdnUrls.length > 0) {
    args.push('-m', cdnUrls.join(','));
  }

  const result = spawnSync('npx', args, {
    encoding: 'utf-8',
    env: process.env,
  });

  if (result.error || result.status !== 0) {
    const errMsg = result.error ? result.error.message : (result.stderr || result.stdout || 'unknown error');
    throw new Error(`Postiz scheduling failed: ${errMsg}`);
  }

  const postizResult = safeJsonParse(result.stdout, 'postiz posts:create response');
  return postizResult;
}

// ------------------------------------------------------------------ action handlers

function handleApprove(db, draft, scheduleAt) {
  // Transition to user-approved first
  transitionDraft(db, draft.id, 'user-approved');

  const scheduleISO = scheduleAt || nextSlotForPlatform(draft.platform);

  // Upload media if visual platform with media_dir
  let cdnUrls = [];
  const visualPlatforms = ['tiktok_en', 'tiktok_de', 'instagram'];
  if (visualPlatforms.includes(draft.platform) && draft.media_dir) {
    try {
      cdnUrls = uploadMediaFiles(draft.media_dir);
    } catch (err) {
      console.error(`[warn] Media upload failed for draft ${draft.id}: ${err.message}`);
      // Treat media upload failure as scheduling failure
      transitionDraft(db, draft.id, 'pending-schedule');
      db.prepare("UPDATE drafts SET updated_at = datetime('now') WHERE id = ?").run(draft.id);
      console.log(JSON.stringify({
        success: false,
        draft_id: draft.id,
        status: 'pending-schedule',
        error: `Media upload failed: ${err.message}`,
      }));
      return;
    }
  }

  // Schedule via Postiz
  try {
    const postizResult = scheduleOnPostiz(draft, scheduleISO, cdnUrls);
    const postizId = postizResult.id || postizResult.postId || null;

    db.prepare("UPDATE drafts SET postiz_id = ?, updated_at = datetime('now') WHERE id = ?")
      .run(postizId, draft.id);
    transitionDraft(db, draft.id, 'scheduled');

    console.log(JSON.stringify({
      success: true,
      draft_id: draft.id,
      status: 'scheduled',
      postiz_id: postizId,
      scheduled_at: scheduleISO,
      platform: draft.platform,
    }));
  } catch (err) {
    // Scheduling failure — move to pending-schedule, do NOT crash (D-07)
    transitionDraft(db, draft.id, 'pending-schedule');
    console.error(`[warn] Scheduling failed for draft ${draft.id}: ${err.message}`);
    console.log(JSON.stringify({
      success: false,
      draft_id: draft.id,
      status: 'pending-schedule',
      error: err.message,
      platform: draft.platform,
    }));
  }
}

function handleReject(db, draftId) {
  transitionDraft(db, draftId, 'rejected');
  console.log(JSON.stringify({
    success: true,
    draft_id: draftId,
    status: 'rejected',
  }));
}

function handleEdit(db, draft, newContent, scheduleAt) {
  // Parse existing content, replace text field
  let parsed;
  try {
    parsed = safeJsonParse(draft.content, 'edit parse');
  } catch (err) {
    console.error(`Cannot parse draft content for edit: ${err.message}`);
    process.exit(1);
  }

  if (draft.platform === 'linkedin') {
    parsed.post_text = newContent;
    // Also update caption if present
    if (parsed.caption !== undefined) parsed.caption = newContent;
  } else {
    parsed.caption = newContent;
    if (parsed.post_text !== undefined) parsed.post_text = newContent;
  }

  db.prepare("UPDATE drafts SET content = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(parsed), draft.id);

  // Reload draft with updated content
  const updatedDraft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draft.id);

  // Proceed with approve logic (auto-schedule after edit per D-04)
  handleApprove(db, updatedDraft, scheduleAt);
}

// ------------------------------------------------------------------ list handlers

function handleList(db, platform) {
  let query = "SELECT * FROM drafts WHERE status = 'critic-approved'";
  const params = [];
  if (platform) {
    query += ' AND platform = ?';
    params.push(platform);
  }
  query += ' ORDER BY updated_at ASC';

  const drafts = db.prepare(query).all(...params);
  const output = drafts.map(d => {
    const displayText = getDisplayText(d);
    const voiceScore = getVoiceScore(d);
    const slideCount = getSlideCount(d);
    const originalText = getOriginalDisplayText(d);
    return {
      id: d.id,
      platform: d.platform,
      display_text: displayText.slice(0, 200),
      original_text: originalText,
      voice_score: voiceScore,
      visual_approach: d.visual_approach || null,
      slide_count: slideCount,
      updated_at: d.updated_at,
      media_dir: d.media_dir || null,
    };
  });

  console.log(JSON.stringify(output, null, 2));
}

function handleListPending(db) {
  const drafts = db.prepare("SELECT * FROM drafts WHERE status = 'pending-schedule' ORDER BY updated_at ASC").all();

  // Attempt to reschedule each pending draft (one attempt per invocation per D-07)
  for (const draft of drafts) {
    console.error(`[retry] Attempting reschedule for draft ${draft.id} (${draft.platform})`);

    const scheduleISO = nextSlotForPlatform(draft.platform);
    let cdnUrls = [];

    const visualPlatforms = ['tiktok_en', 'tiktok_de', 'instagram'];
    if (visualPlatforms.includes(draft.platform) && draft.media_dir) {
      try {
        cdnUrls = uploadMediaFiles(draft.media_dir);
      } catch (err) {
        console.error(`[retry] Media upload still failing for ${draft.id}: ${err.message}`);
        continue;
      }
    }

    try {
      const postizResult = scheduleOnPostiz(draft, scheduleISO, cdnUrls);
      const postizId = postizResult.id || postizResult.postId || null;

      db.prepare("UPDATE drafts SET postiz_id = ?, updated_at = datetime('now') WHERE id = ?")
        .run(postizId, draft.id);
      transitionDraft(db, draft.id, 'scheduled');
      console.error(`[retry] Successfully rescheduled draft ${draft.id} for ${scheduleISO}`);
    } catch (err) {
      console.error(`[retry] Still failing for ${draft.id}: ${err.message}`);
      // Stay in pending-schedule — will retry next time
    }
  }

  // Output current pending drafts (after retry attempts)
  const remaining = db.prepare("SELECT id, platform, updated_at FROM drafts WHERE status = 'pending-schedule' ORDER BY updated_at ASC").all();
  console.log(JSON.stringify(remaining, null, 2));
}

// ------------------------------------------------------------------ main

(function main() {
  const args = process.argv.slice(2);

  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const hasFlag = (flag) => args.includes(flag);

  const db = new Database(DB_PATH);

  // --list mode
  if (hasFlag('--list')) {
    const platform = getArg('--platform');
    handleList(db, platform);
    db.close();
    return;
  }

  // --list-pending mode
  if (hasFlag('--list-pending')) {
    handleListPending(db);
    db.close();
    return;
  }

  // --id + --action mode
  const id = getArg('--id');
  const action = getArg('--action');

  if (!id || !action) {
    console.error('Usage:');
    console.error('  node scripts/approve-draft.js --list [--platform <platform>]');
    console.error('  node scripts/approve-draft.js --list-pending');
    console.error('  node scripts/approve-draft.js --id <draft_id> --action <approve|reject|edit> [--schedule-at <ISO8601>] [--content <text>]');
    process.exit(1);
  }

  const VALID_ACTIONS = ['approve', 'reject', 'edit'];
  if (!VALID_ACTIONS.includes(action)) {
    console.error(`Invalid action "${action}". Must be one of: ${VALID_ACTIONS.join(', ')}`);
    process.exit(1);
  }

  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(id);
  if (!draft) {
    console.error(`No draft found with id "${id}"`);
    db.close();
    process.exit(1);
  }

  if (draft.status !== 'critic-approved') {
    console.error(`Draft ${id} has status "${draft.status}" — only "critic-approved" drafts can be actioned here.`);
    db.close();
    process.exit(1);
  }

  const scheduleAt = getArg('--schedule-at');
  const newContent = getArg('--content');

  if (action === 'approve') {
    handleApprove(db, draft, scheduleAt);
  } else if (action === 'reject') {
    handleReject(db, id);
  } else if (action === 'edit') {
    if (!newContent) {
      console.error('--content is required for --action edit');
      db.close();
      process.exit(1);
    }
    handleEdit(db, draft, newContent, scheduleAt);
  }

  db.close();
})();
