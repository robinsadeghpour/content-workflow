---
phase: 04-publishing-analytics
plan: 01
subsystem: publishing
tags: [postiz, date-fns, sqlite, state-machine, scheduling]

requires:
  - phase: 03-content-generation
    provides: critic-approved drafts in content.db with humanized text and voice scores
provides:
  - approve-draft.js with 6-state draft lifecycle and Postiz scheduling
  - /approve skill for interactive draft review and publishing
  - config/schedule-defaults.json with per-platform posting times
  - topic_category column on drafts table for performance tracking
affects: [04-02-analytics, pulse, generate-content]

tech-stack:
  added: [date-fns@4.1.0, "@date-fns/tz@1.4.1"]
  patterns: [state-machine transitions, Postiz CLI integration via spawnSync, TZDate for DST-safe scheduling]

key-files:
  created:
    - scripts/approve-draft.js
    - config/schedule-defaults.json
    - .claude/skills/approve/SKILL.md
  modified:
    - scripts/init-db.js

key-decisions:
  - "Used spawnSync for Postiz CLI calls — keeps approve-draft.js synchronous and simple for single-operator use"
  - "State machine with explicit VALID_TRANSITIONS map prevents invalid status jumps"
  - "pending-schedule state for failed scheduling instead of crash — enables retry via --list-pending"

patterns-established:
  - "Draft state machine: draft → critic-approved → user-approved → scheduled → published → tracked"
  - "Postiz CLI integration pattern: spawnSync('npx', ['postiz', ...]) with JSON stdout parsing"
  - "Platform config pattern: config/schedule-defaults.json with integration_id, default times, timezone"

requirements-completed: [PUBL-01, PUBL-02, PUBL-03, PUBL-04, PUBL-05]

duration: 12min
completed: 2026-04-09
---

# Plan 04-01: Approval Gate & Postiz Scheduling Summary

**6-state draft approval pipeline with Postiz scheduling, timezone-aware slot computation, and interactive /approve skill**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 1

## Accomplishments
- Built approve-draft.js with full state machine (6 states + rejected) enforcing no-skip approval gate
- Created /approve skill for interactive review loop — show voice score, final text, approve/reject/edit/skip per draft
- Per-platform schedule defaults with Europe/Berlin timezone and DST-safe TZDate computation
- Added topic_category column to drafts table for Phase 4 analytics

## Task Commits

1. **Task 1: Schedule config + approve-draft.js + init-db update** - `fd5ffc7` (feat)
2. **Task 2: /approve skill SKILL.md** - `1b3869a` (feat)

## Files Created/Modified
- `scripts/approve-draft.js` - Approval + scheduling logic with state machine, media upload, Postiz CLI integration
- `config/schedule-defaults.json` - Per-platform default posting times and integration ID placeholders
- `.claude/skills/approve/SKILL.md` - Interactive /approve skill for Claude Code
- `scripts/init-db.js` - Added topic_category column via idempotent ALTER TABLE

## Decisions Made
- Edits are final — no re-critic pass after user edits content (D-04)
- Failed scheduling moves to pending-schedule state instead of crashing (D-07)
- Retry logic in --list-pending attempts one reschedule per invocation

## Deviations from Plan
None - plan executed as specified.

## User Setup Required

**External services require manual configuration:**
- Set `POSTIZ_API_KEY` in `.env`
- Connect LinkedIn, TikTok EN/DE, Instagram integrations in Postiz Dashboard
- Run `postiz integrations:list` and copy integration IDs into `config/schedule-defaults.json`

## Next Phase Readiness
- Approval pipeline ready for Plan 04-02 analytics feedback loop
- postiz_id populated on scheduled drafts enables performance tracking

---
*Phase: 04-publishing-analytics*
*Completed: 2026-04-09*
