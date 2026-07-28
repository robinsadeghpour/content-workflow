'use strict';

const {
  runActorDatasetItems,
  splitActorRows,
  warnDiagnostics,
} = require('../lib/apify');

const X_ACTORS = Object.freeze({
  existing: 'apidojo/tweet-scraper',
  xquik: 'xquik/x-tweet-scraper',
});
const X_ACTOR = X_ACTORS.existing;
const MAX_ITEMS = 20;

// Search queries for AI/tech trending tweets
const SEARCH_QUERIES = [
  'Claude AI OR claude.ai lang:en',
  'LLM agents 2026 lang:en',
  'Claude Code tips lang:en',
];

function resolveXActorId(actorId = process.env.PULSE_X_ACTOR_ID) {
  const selected = (actorId || X_ACTOR).trim().replace('~', '/');
  if (!Object.values(X_ACTORS).includes(selected)) {
    throw new Error(
      `PULSE_X_ACTOR_ID must be ${Object.values(X_ACTORS).join(' or ')}.`
    );
  }
  return selected;
}

function buildXActorInput(
  searchTerms = SEARCH_QUERIES,
  maxItems = MAX_ITEMS,
  actorId = X_ACTOR
) {
  if (!Array.isArray(searchTerms) || searchTerms.length === 0) {
    throw new Error('X search terms are required.');
  }
  if (!Number.isInteger(maxItems) || maxItems < 1) {
    throw new Error('X max items must be a positive integer.');
  }

  const selectedActor = resolveXActorId(actorId);
  if (selectedActor === X_ACTORS.existing) {
    return {
      searchTerms: [...searchTerms],
      maxTweets: maxItems,
      filter: 'Latest',
    };
  }

  return {
    mode: 'search',
    searchTerms: [...searchTerms],
    maxItems,
    queryType: 'Latest',
    outputVariant: 'rich',
    outputPreset: 'nested',
    fieldStyle: 'camelCase',
    includeSearchTerms: true,
  };
}

/**
 * Normalize an X/Twitter tweet item from Apify into the common idea shape.
 */
function normalizeXItem(item, scrapedAt = new Date().toISOString()) {
  const text = (
    item.text ||
    item.fullText ||
    item.full_text ||
    item.content ||
    ''
  ).slice(0, 500);
  if (!text || text.length < 10) return null;

  const author = item.author?.username ||
    item.author?.userName ||
    item.authorUsername ||
    item.author_username ||
    item.username ||
    item.user?.screen_name ||
    'unknown';
  const url = item.tweetUrl ||
    item.twitterUrl ||
    item.tweet_url ||
    item.url ||
    (item.id && author !== 'unknown'
      ? `https://x.com/${author}/status/${item.id}`
      : null);
  if (!url) return null;

  return {
    title: text.slice(0, 200),
    summary: `Tweet by @${author}. ${item.retweetCount || 0} retweets, ${item.likeCount || item.favoriteCount || 0} likes.`.slice(
      0,
      2000
    ),
    source_url: url,
    source_type: 'x',
    scraped_at: scrapedAt,
    views: item.viewCount || item.impressionCount || 0,
    likes: item.likeCount || item.favoriteCount || 0,
    comments: item.replyCount || 0,
  };
}

async function fetchXIdeas({
  runActor = runActorDatasetItems,
  warn = console.warn,
  actorId = resolveXActorId(),
} = {}) {
  const allIdeas = [];
  const seenUrls = new Set();
  const selectedActor = resolveXActorId(actorId);
  const input = buildXActorInput(SEARCH_QUERIES, MAX_ITEMS, selectedActor);
  const items = await runActor({
    actorId: selectedActor,
    input,
    maxItems: MAX_ITEMS,
  });
  const { dataRows, diagnostics } = splitActorRows(items);
  warnDiagnostics('X Tweet Scraper', diagnostics, warn);
  const scrapedAt = new Date().toISOString();

  for (const item of dataRows) {
    const idea = normalizeXItem(item, scrapedAt);
    if (idea && !seenUrls.has(idea.source_url)) {
      seenUrls.add(idea.source_url);
      allIdeas.push(idea);
    }
  }

  return allIdeas;
}

module.exports = {
  SEARCH_QUERIES,
  X_ACTOR,
  X_ACTORS,
  buildXActorInput,
  fetchXIdeas,
  normalizeXItem,
  resolveXActorId,
};
