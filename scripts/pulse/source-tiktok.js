'use strict';

const {
  runActorDatasetItems,
  splitActorRows,
  warnDiagnostics,
} = require('../lib/apify');

const TIKTOK_ACTOR = 'clockworks/tiktok-scraper';

// Hashtags relevant to Robin's content themes: AI, coding, SaaS
const SEARCH_HASHTAGS = ['claudeai', 'aitools', 'llm', 'claudecode'];

function buildTikTokActorInput() {
  return {
    hashtags: SEARCH_HASHTAGS,
    resultsPerPage: 5,
    maxItems: 20,
  };
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

async function fetchTikTokIdeas({
  runActor = runActorDatasetItems,
  warn = console.warn,
} = {}) {
  const allIdeas = [];
  const seenUrls = new Set();
  const input = buildTikTokActorInput();
  const items = await runActor({
    actorId: TIKTOK_ACTOR,
    input,
    maxItems: input.maxItems,
  });
  const { dataRows, diagnostics } = splitActorRows(items);
  warnDiagnostics('TikTok Scraper', diagnostics, warn);

  for (const item of dataRows) {
    const idea = normalizeTikTokItem(item);
    if (idea && !seenUrls.has(idea.source_url)) {
      seenUrls.add(idea.source_url);
      allIdeas.push(idea);
    }
  }

  return allIdeas;
}

module.exports = {
  TIKTOK_ACTOR,
  buildTikTokActorInput,
  fetchTikTokIdeas,
  normalizeTikTokItem,
};
