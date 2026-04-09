---
phase: 02-discovery-pipeline
plan: 01
subsystem: discovery
tags: [node-cron, cheerio, p-limit, better-sqlite3, apify, supadata, yt-search, sqlite]

requires:
  - phase: 01-foundation-voice
    provides: content.db with ideas table, WAL mode, CommonJS package setup, dotenv

provides:
  - Full daily pulse pipeline (scripts/pulse.js) orchestrating 4 sources
  - YouTube source scraper via yt-search CLI with regex text parsing
  - TikTok source scraper via Apify clockworks/tiktok-scraper
  - X/Twitter source scraper via Apify apidojo/tweet-scraper
  - Anthropic changelog scraper via Cheerio + GitHub raw CHANGELOG.md
  - Weighted sum scorer (recency 40%, engagement 60%, no Claude API)
  - SHA-256 URL-based deduplicator with URL normalization
  - Supadata transcript fetcher with p-limit(3) concurrency
  - Dated markdown review generator at data/review/YYYY-MM-DD.md
  - Cron daemon (scripts/cron-daemon.js) for 6 AM Berlin daily schedule
  - Updated pulse SKILL.md (v1.0.0, full instructions, daemon mode docs)

affects:
  - 02-02 (review skill needs ideas table and review markdown files from this plan)
  - 03-content-generation (idea backlog populated by this plan)
  - 04-analytics (performance scoring references idea source_type from this plan)

tech-stack:
  added:
    - node-cron@4.2.1 (daily cron scheduling)
    - cheerio@1.2.0 (Anthropic changelog HTML parsing)
    - p-limit@4.0.0 (CJS-compatible concurrency limiter for transcript fetching)
  patterns:
    - Apify actors invoked via child_process spawnSync (never require — ESM boundary)
    - p-limit default export accessed via _pLimit.default || _pLimit (CJS/ESM interop)
    - Skip-and-log per source failure: try/catch around each source, pulse continues
    - Idempotent schema migration: ALTER TABLE wrapped in try/catch for duplicate column

key-files:
  created:
    - scripts/pulse.js
    - scripts/pulse/source-youtube.js
    - scripts/pulse/source-tiktok.js
    - scripts/pulse/source-x.js
    - scripts/pulse/source-changelog.js
    - scripts/pulse/scorer.js
    - scripts/pulse/deduplicator.js
    - scripts/pulse/transcript-fetcher.js
    - scripts/pulse/review-generator.js
    - scripts/cron-daemon.js
    - .claude/skills/apify-ultimate-scraper/reference/package.json
  modified:
    - scripts/init-db.js (transcript column ALTER TABLE)
    - .claude/skills/pulse/SKILL.md (stub -> v1.0.0 full implementation)
    - package.json (node-cron, cheerio, p-limit@4 added)

key-decisions:
  - "Add package.json with type:module in apify-ultimate-scraper/reference/ to resolve ESM boundary — the content-workflow root has type:commonjs which prevented run_actor.js (ESM) from executing"
  - "p-limit v4 required for CommonJS compatibility — v5+ is ESM-only; access via _pLimit.default || _pLimit for CJS interop"
  - "Transcript fetcher uses AbortController with 30s timeout per fetch — addresses T-02-03 DoS threat"
  - "Input sanitization (strip control chars, truncate title/summary) applied in pulse.js before DB insert — addresses T-02-01 tampering threat"

patterns-established:
  - "Apify ESM invocation pattern: spawnSync('node', ['--env-file=.env', ACTOR_SCRIPT, ...]) from project root"
  - "Source module shape: async function returning { title, summary, source_url, source_type, scraped_at, views, likes, comments }"
  - "Skip-and-log error handling: try/catch per source in for-loop, console.error on failure, continue"

requirements-completed: [DISC-01, DISC-02, DISC-04]

duration: 8min
completed: 2026-04-09
---

# Phase 02 Plan 01: Discovery Pipeline Summary

**Four-source daily pulse pipeline (YouTube, TikTok, X, changelogs) with SHA-256 dedup, weighted scoring, eager Supadata transcript extraction, SQLite persistence, and dated markdown review generation**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-09T10:31:25Z
- **Completed:** 2026-04-09T10:38:55Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Full `scripts/pulse.js` orchestrator runs all 4 sources with skip-and-log fault isolation — one failing source never blocks the others
- All pipeline modules (scorer, deduplicator, transcript-fetcher, review-generator) created and verified loading
- Cron daemon at `scripts/cron-daemon.js` schedules pulse daily at 6:00 AM Europe/Berlin via node-cron
- Pulse SKILL.md upgraded from stub to v1.0.0 with full usage docs and daemon mode section

## Task Commits

1. **Task 1: Install dependencies, migrate schema, create scoring/dedup/transcript modules** - `a7f512a` (feat)
2. **Task 2: Create source scrapers, review markdown generator, pulse orchestrator, update pulse SKILL.md** - `a15c3fe` (feat)
3. **Task 3: Create cron daemon for automated daily pulse** - `2f6adbd` (feat)

## Files Created/Modified

- `scripts/pulse.js` - Main orchestrator: scrape → score → dedup → transcripts → DB insert → review
- `scripts/pulse/source-youtube.js` - YouTube scraper via yt-search CLI, regex text parser
- `scripts/pulse/source-tiktok.js` - TikTok scraper via Apify clockworks/tiktok-scraper
- `scripts/pulse/source-x.js` - X/Twitter scraper via Apify apidojo/tweet-scraper
- `scripts/pulse/source-changelog.js` - Anthropic API changelog (Cheerio) + Claude Code CHANGELOG.md (regex)
- `scripts/pulse/scorer.js` - Weighted sum: recency (40%) + engagement (60%), no Claude API
- `scripts/pulse/deduplicator.js` - SHA-256 URL hash dedup with URL normalization
- `scripts/pulse/transcript-fetcher.js` - Supadata batch fetch, p-limit(3) concurrency, AbortController timeout
- `scripts/pulse/review-generator.js` - Writes data/review/YYYY-MM-DD.md with collapsible transcript blocks
- `scripts/cron-daemon.js` - node-cron schedule 0 6 * * * Europe/Berlin, spawns pulse.js
- `scripts/init-db.js` - Added idempotent ALTER TABLE for transcript column
- `.claude/skills/pulse/SKILL.md` - Upgraded from stub to v1.0.0 with full docs
- `.claude/skills/apify-ultimate-scraper/reference/package.json` - Added type:module to fix ESM boundary

## Decisions Made

- **ESM boundary fix:** Created `reference/package.json` with `"type": "module"` so Node resolves `run_actor.js` (which uses `import` syntax) as ESM even though the project root has `"type": "commonjs"`. This is the minimal non-invasive fix.
- **p-limit CJS interop:** p-limit v4 is the last CJS release per research, but its exports object wraps `.default` — accessed via `_pLimit.default || _pLimit` pattern.
- **Threat mitigations applied inline:** T-02-01 (input sanitization in pulse.js), T-02-02 (API key never logged), T-02-03 (AbortController 30s timeout + p-limit(3) bounds concurrency).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed p-limit CJS interop**
- **Found during:** Task 1 (transcript-fetcher module load verification)
- **Issue:** `pLimit is not a function` — p-limit v4 exports `{ default: fn }` not a direct function
- **Fix:** Access via `const pLimit = _pLimit.default || _pLimit`
- **Files modified:** scripts/pulse/transcript-fetcher.js
- **Verification:** `node -e "require('./scripts/pulse/transcript-fetcher')"` succeeds
- **Committed in:** a7f512a (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Apify ESM boundary — wrong node flag**
- **Found during:** Task 2 (module load test revealed `--input-type=module` is for stdin, not file)
- **Issue:** `--input-type=module` flag is for piped stdin scripts, not for file execution. `run_actor.js` uses ESM `import` but lives under a `"type": "commonjs"` project root
- **Fix:** Added `{"type":"module"}` package.json to `.claude/skills/apify-ultimate-scraper/reference/` directory so Node resolves all scripts there as ESM; removed wrong flag from spawnSync calls
- **Files modified:** source-tiktok.js, source-x.js, reference/package.json
- **Verification:** `node --env-file=.env .claude/skills/apify-ultimate-scraper/reference/scripts/run_actor.js --help` succeeds
- **Committed in:** a15c3fe (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2x Rule 1 - Bug)
**Impact on plan:** Both fixes were essential for correctness. No scope creep.

## Issues Encountered

- Apify `run_actor.js` ESM/CJS boundary was flagged as a primary risk in RESEARCH.md and did materialize. The solution (package.json in the reference subdirectory) was non-invasive and does not affect the main project's CommonJS setup.

## Known Stubs

None — all data flows are wired. Apify and Supadata sources will return empty/skipped results when API keys are not set or actors fail, which is intentional skip-and-log behavior.

## Threat Flags

None — no new network endpoints or trust boundaries introduced beyond what the plan's threat model covers. All T-02-0x mitigations applied.

## Next Phase Readiness

- `data/content.db` ideas table with transcript column ready for population
- `data/review/YYYY-MM-DD.md` format established for Phase 02-02 review skill
- Pulse pipeline can be tested end-to-end with `node scripts/pulse.js` (requires APIFY_TOKEN + SUPADATA_API_KEY in .env)
- Phase 02-02 (interactive review skill) can now be implemented against the ideas backlog

---
*Phase: 02-discovery-pipeline*
*Completed: 2026-04-09*
