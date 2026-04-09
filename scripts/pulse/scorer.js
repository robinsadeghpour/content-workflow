'use strict';

const fs = require('fs');
const path = require('path');

const WEIGHTS = { recency: 0.4, engagement: 0.6 };

// Load performance multipliers from data/performance-weights.json.
// Falls back to empty multipliers when the file doesn't exist yet (first run).
let performanceMultipliers = { by_source_type: {}, by_format: {} };
try {
  performanceMultipliers = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'performance-weights.json'), 'utf-8')
  );
} catch (e) { /* file missing = no multipliers yet, use defaults */ }

function normalizeEngagement(views, likes, comments) {
  const raw = (views || 0) + (likes || 0) * 5 + (comments || 0) * 3;
  return raw > 0 ? Math.log10(raw + 1) : 0;
}

function normalizeRecency(scrapedAtIso) {
  const daysDiff = (Date.now() - new Date(scrapedAtIso).getTime()) / 86400000;
  return Math.max(0, 1 - daysDiff / 30);
}

function scoreIdea(idea) {
  const eng = normalizeEngagement(idea.views, idea.likes, idea.comments);
  const rec = normalizeRecency(idea.scraped_at || new Date().toISOString());
  const baseScore = WEIGHTS.recency * rec + WEIGHTS.engagement * Math.min(eng / 7, 1);
  const sourceMultiplier = (performanceMultipliers.by_source_type && performanceMultipliers.by_source_type[idea.source_type]) || 1.0;
  return baseScore * sourceMultiplier;
}

module.exports = { scoreIdea, normalizeEngagement, normalizeRecency, WEIGHTS };
