'use strict';

const { spawnSync } = require('child_process');
const os = require('os');
const path = require('path');

const YT_SEARCH_SCRIPT = path.join(os.homedir(), '.claude', 'scripts', 'yt-search.py');

const QUERIES = [
  'Claude AI news',
  'AI coding tools 2026',
  'LLM agents tutorial',
  'Claude Code tips',
  'AI automation workflow',
];

/**
 * Parse a view string like "1.2M views", "45.3K views", "356.0K views", "21.9K views"
 * into a numeric value.
 */
function parseViews(viewStr) {
  if (!viewStr) return 0;
  const clean = viewStr.replace(/views?/i, '').trim();
  const multipliers = { k: 1000, m: 1000000, b: 1000000000 };
  const match = clean.match(/^([\d.]+)\s*([kmb])?$/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const suffix = match[2] ? match[2].toLowerCase() : '';
  return Math.round(num * (multipliers[suffix] || 1));
}

/**
 * Parse the formatted text output from yt-search.py into idea objects.
 * Format:
 *   1. {title}
 *      Channel:  {channel}
 *      Views:    {views}
 *      Duration: {dur}
 *      Date:     {date}
 *      URL:      {url}
 *   ────────...
 */
function parseYtSearchOutput(text) {
  const ideas = [];
  // Split by the horizontal rule separator
  const blocks = text.split(/─{10,}/);

  for (const block of blocks) {
    const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    // First line: "N. Title"
    const titleMatch = lines[0].match(/^\d+\.\s+(.+)$/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();

    let channel = '';
    let viewsRaw = '';
    let url = '';
    let dateStr = '';

    for (const line of lines.slice(1)) {
      if (line.startsWith('Channel:')) channel = line.replace('Channel:', '').trim();
      else if (line.startsWith('Views:')) viewsRaw = line.replace('Views:', '').trim();
      else if (line.startsWith('URL:')) url = line.replace('URL:', '').trim();
      else if (line.startsWith('Date:')) dateStr = line.replace('Date:', '').trim();
    }

    if (!url || !title) continue;

    const views = parseViews(viewsRaw);

    ideas.push({
      title: title.slice(0, 500),
      summary: `YouTube video by ${channel}. Views: ${viewsRaw}.${dateStr && dateStr !== 'N/A' ? ` Published: ${dateStr}.` : ''}`.slice(0, 2000),
      source_url: url,
      source_type: 'youtube',
      scraped_at: new Date().toISOString(),
      views,
      likes: 0,
      comments: 0,
    });
  }

  return ideas;
}

async function fetchYouTubeIdeas() {
  const allIdeas = [];
  const seenUrls = new Set();

  for (const query of QUERIES) {
    const result = spawnSync('python3', [YT_SEARCH_SCRIPT, query, '--count', '5', '--months', '1'], {
      encoding: 'utf-8',
      timeout: 60000,
    });

    if (result.status !== 0) {
      console.error(`[YOUTUBE] Query "${query}" failed: ${(result.stderr || '').slice(0, 200)}`);
      continue;
    }

    const ideas = parseYtSearchOutput(result.stdout || '');
    for (const idea of ideas) {
      if (!seenUrls.has(idea.source_url)) {
        seenUrls.add(idea.source_url);
        allIdeas.push(idea);
      }
    }
  }

  return allIdeas;
}

module.exports = { fetchYouTubeIdeas };
