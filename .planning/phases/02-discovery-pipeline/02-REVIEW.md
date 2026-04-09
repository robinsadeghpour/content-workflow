---
phase: 02-discovery-pipeline
reviewed: 2026-04-09T10:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - scripts/pulse.js
  - scripts/pulse/scorer.js
  - scripts/pulse/deduplicator.js
  - scripts/pulse/transcript-fetcher.js
  - scripts/pulse/source-youtube.js
  - scripts/pulse/source-tiktok.js
  - scripts/pulse/source-x.js
  - scripts/pulse/source-changelog.js
  - scripts/pulse/review-generator.js
  - scripts/cron-daemon.js
  - scripts/review-update.js
  - .claude/skills/apify-ultimate-scraper/reference/package.json
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-09T10:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

The discovery pipeline is well-structured with clear separation of concerns across source modules, scoring, deduplication, transcript fetching, and review generation. Error handling follows a consistent skip-and-log pattern for source failures. No security vulnerabilities were found -- secrets are loaded from environment variables, SQL uses parameterized queries, and user input is sanitized before storage.

The main concerns are: (1) a database handle leak if transcript fetching throws, (2) silent data loss when ideas lack a `source_url`, (3) no guard against overlapping cron runs, and (4) duplicated Apify actor-runner code across two source modules.

## Warnings

### WR-01: Database handle leak on transcript fetch failure

**File:** `scripts/pulse.js:88`
**Issue:** If `fetchTranscriptsForIdeas(sanitizedIdeas)` throws an unhandled error at line 88, execution jumps to the top-level `.catch()` at line 122, bypassing `db.close()` at line 119. The database connection opened at line 73 will remain open until process exit. While `better-sqlite3` does finalize on GC, relying on that in a long-running cron context is fragile.
**Fix:** Wrap the DB-dependent section in try/finally:
```javascript
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
try {
  const newIdeas = filterDuplicates(db, allIdeas);
  // ... rest of pipeline through line 118
} finally {
  db.close();
}
```

### WR-02: Ideas without source_url silently dropped by deduplicator

**File:** `scripts/pulse/deduplicator.js:15`
**Issue:** `filterDuplicates` returns `false` for any idea where `source_url` is falsy (line 15). This means ideas without a URL are permanently discarded without any log message. A source module that produces ideas with missing URLs would silently lose data with no diagnostic output.
**Fix:** Log dropped ideas so operators can detect source module regressions:
```javascript
if (!idea.source_url) {
  console.warn(`[DEDUP] Dropping idea without source_url: "${idea.title?.slice(0, 80)}"`);
  return false;
}
```

### WR-03: No guard against overlapping cron pulse runs

**File:** `scripts/cron-daemon.js:13-28`
**Issue:** If a pulse run takes longer than expected (e.g., slow Apify actors with 180s timeouts across multiple sources), the next cron trigger at 06:00 could spawn a second concurrent `pulse.js` process. Both would race on DB inserts, potentially causing duplicate entries or SQLite locking errors (WAL mode helps but does not eliminate write contention).
**Fix:** Track the running child process and skip if one is already active:
```javascript
let running = false;
cron.schedule('0 6 * * *', () => {
  if (running) {
    console.warn('[CRON] Pulse still running from previous trigger, skipping');
    return;
  }
  running = true;
  const child = spawn('node', [PULSE_SCRIPT], { /* ... */ });
  child.on('exit', (code) => {
    running = false;
    console.log(`[CRON] Pulse exited with code ${code}`);
  });
  child.on('error', (err) => {
    running = false;
    console.error(`[CRON] Failed to spawn pulse: ${err.message}`);
  });
}, { timezone: 'Europe/Berlin' });
```

### WR-04: NaN score from invalid scraped_at dates

**File:** `scripts/pulse/scorer.js:11`
**Issue:** `normalizeRecency` creates a `new Date(scrapedAtIso)` without validating the result. If `scrapedAtIso` is an unparseable string (e.g., a malformed date from a scraper), `new Date(...)` returns `Invalid Date`, `.getTime()` returns `NaN`, and the entire score becomes `NaN`. NaN scores would then be inserted into the database and produce broken sorting in the review markdown.
**Fix:** Guard against invalid dates:
```javascript
function normalizeRecency(scrapedAtIso) {
  const d = new Date(scrapedAtIso);
  if (isNaN(d.getTime())) return 0.5; // neutral default for unparseable dates
  const daysDiff = (Date.now() - d.getTime()) / 86400000;
  return Math.max(0, 1 - daysDiff / 30);
}
```

### WR-05: Unsafe hasOwnProperty call on plain object

**File:** `scripts/pulse/review-generator.js:39`
**Issue:** `counts.hasOwnProperty(idea.source_type)` calls `hasOwnProperty` directly on the object instance. If a future `source_type` value were `"hasOwnProperty"` or `"__proto__"`, this could behave unexpectedly. While unlikely in this controlled context, it is a known JavaScript anti-pattern.
**Fix:** Use the safe form:
```javascript
if (Object.prototype.hasOwnProperty.call(counts, idea.source_type)) counts[idea.source_type]++;
```

## Info

### IN-01: Duplicated runApifyActor function across source modules

**File:** `scripts/pulse/source-tiktok.js:17-34` and `scripts/pulse/source-x.js:19-37`
**Issue:** The `runApifyActor` function is identical in both files (same logic, same parameters, same error handling). This violates DRY and means bug fixes must be applied in two places.
**Fix:** Extract to a shared utility module, e.g., `scripts/pulse/apify-runner.js`, and import from both source files.

### IN-02: Transcript detail section always rendered even for non-video ideas

**File:** `scripts/pulse/review-generator.js:86-95`
**Issue:** The review markdown includes a `<details>` transcript section for every idea, including changelogs and tweets that will never have transcripts. This adds visual noise ("No transcript available.") to non-video entries.
**Fix:** Conditionally render the transcript section only for video source types:
```javascript
if (['youtube', 'tiktok'].includes(idea.source_type)) {
  lines.push('<details>');
  // ... transcript content
  lines.push('</details>');
}
```

### IN-03: package.json contains only type field

**File:** `.claude/skills/apify-ultimate-scraper/reference/package.json`
**Issue:** The file contains only `{"type":"module"}` with no `name`, `version`, or `dependencies`. This is likely intentional as a reference/config marker, but could confuse tools that expect a standard package.json structure.
**Fix:** No action required if this is intentional. Consider adding a comment in a sibling README or renaming to avoid ambiguity with npm conventions.

---

_Reviewed: 2026-04-09T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
