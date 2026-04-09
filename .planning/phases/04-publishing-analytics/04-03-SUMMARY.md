---
phase: 04-publishing-analytics
plan: 03
subsystem: approve-workflow
tags: [gap-closure, before-after-diff, publ-05, sqlite, approve]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [original_content-column, before-after-diff-in-approve]
  affects: [scripts/approve-draft.js, scripts/apply-critic.js, .claude/skills/approve/SKILL.md]
tech_stack:
  added: []
  patterns:
    - Idempotent ALTER TABLE column addition (same pattern as prior phases)
    - Pre-loop snapshot saved once via SELECT-then-UPDATE (idempotent for re-runs)
    - Null-safe fallback in SKILL.md for drafts predating diff tracking
key_files:
  created: []
  modified:
    - scripts/init-db.js
    - scripts/apply-critic.js
    - scripts/approve-draft.js
    - .claude/skills/approve/SKILL.md
    - .planning/REQUIREMENTS.md
decisions:
  - "original_text NOT truncated in --list output (unlike display_text at 200 chars) so SKILL.md can show full diff"
  - "Idempotency check (SELECT before UPDATE) prevents overwriting original on re-runs of apply-critic.js"
  - "Null fallback in getOriginalDisplayText and SKILL.md handles drafts created before this gap fix"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-09"
  tasks_completed: 2
  files_modified: 5
---

# Phase 4 Plan 3: Before/After Humanizer Diff (PUBL-05 Gap Closure) Summary

**One-liner:** Added `original_content` column to drafts table, preserved pre-critic content in `apply-critic.js`, and surfaced a before/after voice-pass diff in the `/approve` review workflow.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add original_content column and preserve pre-critic content | dd998eb | scripts/init-db.js, scripts/apply-critic.js |
| 2 | Surface original_content in approval output and update SKILL.md for diff display | 03563e2 | scripts/approve-draft.js, .claude/skills/approve/SKILL.md, .planning/REQUIREMENTS.md |

## What Was Built

### Task 1: DB Column + Pre-Critic Snapshot

`scripts/init-db.js` gains an idempotent `ALTER TABLE drafts ADD COLUMN original_content TEXT` block (same pattern as existing `topic_category` addition). Running init-db.js is safe on an existing database.

`scripts/apply-critic.js` now saves `draft.content` (the raw stored string) to `original_content` before the critic/revise loop begins. The save is idempotent — it checks whether `original_content` is already populated and skips the UPDATE if so. This ensures re-running the critic on a draft (e.g., after a crash) does not overwrite the true original.

### Task 2: Diff in /approve Workflow

`scripts/approve-draft.js` gains `getOriginalDisplayText(draft)` — a helper that mirrors `getDisplayText` but reads from `original_content` instead of `content`. Returns `null` if `original_content` is absent (backward compatible). The `handleList` output now includes `original_text` alongside the existing `display_text`.

`.claude/skills/approve/SKILL.md` Step 3 presentation template is updated to show a **BEFORE / AFTER** diff block. The old rule "Show the final humanized text, NOT a before/after diff (D-02)" is replaced with the PUBL-05 rule. A null fallback note handles drafts created before this change.

`.planning/REQUIREMENTS.md` PUBL-05 is marked `[x]` and the traceability table updated to `Complete`.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `original_text` not truncated in `--list` output | `display_text` is truncated to 200 chars for list summary; `original_text` needs to be full-length so SKILL.md can show a meaningful diff |
| Idempotency via SELECT-then-UPDATE | Protects against re-runs overwriting the true original if `apply-critic.js` is invoked multiple times on the same draft |
| Null fallback in helper and SKILL.md | Backward compatible — drafts from Phases 3 and earlier have no `original_content`; the skill handles this gracefully without crashing |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The diff display is fully wired: `apply-critic.js` writes to `original_content`, `approve-draft.js` reads it and emits `original_text`, and the SKILL.md instructs Claude to display it.

## Threat Flags

None. `original_content` column has the same trust model as the existing `content` column — single-user CLI, no external input vector, no network exposure.

## Self-Check: PASSED

- `scripts/init-db.js` — exists and runs without error
- `scripts/apply-critic.js` — contains `original_content` UPDATE before while loop
- `scripts/approve-draft.js` — contains `getOriginalDisplayText` and `original_text` in output
- `.claude/skills/approve/SKILL.md` — contains "before/after diff", "BEFORE (original):", "AFTER (humanized):", null fallback note
- `.planning/REQUIREMENTS.md` — contains `[x] **PUBL-05**` and `PUBL-05 | Phase 4 | Complete`
- Commits dd998eb and 03563e2 exist in git log
- `node scripts/init-db.js` succeeds; `PRAGMA table_info(drafts)` includes `original_content`
- `node scripts/approve-draft.js --list` returns valid JSON (empty array)
