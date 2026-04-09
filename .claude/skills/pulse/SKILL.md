---
name: pulse
version: 1.0.0
description: |
  Daily content discovery pipeline that scrapes YouTube, X/Twitter, TikTok, and Anthropic
  changelogs for trending AI/tech topics relevant to Robin's personal brand. Scores and
  deduplicates all ideas, eagerly extracts transcripts for video content, writes everything
  to data/content.db, and generates a dated markdown review file at data/review/YYYY-MM-DD.md.
  Trigger phrases: /pulse, "run discovery", "find topics", "run pulse", or triggered by
  daily 6 AM schedule via scripts/cron-daemon.js.
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - AskUserQuestion
---

# Pulse -- Content Discovery Pipeline

Automated daily discovery that keeps Robin's content backlog stocked with trending AI/tech
ideas -- no manual searching required.

## Prerequisites

Ensure `.env` contains:
- `APIFY_TOKEN` -- required for TikTok and X scrapers
- `SUPADATA_API_KEY` -- required for transcript extraction
- `ANTHROPIC_API_KEY` -- required for content generation phases (not used by pulse itself)

## Running the Pulse

### Step 1: Ensure DB is initialized with transcript column

```bash
node scripts/init-db.js
```

### Step 2: Run the full pulse

```bash
node scripts/pulse.js
```

This will:
1. Scrape YouTube (via yt-search), TikTok (via Apify `clockworks/tiktok-scraper`), X/Twitter (via Apify `apidojo/tweet-scraper`), and Anthropic changelogs (via Cheerio)
2. Score each idea by recency + engagement (no Claude API calls -- pure numeric formula)
3. Deduplicate against existing `data/content.db` entries using SHA-256 URL hashes
4. Eagerly fetch transcripts for all YouTube and TikTok ideas via Supadata
5. Insert new ideas into `data/content.db` (ideas table, status='new')
6. Generate a dated markdown review file at `data/review/YYYY-MM-DD.md`

Source failures are logged and skipped -- the pulse continues even if one source is down.

### Step 3: Read and display the review file

After the pulse completes, read the review file to present a summary:

```bash
cat data/review/$(date +%Y-%m-%d).md
```

Present the top ideas from the review file to Robin with their scores, sources, and content angle suggestions.

## Expected Output

```
[PULSE] 2026-04-09T06:00:00.000Z -- pulse started
[PULSE] youtube: 12 ideas found
[PULSE] tiktok: 8 ideas found
[PULSE] x: 15 ideas found
[PULSE] changelog: 3 ideas found
[PULSE] 18 new ideas (20 duplicates filtered)
[TRANSCRIPT] Fetching transcripts for 10 video ideas...
[TRANSCRIPT] 8/10 transcripts fetched
[PULSE] Inserted 18 ideas into data/content.db
[REVIEW] Review file written: data/review/2026-04-09.md
[PULSE] Done. 18 ideas written to DB. Review file generated.
```

## Daemon Mode

To run the pulse automatically every day at 6:00 AM Berlin time, use the cron daemon:

### Start the daemon (background)

```bash
node scripts/cron-daemon.js &
```

Or with persistent logging:

```bash
node scripts/cron-daemon.js >> data/pulse-cron.log 2>&1 &
```

The daemon uses `node-cron` with schedule `0 6 * * *` and `timezone: 'Europe/Berlin'`.

### Check if daemon is running

```bash
pgrep -f cron-daemon
```

### Stop the daemon

```bash
pkill -f cron-daemon
```

Or find the PID and kill it:

```bash
kill $(pgrep -f cron-daemon)
```

### Manual pulse is always available

```bash
node scripts/pulse.js
```

Or trigger via this skill: `/pulse`

## Architecture

```
scripts/pulse.js              -- Main orchestrator
scripts/pulse/
  source-youtube.js           -- YouTube via yt-search CLI
  source-tiktok.js            -- TikTok via Apify clockworks/tiktok-scraper
  source-x.js                 -- X/Twitter via Apify apidojo/tweet-scraper
  source-changelog.js         -- Anthropic API + Claude Code CHANGELOG.md
  scorer.js                   -- Weighted sum score (recency 40%, engagement 60%)
  deduplicator.js             -- SHA-256 URL hash deduplication
  transcript-fetcher.js       -- Supadata transcript extraction (p-limit 3)
  review-generator.js         -- Dated markdown review file generator
scripts/cron-daemon.js        -- node-cron daemon for 6 AM daily schedule
data/review/YYYY-MM-DD.md     -- Daily review files (one per pulse run)
data/content.db               -- SQLite backlog (ideas table)
```

## Troubleshooting

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| `APIFY_TOKEN not found` | Missing `.env` key | Add `APIFY_TOKEN=...` to `.env` |
| `SUPADATA_API_KEY not set` | Missing env key | Add `SUPADATA_API_KEY=...` to `.env` |
| `youtube FAILED` | yt-dlp not installed | `pip install yt-dlp` |
| `tiktok FAILED` | Apify actor error | Check Apify console, verify credits |
| `x FAILED` | Apify actor error | Check Apify console, verify credits |
| No review file generated | 0 new ideas found | All today's ideas already in DB (expected on re-run) |
