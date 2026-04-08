---
name: pulse
version: 0.1.0
description: |
  Daily content discovery trigger that scrapes YouTube, X, TikTok, web, and
  changelog sources for trending AI/tech topics relevant to Robin's personal brand.
  Writes discovered ideas to data/content.db for morning review. Trigger phrases:
  /pulse, "run discovery", "find topics", or triggered by daily 6 AM schedule.
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - AskUserQuestion
---

# Pulse -- Content Discovery Trigger

> Phase 1 stub. Phase 2 will implement full scraping logic (DISC-01, DISC-02).

## Current Behavior (Phase 1)

This is a stub. When invoked, respond with the following log output:

```
[PULSE] {current ISO timestamp} -- pulse triggered (stub, no scraping)
Status: Awaiting Phase 2 implementation
Intended sources: YouTube, X, TikTok, web, changelogs
Target database: data/content.db (ideas table)
```

No network requests are made. No data is written. The invocation is acknowledged and logged only.

## Intended Behavior (Phase 2)

Full implementation will execute these steps in order:

1. **Scrape sources** -- Pull trending AI/tech content from YouTube (via yt-search + Supadata), X/TikTok (via Apify actors), web changelogs, and GitHub release pages
2. **Score and deduplicate** -- Score scraped items by relevance and engagement signals; deduplicate against existing entries in data/content.db using content hash
3. **Write to ideas table** -- Insert new ideas into data/content.db with status='new', source, score, and scraped metadata
4. **Present summary** -- Output top 5 discovered ideas with title, source, and score so Robin can see what pulse found at a glance

## Schedule

- Daily trigger: 6:00 AM via Claude Code /schedule (per D-07)
- Manual trigger: User runs /pulse anytime
- Registration command: `/schedule "0 6 * * *" /pulse`

## Dependencies (Phase 2)

- `data/content.db` -- ideas table where discovered topics are written
- `APIFY_TOKEN` in `.env` -- required for Apify-based scraping actors
- Apify skill -- for YouTube, TikTok, X data extraction
- Supadata skill -- for transcript extraction from discovered videos
