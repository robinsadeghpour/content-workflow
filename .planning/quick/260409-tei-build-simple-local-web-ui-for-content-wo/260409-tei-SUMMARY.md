---
phase: quick
plan: 260409-tei
subsystem: dashboard
tags: [dashboard, ui, local-web, better-sqlite3, node-http]
dependency_graph:
  requires: [data/content.db, scripts/pulse.js, scripts/perf-check.js]
  provides: [scripts/dashboard/server.js, scripts/dashboard/api.js, scripts/dashboard/public/]
  affects: [scripts/approve-draft.js (action mirrored in UI)]
tech_stack:
  added: []
  patterns: [node:http (no Express), better-sqlite3 direct queries, vanilla JS SPA (no framework)]
key_files:
  created:
    - scripts/dashboard/api.js
    - scripts/dashboard/server.js
    - scripts/dashboard/public/index.html
    - scripts/dashboard/public/style.css
    - scripts/dashboard/public/app.js
  modified: []
decisions:
  - "Server binds to 127.0.0.1 (not 0.0.0.0) — local-only per threat model T-Q-04"
  - "Separate read-only and writable better-sqlite3 connections — reads use readonly mode, writes use full connection"
  - "Path traversal guard normalizes PUBLIC_DIR with trailing sep before startsWith check — handles root index.html case"
  - "Approve/reject in dashboard sets status to 'approved'/'rejected' directly — simpler than full approve-draft.js state machine for visual review workflow"
metrics:
  duration: 18m
  completed_date: "2026-04-09"
  tasks_completed: 2
  files_created: 5
---

# Quick Task 260409-tei: Build Simple Local Web UI for Content Workflow — Summary

**One-liner:** Node.js HTTP dashboard at localhost:3456 with four-tab SPA for managing ideas, drafts, performance, and cron from a browser instead of the terminal.

## What Was Built

A self-contained local web dashboard under `scripts/dashboard/` runnable via `node scripts/dashboard/server.js`.

**API layer (`api.js`):** CommonJS module exporting `handleApi(req, res, db, dbWrite)`. Covers:
- `GET /api/ideas` — idea backlog (100 most recent)
- `GET /api/drafts` — drafts joined with idea titles
- `GET /api/performance` — performance records joined with draft content
- `GET /api/stats` — aggregate counts and averages for stats bar
- `GET /api/cron-status` — schedule info + running/stopped state via `pgrep`
- `POST /api/drafts/:id/approve` and `/reject` — update draft status
- `POST /api/trigger/pulse` and `/perf-check` — spawn scripts detached

**HTTP server (`server.js`):** Uses built-in `node:http` (no Express per CLAUDE.md constraint). Opens separate read-only and writable better-sqlite3 connections. Serves static files from `public/` with path traversal guard. Binds to `127.0.0.1:3456`. Graceful shutdown on SIGINT/SIGTERM closes both DB connections.

**Frontend (`public/`):**
- `index.html`: Four-tab SPA — Ideas, Drafts, Performance, Cron/Actions — with stats bar showing live aggregate counts.
- `style.css`: Dark theme (--bg: #1a1a2e palette), status and platform badges, sticky table headers, responsive card grid for drafts.
- `app.js`: Vanilla JS with tab switching, per-tab data fetching, approve/reject handlers with optimistic UI disable, trigger log for cron actions, 30-second stats auto-refresh, HTML escaping on all rendered user data.

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-Q-01: SQL injection via draft IDs | All user-input-derived values use better-sqlite3 parameterized `.prepare().run()` |
| T-Q-02: Command injection in trigger endpoints | Script paths hardcoded in api.js; POST body ignored; no user string passed to spawn() |
| T-Q-03: Path traversal in static file serving | `path.resolve()` output checked against `PUBLIC_DIR + path.sep` prefix before serving |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: API layer | `b48fd75` | feat(quick-01): add API layer for dashboard REST endpoints |
| Task 2: Server + frontend | `07374e7` | feat(quick-01): add HTTP server and single-page dashboard frontend |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Path traversal guard blocked legitimate file serving**
- **Found during:** Task 2 verification
- **Issue:** `resolved.startsWith(PUBLIC_DIR + path.sep)` fails when `PUBLIC_DIR` already ends without a separator and `resolved` points to a file directly inside it (e.g., `public/index.html`). The `path.sep` append created a double-check that never matched file paths.
- **Fix:** Normalize `PUBLIC_DIR` by appending `path.sep` only if not already present before comparison.
- **Files modified:** `scripts/dashboard/server.js`
- **Commit:** Included in `07374e7`

## Known Stubs

None. All four tabs wire directly to live `content.db` data.

## Usage

```bash
# Start the dashboard
node scripts/dashboard/server.js
# Open http://localhost:3456 in browser
```

Note: If another process is already bound to port 3456 on all interfaces (IPv6 wildcard), the dashboard binds to `127.0.0.1:3456` exclusively. Access via `http://127.0.0.1:3456` if `localhost` resolves to `::1` and hits the other process first.

## Self-Check: PASSED

- [x] `scripts/dashboard/api.js` exists
- [x] `scripts/dashboard/server.js` exists
- [x] `scripts/dashboard/public/index.html` exists
- [x] `scripts/dashboard/public/style.css` exists
- [x] `scripts/dashboard/public/app.js` exists
- [x] Commit `b48fd75` exists
- [x] Commit `07374e7` exists
- [x] Server responds 200 on `http://127.0.0.1:3456/` with correct HTML
- [x] API routes return JSON with live data from content.db (48 ideas, 0 drafts verified)
