'use strict';

const WEIGHTS = { recency: 0.4, engagement: 0.6 };

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
  return WEIGHTS.recency * rec + WEIGHTS.engagement * Math.min(eng / 7, 1);
}

module.exports = { scoreIdea, normalizeEngagement, normalizeRecency, WEIGHTS };
