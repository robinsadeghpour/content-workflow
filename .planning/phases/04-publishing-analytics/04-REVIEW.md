---
phase: 04-publishing-analytics
reviewed: 2026-04-09T14:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - .claude/skills/approve/SKILL.md
  - config/schedule-defaults.json
  - scripts/apply-critic.js
  - scripts/apply-performance-weights.js
  - scripts/approve-draft.js
  - scripts/cron-daemon.js
  - scripts/generate-content.js
  - scripts/init-db.js
  - scripts/perf-check.js
  - scripts/pulse/scorer.js
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-04-09T14:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the full publishing, approval, analytics, and performance feedback loop pipeline including the critic loop, approval workflow, cron daemon, content generation, database schema, performance checking, and scoring. The code is generally well-structured with good error handling patterns (graceful degradation on missing DB/weights, state machine for draft transitions, sequential Postiz API calls to respect rate limits). However, there are two critical bugs: a status string mismatch between the critic and approval scripts that completely breaks the pipeline, and a falsy-zero bug in metrics normalization that silently corrupts analytics data. Several warnings relate to missing schema columns, incomplete state machine enforcement, and object mutation issues.

## Critical Issues

### CR-01: Status string mismatch breaks critic-to-approval pipeline entirely

**File:** `scripts/apply-critic.js:229` and `scripts/approve-draft.js:291`
**Issue:** `apply-critic.js` writes the status `critic_approved` (underscore) to the database, but `approve-draft.js` queries for `critic-approved` (hyphen) and validates against `critic-approved` in its `VALID_TRANSITIONS` map. The same mismatch exists for `critic_failed`. This means no draft that passes the critic will ever appear in the approval queue -- the entire publishing pipeline is broken. Robin would run `/approve` and always see "No drafts pending approval" even after successful critic runs.

Affected lines in `apply-critic.js`:
- Line 178: `'critic_failed'` (underscore)
- Line 216: `'critic_failed'` (underscore)
- Line 229: `'critic_approved'` (underscore)
- Line 260: `'critic_failed'` (underscore)
- Line 267: `r.status === 'critic_approved'` (underscore)
- Line 268: `r.status === 'critic_failed'` (underscore)

`approve-draft.js` expects (hyphens):
- Line 21: `'critic-approved'` in VALID_TRANSITIONS
- Line 291: `WHERE status = 'critic-approved'`
- Line 414: `draft.status !== 'critic-approved'`

**Fix:** Standardize on hyphens to match the `VALID_TRANSITIONS` map in `approve-draft.js`. In `scripts/apply-critic.js`, change all occurrences:
```javascript
// Line 178, 216, 260: change 'critic_failed' to 'critic-failed'
db.prepare('UPDATE drafts SET status = ?, ...').run('critic-failed', draft.id);

// Line 229: change 'critic_approved' to 'critic-approved'
db.prepare('UPDATE drafts SET status = ?, ...').run('critic-approved', draft.id);

// Lines 267-268: update summary filters
const approved = results.filter(r => r.status === 'critic-approved').length;
const failed = results.filter(r => r.status === 'critic-failed').length;
```

### CR-02: Falsy-zero bug in normalizeMetrics causes incorrect analytics data

**File:** `scripts/perf-check.js:83-89`
**Issue:** The `||` operator treats `0` as falsy. If a Postiz API response returns `{ views: 0, impressions: 500 }`, the code would use `500` for views instead of the correct `0`. This silently corrupts performance data -- a post with 0 views but 500 impressions would get scored as if it had 500 views, inflating its performance score and polluting the feedback loop into scorer.js and generate-content.js visual approach selection.
**Fix:**
```javascript
function normalizeMetrics(data) {
  return {
    views:    data.views    ?? data.impressions    ?? data.impression_count  ?? 0,
    likes:    data.likes    ?? data.like_count      ?? data.reactions         ?? 0,
    comments: data.comments ?? data.comment_count   ?? data.replies           ?? 0,
    shares:   data.shares   ?? data.share_count     ?? data.reposts           ?? data.retweets ?? 0,
  };
}
```

## Warnings

### WR-01: Object.assign does not fully replace content on revision

**File:** `scripts/apply-critic.js:250`
**Issue:** After a successful auto-revise, the local `content` variable is updated via `Object.assign(content, revisedContent)`. If the revised content removes a top-level key that was in the original, `Object.assign` will not delete that key from `content`. The next critic iteration will evaluate stale fields. The DB is updated correctly (full JSON replacement at line 246-247), but the in-memory object used for the next loop iteration may carry ghost properties from prior versions.
**Fix:**
```javascript
// Replace line 250:
// Object.assign(content, revisedContent);
// With:
content = revisedContent;
```
Note: `content` is declared with `let` at line 174, so reassignment is valid.

### WR-02: Missing content_angle_suggestion column degrades LinkedIn format auto-detection

**File:** `scripts/init-db.js` (missing column) / `scripts/generate-content.js:104`
**Issue:** `generate-content.js` reads `idea.content_angle_suggestion` for LinkedIn format heuristics (line 104), but `init-db.js` never creates this column in the `ideas` table. The value will always be `null`/`undefined` from the DB, so the `angle` variable is always an empty string. This means the LinkedIn format auto-suggestion never triggers the "tutorial breakdown", "hot take", or "news reaction" angle-based rules, reducing format suggestion accuracy.
**Fix:** Add the column in `scripts/init-db.js` after the existing ALTER TABLE blocks:
```javascript
try {
  db.exec('ALTER TABLE ideas ADD COLUMN content_angle_suggestion TEXT');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}
```

### WR-03: UUID validation regex is too permissive

**File:** `scripts/generate-content.js:79`
**Issue:** The regex `/^[0-9a-f-]{36}$/` allows strings like `------------------------------------` (36 hyphens) or `aaaa-a-a-a-a-a-a-a-a-a-a-a-a-a-a-aaa` as valid UUIDs. While this is used for path construction and the value comes from CLI args (not external input), a malformed ID would create garbage directory names and fail silently at the DB lookup.
**Fix:**
```javascript
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(ideaId)) {
```

### WR-04: Database connection not closed on error paths in generate-content.js

**File:** `scripts/generate-content.js:148-165`
**Issue:** Multiple early `process.exit(1)` calls (lines 254, 258, 309, 329, 359, 456) exit without calling `db.close()`. While SQLite with WAL mode handles this gracefully in most cases (the OS closes the file handle), it can leave stale WAL/SHM files and in rare cases cause "database is locked" errors for the next process that opens the DB.
**Fix:** Add an exit handler right after opening the database:
```javascript
process.on('exit', () => {
  try { db.close(); } catch {}
});
```

### WR-05: State machine logic duplicated between approve-draft.js and perf-check.js

**File:** `scripts/perf-check.js:281-283` / `scripts/approve-draft.js:20-38`
**Issue:** `approve-draft.js` defines a proper `VALID_TRANSITIONS` state machine with validation (lines 20-38), but `perf-check.js` bypasses it entirely with raw SQL updates (line 282). If the state machine rules change (e.g., adding a new intermediate state), perf-check.js would not enforce the new constraints. This is especially risky given CR-01 above -- inconsistent status values across files are already causing bugs.
**Fix:** Extract the state machine into a shared module (e.g., `scripts/lib/draft-state.js`) and import it in both scripts:
```javascript
// scripts/lib/draft-state.js
const VALID_TRANSITIONS = { ... };
function transitionDraft(db, draftId, toStatus) { ... }
module.exports = { VALID_TRANSITIONS, transitionDraft };
```

## Info

### IN-01: Cron schedule differs from CLAUDE.md specification

**File:** `scripts/cron-daemon.js:34`
**Issue:** The cron daemon schedules perf-check at 18:00 Europe/Berlin, but CLAUDE.md states "0 20 * * * end-of-day performance check" (20:00 Berlin time). The code is internally consistent (log message matches cron expression), but diverges from the project specification.
**Fix:** Decide which time is correct and align code with CLAUDE.md, or update CLAUDE.md to reflect the 18:00 schedule.

### IN-02: performanceMultipliers loaded at module import time in scorer.js

**File:** `scripts/pulse/scorer.js:10-14`
**Issue:** Performance weights are read from disk once when the module is first `require()`-d. If the pulse script runs for a long time or the weights file is updated mid-run, the scorer uses stale data. For the current usage pattern (short-lived cron jobs), this is not a problem, but it would become one if scorer.js is used in a long-running process.
**Fix:** No immediate action needed. If scorer is ever used in a long-running context, change to a function that reads the file on each call.

### IN-03: config/schedule-defaults.json contains placeholder integration IDs

**File:** `config/schedule-defaults.json:4,9,14,19`
**Issue:** All four platform `integration_id` values are set to `"FILL_AT_SETUP"`. The code in `approve-draft.js:157-158` correctly checks for this and throws an informative error, so this is handled gracefully. Noting for setup completeness tracking.
**Fix:** Replace with actual Postiz integration IDs when setting up. The error message provides the correct command to find them.

---

_Reviewed: 2026-04-09T14:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
