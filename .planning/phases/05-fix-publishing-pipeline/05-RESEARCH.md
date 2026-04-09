# Phase 5: Fix Publishing Pipeline - Research

**Researched:** 2026-04-09
**Domain:** Node.js pipeline state machine, SQLite status strings, Postiz scheduling
**Confidence:** HIGH — all findings verified by direct source code inspection

## Summary

Phase 5 is a targeted bug-fix phase, not a feature phase. The entire publishing pipeline (Flow 3: generate → critic → approve → schedule) is broken by two concrete defects discovered during the v1.0 audit. Both defects are verified by reading the actual source files.

**Defect 1 (the critical blocker):** `apply-critic.js` writes `'critic_approved'` (underscore) to the DB. `approve-draft.js` reads `WHERE status = 'critic-approved'` (hyphen). Every draft that passes the critic is invisible to `/approve` — the list query returns zero rows because the status strings never match.

**Defect 2 (state machine entry mismatch):** `VALID_TRANSITIONS` in `approve-draft.js` defines `'draft'` as the initial state. But `generate-content.js` saves new drafts with `status = 'generated'`, and `apply-critic.js` queries for `status = 'generated'`. The string `'generated'` is absent from `VALID_TRANSITIONS` entirely — `transitionDraft()` would throw `Invalid transition: generated -> user-approved` if a corrected-status draft reached the `handleApprove` path.

**Primary recommendation:** Fix Defect 1 by standardizing on `'critic_approved'` (underscore) everywhere in `approve-draft.js`. Fix Defect 2 by adding `'generated'` as the start of `VALID_TRANSITIONS`, removing the orphaned `'draft'` entry. No schema migration needed — the DB column is `TEXT` with no CHECK constraint.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PUBL-01 | Manual approval gate — nothing publishes without Robin's explicit sign-off | Gate enforced by `approve-draft.js` status guard (line 414); fix must preserve the guard while correcting the status string it checks against |
| PUBL-02 | Postiz scheduling for LinkedIn posts | `scheduleOnPostiz()` in `approve-draft.js` already implemented; blocked only by Defect 1 preventing drafts from reaching the approve action |
| PUBL-03 | Postiz scheduling for TikTok EN + DE posts | Same as PUBL-02 — media upload + schedule path exists; blocked by Defect 1 |
| PUBL-04 | Postiz scheduling for Instagram posts | Same as PUBL-02 — visual platform path exists; blocked by Defect 1 |
</phase_requirements>

## Standard Stack

No new libraries needed. This phase modifies existing files only.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | latest | SQLite reads/writes in scripts | Already in use — sync API, WAL mode enabled |
| `@anthropic-ai/sdk` | 0.85.0 | Critic agent calls | Already in use in `apply-critic.js` |
| `date-fns` + `@date-fns/tz` | 3.x | Schedule time calculation | Already in `approve-draft.js` |

**No installation step needed for this phase.**

## Architecture Patterns

### Existing Flow (broken)

```
generate-content.js
  → saves draft: status = 'generated'          [VERIFIED: scripts/generate-content.js:559]

apply-critic.js
  → queries: WHERE status = 'generated'         [VERIFIED: scripts/apply-critic.js:151]
  → on pass: UPDATE status = 'critic_approved'  [VERIFIED: scripts/apply-critic.js:229]

approve-draft.js handleList()
  → queries: WHERE status = 'critic-approved'   [VERIFIED: scripts/approve-draft.js:291]
  -- RETURNS ZERO ROWS -- (underscore vs hyphen)

approve-draft.js VALID_TRANSITIONS
  → 'draft' → ['critic-approved']               [VERIFIED: scripts/approve-draft.js:21]
  -- 'generated' NOT in map --
  -- 'critic_approved' NOT in map --
```

### Fixed Flow (target)

```
generate-content.js
  → saves draft: status = 'generated'           [no change needed]

apply-critic.js
  → queries: WHERE status = 'generated'         [no change needed]
  → on pass: UPDATE status = 'critic_approved'  [no change needed — this is the canonical form]

approve-draft.js VALID_TRANSITIONS (FIXED)
  → 'generated'       → ['critic_approved', 'critic_failed']
  → 'critic_approved' → ['user-approved', 'rejected']
  → 'user-approved'   → ['scheduled', 'pending-schedule']
  → 'pending-schedule'→ ['scheduled']
  → 'scheduled'       → ['published']
  → 'published'       → ['tracked']

approve-draft.js handleList() (FIXED)
  → queries: WHERE status = 'critic_approved'   [matches what apply-critic.js writes]

approve-draft.js status guard (FIXED)
  → if (draft.status !== 'critic_approved')     [line 414]
```

### Anti-Patterns to Avoid

- **Do NOT change `apply-critic.js` to use hyphens.** The underscore form (`'critic_approved'`) is used consistently in `apply-critic.js` (write, filter, summary count) — it is the canonical form. Change the consumer (`approve-draft.js`), not the producer.
- **Do NOT add a CHECK constraint to the DB** during this phase — altering live tables with `ALTER TABLE` + `CHECK` is not supported in SQLite; would require table rebuild. Out of scope for a bug-fix phase.
- **Do NOT rename `'draft'` to `'generated'` in `VALID_TRANSITIONS` without also adding `'critic_failed'` as a terminal transition from `'generated'`** — `apply-critic.js` already writes `'critic_failed'` on failure (line 178, 215, 261) and `'generated'` must allow that transition.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Status normalization | Custom migration script to rewrite existing DB rows | SQLite `UPDATE drafts SET status = REPLACE(status, '-', '_')` one-liner if any rows have hyphenated statuses (verify first with SELECT) |
| State machine tests | Custom test framework | Manual verification via `node scripts/approve-draft.js --list` after inserting a test row with `status='critic_approved'` |

## Common Pitfalls

### Pitfall 1: Hyphenated statuses already in the DB
**What goes wrong:** If any drafts were written with `'critic-approved'` (hyphen) during prior testing, they will still be invisible after the code fix — the query now looks for `'critic_approved'` (underscore).
**Why it happens:** The bug existed since Phase 4 was written; any test runs that reached the critic would have stored hyphenated statuses.
**How to avoid:** Before or after the code fix, run `SELECT id, status FROM drafts` and inspect. If hyphenated rows exist, run: `UPDATE drafts SET status = 'critic_approved' WHERE status = 'critic-approved';`
**Warning signs:** `--list` returns empty even after fix; `SELECT COUNT(*) FROM drafts WHERE status LIKE 'critic%'` shows rows but `--list` shows none.

### Pitfall 2: `VALID_TRANSITIONS` missing `'critic_failed'` terminal
**What goes wrong:** `apply-critic.js` writes `'critic_failed'` for drafts that exhaust all attempts. If `VALID_TRANSITIONS` is updated to include `'generated'` but only maps to `['critic_approved']`, `transitionDraft()` will throw on the failure path if it's ever called for a `critic_failed` transition.
**Why it happens:** `transitionDraft()` is not called by `apply-critic.js` — it uses direct `db.prepare(...).run()` statements. So this is NOT an active runtime bug. However, the state map should be correct for completeness.
**How to avoid:** Add `'generated': ['critic_approved', 'critic_failed']` to the map.

### Pitfall 3: `handleApprove` transition path
**What goes wrong:** `handleApprove` calls `transitionDraft(db, draft.id, 'user-approved')`. After the fix, `VALID_TRANSITIONS['critic_approved']` must include `'user-approved'`.
**Why it happens:** Rename from `'critic-approved'` key to `'critic_approved'` key — must also update the value arrays that reference `'critic-approved'` as a destination.
**How to avoid:** Global search for `'critic-approved'` in `approve-draft.js` before considering the fix complete. Every occurrence must change to `'critic_approved'`.

### Pitfall 4: Integration IDs not configured
**What goes wrong:** `scheduleOnPostiz()` throws `Integration ID not configured for <platform>` because `config/schedule-defaults.json` has `"integration_id": "FILL_AT_SETUP"` for all 4 platforms.
**Why it happens:** The Postiz dashboard integration step was deferred to setup time.
**How to avoid:** This is a configuration gap, not a code bug. Phase 5 success criteria say "scheduling completes without error" — this requires Robin to have the Postiz integration IDs filled in. Include a verification task that checks for `FILL_AT_SETUP` values and prompts Robin if found.
**Warning signs:** `Error: Integration ID not configured for linkedin` in Postiz scheduling output.

## Code Examples

### Bug 1: Status string mismatch (exact lines)

```javascript
// apply-critic.js line 229 — WRITES with underscore (correct canonical form)
// [VERIFIED: scripts/apply-critic.js:229]
db.prepare('UPDATE drafts SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
  .run('critic_approved', draft.id);

// approve-draft.js line 291 — READS with hyphen (BUG — returns 0 rows)
// [VERIFIED: scripts/approve-draft.js:291]
let query = "SELECT * FROM drafts WHERE status = 'critic-approved'";

// approve-draft.js line 414 — GUARDS with hyphen (BUG — never matches)
// [VERIFIED: scripts/approve-draft.js:414]
if (draft.status !== 'critic-approved') {
```

### Bug 2: VALID_TRANSITIONS missing actual entry point

```javascript
// approve-draft.js lines 20-27 — current (broken)
// [VERIFIED: scripts/approve-draft.js:20-27]
const VALID_TRANSITIONS = {
  'draft':            ['critic-approved'],    // 'draft' never written by generate-content.js
  'critic-approved':  ['user-approved', 'rejected'],  // hyphen — doesn't match 'critic_approved'
  'user-approved':    ['scheduled', 'pending-schedule'],
  'pending-schedule': ['scheduled'],
  'scheduled':        ['published'],
  'published':        ['tracked'],
};

// approve-draft.js — FIXED version
const VALID_TRANSITIONS = {
  'generated':        ['critic_approved', 'critic_failed'],
  'critic_approved':  ['user-approved', 'rejected'],
  'user-approved':    ['scheduled', 'pending-schedule'],
  'pending-schedule': ['scheduled'],
  'scheduled':        ['published'],
  'published':        ['tracked'],
};
```

### DB check: detect hyphenated rows already in DB

```sql
-- Run before or after code fix to find rows that won't match the new query
SELECT id, status FROM drafts WHERE status LIKE 'critic%';

-- One-shot fix if hyphenated rows exist
UPDATE drafts SET status = 'critic_approved' WHERE status = 'critic-approved';
```

### Postiz integration ID verification

```bash
# Check whether all integration IDs are filled in
node -e "
const c = require('./config/schedule-defaults.json');
const missing = Object.entries(c.platforms)
  .filter(([k,v]) => v.integration_id === 'FILL_AT_SETUP')
  .map(([k]) => k);
if (missing.length) {
  console.log('MISSING integration IDs for:', missing.join(', '));
  console.log('Run: npx postiz integrations:list');
} else {
  console.log('All integration IDs configured.');
}
" 2>/dev/null || echo "Run from /Users/robinsadeghpour/content-workflow"
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `transitionDraft()` is not called by `apply-critic.js` — it writes status directly via `db.prepare().run()` | Common Pitfalls / Pitfall 2 | If `transitionDraft()` IS called somewhere in `apply-critic.js`, the `'generated' → 'critic_failed'` transition gap is an active bug, not just a map completeness issue. Impact: low — source was read fully and no call to `transitionDraft` was found. [VERIFIED: scripts/apply-critic.js — direct SQL only] |
| A2 | No rows with `status = 'critic-approved'` (hyphen) exist in the live `content.db` at this moment | Common Pitfalls / Pitfall 1 | If hyphenated rows exist from earlier test runs, a data migration is needed alongside the code fix. Impact: medium — easy to detect with one SELECT before fix. |

## Open Questions (RESOLVED)

1. **Postiz integration IDs** -- RESOLVED by Plan 05-01: `user_setup` frontmatter declares the config requirement, and Task 2 Step 3 detects `FILL_AT_SETUP` values and surfaces the gap before scheduling is attempted.

2. **Postiz CLI availability (`npx postiz upload` / `npx postiz posts:create`)** -- RESOLVED by Plan 05-01 Task 2 Step 4: smoke-tests `npx postiz --help` and documents whether the CLI binary is available. If unavailable, the finding is recorded in the summary so Robin knows scheduling calls will fail regardless of the status fix.

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| `better-sqlite3` | Status fix verification | Available | `content.db` exists at `data/content.db` |
| `@postiz/node` | Scheduling | Listed in package.json | CLI availability via `npx postiz` unverified — see Open Questions |
| `config/schedule-defaults.json` | Schedule slot calculation | Available | All 4 platforms present; all `integration_id` = `FILL_AT_SETUP` |

## Security Domain

Not applicable — this is a string constant bug fix in a local CLI tool with no new inputs, no new API surfaces, and no authentication changes. No ASVS categories triggered.

## Sources

### Primary (HIGH confidence — direct source code inspection)
- `scripts/apply-critic.js` lines 151, 229 — status write (`'critic_approved'`) and query (`'generated'`)
- `scripts/approve-draft.js` lines 20–27, 291, 414 — `VALID_TRANSITIONS`, `handleList`, status guard
- `scripts/generate-content.js` lines 559, 670 — status on new draft insert (`'generated'`)
- `scripts/init-db.js` — DB schema; `drafts.status` is `TEXT DEFAULT 'draft'` with no CHECK constraint
- `config/schedule-defaults.json` — all 4 platforms present, all `integration_id = 'FILL_AT_SETUP'`
- `.claude/skills/approve/SKILL.md` — skill orchestration; calls `approve-draft.js --list` and `--id --action`

### Tertiary (LOW confidence — unverified)
- `npx postiz` CLI availability — not probed in this session; `spawnSync` path assumes it exists

## Metadata

**Confidence breakdown:**
- Bug identification: HIGH — both bugs verified line-by-line from source
- Fix approach: HIGH — straightforward string constant correction, no structural change
- Postiz CLI availability: LOW — not verified empirically
- Integration ID gap: HIGH — directly visible in config file

**Research date:** 2026-04-09
**Valid until:** This research is tied to specific file contents — valid until those files change
