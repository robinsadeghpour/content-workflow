# Phase 2: Discovery Pipeline - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the automated daily content discovery pulse, a scored idea backlog with deduplication, and a morning CLI review workflow where Robin can scan ideas and make KEEP/SKIP/STAR decisions — so topics flow continuously into the pipeline without manual searching.

</domain>

<decisions>
## Implementation Decisions

### Source Strategy
- **D-01:** Pulse scrapes all four source categories daily: YouTube (via yt-search + Supadata), TikTok (via Apify actor), X/Twitter (via Apify actor), and web changelogs/GitHub releases (via Cheerio).
- **D-02:** Source failures are handled with skip-and-log — if a source fails (API down, rate limit, timeout), log the failure and continue with remaining sources. Next pulse run retries automatically. No partial run blocking.
- **D-03:** Changelog monitoring starts with Claude/Anthropic only. No broader ecosystem monitoring in Phase 2. Can be expanded later via config.

### Scoring & Ranking
- **D-04:** Ideas are scored using two signals only: recency/freshness and engagement metrics (views, likes, comments from source platform). No topic relevance or source authority scoring in v1.
- **D-05:** Scoring uses a weighted sum formula — numeric calculation, no Claude API calls. Fast, predictable, zero cost per idea. Weights can be tuned later.
- **D-06:** Pulse targets 10-20 discovered ideas per daily run. Enough variety for Robin to pick from without overwhelming the review session (~5 min).

### Review Workflow
- **D-07:** Morning review is a two-step flow: (1) Pulse generates a markdown overview file at `data/review/YYYY-MM-DD.md` with the full ranked list of ideas. Robin scans this file at their own pace. (2) Robin runs `/review` which walks through ideas interactively for KEEP/SKIP/STAR decisions.
- **D-08:** The review markdown file is the read-only overview. Decisions happen via the interactive `/review` command, not by editing the file.
- **D-09:** Each idea in `/review` shows: title + summary, source + link, and a content angle suggestion (e.g., "hot take", "tutorial", "news reaction"). Score breakdown is not shown — Robin doesn't need to see the math.

### Transcript Handling
- **D-10:** Transcripts are extracted eagerly during pulse — all discovered video ideas (YouTube, TikTok) get their transcripts extracted immediately via Supadata, not deferred to KEEP or content generation.
- **D-11:** Transcripts are stored in a `transcript` TEXT column added to the existing `ideas` table in `data/content.db`. Co-located with idea metadata.
- **D-12:** The morning review markdown file includes transcripts as collapsible `<details><summary>` blocks — available for Robin to expand and skim without cluttering the overview.

### Claude's Discretion
- Search queries and keywords used per source (what to search for on YouTube, TikTok, X)
- Deduplication hash algorithm (content hash vs URL-based)
- Exact weighted sum formula and default weight values for scoring
- Markdown review file layout and formatting details
- Content angle suggestion generation approach
- How `/review` handles ideas that were starred in previous sessions (re-surface vs separate view)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Skills (scraping + data sources)
- `.claude/skills/apify-ultimate-scraper/SKILL.md` — Apify actor invocation for TikTok and X/Twitter scraping
- `.claude/skills/supadata/SKILL.md` — YouTube and TikTok transcript extraction API
- `.claude/skills/yt-search-setup/SKILL.md` — YouTube search integration setup

### Phase 1 Stubs (to be implemented)
- `.claude/skills/pulse/SKILL.md` — Current stub with intended Phase 2 behavior documented
- `.claude/skills/review/SKILL.md` — Current stub with intended Phase 2 behavior and cron schedule summary

### Database Schema
- `data/content.db` — Existing schema with `ideas`, `drafts`, `performance` tables. Phase 2 adds `transcript` column to `ideas` and populates the table.

### Technology Stack
- `CLAUDE.md` — Full recommended tech stack. Relevant: better-sqlite3, cheerio, native fetch, p-limit for concurrency control.

### Pipeline Reference
- `.claude/skills/tiktok-slideshows/data/performance-log.json` — Performance tracking format reference for scoring patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Apify skill** (`.claude/skills/apify-ultimate-scraper/SKILL.md`): Ready-to-use for TikTok and X scraping via Apify actors
- **Supadata skill** (`.claude/skills/supadata/SKILL.md`): YouTube/TikTok transcript extraction — direct integration for D-10
- **yt-search skill**: YouTube search for discovering trending AI/tech videos
- **content.db schema**: `ideas` table already exists with id, title, summary, source_url, source_type, score, status, dedup_hash, scraped_at, created_at — needs only `transcript` column added

### Established Patterns
- Skills are SKILL.md directories under `.claude/skills/` — pulse and review stubs already exist
- SQLite via better-sqlite3 with WAL mode (D-02 from Phase 1) — supports concurrent pulse writes and review reads
- Node.js scripts invoked from skills via bash

### Integration Points
- `data/content.db` ideas table — pulse writes, review reads and updates status
- `data/review/` directory — new, pulse generates daily markdown files here
- `/pulse` skill — replace stub with full scraping + scoring + markdown generation
- `/review` skill — replace stub with interactive KEEP/SKIP/STAR workflow reading from DB

</code_context>

<specifics>
## Specific Ideas

- Robin wants to scan a full list first (markdown file), then make decisions interactively — not a pure card-by-card flow from the start
- Content angle suggestions per idea make the review faster — Robin immediately knows "this is a hot take" vs "this is a tutorial"
- Transcripts available upfront (eager extraction) so Robin can expand and skim during review — no waiting for extraction after KEEP
- Changelogs start narrow (Claude/Anthropic only) and expand later — avoids noise from irrelevant product updates

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-discovery-pipeline*
*Context gathered: 2026-04-09*
