'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ACTOR_SCRIPT = path.join(__dirname, '../../.claude/skills/apify-ultimate-scraper/reference/scripts/run_actor.js');
const PROJECT_ROOT = path.join(__dirname, '../..');

const X_ACTOR = 'apidojo/tweet-scraper';

// Search queries for AI/tech trending tweets
const SEARCH_QUERIES = [
  'Claude AI OR claude.ai lang:en',
  'LLM agents 2026 lang:en',
  'Claude Code tips lang:en',
];

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
 * Normalize an X/Twitter tweet item from Apify into the common idea shape.
 */
function normalizeXItem(item) {
  const text = (item.text || item.full_text || item.content || '').slice(0, 500);
  if (!text || text.length < 10) return null;

  // Build tweet URL from id and author if not provided
  const url = item.url || item.tweetUrl ||
    (item.id && item.author?.userName
      ? `https://x.com/${item.author.userName}/status/${item.id}`
      : null);
  if (!url) return null;

  const author = item.author?.userName || item.username || item.user?.screen_name || 'unknown';

  return {
    title: text.slice(0, 200),
    summary: `Tweet by @${author}. ${item.retweetCount || 0} retweets, ${item.likeCount || item.favoriteCount || 0} likes.`.slice(0, 2000),
    source_url: url,
    source_type: 'x',
    scraped_at: new Date().toISOString(),
    views: item.viewCount || item.impressionCount || 0,
    likes: item.likeCount || item.favoriteCount || 0,
    comments: item.replyCount || 0,
  };
}

async function fetchXIdeas() {
  const allIdeas = [];
  const seenUrls = new Set();
  const outputFile = path.join(PROJECT_ROOT, 'data', `x-pulse-${Date.now()}.json`);

  try {
    // Use first query — scraper runs one at a time to minimize credit usage
    const input = {
      searchTerms: SEARCH_QUERIES,
      maxTweets: 20,
      filter: 'Latest',
    };

    runApifyActor(X_ACTOR, input, outputFile);

    if (!fs.existsSync(outputFile)) {
      throw new Error('Output file not created by Apify actor');
    }

    const raw = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    const items = Array.isArray(raw) ? raw : [];

    for (const item of items) {
      const idea = normalizeXItem(item);
      if (idea && !seenUrls.has(idea.source_url)) {
        seenUrls.add(idea.source_url);
        allIdeas.push(idea);
      }
    }

    return allIdeas;
  } finally {
    if (fs.existsSync(outputFile)) {
      try { fs.unlinkSync(outputFile); } catch (_) {}
    }
  }
}

module.exports = { fetchXIdeas };
