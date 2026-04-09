---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/dashboard/server.js
  - scripts/dashboard/api.js
  - scripts/dashboard/public/index.html
  - scripts/dashboard/public/style.css
  - scripts/dashboard/public/app.js
autonomous: true
must_haves:
  truths:
    - "Robin can open localhost:3456 and see idea backlog, drafts, and performance data from content.db"
    - "Robin can see cron daemon status (pulse + perf-check schedules and last-run info)"
    - "Robin can trigger pulse or perf-check manually from the UI"
    - "Robin can approve/reject drafts from the UI instead of the terminal"
  artifacts:
    - path: "scripts/dashboard/server.js"
      provides: "Node http server serving static files + JSON API"
    - path: "scripts/dashboard/api.js"
      provides: "REST API routes reading/writing content.db"
    - path: "scripts/dashboard/public/index.html"
      provides: "Single-page dashboard HTML"
    - path: "scripts/dashboard/public/style.css"
      provides: "Dashboard styling"
    - path: "scripts/dashboard/public/app.js"
      provides: "Client-side JS for fetching data and handling actions"
  key_links:
    - from: "scripts/dashboard/api.js"
      to: "data/content.db"
      via: "better-sqlite3 direct queries"
      pattern: "require.*better-sqlite3"
    - from: "scripts/dashboard/server.js"
      to: "scripts/dashboard/api.js"
      via: "route handler imports"
    - from: "scripts/dashboard/public/app.js"
      to: "scripts/dashboard/api.js"
      via: "fetch calls to /api/* endpoints"
---

<objective>
Build a simple local web dashboard for the content workflow pipeline at localhost:3456. Robin opens one browser tab to see the full pipeline state: idea backlog, draft status, performance metrics, cron status, and can approve/reject drafts or trigger pipeline actions without touching the terminal.

Purpose: Replace terminal-only workflow management with a visual overview that reduces context-switching and makes the daily morning review session faster.
Output: A self-contained dashboard under scripts/dashboard/ runnable via `node scripts/dashboard/server.js`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@scripts/init-db.js (DB schema — ideas, drafts, performance tables)
@scripts/cron-daemon.js (cron schedules — pulse at 06:00, perf-check at 18:00 Europe/Berlin)
@scripts/approve-draft.js (existing draft approval logic)
@scripts/pulse.js (pulse trigger logic)
@scripts/perf-check.js (performance check logic)
@package.json (CommonJS, better-sqlite3, node-cron already installed)
</context>

<tasks>

<task type="auto">
  <name>Task 1: API layer — REST endpoints reading content.db</name>
  <files>scripts/dashboard/api.js</files>
  <action>
Create scripts/dashboard/api.js as a CommonJS module that exports a function `handleApi(req, res, db)` where `db` is a better-sqlite3 instance.

Endpoints (all return JSON):

GET /api/ideas — Query ideas table: `SELECT * FROM ideas ORDER BY created_at DESC LIMIT 100`. Return array.

GET /api/drafts — Query drafts table joined with ideas: `SELECT d.*, i.title as idea_title FROM drafts d LEFT JOIN ideas i ON d.idea_id = i.id ORDER BY d.updated_at DESC LIMIT 100`. Return array.

GET /api/performance — Query performance table joined with drafts: `SELECT p.*, d.platform as draft_platform, d.content as draft_content FROM performance p LEFT JOIN drafts d ON p.draft_id = d.id ORDER BY p.checked_at DESC LIMIT 50`. Return array.

GET /api/stats — Return aggregate stats: `{ ideas: { total, new, kept, skipped }, drafts: { total, draft, approved, scheduled, published }, performance: { avgScore, totalViews, totalLikes } }`. Use COUNT queries with WHERE status filters.

GET /api/cron-status — Return static schedule info: `{ pulse: { schedule: "0 6 * * *", timezone: "Europe/Berlin", description: "Daily idea discovery" }, perfCheck: { schedule: "0 18 * * *", timezone: "Europe/Berlin", description: "Daily performance check" } }`. Also check if cron-daemon.js process is running via `require('child_process').execSync('pgrep -f cron-daemon || true')` and include `running: boolean`.

POST /api/drafts/:id/approve — Read draft by id, update status to 'approved', updated_at to now. Return updated draft. Use parameterized queries to prevent SQL injection.

POST /api/drafts/:id/reject — Same but set status to 'rejected'.

POST /api/trigger/pulse — Spawn `node scripts/pulse.js` detached using child_process.spawn with cwd set to project root. Return `{ triggered: true, script: "pulse.js" }`.

POST /api/trigger/perf-check — Same but spawn `node scripts/perf-check.js`.

URL parsing: Use `new URL(req.url, 'http://localhost')` for pathname and params. For POST with :id pattern, extract id from pathname segments. Set Content-Type: application/json on all responses. Return 404 JSON for unknown /api/* routes.
  </action>
  <verify>
    <automated>node -e "const api = require('./scripts/dashboard/api.js'); console.log(typeof api.handleApi === 'function' ? 'OK' : 'FAIL')"</automated>
  </verify>
  <done>api.js exports handleApi function; all endpoint handlers defined; uses parameterized SQL queries; returns JSON for all routes</done>
</task>

<task type="auto">
  <name>Task 2: HTTP server + static frontend (single-page dashboard)</name>
  <files>scripts/dashboard/server.js, scripts/dashboard/public/index.html, scripts/dashboard/public/style.css, scripts/dashboard/public/app.js</files>
  <action>
**server.js** — Create a Node.js HTTP server using built-in `node:http` (no Express, stays true to project constraint of no web frameworks). CommonJS.

- Open better-sqlite3 connection to `path.join(__dirname, '../../data/content.db')` in readonly mode for GET endpoints. Open a second writable connection for POST endpoints.
- Serve static files from `scripts/dashboard/public/` directory. Map extensions to MIME types (html, css, js, png, svg). Default to index.html for root path.
- Route /api/* requests to `handleApi(req, res, db)` from api.js (pass both read and write db connections).
- Listen on port 3456. Log: `Dashboard running at http://localhost:3456`.
- Gracefully close db on SIGINT/SIGTERM.

**public/index.html** — Single HTML file with:
- Tab navigation: Ideas | Drafts | Performance | Cron/Actions
- Each tab is a `<section>` shown/hidden via JS (no routing library)
- Stats summary bar at top (total ideas, drafts pending, avg performance score)
- Ideas tab: table with columns — Title, Source, Score, Status, Created. Color-code status (new=blue, kept=green, skipped=gray).
- Drafts tab: cards showing platform badge, idea title, content preview (first 200 chars), status badge, and Approve/Reject buttons for drafts with status='draft'. Show visual_approach and media_dir if present.
- Performance tab: table with Platform, Content preview, Views, Likes, Comments, Shares, Score, Checked date.
- Cron tab: show pulse and perf-check schedule cards with a "Trigger Now" button on each. Show running/stopped indicator. Add a manual trigger log area that shows responses.
- Link style.css and app.js.

**public/style.css** — Clean, minimal dashboard styling:
- CSS custom properties for colors (dark sidebar theme: --bg: #1a1a2e, --surface: #16213e, --accent: #0f3460, --text: #e0e0e0, --success: #4ade80, --warning: #fbbf24, --danger: #f87171).
- Tab nav as horizontal pills. Active tab highlighted.
- Tables: alternating row colors, sticky header. Cards: rounded corners, subtle shadow.
- Status badges: colored pills (draft=yellow, approved=green, rejected=red, published=blue, scheduled=purple).
- Platform badges: LinkedIn=blue, tiktok-en=cyan, tiktok-de=pink, instagram=gradient.
- Responsive: works on laptop screen, no mobile needed.
- Stats bar: flex row of stat cards at top.

**public/app.js** — Vanilla JS (no framework, no build step):
- On load, fetch /api/stats and populate stats bar.
- Tab switching: add click handlers to nav items, toggle section visibility.
- For each tab, fetch its /api endpoint and render:
  - Ideas: build table rows from JSON array.
  - Drafts: build card elements. Attach click handlers to Approve/Reject buttons that POST to /api/drafts/:id/approve or /reject, then re-fetch drafts list.
  - Performance: build table rows.
  - Cron: render schedule info. Attach click handlers to "Trigger Now" buttons that POST to /api/trigger/pulse or /api/trigger/perf-check and show response in log area.
- Auto-refresh: poll /api/stats every 30 seconds to update stats bar.
- Helper: formatDate(iso) to display dates as "Apr 9, 12:30" style.
- Helper: truncate(str, len) for content previews.
  </action>
  <verify>
    <automated>node -e "const http = require('http'); const srv = require('./scripts/dashboard/server.js'); setTimeout(() => { fetch('http://localhost:3456/').then(r => { console.log(r.status === 200 ? 'OK' : 'FAIL'); process.exit(0); }).catch(e => { console.log('FAIL:', e.message); process.exit(1); }); }, 500);" 2>/dev/null || node -e "const { execSync } = require('child_process'); const child = require('child_process').spawn('node', ['scripts/dashboard/server.js'], { detached: true, stdio: 'ignore' }); child.unref(); setTimeout(() => { try { const r = execSync('curl -s -o /dev/null -w \"%{http_code}\" http://localhost:3456/'); console.log(r.toString().trim() === '200' ? 'OK' : 'FAIL'); } catch(e) { console.log('FAIL'); } finally { try { execSync('pkill -f \"dashboard/server.js\"'); } catch(e) {} process.exit(0); } }, 1000);"</automated>
  </verify>
  <done>Running `node scripts/dashboard/server.js` opens a local dashboard at localhost:3456; all four tabs render data from content.db; Approve/Reject buttons update draft status; Trigger buttons spawn pulse/perf-check; stats bar shows aggregate counts</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser -> localhost:3456 | Local only, no external access. No auth needed for single-user local tool. |
| server -> content.db | SQL queries must use parameterized statements to prevent injection |
| server -> child_process | Trigger endpoints spawn known scripts only, no user-supplied command injection |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-Q-01 | Injection | api.js SQL queries | mitigate | Use better-sqlite3 parameterized queries (`.prepare().get()`) for all user-input-derived values (draft IDs) |
| T-Q-02 | Injection | trigger endpoints | mitigate | Hardcode script paths in api.js; POST body is ignored; no user string passed to spawn() |
| T-Q-03 | Info Disclosure | static file serving | mitigate | Restrict served directory to scripts/dashboard/public/ only; path-traversal guard via path.resolve check |
| T-Q-04 | Spoofing | no auth | accept | Local-only dashboard on localhost; single-user machine; no sensitive write operations beyond draft status |
</threat_model>

<verification>
1. `node scripts/dashboard/server.js` starts without errors on port 3456
2. Opening http://localhost:3456 shows the dashboard with stats bar and four tabs
3. Ideas tab shows data from content.db ideas table
4. Drafts tab shows drafts with working Approve/Reject buttons
5. Performance tab shows performance records
6. Cron tab shows schedule info and trigger buttons that spawn scripts
</verification>

<success_criteria>
Robin can run `node scripts/dashboard/server.js`, open localhost:3456 in a browser, and manage the entire content pipeline visually: view ideas, approve/reject drafts, check performance metrics, monitor cron status, and trigger pipeline actions -- all without touching the terminal.
</success_criteria>

<output>
After completion, create `.planning/quick/260409-tei-build-simple-local-web-ui-for-content-wo/260409-tei-SUMMARY.md`
</output>
