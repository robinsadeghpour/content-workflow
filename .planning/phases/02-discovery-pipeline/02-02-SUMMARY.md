---
phase: 02-discovery-pipeline
plan: 02
subsystem: review
tags: [better-sqlite3, interactive-cli, sqlite, morning-review]

requires:
  - phase: 02-discovery-pipeline
    plan: 01
    provides: data/content.db with ideas table (status, score, transcript columns), data/review/YYYY-MM-DD.md generation

provides:
  - scripts/review-update.js: Safe CLI script for parameterized idea status updates
  - .claude/skills/review/SKILL.md v1.0.0: Full interactive morning review workflow

affects:
  - 03-content-generation (kept ideas in content.db flow into content generation)
  - 04-analytics (review decisions establish kept/starred/skipped status for performance tracking)

tech-stack:
  added: []
  patterns:
    - Dedicated CLI script (review-update.js) for DB writes instead of inline node -e with placeholder substitution
    - AskUserQuestion tool for interactive CLI decision collection in skills
    - Content angle heuristics via title keyword matching (no Claude API call needed)

key-files:
  created:
    - scripts/review-update.js
  modified:
    - .claude/skills/review/SKILL.md (stub -> v1.0.0 full implementation)

key-decisions:
  - "Dedicated review-update.js script rather than inline node -e prevents placeholder string injection if Claude substitution fails"
  - "Content angle suggestions derived from keyword heuristics (no Claude API) — fast, zero-cost, good enough for routing decisions"
  - "Transcript shown on-demand only (Robin asks) rather than inline per card — keeps review cards scannable"

requirements-completed: [DISC-03]

duration: 2min
completed: 2026-04-09
---

# Phase 02 Plan 02: Interactive Morning Review Summary

**Interactive /review skill with KEEP/SKIP/STAR decisions persisted to SQLite — Robin's 5-minute morning idea triage via CLI**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-09T10:41:14Z
- **Completed:** 2026-04-09T10:42:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `scripts/review-update.js` created: safe parameterized UPDATE script that accepts `--id` and `--status` flags, validates inputs, and exits non-zero on failure
- `.claude/skills/review/SKILL.md` upgraded from Phase 1 stub to v1.0.0 with full interactive workflow
- Review skill queries `status IN ('new', 'starred') ORDER BY score DESC` — resurfaces starred ideas automatically
- Per-idea content angle suggestions (News reaction / Tutorial breakdown / Hot take / Comparison / Topic breakdown) from title keyword heuristics — no Claude API call
- Score breakdown deliberately hidden from Robin per D-09 — only title, summary, source, link, and angle shown
- QUIT option lets Robin stop mid-session and see a running summary of decisions made
- Cron schedule table retained from Phase 1 stub as single source of truth for all pipeline triggers

## Task Commits

1. **Task 1: Create review-update.js CLI script for safe status updates** — `639bd13` (feat)
2. **Task 2: Implement interactive /review skill with KEEP/SKIP/STAR workflow** — `0bc6684` (feat)

## Files Created/Modified

- `scripts/review-update.js` — Parameterized UPDATE script: accepts --id, --status; validates status; exits 1 on not-found
- `.claude/skills/review/SKILL.md` — v1.0.0: full 5-step workflow (check pulse file → query DB → present cards → update status → show summary)

## Decisions Made

- **Dedicated update script:** `review-update.js` exists as a separate file to avoid the risk of Claude writing literal `{id}` placeholder strings into the DB. The script receives real CLI arguments, not template substitutions.
- **Keyword-based angle heuristics:** Content angle suggestions are derived from simple title keyword matching (changelog → News reaction, tutorial/how-to → Tutorial breakdown, etc.). No Claude API call needed — fast and deterministic.
- **Transcript on-demand:** Transcript content is not shown in review cards (keeps them scannable). Robin can ask about a specific idea's transcript and the skill fetches it from DB on request.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched the spec without requiring auto-fixes.

## Known Stubs

None — all data flows are wired. The review skill reads from content.db (populated by pulse) and writes back via review-update.js.

## Threat Flags

None — no new network endpoints or trust boundaries introduced. T-02-05 and T-02-06 apply (accepted per threat register): review reads local SQLite data only, no secrets displayed.

## Phase 02 Completion

Both plans of Phase 02 are now complete:
- **02-01:** Four-source daily pulse pipeline (YouTube, TikTok, X, changelogs) with scoring, dedup, transcript extraction, SQLite persistence, and dated review markdown generation
- **02-02:** Interactive morning review skill with KEEP/SKIP/STAR decisions, safe DB updates, content angle heuristics, and starred-idea resurfacing

The discovery pipeline is end-to-end: pulse fills the backlog, review drains it into `status='kept'` ideas ready for Phase 03 content generation.

---
*Phase: 02-discovery-pipeline*
*Completed: 2026-04-09*
