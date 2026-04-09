---
phase: 05-fix-publishing-pipeline
reviewed: 2026-04-09T12:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - scripts/approve-draft.js
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-09T12:00:00Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Reviewed `scripts/approve-draft.js`, a CLI tool that manages draft approval, rejection, editing, and scheduling via Postiz. The code is well-structured with a clear state machine, safe use of `spawnSync` (array form avoids shell injection), and good error handling in the scheduling path (graceful fallback to `pending-schedule`). However, there are several robustness issues: the database connection is not reliably closed on unexpected errors, `loadConfig` can throw unhelpful errors, and external process calls lack timeouts.

## Warnings

### WR-01: Database connection leaked on unhandled exceptions

**File:** `scripts/approve-draft.js:362-437`
**Issue:** The main IIFE opens the database at line 372 and closes it at line 436, but there is no `try/finally` block. If any handler throws an unexpected error (e.g., `transitionDraft` throws on line 193 because the draft was concurrently modified, or `loadConfig` throws on line 100 because the config file is missing), the error propagates as an unhandled exception and `db.close()` is never called. While SQLite handles this gracefully on process exit for reads, writes in WAL mode could leave the `-wal` file in an inconsistent state.
**Fix:**
```javascript
(function main() {
  const args = process.argv.slice(2);
  // ... arg parsing ...

  const db = new Database(DB_PATH);
  try {
    // ... all existing logic ...
  } finally {
    db.close();
  }
})();
```

### WR-02: loadConfig throws raw errors with no context

**File:** `scripts/approve-draft.js:99-101`
**Issue:** `loadConfig` calls `fs.readFileSync` and `JSON.parse` without any error wrapping. If `config/schedule-defaults.json` is missing or contains invalid JSON, the user sees a raw `ENOENT` or `SyntaxError` with no guidance on how to fix it. This function is called in hot paths (`handleApprove`, `handleListPending`, `scheduleOnPostiz`) so the failure surface is wide.
**Fix:**
```javascript
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Schedule config not found at ${CONFIG_PATH}. Copy config/schedule-defaults.example.json and fill in integration IDs.`);
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (err) {
    throw new Error(`Invalid JSON in ${CONFIG_PATH}: ${err.message}`);
  }
}
```

### WR-03: spawnSync calls have no timeout -- can hang indefinitely

**File:** `scripts/approve-draft.js:131-133` and `scripts/approve-draft.js:176-179`
**Issue:** Both `spawnSync` calls to `npx postiz upload` and `npx postiz posts:create` have no `timeout` option. If the Postiz CLI hangs (network issue, unresponsive API), the entire approve-draft process blocks forever with no recourse. This is especially problematic in `handleListPending` which iterates over multiple drafts -- one hung call blocks all subsequent retries.
**Fix:**
```javascript
const result = spawnSync('npx', args, {
  encoding: 'utf-8',
  env: process.env,
  timeout: 60_000, // 60 seconds
});

// Also check for timeout signal:
if (result.signal === 'SIGTERM') {
  throw new Error(`Postiz CLI timed out after 60s`);
}
```

## Info

### IN-01: getArg does not distinguish flag values from next flags

**File:** `scripts/approve-draft.js:365-368`
**Issue:** `getArg` returns `args[idx + 1]` without checking whether it starts with `--`. If a user accidentally omits a value (e.g., `--content --schedule-at 2026-04-10`), `getArg('--content')` returns `"--schedule-at"` as the content value, leading to confusing behavior rather than a clear error.
**Fix:**
```javascript
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  if (idx === -1 || !args[idx + 1]) return null;
  const val = args[idx + 1];
  if (val.startsWith('--')) return null; // Next arg is a flag, not a value
  return val;
};
```

### IN-02: loadConfig called multiple times per approve flow

**File:** `scripts/approve-draft.js:105` and `scripts/approve-draft.js:152`
**Issue:** `loadConfig()` reads and parses the JSON config file from disk on every call. In the `handleApprove` flow, it is called once in `nextSlotForPlatform` (line 106) and again in `scheduleOnPostiz` (line 152). Similarly, `handleListPending` calls both functions per draft in the loop. While not a correctness issue, it is unnecessary I/O that could be replaced by loading once at startup.
**Fix:** Load config once at the top of `main()` and pass it as a parameter, or cache it in a module-level variable.

---

_Reviewed: 2026-04-09T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
