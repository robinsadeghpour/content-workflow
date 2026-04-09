'use strict';

const cheerio = require('cheerio');

const ANTHROPIC_API_CHANGELOG_URL = 'https://platform.claude.com/docs/en/release-notes/api';
const CLAUDE_CODE_CHANGELOG_URL = 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md';

// Max age in days for changelog entries to be considered "new"
const MAX_AGE_DAYS = 7;

/**
 * Parse a date string from a changelog heading.
 * Handles formats like "April 8, 2026", "2026-04-08", "January 2026", etc.
 * Returns a Date object or null if unparseable.
 */
function parseChangelogDate(str) {
  if (!str) return null;
  // Try direct parse first
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  // Try "Month DD, YYYY"
  const match = str.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (match) {
    const attempt = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
    if (!isNaN(attempt.getTime())) return attempt;
  }
  // Try "Month YYYY" (no day — use first of month)
  const monthYear = str.match(/([A-Za-z]+)\s+(\d{4})/);
  if (monthYear) {
    const attempt = new Date(`${monthYear[1]} 1, ${monthYear[2]}`);
    if (!isNaN(attempt.getTime())) return attempt;
  }
  return null;
}

function isRecent(dateStr) {
  const d = parseChangelogDate(dateStr);
  if (!d) return true; // If unparseable, include it (fail open)
  const ageDays = (Date.now() - d.getTime()) / 86400000;
  return ageDays <= MAX_AGE_DAYS;
}

/**
 * Fetch Anthropic API changelog from platform.claude.com
 * Uses cheerio to parse server-rendered HTML.
 */
async function fetchAnthropicApiChangelog() {
  const ideas = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(ANTHROPIC_API_CHANGELOG_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (content-workflow-pulse/1.0)' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error(`[CHANGELOG] Anthropic API changelog returned ${res.status}`);
      return ideas;
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    // Try h3 headings first, fall back to h2
    let headings = $('h3');
    if (headings.length === 0) headings = $('h2');

    headings.each((_, el) => {
      const text = $(el).text().trim();
      if (!text) return;

      // Check if heading looks like a date or version
      const hasDate = /\d{4}|january|february|march|april|may|june|july|august|september|october|november|december/i.test(text);
      if (!hasDate) return;
      if (!isRecent(text)) return;

      // Get the next sibling paragraph as summary
      const nextP = $(el).nextAll('p').first().text().trim();
      const summary = nextP ? nextP.slice(0, 2000) : `Anthropic API changelog update: ${text}`;

      ideas.push({
        title: `Anthropic API Update: ${text}`.slice(0, 500),
        summary: summary.slice(0, 2000),
        source_url: ANTHROPIC_API_CHANGELOG_URL,
        source_type: 'changelog',
        scraped_at: new Date().toISOString(),
        views: 0,
        likes: 0,
        comments: 0,
      });
    });
  } catch (err) {
    console.error(`[CHANGELOG] Anthropic API changelog fetch failed: ${err.message}`);
  }
  return ideas;
}

/**
 * Fetch Claude Code CHANGELOG.md from GitHub raw.
 * Takes the latest 3 version sections.
 */
async function fetchClaudeCodeChangelog() {
  const ideas = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(CLAUDE_CODE_CHANGELOG_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (content-workflow-pulse/1.0)' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error(`[CHANGELOG] Claude Code CHANGELOG.md returned ${res.status}`);
      return ideas;
    }
    const text = await res.text();

    // Match ## X.Y.Z headings (version headings in CHANGELOG.md)
    const versionRegex = /^## (\d+\.\d+\.\d+.*?)$/gm;
    const matches = [];
    let match;
    while ((match = versionRegex.exec(text)) !== null) {
      matches.push({ version: match[1].trim(), index: match.index });
      if (matches.length >= 3) break;
    }

    for (const m of matches) {
      // Extract content between this heading and the next
      const nextIdx = matches[matches.indexOf(m) + 1];
      const section = nextIdx
        ? text.slice(m.index, nextIdx.index).trim()
        : text.slice(m.index, m.index + 1000).trim();

      // Extract first meaningful paragraph as summary
      const lines = section.split('\n').slice(1); // skip heading line
      const summaryLines = lines.filter(l => l.trim() && !l.startsWith('##')).slice(0, 5);
      const summary = summaryLines.join(' ').replace(/\s+/g, ' ').trim().slice(0, 2000);

      ideas.push({
        title: `Claude Code ${m.version}`.slice(0, 500),
        summary: (summary || `Claude Code release ${m.version}`).slice(0, 2000),
        source_url: `https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md#${m.version.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
        source_type: 'changelog',
        scraped_at: new Date().toISOString(),
        views: 0,
        likes: 0,
        comments: 0,
      });
    }
  } catch (err) {
    console.error(`[CHANGELOG] Claude Code changelog fetch failed: ${err.message}`);
  }
  return ideas;
}

async function fetchChangelogIdeas() {
  const [anthropicIdeas, claudeCodeIdeas] = await Promise.all([
    fetchAnthropicApiChangelog(),
    fetchClaudeCodeChangelog(),
  ]);
  return [...anthropicIdeas, ...claudeCodeIdeas];
}

module.exports = { fetchChangelogIdeas };
