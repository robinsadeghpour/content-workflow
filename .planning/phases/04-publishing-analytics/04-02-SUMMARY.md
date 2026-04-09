---
phase: 04-publishing-analytics
plan: 02
subsystem: analytics
tags: [analytics, performance, feedback-loop, cron, scorer, sqlite]

requires:
  - phase: 04-publishing-analytics
    plan: 01
    provides: scheduled/published drafts with postiz_id in content.db

provides:
  - scripts/perf-check.js with Postiz analytics pull + performance table writes + daily summary
  - scripts/apply-performance-weights.js with 14-day rolling multiplier computation
  - data/performance-weights.json consumed by scorer.js and generate-content.js
  - cron-daemon.js updated with 18:00 perf-check job
  - scorer.js updated with topic multiplier support (by_source_type)
  - generate-content.js updated with format multiplier support (by_format)

affects: [pulse, scorer, generate-content, cron-daemon]

tech-stack:
  added: []
  patterns:
    - "Sequential Postiz analytics pull (not parallel) to respect 30 req/hr rate limit (T-04-08)"
    - "missing===true guard pattern for TikTok release ID resolution (T-04-11)"
    - "ON CONFLICT(id) DO UPDATE for idempotent daily performance upserts"
    - "14-day rolling window with clamp(avg/global, 0.7, 1.5) multiplier formula"
    - "Graceful degradation: both scorer.js and generate-content.js use try/catch so they work before first perf-check run"

key-files:
  created:
    - scripts/perf-check.js
    - scripts/apply-performance-weights.js
    - data/performance/ (directory, daily markdown files written at runtime)
  modified:
    - scripts/cron-daemon.js
    - scripts/pulse/scorer.js
    - scripts/generate-content.js

key-decisions:
  - "Sequential analytics pull in perf-check.js — Postiz rate limit is 30 req/hr; typical batch <10 posts; sequential loop avoids race conditions and simplifies error handling"
  - "Performance record ID is draft_id + date (YYYY-MM-DD) — enables one record per draft per day with idempotent upserts; perf-check is safe to re-run"
  - "Multiplier formula: clamp(avg_score / global_avg_score, 0.7, 1.5) — avoids extreme swings while still rewarding top performers and gently penalizing underperformers"
  - "scorer.js reads weights at module load time — simple, zero overhead per scoreIdea call; weights refresh on next perf-check run (daily)"
  - "generate-content.js uses photoWeight >= aiWeight (not >) — ties go to photo_overlay as photos are higher fidelity"

patterns-established:
  - "Analytics feedback loop: Postiz pull -> performance table -> apply-weights -> scorer.js multipliers -> better idea surfacing"
  - "Daily summary pattern: data/performance/YYYY-MM-DD.md with today's results table + 14-day top/bottom performers + trend signals"
  - "Config override pattern: perf_check.multiplier_max / perf_check.multiplier_min in schedule-defaults.json for future tuning without code changes"

requirements-completed: [ANLY-01, ANLY-02, ANLY-03]

duration: 10min
completed: 2026-04-09
---

# Phase 04 Plan 02: Analytics Feedback Loop Summary

**End-of-day performance check with Postiz analytics pull, SQLite persistence, daily summary markdown, and discovery scoring feedback via performance multipliers**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2
- **Files created:** 2 scripts + 1 directory
- **Files modified:** 3

## Accomplishments

- Built `perf-check.js`: pulls `analytics:post` from Postiz for all scheduled/published posts, handles missing TikTok release IDs gracefully, computes performance scores using `Math.log10(engagementRate * 1000 + 1) / 3`, upserts into performance table, generates daily summary markdown
- Built `apply-performance-weights.js`: queries 14-day rolling window, computes `clamp(avg/global, 0.7, 1.5)` multipliers by source_type and visual_approach, writes `data/performance-weights.json`
- Updated `cron-daemon.js`: adds 18:00 Europe/Berlin perf-check job alongside existing 06:00 pulse; startup log shows both schedules
- Updated `scorer.js`: reads `by_source_type` multipliers at module load, applies `sourceMultiplier` in `scoreIdea`; backward compatible (falls back to 1.0 when file absent)
- Updated `generate-content.js`: reads `by_format` multipliers at startup, uses `photoWeight >= aiWeight` comparison for auto-detected visual approach; Robin's explicit choice never overridden

## Task Commits

1. **Task 1: Create perf-check.js and apply-performance-weights.js** - `b670576` (feat)
2. **Task 2: Update cron-daemon.js, scorer.js, generate-content.js** - `3c3b99f` (feat)

## Files Created/Modified

- `scripts/perf-check.js` — Analytics pull + performance table upsert + daily summary + weight trigger
- `scripts/apply-performance-weights.js` — 14-day multiplier computation + performance-weights.json writer
- `scripts/cron-daemon.js` — Added 18:00 perf-check cron job
- `scripts/pulse/scorer.js` — Added performanceMultipliers + sourceMultiplier in scoreIdea
- `scripts/generate-content.js` — Added formatWeights loading + photoWeight/aiWeight comparison

## Decisions Made

- Sequential Postiz analytics pull to respect rate limit (T-04-08 mitigation)
- Performance record ID = `${draft_id}-${YYYY-MM-DD}` for idempotent daily upserts
- Multiplier clamp bounds 0.7-1.5 configurable via `config/schedule-defaults.json` `perf_check` section
- scorer.js reads weights at module load (not per call) — zero overhead per scoring operation

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The analytics pipeline writes real data from Postiz API. The first run will produce empty multipliers (no data yet) which is by design — scorer.js and generate-content.js fall back to 1.0 multipliers until real performance data accumulates.

## Threat Surface Scan

No new network endpoints introduced. `perf-check.js` calls Postiz CLI (already in threat model as T-04-07, T-04-08, T-04-11). `performance-weights.json` contains only numeric multipliers — no PII (T-04-09 accepted). No new trust boundaries beyond those documented in the plan's threat model.

## Self-Check: PASSED

- `scripts/perf-check.js` exists: FOUND
- `scripts/apply-performance-weights.js` exists: FOUND
- `scripts/cron-daemon.js` contains `0 18 * * *`: FOUND
- `scripts/pulse/scorer.js` contains `performanceMultipliers`: FOUND
- `scripts/generate-content.js` contains `formatWeights`: FOUND
- Commit `b670576` exists: FOUND
- Commit `3c3b99f` exists: FOUND
