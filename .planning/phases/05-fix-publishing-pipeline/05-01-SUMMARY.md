---
phase: 05-fix-publishing-pipeline
plan: 01
subsystem: publishing
tags: [sqlite, state-machine, postiz, approve-draft, status-strings]

# Dependency graph
requires:
  - phase: 04-publishing-analytics
    provides: approve-draft.js, apply-critic.js, schedule-defaults.json
provides:
  - Fixed status string alignment between apply-critic.js and approve-draft.js
  - Working state machine starting at 'generated' (matching generate-content.js output)
  - Unblocked publishing pipeline (critic -> approve -> schedule flow)
affects: [06-morning-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status strings use underscores (critic_approved, critic_failed) not hyphens"

key-files:
  created: []
  modified:
    - scripts/approve-draft.js

key-decisions:
  - "Postiz CLI is available via npx; integration IDs still need manual configuration per platform"

patterns-established:
  - "Status string convention: underscores for multi-word statuses (critic_approved, critic_failed)"
  - "State machine entry point is 'generated' (written by generate-content.js)"

requirements-completed: [PUBL-01, PUBL-02, PUBL-03, PUBL-04]

# Metrics
duration: 4min
completed: 2026-04-09
---

# Phase 5 Plan 1: Fix Publishing Pipeline Summary

**Fixed status string mismatch (critic-approved vs critic_approved) and broken state machine entry point (draft vs generated) that blocked the entire publish flow**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-09T18:26:25Z
- **Completed:** 2026-04-09T18:30:25Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Fixed all 4 occurrences of hyphenated 'critic-approved' to underscore 'critic_approved' in approve-draft.js, aligning with what apply-critic.js writes
- Replaced orphaned 'draft' state machine key with 'generated' and added 'critic_failed' as valid terminal
- Runtime smoke test confirmed state machine transition (critic_approved -> user-approved) works without errors
- Verified database has zero stale hyphenated status rows

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix status string mismatch and state machine** - `0d0c9a9` (fix)
2. **Task 2: DB migration, runtime smoke test, pipeline verification** - No commit (runtime verification only, no source changes)

## Files Created/Modified
- `scripts/approve-draft.js` - Fixed VALID_TRANSITIONS state machine, handleList query, status guard, and error message to use correct status strings

## Decisions Made
- Postiz CLI is available via npx (confirmed working)
- All 4 Postiz integration IDs (linkedin, tiktok_en, tiktok_de, instagram) are still set to FILL_AT_SETUP -- Robin must configure these in config/schedule-defaults.json before scheduling will work (user_setup documented in plan frontmatter)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

Postiz integration IDs must be configured before scheduling works:
- **File:** `config/schedule-defaults.json`
- **Fields:** `platforms.linkedin.integration_id`, `platforms.tiktok_en.integration_id`, `platforms.tiktok_de.integration_id`, `platforms.instagram.integration_id`
- **Where to get IDs:** Postiz Dashboard -> Integrations -> copy ID for each connected platform
- **Status:** All currently set to `FILL_AT_SETUP`

## Next Phase Readiness
- Publishing pipeline code is unblocked: critic_approved drafts now appear in --list and can be approved without state machine errors
- Scheduling will work end-to-end once Robin configures Postiz integration IDs
- Ready for Phase 06 (morning workflow) which depends on a working approve flow

## Self-Check: PASSED

- FOUND: scripts/approve-draft.js
- FOUND: 05-01-SUMMARY.md
- FOUND: commit 0d0c9a9

---
*Phase: 05-fix-publishing-pipeline*
*Completed: 2026-04-09*
