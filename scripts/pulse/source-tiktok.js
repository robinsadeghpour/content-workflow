'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ACTOR_SCRIPT = path.join(__dirname, '../../.claude/skills/apify-ultimate-scraper/reference/scripts/run_actor.js');
const PROJECT_ROOT = path.join(__dirname, '../..');

const TIKTOK_ACTOR = 'clockworks/tiktok-scraper';

// Hashtags relevant to Robin's content themes: AI, coding, SaaS
const SEARCH_HASHTAGS = ['claudeai', 'aitools', 'llm', 'claudecode'];

function runApifyActor(actorId, input, outputFile) {
  const result = spawnSync('node', [
    '--env-file=.env',
    ACTOR_SCRIPT,
    '--actor', actorId,
    '--input', JSON.stringify(input),
    '--output', outputFile,
    '--format', 'json',
  ], {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
    timeout: 180000,
  });

  if (result.status !== 0) {
    throw new Error(`Apify actor ${actorId} failed: ${(result.stderr || '').slice(0, 500)}`);
  }
  return outputFile;
}

/**
 * Normalize a TikTok item from Apify into the common idea shape.
 */
function normalizeTikTokItem(item) {
  const title = (item.text || item.title || item.description || '').slice(0, 500);
  if (!title) return null;

  const url = item.webVideoUrl || item.url || item.videoUrl;
  if (!url) return null;

  return {
    title,
    summary: `TikTok by @${item.authorMeta?.name || item.author || 'unknown'}. ${item.playCount || 0} plays.`.slice(0, 2000),
    source_url: url,
    source_type: 'tiktok',
    scraped_at: new Date().toISOString(),
    views: item.playCount || 0,
    likes: item.diggCount || item.likeCount || 0,
    comments: item.commentCount || 0,
  };
}

async function fetchTikTokIdeas() {
  const allIdeas = [];
  const seenUrls = new Set();
  const outputFile = path.join(PROJECT_ROOT, 'data', `tiktok-pulse-${Date.now()}.json`);

  try {
    // Search by hashtags for AI/tech content
    const input = {
      hashtags: SEARCH_HASHTAGS,
      resultsPerPage: 5,
      maxItems: 20,
    };

    runApifyActor(TIKTOK_ACTOR, input, outputFile);

    if (!fs.existsSync(outputFile)) {
      throw new Error('Output file not created by Apify actor');
    }

    const raw = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    const items = Array.isArray(raw) ? raw : [];

    for (const item of items) {
      const idea = normalizeTikTokItem(item);
      if (idea && !seenUrls.has(idea.source_url)) {
        seenUrls.add(idea.source_url);
        allIdeas.push(idea);
      }
    }

    return allIdeas;
  } finally {
    // Clean up temp output file
    if (fs.existsSync(outputFile)) {
      try { fs.unlinkSync(outputFile); } catch (_) {}
    }
  }
}

module.exports = { fetchTikTokIdeas };
