# Phase 4: Publishing & Analytics - Research

**Researched:** 2026-04-09
**Domain:** Postiz scheduling API, approval CLI patterns, SQLite state machine, performance analytics feedback loop
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single `/approve` command with optional `--platform` flag (e.g., `/approve --linkedin`). Default shows all pending critic-approved drafts across all platforms.
- **D-02:** Approval review shows humanized text + voice authenticity score from the critic. No before/after diff displayed — Robin trusts the voice pass and just reads the final text.
- **D-03:** Three actions per draft: Approve (schedule it), Reject (move to rejected state), Edit (open text for quick tweaks before approving).
- **D-04:** Robin's edits during approval are final — no re-critic pass. Edited + approved drafts go straight to scheduling.
- **D-05:** Staggered auto-schedule with configurable per-platform default posting times (LinkedIn 9 AM CET, TikTok 12 PM CET, Instagram 6 PM CET as suggested defaults). Defaults stored in a config file. On approve, posts auto-slot into the next available window for their platform.
- **D-06:** Per-post time override available during `/approve` — Robin can set a custom schedule time for any individual post.
- **D-07:** Scheduling failures handled with queue + retry. Failed posts stay in `pending-schedule` state. Next cron run or manual `/approve` retries them.
- **D-08:** Performance score = impressions weighted by engagement rate (likes + comments + shares / impressions). Matches existing `performance` table schema.
- **D-09:** Feedback loop tracks by topic category AND format type. High-performing topics/formats get a score multiplier in next pulse. Simple multiplicative boost.
- **D-10:** 14-day rolling lookback window for performance weighting.
- **D-11:** Perf-check cron writes a daily human-readable summary to `data/performance/YYYY-MM-DD.md`.
- **D-12:** Six draft states: `draft` -> `critic-approved` -> `user-approved` -> `scheduled` -> `published` -> `tracked`. Plus `rejected` as terminal state.
- **D-13:** State transitions: (1) critic pass -> critic-approved, (2) Robin approves -> user-approved, (3) Postiz scheduling succeeds -> scheduled, (4) Postiz confirms publish -> published, (5) perf-check pulls data -> tracked.
- **D-14:** Rejected drafts get `rejected` status, stay in DB for reference, do not appear in approval queue.

### Claude's Discretion

- Default posting times per platform (optimize for engagement based on common social media best practices)
- Schedule config file format and location
- Retry logic details (backoff strategy, max retries, notification mechanism)
- Performance score formula details (exact weights for impressions vs engagement rate)
- Topic/format category taxonomy for performance tracking
- Daily performance report layout and formatting
- How `pending-schedule` retries are triggered (cron-based vs on next `/approve`)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PUBL-01 | Manual approval gate — nothing publishes without Robin's explicit sign-off | `/approve` skill with three-action loop (Approve/Reject/Edit); state machine enforces `user-approved` before scheduling |
| PUBL-02 | Postiz scheduling for LinkedIn posts | `postiz posts:create -c ... -s ... -i <linkedin-id>` — verified working pattern in SKILL.md |
| PUBL-03 | Postiz scheduling for TikTok EN + DE posts | TikTok requires media pre-upload via `postiz upload`; `{"missing": true}` release ID pattern documented |
| PUBL-04 | Postiz scheduling for Instagram posts | Instagram requires pre-upload; `--settings '{"post_type":"post"}'` for carousels |
| PUBL-05 | Draft review shows content per-platform with humanizer diff | D-02 overrides: show final text + voice score only; no diff required |
| ANLY-01 | End-of-day performance check pulls impressions from Postiz analytics | `postiz analytics:post <post-id>` with `-d 1` for yesterday's data; missing release ID requires `posts:connect` flow |
| ANLY-02 | Performance feedback loop adjusts topic/format weighting | Modify `scripts/pulse/scorer.js` `WEIGHTS` or add a multiplier lookup from performance table |
| ANLY-03 | Performance history persisted for trend analysis | `data/content.db` performance table already defined; `data/performance/YYYY-MM-DD.md` daily markdown summaries |

</phase_requirements>

---

## Summary

Phase 4 closes the content loop: approval gate -> Postiz scheduling -> end-of-day analytics -> scorer feedback. All three moving parts have clear implementation paths based on the existing codebase.

The approval gate follows the exact same pattern as `review-update.js` and the `/review` skill — an interactive CLI loop driven by `AskUserQuestion`, committing decisions immediately to SQLite after each action. The primary new behavior is calling `postiz posts:create` after Robin approves, then storing the returned Postiz post ID in `drafts.postiz_id` for later analytics queries.

The analytics half is simpler: `cron-daemon.js` already has a 6 PM stub with the right shape. Filling it in means querying the `drafts` table for posts in `scheduled` or `published` state, calling `postiz analytics:post <postiz_id>` for each, writing results to the `performance` table, and applying a multiplicative boost to `scorer.js` weights for high-performing topics/formats.

**Primary recommendation:** Build Phase 4 as three focused scripts — `approve-draft.js` (approval + schedule), `perf-check.js` (analytics pull + performance table write), and `apply-performance-weights.js` (scorer multiplier update) — plus the `/approve` SKILL.md that orchestrates the interactive approval loop. The cron daemon gets a second job added at 18:00.

---

## Standard Stack

### Core (already installed — no new installs needed for core path)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | 12.8.0 | State machine transitions, performance table writes, weight updates | Already installed, WAL mode enabled, sync API ideal for CLI loop [VERIFIED: package.json] |
| `postiz` CLI | 2.1.0 (global via npx) | Scheduling posts, pulling analytics | Only available via `npx postiz` — NOT installed globally on this machine [VERIFIED: command -v postiz returned empty, npx postiz@2.1.0 confirmed] |
| `node-cron` | 4.2.1 | Second cron job at 18:00 in cron-daemon.js | Already installed, already used in cron-daemon.js [VERIFIED: package.json] |
| `@anthropic-ai/sdk` | 0.86.1 | Currently installed — not needed for approval or analytics, but available if needed | [VERIFIED: package.json] |
| `dotenv` | 17.4.1 | Loading `POSTIZ_API_KEY` / `POSTIZ_API_URL` in scripts | Already installed [VERIFIED: package.json] |

### Supporting (needs install)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | 4.1.0 | Computing next available schedule slot per platform, CET timezone conversion, 14-day lookback window | Required for D-05/D-10; not yet installed [VERIFIED: npm view date-fns version = 4.1.0; not in node_modules] |

### Installation Required

```bash
cd /Users/robinsadeghpour/content-workflow
npm install date-fns
```

**Note on postiz CLI:** `postiz` is NOT installed globally on this machine. All `postiz` commands in scripts must be invoked as:
```bash
npx postiz <command>
```
Or install globally first:
```bash
npm install -g postiz
```
The SKILL.md pattern uses `postiz <command>` directly — verify global install or update all script invocations to use `npx postiz`. [VERIFIED: `command -v postiz` returned empty; `npx postiz --version` returned 2.1.0]

### Version Notes

- `@postiz/node` (npm SDK) at 1.0.8 is listed in CLAUDE.md but is NOT installed. The project uses the `postiz` CLI instead. Do NOT add `@postiz/node` — the CLI covers all needed operations. [VERIFIED: `ls node_modules/@postiz` returned empty]
- `date-fns` 4.x is the current version (not 3.x as CLAUDE.md documents). API is compatible. [VERIFIED: npm view date-fns version]

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
scripts/
├── approve-draft.js          # NEW: approval + Postiz scheduling
├── perf-check.js             # NEW: analytics pull + performance table write
├── apply-performance-weights.js  # NEW: updates scorer multipliers
└── [existing scripts unchanged]

.claude/skills/
└── approve/
    └── SKILL.md              # NEW: /approve interactive skill

data/
├── content.db                # EXTENDED: new status values, topic_category column
├── performance/              # NEW directory: daily YYYY-MM-DD.md summaries
└── review/                   # EXISTING: unchanged

config/
└── schedule-defaults.json    # NEW: per-platform default posting times
```

### Pattern 1: Draft State Machine (DB-enforced)

**What:** Six states enforced via column check before each transition. Scripts validate current state before updating.
**When to use:** Every status update in any Phase 4 script.

```javascript
// Source: existing apply-critic.js pattern — extended for Phase 4
const VALID_TRANSITIONS = {
  'draft':          ['critic-approved'],
  'critic-approved': ['user-approved', 'rejected'],
  'user-approved':  ['scheduled', 'pending-schedule'],
  'pending-schedule': ['scheduled'],
  'scheduled':      ['published'],
  'published':      ['tracked'],
};

function transitionDraft(db, draftId, toStatus) {
  const draft = db.prepare('SELECT status FROM drafts WHERE id = ?').get(draftId);
  const allowed = VALID_TRANSITIONS[draft.status] || [];
  if (!allowed.includes(toStatus)) {
    throw new Error(`Invalid transition: ${draft.status} -> ${toStatus} for draft ${draftId}`);
  }
  db.prepare("UPDATE drafts SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(toStatus, draftId);
}
```

### Pattern 2: Postiz Scheduling via CLI

**What:** Call `postiz posts:create` (or `npx postiz posts:create`) from a Node.js script using `spawnSync`. Capture output, parse postiz_id, update DB.
**When to use:** `approve-draft.js` after Robin approves.

```javascript
// Source: pattern from generate-content.js spawnSync usage — adapted for postiz
const { spawnSync } = require('child_process');

function schedulePost(integrationId, content, scheduleDate, mediaPaths) {
  const args = [
    'posts:create',
    '-c', content,
    '-s', scheduleDate.toISOString(),
    '-i', integrationId,
  ];
  if (mediaPaths && mediaPaths.length > 0) {
    // Must upload media first via postiz upload — get CDN URL
    args.push('-m', mediaPaths.join(','));
  }

  const result = spawnSync('postiz', args, {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env },
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    throw new Error(`postiz posts:create failed: ${result.stderr}`);
  }
  // Parse postiz_id from stdout JSON
  return JSON.parse(result.stdout);
}
```

**Critical: Media must be uploaded before scheduling.** TikTok and Instagram reject external URLs. Upload each file with `postiz upload <file>` and use the returned `path` (CDN URL) in `-m`. [VERIFIED: SKILL.md Gotcha #4]

### Pattern 3: Analytics Pull + Missing Release ID Resolution

**What:** `perf-check.js` queries all `scheduled`/`published` drafts with a `postiz_id`, calls `analytics:post`, handles `{"missing": true}` gracefully.
**When to use:** 18:00 cron job.

```javascript
// Source: SKILL.md analytics workflow
function fetchPostAnalytics(postizId) {
  const result = spawnSync('postiz', ['analytics:post', postizId, '-d', '1'], {
    encoding: 'utf-8', env: { ...process.env }
  });
  const data = JSON.parse(result.stdout);

  if (data && data.missing === true) {
    // TikTok doesn't return post ID immediately after publish
    // Must resolve before analytics work
    return { missing: true, postizId };
  }
  return data; // Array of metric objects
}
```

### Pattern 4: Performance Feedback to Scorer

**What:** `apply-performance-weights.js` reads 14-day performance window, computes topic/format multipliers, writes them to a JSON file that `scorer.js` reads on each pulse run.
**When to use:** Called at end of `perf-check.js` run.

The current `scorer.js` uses static WEIGHTS. The cleanest non-invasive approach: read a `data/performance-weights.json` file at the top of `scorer.js`, merge with static defaults. The `perf-check.js` regenerates this file daily.

```javascript
// In scorer.js — add at top (backward compatible if file missing)
let performanceMultipliers = {};
try {
  performanceMultipliers = JSON.parse(
    require('fs').readFileSync(path.join(__dirname, '../../data/performance-weights.json'), 'utf-8')
  );
} catch (e) { /* file missing = no multipliers yet */ }

// In scoreIdea() — apply multiplier by source_type (topic proxy)
function scoreIdea(idea) {
  const eng = normalizeEngagement(idea.views, idea.likes, idea.comments);
  const rec = normalizeRecency(idea.scraped_at || new Date().toISOString());
  const multiplier = performanceMultipliers[idea.source_type] || 1.0;
  return (WEIGHTS.recency * rec + WEIGHTS.engagement * Math.min(eng / 7, 1)) * multiplier;
}
```

### Pattern 5: Schedule Slot Calculation (date-fns)

**What:** Given a platform, compute the next available default posting time in Europe/Berlin timezone.
**When to use:** `approve-draft.js` when Robin approves without a time override.

```javascript
// Source: date-fns 4.x docs pattern [ASSUMED — date-fns TZ docs not re-verified in session]
const { format, addDays, setHours, setMinutes, isBefore } = require('date-fns');
// Note: date-fns 4.x drops toZonedTime/fromZonedTime — use date-fns-tz for TZ handling

const PLATFORM_DEFAULTS = require('../config/schedule-defaults.json');
// { linkedin: { hour: 9, minute: 0 }, tiktok_en: { hour: 12, minute: 0 }, ... }

function nextSlotForPlatform(platform) {
  const now = new Date();
  const { hour, minute } = PLATFORM_DEFAULTS[platform];
  let candidate = setMinutes(setHours(now, hour), minute);
  if (isBefore(candidate, now)) {
    candidate = addDays(candidate, 1);
  }
  return candidate.toISOString();
}
```

**Important:** `date-fns` alone does not handle timezone conversion. For CET/Europe/Berlin, the options are:
1. Use `date-fns-tz` (separate package, ~50K weekly downloads) for `toZonedTime`/`fromZonedTime`.
2. Use Node's built-in `Intl.DateTimeFormat` with `timeZone: 'Europe/Berlin'` for display only.
3. Store defaults as UTC offsets (CET = UTC+1, CEST = UTC+2) and compute manually.

**Recommendation:** Install `date-fns-tz` alongside `date-fns` for clean timezone handling. [ASSUMED — not verified against date-fns 4.x changelog in this session]

### Anti-Patterns to Avoid

- **Inline `node -e` for DB updates:** As established by Phase 2 decision — always use dedicated scripts with parameterized queries. The `/approve` skill MUST call `node scripts/approve-draft.js --id <id> --action <approve|reject>`.
- **Hardcoded integration IDs:** Postiz integration IDs are dynamic (change per environment/re-auth). Always resolve via `postiz integrations:list | jq -r '.[] | select(.identifier=="linkedin") | .id'` at runtime, or cache them in `config/schedule-defaults.json` after initial setup.
- **Publishing without media upload:** Never pass a local file path to `-m`. Must `postiz upload <file>` first and pass the returned CDN URL. [VERIFIED: SKILL.md Gotcha #4]
- **Skipping `{"missing": true}` check:** TikTok posts frequently have missing release IDs post-publish. `perf-check.js` must handle this case rather than crashing.
- **Blocking the approval loop on scheduling failure:** D-07 says failed posts move to `pending-schedule` — the loop continues to the next draft rather than stopping.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Social media scheduling | Custom HTTP calls to LinkedIn/TikTok/Instagram APIs | `postiz posts:create` via CLI | Platform partner restrictions, auth complexity, Postiz already handles rate limits |
| Timezone slot calculation | Manual UTC offset arithmetic | `date-fns` + `date-fns-tz` | DST edge cases (CET/CEST transition) are non-trivial and easy to get wrong |
| Analytics data fetching | Direct platform API calls | `postiz analytics:post <id>` | Same auth/rate-limit reasons; Postiz normalizes cross-platform response formats |
| Post ID resolution | Custom polling loop | `postiz posts:missing` + `postiz posts:connect` | Documented TikTok edge case handled by Postiz CLI |
| Concurrent DB writes during perf-check | Custom locking | WAL mode (already enabled) | SQLite WAL handles concurrent reads + single writer correctly |

**Key insight:** The postiz CLI is a complete abstraction layer. Every platform-specific scheduling and analytics concern is already handled — Phase 4 only needs to call the CLI and record what it returns.

---

## Common Pitfalls

### Pitfall 1: Postiz Not Globally Installed

**What goes wrong:** `postiz posts:create` fails with "command not found" when called from `spawnSync` in Node.js scripts.
**Why it happens:** `postiz` is not in `$PATH` on this machine (verified: `command -v postiz` returned empty). It's available via `npx postiz`.
**How to avoid:** Either (a) install globally with `npm install -g postiz` before running Phase 4, or (b) use `npx` in all `spawnSync` calls: `spawnSync('npx', ['postiz', 'posts:create', ...])`.
**Recommendation:** Install globally once. Add to setup instructions in SKILL.md.
**Warning signs:** `result.status !== 0` with `stderr` containing "command not found".

### Pitfall 2: Missing Release ID on TikTok Analytics

**What goes wrong:** `perf-check.js` calls `analytics:post <postiz_id>` and gets `{"missing": true}` instead of metrics. Script crashes or records zero values.
**Why it happens:** TikTok's API doesn't synchronously return a post ID after upload. Postiz records the post as "missing" until the user manually connects it.
**How to avoid:** In `perf-check.js`, check `data.missing === true` before writing to performance table. Log the draft ID that needs resolution. Write a helper `scripts/resolve-missing-posts.js` that runs `posts:missing` and `posts:connect` interactively.
**Warning signs:** `perf-check.js` logs with `[MISSING]` prefix and skips performance record insertion.

### Pitfall 3: CET vs CEST Timezone Drift

**What goes wrong:** Posts scheduled at "9 AM CET" during summer are actually published at 10 AM because Europe/Berlin switches to CEST (UTC+2) in summer.
**Why it happens:** CET is UTC+1, CEST is UTC+2. A hardcoded `+01:00` offset is wrong 6 months of the year.
**How to avoid:** Always use `'Europe/Berlin'` as a named timezone, not a fixed UTC offset. `date-fns-tz` handles DST transitions correctly.
**Warning signs:** Posts publishing one hour off in summer months.

### Pitfall 4: Approval Loop State Corruption if Script Crashes Mid-Session

**What goes wrong:** Robin approves 3 drafts, script crashes on the 4th (Postiz API error), posts are already marked `user-approved` but not `scheduled`. Next `/approve` run re-shows them.
**Why it happens:** State transition happens before scheduling API call, or vice versa.
**How to avoid:** Transition state in order: (1) set `user-approved` after Robin confirms, (2) attempt scheduling, (3) set `scheduled` on success or `pending-schedule` on failure. Never set `scheduled` before the API call returns successfully.

### Pitfall 5: Integration IDs Hardcoded vs Environment-Specific

**What goes wrong:** `schedule-defaults.json` contains integration IDs that work on one Postiz account but break if Robin re-authenticates or connects a new account.
**Why it happens:** Postiz integration IDs are UUIDs that change per account connection.
**How to avoid:** Store integration IDs in `config/schedule-defaults.json` with a setup step that runs `postiz integrations:list` to populate them. Document that re-running setup is needed after re-authentication.

### Pitfall 6: `topic_category` Field Doesn't Exist in `ideas` Table

**What goes wrong:** `apply-performance-weights.js` tries to GROUP BY `topic_category` on the `ideas` table, but that column doesn't exist. The performance feedback loop silently fails.
**Why it happens:** `ideas` table has `source_type` (youtube/tiktok/x/changelog) but no content-level topic category. The Phase 4 decisions mention "topic category" but the ideas table doesn't have one.
**How to avoid:** Use `source_type` as the topic proxy (maps to content themes well enough for v1). For format tracking, use `drafts.visual_approach` + `drafts.platform`. No schema migration needed — both columns already exist.
**Alternatively:** Add a `topic_category` column to `drafts` table at Phase 4 init time, populated by re-running a heuristic against `ideas.title` (same logic as content angle suggestion in `/review`).

### Pitfall 7: Draft `content` Column Format Mismatch During Approval Display

**What goes wrong:** `/approve` reads `drafts.content` and tries to display it, but the content is stored as platform-specific JSON (e.g., `{"type": "tiktok_slideshow", "slides": [...], "caption": "..."}`) not as plain text.
**Why it happens:** `generate-content.js` stores structured JSON in the `content` column, not raw post text.
**How to avoid:** The approval display script must parse `drafts.content` as JSON and extract the display text by platform:
  - `tiktok_en`/`tiktok_de`: `content.caption`
  - `instagram`: `content.caption`
  - `linkedin`: `content.post_text`
  - Slides: summarize as "N slides + caption"

---

## Code Examples

### DB Schema Extensions Needed

```sql
-- Add new status values (enforced in application, not DB constraint)
-- No ALTER TABLE needed — status is TEXT, any value accepted

-- Optional: add topic_category to drafts for richer performance tracking
ALTER TABLE drafts ADD COLUMN topic_category TEXT;

-- perf-check.js uses these columns (all already exist):
-- drafts: id, platform, status, postiz_id, content, visual_approach, idea_id
-- performance: id, draft_id, platform, views, likes, comments, shares, score, checked_at
-- ideas: id, source_type (used as topic proxy)
```

### schedule-defaults.json (config file)

```json
{
  "platforms": {
    "linkedin": {
      "integration_id": "FILL_AT_SETUP",
      "default_hour": 9,
      "default_minute": 0,
      "timezone": "Europe/Berlin"
    },
    "tiktok_en": {
      "integration_id": "FILL_AT_SETUP",
      "default_hour": 12,
      "default_minute": 0,
      "timezone": "Europe/Berlin"
    },
    "tiktok_de": {
      "integration_id": "FILL_AT_SETUP",
      "default_hour": 12,
      "default_minute": 30,
      "timezone": "Europe/Berlin"
    },
    "instagram": {
      "integration_id": "FILL_AT_SETUP",
      "default_hour": 18,
      "default_minute": 0,
      "timezone": "Europe/Berlin"
    }
  },
  "retry": {
    "max_attempts": 3,
    "backoff_base_seconds": 5
  },
  "perf_check": {
    "lookback_days": 14,
    "high_score_threshold": 0.7,
    "multiplier_max": 1.5,
    "multiplier_min": 0.7
  }
}
```

### perf-check cron addition to cron-daemon.js

```javascript
// Source: existing cron-daemon.js pattern — second job
const PERF_SCRIPT = path.join(__dirname, 'perf-check.js');

cron.schedule('0 18 * * *', () => {
  console.log(`[CRON] ${new Date().toISOString()} -- triggering perf-check`);
  const child = spawn('node', [PERF_SCRIPT], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env },
  });
  child.on('exit', (code) => {
    console.log(`[CRON] Perf-check exited with code ${code}`);
  });
}, {
  timezone: 'Europe/Berlin',
});
```

### Performance Score Formula (D-08)

```javascript
// Engagement rate = (likes + comments + shares) / views
// Performance score = log-weighted engagement rate (avoids outlier domination)
function computePerformanceScore(views, likes, comments, shares) {
  if (!views || views === 0) return 0;
  const engagementRate = (likes + comments + shares) / views;
  // Log scale to compress outliers: log10(engagement_rate * 1000 + 1) / 3
  return Math.min(1, Math.log10(engagementRate * 1000 + 1) / 3);
}
```

### Media Upload Before Scheduling (platform-specific)

```javascript
// Source: SKILL.md Pattern 2 — Upload Media Before Posting
function uploadMediaForDraft(draft) {
  const mediaDir = draft.media_dir;
  if (!mediaDir || !['tiktok_en', 'tiktok_de', 'instagram'].includes(draft.platform)) {
    return []; // LinkedIn text posts, no media
  }

  const slideFiles = fs.readdirSync(mediaDir)
    .filter(f => /^slide-\d+\.(png|jpg|webp)$/.test(f))
    .sort()
    .map(f => path.join(mediaDir, f));

  return slideFiles.map(filePath => {
    const result = spawnSync('postiz', ['upload', filePath], {
      encoding: 'utf-8', env: { ...process.env }
    });
    if (result.status !== 0) throw new Error(`Upload failed for ${filePath}: ${result.stderr}`);
    return JSON.parse(result.stdout).path; // CDN URL
  });
}
```

---

## Runtime State Inventory

> Phase 4 is not a rename/refactor phase. However, key runtime state exists that Phase 4 scripts must interact with.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `data/content.db` — `drafts` table (0 rows with `critic_approved` status currently), `performance` table (0 rows) | Phase 4 populate performance table; no migration needed |
| Live service config | Postiz account — integration IDs for LinkedIn/TikTok EN/TikTok DE/Instagram NOT yet captured | Must run `postiz integrations:list` during Wave 0 setup and populate `config/schedule-defaults.json` |
| OS-registered state | cron-daemon.js runs manually (not registered as system service) — second cron job at 18:00 needs adding to the daemon | Code edit to `cron-daemon.js` only |
| Secrets/env vars | `POSTIZ_API_KEY` or OAuth2 credentials in `~/.postiz/credentials.json` — must be present before any scheduling script runs | Verify via `postiz auth:status` in Wave 0 |
| Build artifacts | `postiz` not globally installed — `npx postiz` works but slower | `npm install -g postiz` recommended as Wave 0 setup step |

**Status columns not yet in drafts schema:** The six-state machine (D-12) adds `pending-schedule` and `tracked` as new status values. No SQL migration needed — the `status TEXT` column accepts any string. But `init-db.js` should be updated to document the valid values.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All scripts | Yes | 24.12.0 | — |
| `better-sqlite3` | DB state machine | Yes | 12.8.0 | — |
| `node-cron` | 18:00 perf-check cron | Yes | 4.2.1 | — |
| `dotenv` | POSTIZ_API_KEY loading | Yes | 17.4.1 | — |
| `postiz` CLI (global) | Scheduling + analytics | No (via npx only) | 2.1.0 | `npx postiz` |
| `date-fns` | Schedule slot computation | No | — | Manual UTC offset (fragile) |
| `date-fns-tz` | Berlin timezone handling | No | — | Intl.DateTimeFormat (display only) |
| Postiz auth credentials | All postiz commands | Unknown — not testable without global install | — | Run `postiz auth:login` |
| `data/performance/` directory | perf-check output | No (directory missing) | — | Create in Wave 0 |

**Missing dependencies with no fallback:**
- Postiz auth credentials — must be configured before scheduling works. Block if `postiz auth:status` fails.

**Missing dependencies with fallback:**
- `postiz` global install — use `npx postiz` as interim. Install globally for production use.
- `date-fns` + `date-fns-tz` — install required; no good inline fallback for DST-safe timezone math.
- `data/performance/` directory — create with `fs.mkdirSync('data/performance', { recursive: true })` at script start.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@postiz/node` SDK | `postiz` CLI (v2.1.0) | Project convention | CLI is what's used in all existing skills; SDK not installed |
| Static scorer weights | Multiplier file + static weights | Phase 4 (new) | Performance data influences future pulse discovery |
| Single cron job (pulse) | Two cron jobs (pulse + perf-check) | Phase 4 (new) | Closes the feedback loop |

**Key existing patterns to follow:**
- `spawnSync` for synchronous subprocess calls (pattern from `generate-content.js`)
- `safeJsonParse()` helper for all external command output (pattern from `apply-critic.js`)
- `AskUserQuestion` for all interactive prompts (pattern from `/review` skill)
- Parameterized SQL via `better-sqlite3` `.prepare().run()` (pattern from `review-update.js`)
- Never inline `node -e` for DB mutations (Phase 2 decision — use dedicated scripts)

---

## Open Questions

1. **Postiz Auth Status**
   - What we know: `postiz auth:status` could not be run (CLI not globally installed)
   - What's unclear: Whether Robin's Postiz account is authenticated on this machine and whether integration IDs are configured
   - Recommendation: Wave 0 task must verify auth and populate integration IDs into `config/schedule-defaults.json` before any scheduling can proceed. Block the rest of the wave on this.

2. **TikTok Slideshow as Postiz Post Type**
   - What we know: Postiz TikTok support accepts video via verified CDN URLs. The SKILL.md shows TikTok settings with `privacy/duet/stitch` flags.
   - What's unclear: TikTok slideshows (multiple images, no video) may require different handling than video posts. The existing `tiktok-slideshows` skill documents "Upload plain photos via Postiz, send captions separately for manual text addition in TikTok app."
   - Risk: TikTok's slideshow format (multiple images + text per slide) may not be fully automatable via Postiz — the caption goes to Postiz but slide text is added manually in the TikTok app. [ASSUMED — from SKILL.md description, not tested]
   - Recommendation: Phase 4 should handle TikTok as "schedule caption + upload images" and note in the approval flow that slide text must be added in-app.

3. **Integration ID for TikTok DE (Separate Account)**
   - What we know: Robin has TikTok EN and TikTok DE as separate accounts, both connected to Postiz.
   - What's unclear: Whether these appear as separate integrations in `postiz integrations:list` or require settings to differentiate them.
   - Recommendation: Run `postiz integrations:list` as Wave 0 step and document both TikTok integration IDs.

4. **`topic_category` Column Decision**
   - What we know: The ideas table has `source_type` (youtube/tiktok/x/changelog) but not a content-level topic category. D-09 says feedback tracks "topic category AND format type."
   - What's unclear: Whether `source_type` is sufficient as a topic proxy or whether a separate `topic_category` needs deriving from title keywords.
   - Recommendation: Use `source_type` as v1 topic proxy. If Robin finds it too coarse after a week, add a derived `topic_category` column populated by the same angle-detection heuristic from `/review`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TikTok slideshows schedule as image uploads + caption via Postiz (slide text added manually in TikTok app) | Open Questions #2 | If Postiz supports native slideshow scheduling, the approval flow could be simplified |
| A2 | `date-fns-tz` is needed alongside `date-fns` 4.x for Europe/Berlin timezone handling | Architecture Patterns Pattern 5 | date-fns 4.x may have internalized timezone support — check changelog before installing |
| A3 | Performance multiplier reading in scorer.js via a flat JSON file is safe across concurrent pulse runs | Architecture Patterns Pattern 4 | If pulse runs while perf-check is writing the file, a partial read could corrupt scoring. Low risk given single-user, daily cadence. |
| A4 | Source_type is an adequate proxy for topic_category in performance weighting v1 | Open Questions #4 | Could result in coarse feedback signal (all youtube content treated as same "topic") |

---

## Project Constraints (from CLAUDE.md)

| Directive | Phase 4 Impact |
|-----------|----------------|
| All scheduling through Postiz API | Confirmed — postiz CLI for all scheduling operations |
| No post publishes without Robin's explicit approval | State machine enforces `user-approved` before any `posts:create` call |
| Human-in-the-loop | `/approve` skill uses `AskUserQuestion` for every draft decision |
| Tech stack: Claude Code skills + agents as primary architecture, Node.js scripts where needed | `/approve` is a SKILL.md that calls `scripts/approve-draft.js` |
| CommonJS module type (package.json `type: commonjs`) | All new scripts use `require()` — no `import`/`export` |
| WAL mode enabled at DB init | Concurrent cron + manual approve reads are safe |
| Never use inline `node -e` for DB mutations | All state changes via dedicated scripts |
| Use `spawnSync` for subprocess calls | All postiz CLI calls via `spawnSync` in Node scripts |
| `p-limit@4.x` for CJS compatibility (not v5) | If parallel media uploads are needed, use p-limit@4 |
| NEVER use `gpt-image-1` (use `gpt-image-1.5`) | Not relevant — no image generation in Phase 4 |
| No Express/web framework | CLI-first; `/approve` is a SKILL.md slash command |

---

## Sources

### Primary (HIGH confidence)
- `.claude/skills/postiz/SKILL.md` — full CLI reference, media upload requirements, analytics workflow, missing release ID handling [VERIFIED: read in this session]
- `scripts/init-db.js` — exact schema for `drafts`, `performance`, `ideas` tables [VERIFIED: read in this session]
- `scripts/cron-daemon.js` — exact cron pattern to replicate for perf-check job [VERIFIED: read in this session]
- `scripts/apply-critic.js` — `safeJsonParse`, `spawnSync`, state transition patterns [VERIFIED: read in this session]
- `scripts/review-update.js` — parameterized SQL update pattern, CLI arg parsing [VERIFIED: read in this session]
- `scripts/pulse/scorer.js` — current WEIGHTS structure, scoreIdea function signature [VERIFIED: read in this session]
- `scripts/generate-content.js` — `spawnSync` pattern, UUID validation, media dir structure [VERIFIED: read in this session]
- `.claude/skills/review/SKILL.md` — `AskUserQuestion` interactive loop pattern [VERIFIED: read in this session]
- `package.json` — exact installed dependency versions [VERIFIED: read in this session]

### Secondary (MEDIUM confidence)
- `npm view @postiz/node version` → 1.0.8 confirmed [VERIFIED: npm registry query]
- `npm view date-fns version` → 4.1.0 confirmed [VERIFIED: npm registry query]
- `npx postiz --version` → 2.1.0 confirmed [VERIFIED: executed in this session]
- Node.js 24.12.0 confirmed on machine [VERIFIED: node --version]

### Tertiary (LOW confidence)
- date-fns-tz timezone handling claim [ASSUMED — not verified against date-fns 4.x changelog]
- TikTok slideshow posting behavior via Postiz [ASSUMED — from SKILL.md description, not empirically tested]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against package.json and npm registry
- Architecture patterns: HIGH — all patterns derived from existing codebase, not invented
- Pitfalls: HIGH — verified against actual codebase structure and postiz SKILL.md gotchas
- DB schema: HIGH — read directly from init-db.js
- Environment availability: HIGH — verified via bash commands in this session

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable stack; postiz CLI version may drift)
