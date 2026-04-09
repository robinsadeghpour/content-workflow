#!/usr/bin/env node
'use strict';

/**
 * End-of-day performance check script.
 * Pulls analytics from Postiz for all scheduled/published posts,
 * computes performance scores, persists to content.db performance table,
 * generates a human-readable daily summary markdown, and triggers
 * apply-performance-weights.js for the discovery scoring feedback loop.
 *
 * Called by cron-daemon.js at 18:00 Europe/Berlin daily.
 * Also callable manually: node scripts/perf-check.js
 *
 * Threat mitigations:
 *   T-04-08: Sequential processing to avoid Postiz rate limit (30 req/hr)
 *   T-04-11: missing === true check skips affected posts gracefully
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Database = require('better-sqlite3');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_PATH = path.join(__dirname, '..', 'data', 'content.db');
const PERF_DIR = path.join(__dirname, '..', 'data', 'performance');
const APPLY_WEIGHTS_SCRIPT = path.join(__dirname, 'apply-performance-weights.js');

// ---------------------------------------------------------------------------
// Ensure performance directory exists
// ---------------------------------------------------------------------------

fs.mkdirSync(PERF_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Performance score formula (D-08)
// ---------------------------------------------------------------------------

function computePerformanceScore(views, likes, comments, shares) {
  if (!views || views === 0) return 0;
  const engagementRate = (likes + comments + shares) / views;
  return Math.min(1, Math.log10(engagementRate * 1000 + 1) / 3);
}

// ---------------------------------------------------------------------------
// Pull analytics from Postiz for a single post (T-04-08: sequential, no parallel)
// ---------------------------------------------------------------------------

function fetchPostAnalytics(postizId) {
  const result = spawnSync('npx', ['postiz', 'analytics:post', postizId, '-d', '1'], {
    encoding: 'utf-8',
    env: { ...process.env },
  });

  if (result.error) {
    console.error(`[perf-check] spawnSync error for ${postizId}: ${result.error.message}`);
    return null;
  }

  if (result.status !== 0) {
    console.error(`[perf-check] postiz analytics:post exited ${result.status} for ${postizId}: ${result.stderr || result.stdout}`);
    return null;
  }

  try {
    return JSON.parse(result.stdout.trim());
  } catch (e) {
    console.error(`[perf-check] JSON parse error for ${postizId}: ${e.message}. Raw: ${result.stdout.slice(0, 200)}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Normalize field names from Postiz analytics response
// Postiz may return impressions, impression_count, etc. — normalize all.
// ---------------------------------------------------------------------------

function normalizeMetrics(data) {
  return {
    views:    data.views    || data.impressions    || data.impression_count  || 0,
    likes:    data.likes    || data.like_count      || data.reactions         || 0,
    comments: data.comments || data.comment_count   || data.replies           || 0,
    shares:   data.shares   || data.share_count     || data.reposts           || data.retweets || 0,
  };
}

// ---------------------------------------------------------------------------
// Generate daily summary markdown (D-11)
// ---------------------------------------------------------------------------

function generateDailySummary(db, todayRows, dateStr) {
  // Top performers: last 14 days, top 5 by score
  const topPerformers = db.prepare(`
    SELECT p.score, p.views, p.likes, p.comments, p.shares, d.platform, d.id AS draft_id, i.title
    FROM performance p
    JOIN drafts d ON p.draft_id = d.id
    LEFT JOIN ideas i ON d.idea_id = i.id
    WHERE p.checked_at >= datetime('now', '-14 days')
    AND p.score > 0
    ORDER BY p.score DESC
    LIMIT 5
  `).all();

  // Underperformers: bottom 5 by score with views > 0 (last 14 days)
  const underPerformers = db.prepare(`
    SELECT p.score, p.views, p.likes, p.comments, p.shares, d.platform, d.id AS draft_id, i.title
    FROM performance p
    JOIN drafts d ON p.draft_id = d.id
    LEFT JOIN ideas i ON d.idea_id = i.id
    WHERE p.checked_at >= datetime('now', '-14 days')
    AND p.views > 0
    ORDER BY p.score ASC
    LIMIT 5
  `).all();

  // Trend signals: current 7d avg vs prior 7d avg, by source_type
  const currentWeek = db.prepare(`
    SELECT i.source_type, AVG(p.score) AS avg_score, COUNT(*) AS count
    FROM performance p
    JOIN drafts d ON p.draft_id = d.id
    LEFT JOIN ideas i ON d.idea_id = i.id
    WHERE p.checked_at >= datetime('now', '-7 days')
    AND i.source_type IS NOT NULL
    GROUP BY i.source_type
  `).all();

  const priorWeek = db.prepare(`
    SELECT i.source_type, AVG(p.score) AS avg_score
    FROM performance p
    JOIN drafts d ON p.draft_id = d.id
    LEFT JOIN ideas i ON d.idea_id = i.id
    WHERE p.checked_at >= datetime('now', '-14 days')
    AND p.checked_at < datetime('now', '-7 days')
    AND i.source_type IS NOT NULL
    GROUP BY i.source_type
  `).all();

  const priorByType = {};
  for (const row of priorWeek) {
    priorByType[row.source_type] = row.avg_score;
  }

  // Format table rows for today's results
  const todayTableRows = todayRows.map(r => {
    const shortId = r.draft_id.slice(0, 8);
    return `| ${r.platform} | ${shortId} | ${r.views} | ${r.likes} | ${r.comments} | ${r.shares} | ${r.score.toFixed(2)} |`;
  }).join('\n');

  const topLines = topPerformers.map(r => {
    const title = r.title ? r.title.slice(0, 40) : r.draft_id.slice(0, 8);
    const engRate = r.views > 0 ? (((r.likes + r.comments + r.shares) / r.views) * 100).toFixed(1) : '0.0';
    return `- "${title}" on ${r.platform} — score ${r.score.toFixed(2)} (views: ${r.views}, engagement: ${engRate}%)`;
  });

  const underLines = underPerformers.map(r => {
    const title = r.title ? r.title.slice(0, 40) : r.draft_id.slice(0, 8);
    const engRate = r.views > 0 ? (((r.likes + r.comments + r.shares) / r.views) * 100).toFixed(1) : '0.0';
    return `- "${title}" on ${r.platform} — score ${r.score.toFixed(2)} (views: ${r.views}, engagement: ${engRate}%)`;
  });

  // Trend signal lines
  const trendLines = currentWeek.map(r => {
    const prior = priorByType[r.source_type];
    if (prior === undefined) return null;
    const delta = r.avg_score - prior;
    const dir = delta >= 0 ? 'up' : 'down';
    const sign = delta >= 0 ? '+' : '';
    return `- Topic source "${r.source_type}" trending ${dir} (${sign}${delta.toFixed(2)} avg score vs prior 7 days)`;
  }).filter(Boolean);

  // Format multiplier trends by visual_approach
  const currentVisual = db.prepare(`
    SELECT d.visual_approach, AVG(p.score) AS avg_score
    FROM performance p
    JOIN drafts d ON p.draft_id = d.id
    WHERE p.checked_at >= datetime('now', '-7 days')
    AND d.visual_approach IS NOT NULL
    GROUP BY d.visual_approach
  `).all();

  const priorVisual = db.prepare(`
    SELECT d.visual_approach, AVG(p.score) AS avg_score
    FROM performance p
    JOIN drafts d ON p.draft_id = d.id
    WHERE p.checked_at >= datetime('now', '-14 days')
    AND p.checked_at < datetime('now', '-7 days')
    AND d.visual_approach IS NOT NULL
    GROUP BY d.visual_approach
  `).all();

  const priorVisualByType = {};
  for (const row of priorVisual) {
    priorVisualByType[row.visual_approach] = row.avg_score;
  }

  for (const r of currentVisual) {
    const prior = priorVisualByType[r.visual_approach];
    if (prior !== undefined && prior > 0) {
      const ratio = (r.avg_score / prior).toFixed(1);
      trendLines.push(`- Format "${r.visual_approach}" ${r.avg_score > prior ? 'out' : 'under'}performing by ${ratio}x vs prior 7 days`);
    }
  }

  const todaySection = todayRows.length > 0
    ? `| Platform | Draft | Views | Likes | Comments | Shares | Score |
|----------|-------|-------|-------|----------|--------|-------|
${todayTableRows}`
    : '_No posts tracked today (no scheduled/published posts with postiz_id found)_';

  const topSection = topPerformers.length > 0
    ? topLines.join('\n')
    : '_No performance data yet (first 14 days)_';

  const underSection = underPerformers.length > 0
    ? underLines.join('\n')
    : '_No underperformers identified_';

  const trendSection = trendLines.length > 0
    ? trendLines.join('\n')
    : '_Not enough data yet for trend analysis_';

  return `# Performance Summary — ${dateStr}

## Today's Results

${todaySection}

## Top Performers (last 14 days)
${topSection}

## Underperformers (last 14 days)
${underSection}

## Trend Signals
${trendSection}
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(function main() {
  console.log(`[perf-check] Starting at ${new Date().toISOString()}`);

  if (!fs.existsSync(DB_PATH)) {
    console.error(`[perf-check] Database not found at ${DB_PATH} — run: node scripts/init-db.js`);
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Query all drafts that have a postiz_id and are in scheduled or published state
  const drafts = db.prepare(`
    SELECT id, platform, postiz_id, status, idea_id, topic_category, visual_approach
    FROM drafts
    WHERE status IN ('scheduled', 'published')
    AND postiz_id IS NOT NULL
  `).all();

  console.log(`[perf-check] Found ${drafts.length} draft(s) to check`);

  const insertPerf = db.prepare(`
    INSERT INTO performance (id, draft_id, platform, views, likes, comments, shares, score, checked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      views=excluded.views,
      likes=excluded.likes,
      comments=excluded.comments,
      shares=excluded.shares,
      score=excluded.score,
      checked_at=datetime('now')
  `);

  const transitionDraft = db.prepare(`
    UPDATE drafts SET status = ?, updated_at = datetime('now') WHERE id = ? AND status = ?
  `);

  const dateStr = new Date().toISOString().slice(0, 10);
  const todayRows = [];

  for (const draft of drafts) {
    console.log(`[perf-check] Checking draft ${draft.id} (${draft.platform}, postiz_id=${draft.postiz_id})`);

    const data = fetchPostAnalytics(draft.postiz_id);

    if (data === null) {
      console.warn(`[perf-check] Skipping draft ${draft.id} — analytics call failed`);
      continue;
    }

    // T-04-11: Handle missing TikTok release ID gracefully
    if (data.missing === true) {
      console.log(`[perf-check] [MISSING] Draft ${draft.id} (${draft.platform}) — TikTok release ID not yet resolved. Skipping.`);
      continue;
    }

    const metrics = normalizeMetrics(data);
    const score = computePerformanceScore(metrics.views, metrics.likes, metrics.comments, metrics.shares);

    const perfId = `${draft.id}-${dateStr}`;
    insertPerf.run(
      perfId,
      draft.id,
      draft.platform,
      metrics.views,
      metrics.likes,
      metrics.comments,
      metrics.shares,
      score
    );

    console.log(`[perf-check] Recorded: draft=${draft.id} views=${metrics.views} likes=${metrics.likes} comments=${metrics.comments} shares=${metrics.shares} score=${score.toFixed(3)}`);

    todayRows.push({
      draft_id: draft.id,
      platform: draft.platform,
      ...metrics,
      score,
    });

    // State transitions: scheduled -> published, published -> tracked
    if (draft.status === 'scheduled' && metrics.views > 0) {
      transitionDraft.run('published', draft.id, 'scheduled');
      console.log(`[perf-check] Draft ${draft.id} transitioned: scheduled -> published`);
    } else if (draft.status === 'published') {
      transitionDraft.run('tracked', draft.id, 'published');
      console.log(`[perf-check] Draft ${draft.id} transitioned: published -> tracked`);
    }
  }

  // Generate daily summary markdown
  const summaryPath = path.join(PERF_DIR, `${dateStr}.md`);
  const summaryContent = generateDailySummary(db, todayRows, dateStr);
  fs.writeFileSync(summaryPath, summaryContent, 'utf-8');
  console.log(`[perf-check] Daily summary written to ${summaryPath}`);

  db.close();

  // Trigger apply-performance-weights.js to update scoring multipliers
  console.log('[perf-check] Triggering apply-performance-weights.js...');
  const weightsResult = spawnSync('node', [APPLY_WEIGHTS_SCRIPT], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf-8',
    env: { ...process.env },
    stdio: 'inherit',
  });

  if (weightsResult.status !== 0) {
    console.error(`[perf-check] apply-performance-weights.js exited with code ${weightsResult.status}`);
  } else {
    console.log('[perf-check] Weight computation complete');
  }

  console.log(`[perf-check] Done at ${new Date().toISOString()}`);
})();
