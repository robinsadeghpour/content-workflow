#!/usr/bin/env node
'use strict';

/**
 * Computes topic and format performance multipliers from the last 14 days
 * of performance data and writes data/performance-weights.json.
 *
 * The multipliers are consumed by:
 *   - scripts/pulse/scorer.js (by_source_type -> idea scoring)
 *   - scripts/generate-content.js (by_format -> visual approach auto-detection)
 *
 * Called by perf-check.js at the end of each performance check run.
 * Also callable manually: node scripts/apply-performance-weights.js
 *
 * Design decisions (D-09, D-10):
 *   - 14-day rolling window (D-10) — old data drops out automatically
 *   - Multiplier = clamp(avg_score / global_avg_score, 0.7, 1.5)
 *   - Defaults to empty multipliers when no data yet (first run graceful degradation)
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_PATH = path.join(__dirname, '..', 'data', 'content.db');
const WEIGHTS_PATH = path.join(__dirname, '..', 'data', 'performance-weights.json');

// Default multiplier bounds — can be overridden via config/schedule-defaults.json
// if perf_check.multiplier_max / perf_check.multiplier_min are set.
const DEFAULT_MULTIPLIER_MAX = 1.5;
const DEFAULT_MULTIPLIER_MIN = 0.7;

// ---------------------------------------------------------------------------
// Load optional config overrides
// ---------------------------------------------------------------------------

function loadMultiplierBounds() {
  try {
    const configPath = path.join(__dirname, '..', 'config', 'schedule-defaults.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const pc = config.perf_check || {};
    return {
      max: typeof pc.multiplier_max === 'number' ? pc.multiplier_max : DEFAULT_MULTIPLIER_MAX,
      min: typeof pc.multiplier_min === 'number' ? pc.multiplier_min : DEFAULT_MULTIPLIER_MIN,
    };
  } catch (e) {
    return { max: DEFAULT_MULTIPLIER_MAX, min: DEFAULT_MULTIPLIER_MIN };
  }
}

// ---------------------------------------------------------------------------
// Clamp helper
// ---------------------------------------------------------------------------

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(function main() {
  console.log(`[apply-weights] Starting at ${new Date().toISOString()}`);

  if (!fs.existsSync(DB_PATH)) {
    console.error(`[apply-weights] Database not found at ${DB_PATH}`);
    // Write empty weights file so consumers don't crash
    const emptyWeights = {
      by_source_type: {},
      by_format: {},
      computed_at: new Date().toISOString(),
    };
    fs.writeFileSync(WEIGHTS_PATH, JSON.stringify(emptyWeights, null, 2), 'utf-8');
    console.log('[apply-weights] Wrote empty weights (no DB)');
    return;
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const { max: multiplierMax, min: multiplierMin } = loadMultiplierBounds();
  console.log(`[apply-weights] Multiplier bounds: [${multiplierMin}, ${multiplierMax}]`);

  // Query performance data from last 14 days (D-10)
  const rows = db.prepare(`
    SELECT d.id, d.platform, d.topic_category, d.visual_approach, i.source_type, p.score
    FROM performance p
    JOIN drafts d ON p.draft_id = d.id
    LEFT JOIN ideas i ON d.idea_id = i.id
    WHERE p.checked_at >= datetime('now', '-14 days')
  `).all();

  console.log(`[apply-weights] Loaded ${rows.length} performance record(s) from last 14 days`);

  if (rows.length === 0) {
    const emptyWeights = {
      by_source_type: {},
      by_format: {},
      computed_at: new Date().toISOString(),
    };
    fs.writeFileSync(WEIGHTS_PATH, JSON.stringify(emptyWeights, null, 2), 'utf-8');
    console.log('[apply-weights] No data yet — wrote empty weights');
    db.close();
    return;
  }

  // Compute global average score (denominator for multiplier formula)
  const globalAvgScore = rows.reduce((sum, r) => sum + r.score, 0) / rows.length;
  console.log(`[apply-weights] Global avg score: ${globalAvgScore.toFixed(4)}`);

  if (globalAvgScore === 0) {
    // All scores are 0 — no analytics data has meaningful signal yet
    const zeroWeights = {
      by_source_type: {},
      by_format: {},
      computed_at: new Date().toISOString(),
    };
    fs.writeFileSync(WEIGHTS_PATH, JSON.stringify(zeroWeights, null, 2), 'utf-8');
    console.log('[apply-weights] Global avg is 0 — no signal yet, wrote empty weights');
    db.close();
    return;
  }

  // Group by source_type (topic proxy)
  const bySourceType = {};
  for (const row of rows) {
    const key = row.source_type || 'unknown';
    if (!bySourceType[key]) bySourceType[key] = { total: 0, count: 0 };
    bySourceType[key].total += row.score;
    bySourceType[key].count += 1;
  }

  const sourceTypeMultipliers = {};
  for (const [key, agg] of Object.entries(bySourceType)) {
    const avgScore = agg.total / agg.count;
    const multiplier = clamp(avgScore / globalAvgScore, multiplierMin, multiplierMax);
    sourceTypeMultipliers[key] = parseFloat(multiplier.toFixed(4));
    console.log(`[apply-weights] source_type="${key}" avg=${avgScore.toFixed(4)} multiplier=${multiplier.toFixed(4)} (n=${agg.count})`);
  }

  // Group by visual_approach (format proxy)
  const byFormat = {};
  for (const row of rows) {
    const key = row.visual_approach || 'unknown';
    if (!byFormat[key]) byFormat[key] = { total: 0, count: 0 };
    byFormat[key].total += row.score;
    byFormat[key].count += 1;
  }

  const formatMultipliers = {};
  for (const [key, agg] of Object.entries(byFormat)) {
    const avgScore = agg.total / agg.count;
    const multiplier = clamp(avgScore / globalAvgScore, multiplierMin, multiplierMax);
    formatMultipliers[key] = parseFloat(multiplier.toFixed(4));
    console.log(`[apply-weights] visual_approach="${key}" avg=${avgScore.toFixed(4)} multiplier=${multiplier.toFixed(4)} (n=${agg.count})`);
  }

  const weights = {
    by_source_type: sourceTypeMultipliers,
    by_format: formatMultipliers,
    computed_at: new Date().toISOString(),
  };

  fs.writeFileSync(WEIGHTS_PATH, JSON.stringify(weights, null, 2), 'utf-8');
  console.log(`[apply-weights] Wrote ${WEIGHTS_PATH}`);
  console.log('[apply-weights] Summary:');
  console.log('  by_source_type:', JSON.stringify(sourceTypeMultipliers));
  console.log('  by_format:     ', JSON.stringify(formatMultipliers));

  db.close();
  console.log(`[apply-weights] Done at ${new Date().toISOString()}`);
})();
