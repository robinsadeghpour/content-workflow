---
phase: 04-publishing-analytics
reviewed: 2026-04-09T12:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - config/schedule-defaults.json
  - scripts/apply-performance-weights.js
  - scripts/approve-draft.js
  - scripts/cron-daemon.js
  - scripts/generate-content.js
  - scripts/init-db.js
  - scripts/perf-check.js
  - scripts/pulse/scorer.js
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-04-09T12:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the publishing, analytics, and performance feedback loop scripts. The code is generally well-structured with good error handling patterns (graceful degradation on missing DB/weights, state machine for draft transitions, sequential Postiz API calls to respect rate limits). However, there is one critical bug in metrics normalization that silently produces incorrect analytics data, a missing database column that degrades LinkedIn format auto-suggestion, and several code quality issues around duplicated logic and inconsistent patterns.

## Critical Issues

### CR-01: Falsy-zero bug in normalizeMetrics causes incorrect analytics data

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

Use nullish coalescing (`??`) instead of logical OR (`||`) so that `0` is preserved as a valid value and only `null`/`undefined` triggers the fallback.

## Warnings

### WR-01: Missing content_angle_suggestion column degrades LinkedIn format auto-detection

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

### WR-02: UUID validation regex is too permissive

**File:** `scripts/generate-content.js:79`
**Issue:** The regex `/^[0-9a-f-]{36}$/` allows strings like `------------------------------------` (36 hyphens) or `aaaa-a-a-a-a-a-a-a-a-a-a-a-a-a-a-aaa` as valid UUIDs. While this is used for path construction and the value comes from CLI args (not external input), a malformed ID would create garbage directory names and fail silently at the DB lookup.
**Fix:**
```javascript
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(ideaId)) {
```

### WR-03: Database connection not closed on error paths in generate-content.js

**File:** `scripts/generate-content.js:148-165`
**Issue:** Multiple early `process.exit(1)` calls (lines 254, 258, 309, 329, 359, 456) exit without calling `db.close()`. While SQLite with WAL mode handles this gracefully in most cases (the OS closes the file handle), it can leave stale WAL/SHM files and in rare cases cause "database is locked" errors for the next process that opens the DB.
**Fix:** Wrap the main logic in a try/finally or use a cleanup function:
```javascript
process.on('exit', () => {
  try { db.close(); } catch {}
});
```
Add this right after opening the database at line 148.

### WR-04: State machine logic duplicated between approve-draft.js and perf-check.js

**File:** `scripts/perf-check.js:281-283` / `scripts/approve-draft.js:20-38`
**Issue:** `approve-draft.js` defines a proper `VALID_TRANSITIONS` state machine with validation (lines 20-38), but `perf-check.js` bypasses it entirely with raw SQL updates (line 282). If the state machine rules change (e.g., adding a new intermediate state), perf-check.js would not enforce the new constraints. This creates a maintenance hazard where two files must be updated in lockstep.
**Fix:** Extract the state machine into a shared module (e.g., `scripts/lib/draft-state.js`) and import it in both scripts. Alternatively, at minimum add a comment in perf-check.js documenting the allowed transitions it performs:
```javascript
// Allowed transitions (must match VALID_TRANSITIONS in approve-draft.js):
// scheduled -> published (when views > 0)
// published -> tracked (after analytics recorded)
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
**Issue:** All four platform `integration_id` values are set to `"FILL_AT_SETUP"`. The code in `approve-draft.js:144` correctly checks for this and throws an informative error, so this is handled gracefully. Noting for setup completeness tracking.
**Fix:** Replace with actual Postiz integration IDs when setting up. The error message at line 145 provides the correct command to find them.

---

_Reviewed: 2026-04-09T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
