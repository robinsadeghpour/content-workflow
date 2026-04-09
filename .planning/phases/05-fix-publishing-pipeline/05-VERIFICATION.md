---
phase: 05-fix-publishing-pipeline
verified: 2026-04-09T18:45:00Z
status: human_needed
score: 4/4
overrides_applied: 0
human_verification:
  - test: "Insert a real critic_approved draft and run approve action with valid Postiz integration IDs configured"
    expected: "Draft transitions to scheduled and appears in Postiz dashboard with correct time slot"
    why_human: "Postiz integration IDs are FILL_AT_SETUP; cannot verify actual scheduling without live credentials"
---

# Phase 5: Fix Publishing Pipeline Verification Report

**Phase Goal:** The publishing pipeline works end-to-end -- critic-approved drafts appear in the approval list and can be scheduled to all platforms via Postiz
**Verified:** 2026-04-09T18:45:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | apply-critic.js and approve-draft.js use the same status string for critic-approved drafts | VERIFIED | apply-critic.js writes `critic_approved` (line 229); approve-draft.js reads `critic_approved` in VALID_TRANSITIONS (line 22), handleList query (line 291), and status guard (line 414). Zero occurrences of `critic-approved` (hyphen) remain in approve-draft.js. |
| 2 | VALID_TRANSITIONS state machine starts at 'generated' (the actual content entry point) | VERIFIED | Line 21: `'generated': ['critic_approved', 'critic_failed']` is first key. 6 keys total: generated, critic_approved, user-approved, pending-schedule, scheduled, published. No `'draft'` key exists. |
| 3 | /approve --list shows critic-approved drafts (non-empty when drafts exist with status 'critic_approved') | VERIFIED | `node scripts/approve-draft.js --list` exits 0 and returns `[]` (empty array -- no critic_approved drafts currently in DB, which is correct behavior). Query on line 291 uses `WHERE status = 'critic_approved'`. |
| 4 | Approving a draft transitions it through user-approved to scheduled without state machine errors | VERIFIED | VALID_TRANSITIONS defines `critic_approved -> ['user-approved', 'rejected']` and `user-approved -> ['scheduled', 'pending-schedule']`. handleApprove (line 192) calls `transitionDraft(db, draft.id, 'user-approved')` then proceeds to schedule. SUMMARY confirms runtime smoke test passed (synthetic draft transitioned without "Invalid transition" error). |

**Score:** 4/4 truths verified

### Roadmap Success Criteria Cross-Check

| # | Roadmap SC | Mapped Truth | Status |
|---|-----------|-------------|--------|
| SC1 | apply-critic.js and approve-draft.js use same status string | Truth 1 | VERIFIED |
| SC2 | VALID_TRANSITIONS starts at 'generated' | Truth 2 | VERIFIED |
| SC3 | /approve lists critic-approved drafts and scheduling to all 4 platforms completes without error | Truths 3+4 | VERIFIED (code path); scheduling to Postiz requires human verification with live integration IDs |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/approve-draft.js` | Fixed state machine and status string alignment | VERIFIED | 437 lines. Contains `'generated'` as VALID_TRANSITIONS entry. All status strings use underscore `critic_approved`. No `'draft'` key. No `critic-approved` (hyphen) occurrences. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| scripts/apply-critic.js | scripts/approve-draft.js | status string 'critic_approved' in SQLite drafts table | WIRED | apply-critic.js writes `critic_approved` (line 229). approve-draft.js reads `critic_approved` in query (line 291) and guard (line 414). Strings match exactly. |
| scripts/approve-draft.js handleList() | SQLite drafts table | WHERE status = 'critic_approved' | WIRED | Line 291: `SELECT * FROM drafts WHERE status = 'critic_approved'`. Matches what apply-critic.js writes. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| approve-draft.js handleList | drafts | SQLite query `SELECT * FROM drafts WHERE status = 'critic_approved'` | Yes -- real DB query, not static | FLOWING |
| approve-draft.js handleApprove | draft | SQLite query `SELECT * FROM drafts WHERE id = ?` | Yes -- real DB query | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| --list executes without crash | `node scripts/approve-draft.js --list` | Exits 0, returns `[]` | PASS |
| No hyphenated status strings | grep `critic-approved` approve-draft.js | 0 matches | PASS |
| Generated state in VALID_TRANSITIONS | grep `'generated'` approve-draft.js | Found on line 21 | PASS |
| VALID_TRANSITIONS has 6 keys, no 'draft' | Structural check | 6 keys: generated, critic_approved, user-approved, pending-schedule, scheduled, published | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| PUBL-01 | 05-01-PLAN | Manual approval gate -- nothing publishes without Robin's explicit sign-off | SATISFIED | approve-draft.js requires explicit `--id <id> --action approve` CLI invocation. Status guard on line 414 ensures only `critic_approved` drafts can be actioned. |
| PUBL-02 | 05-01-PLAN | Postiz scheduling for LinkedIn posts | SATISFIED | scheduleOnPostiz() (line 151) reads integration_id from config, calls `npx postiz posts:create` with content, schedule time, and integration ID. LinkedIn config exists in schedule-defaults.json. |
| PUBL-03 | 05-01-PLAN | Postiz scheduling for TikTok EN + DE posts | SATISFIED | Same scheduleOnPostiz() handles all platforms. tiktok_en and tiktok_de configs exist in schedule-defaults.json with separate time slots. |
| PUBL-04 | 05-01-PLAN | Postiz scheduling for Instagram posts | SATISFIED | Same scheduleOnPostiz() handles all platforms. Instagram config exists in schedule-defaults.json. Visual platforms (tiktok_en, tiktok_de, instagram) get media upload via uploadMediaFiles(). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| config/schedule-defaults.json | 4,10,16,22 | `FILL_AT_SETUP` placeholder for all 4 integration IDs | Info | Expected -- documented in plan `user_setup` frontmatter. Robin must configure before scheduling works. Not a code defect. |

### Human Verification Required

### 1. End-to-End Postiz Scheduling

**Test:** Configure real Postiz integration IDs in `config/schedule-defaults.json`, create a critic_approved draft, then run `node scripts/approve-draft.js --id <id> --action approve`
**Expected:** Draft transitions to `scheduled` status, Postiz API call succeeds, post appears in Postiz dashboard with correct scheduled time
**Why human:** All 4 Postiz integration IDs are `FILL_AT_SETUP`. The code path is verified correct but actual API scheduling cannot be tested without live credentials and connected platform accounts.

### Gaps Summary

No code gaps found. All 4 must-have truths are verified in the codebase. The status string mismatch is fixed (underscore everywhere), the state machine starts at `generated`, `--list` queries correctly, and the approve transition chain is properly wired.

The only outstanding item is human verification: confirming that Postiz scheduling works end-to-end with real integration IDs. This is a configuration step (documented in plan `user_setup`), not a code defect.

---

_Verified: 2026-04-09T18:45:00Z_
_Verifier: Claude (gsd-verifier)_
