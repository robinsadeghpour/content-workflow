#!/usr/bin/env node
'use strict';

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const { randomUUID } = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'content.db');

const { fetchYouTubeIdeas } = require('./pulse/source-youtube');
const { fetchTikTokIdeas } = require('./pulse/source-tiktok');
const { fetchXIdeas } = require('./pulse/source-x');
const { fetchChangelogIdeas } = require('./pulse/source-changelog');
const { scoreIdea } = require('./pulse/scorer');
const { filterDuplicates } = require('./pulse/deduplicator');
const { fetchTranscriptsForIdeas } = require('./pulse/transcript-fetcher');
const { generateReviewMarkdown } = require('./pulse/review-generator');

const sources = [
  { name: 'youtube', fn: fetchYouTubeIdeas },
  { name: 'tiktok', fn: fetchTikTokIdeas },
  { name: 'x', fn: fetchXIdeas },
  { name: 'changelog', fn: fetchChangelogIdeas },
];

/**
 * Sanitize an idea's text fields before DB insert.
 * Truncates to safe lengths and strips control characters.
 */
function sanitizeIdea(idea) {
  const stripControl = str =>
    typeof str === 'string'
      ? str.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim()
      : str;

  return {
    ...idea,
    title: stripControl(idea.title || '').slice(0, 500),
    summary: idea.summary ? stripControl(idea.summary).slice(0, 2000) : null,
    source_url: idea.source_url ? idea.source_url.slice(0, 2000) : null,
  };
}

async function runPulse() {
  console.log(`[PULSE] ${new Date().toISOString()} -- pulse started`);
  const allIdeas = [];

  // Step 1: Scrape all sources — skip-and-log per D-02
  for (const source of sources) {
    try {
      const ideas = await source.fn();
      allIdeas.push(...ideas);
      console.log(`[PULSE] ${source.name}: ${ideas.length} ideas found`);
    } catch (err) {
      console.error(`[PULSE] ${source.name} FAILED: ${err.message}`);
    }
  }

  if (allIdeas.length === 0) {
    console.log('[PULSE] No ideas found from any source. Done.');
    return;
  }

  // Step 2: Score all ideas (per D-04, D-05 — numeric only, no Claude API)
  const scrapedAt = new Date().toISOString();
  allIdeas.forEach(idea => {
    if (!idea.scraped_at) idea.scraped_at = scrapedAt;
    idea.score = scoreIdea(idea);
  });

  // Step 3: Deduplicate against existing DB entries
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  const newIdeas = filterDuplicates(db, allIdeas);
  console.log(`[PULSE] ${newIdeas.length} new ideas (${allIdeas.length - newIdeas.length} duplicates filtered)`);

  if (newIdeas.length === 0) {
    console.log('[PULSE] All ideas already in DB. Done.');
    db.close();
    return;
  }

  // Step 4: Sanitize text fields before storage (T-02-01)
  const sanitizedIdeas = newIdeas.map(sanitizeIdea);

  // Step 5: Fetch transcripts eagerly for video ideas (per D-10)
  await fetchTranscriptsForIdeas(sanitizedIdeas);

  // Step 6: Insert into DB
  const insertStmt = db.prepare(`
    INSERT INTO ideas (id, title, summary, source_url, source_type, score, status, dedup_hash, scraped_at, transcript)
    VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)
  `);

  const insertMany = db.transaction((ideas) => {
    for (const idea of ideas) {
      insertStmt.run(
        randomUUID(),
        idea.title,
        idea.summary || null,
        idea.source_url || null,
        idea.source_type,
        idea.score,
        idea.dedup_hash,
        idea.scraped_at || scrapedAt,
        idea.transcript || null
      );
    }
  });
  insertMany(sanitizedIdeas);
  console.log(`[PULSE] Inserted ${sanitizedIdeas.length} ideas into data/content.db`);

  // Step 7: Generate review markdown (per D-07, D-12)
  const sortedIdeas = [...sanitizedIdeas].sort((a, b) => b.score - a.score);
  generateReviewMarkdown(sortedIdeas);

  console.log(`[PULSE] Done. ${sanitizedIdeas.length} ideas written to DB. Review file generated.`);
  db.close();
}

runPulse().catch(err => {
  console.error('[PULSE] Fatal error:', err);
  process.exit(1);
});
