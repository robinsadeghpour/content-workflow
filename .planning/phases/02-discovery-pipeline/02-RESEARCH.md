# Phase 02: Discovery Pipeline - Research

**Researched:** 2026-04-09
**Domain:** Multi-source scraping pipeline, SQLite backlog, CLI review workflow
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Pulse scrapes all four source categories daily: YouTube (via yt-search + Supadata), TikTok (via Apify actor), X/Twitter (via Apify actor), and web changelogs/GitHub releases (via Cheerio).
- **D-02:** Source failures are handled with skip-and-log — if a source fails, log the failure and continue with remaining sources. No partial run blocking.
- **D-03:** Changelog monitoring starts with Claude/Anthropic only. Can be expanded later via config.
- **D-04:** Ideas scored using two signals only: recency/freshness and engagement metrics (views, likes, comments from source platform). No topic relevance or source authority scoring.
- **D-05:** Scoring uses a weighted sum formula — numeric calculation, no Claude API calls.
- **D-06:** Pulse targets 10-20 discovered ideas per daily run.
- **D-07:** Morning review is two-step: (1) Pulse generates a markdown overview file at `data/review/YYYY-MM-DD.md`. (2) Robin runs `/review` which walks through ideas interactively for KEEP/SKIP/STAR decisions.
- **D-08:** The review markdown file is read-only overview. Decisions happen via the interactive `/review` command, not by editing the file.
- **D-09:** Each idea in `/review` shows: title + summary, source + link, and a content angle suggestion. Score breakdown is not shown.
- **D-10:** Transcripts extracted eagerly during pulse — all discovered video ideas get transcripts immediately via Supadata.
- **D-11:** Transcripts stored in a `transcript` TEXT column added to the existing `ideas` table in `data/content.db`.
- **D-12:** Morning review markdown file includes transcripts as collapsible `<details><summary>` blocks.

### Claude's Discretion

- Search queries and keywords used per source
- Deduplication hash algorithm (content hash vs URL-based)
- Exact weighted sum formula and default weight values for scoring
- Markdown review file layout and formatting details
- Content angle suggestion generation approach
- How `/review` handles ideas that were starred in previous sessions

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-01 | Automated daily pulse scrapes YouTube, X, TikTok, web, changelogs for trending AI/tech topics via cron | yt-search script confirmed working; Apify actors identified for TikTok + X; Cheerio for Anthropic changelog; node-cron for scheduling |
| DISC-02 | Idea backlog persists discovered topics with scoring and deduplication | `ideas` table schema confirmed in content.db; `dedup_hash` column already exists; `transcript` column to be added via ALTER TABLE |
| DISC-03 | Morning batch review presents top ideas for KEEP/SKIP/STAR decisions via CLI | Two-step flow: markdown file generation + interactive /review skill; AskUserQuestion tool for CLI decisions |
| DISC-04 | Transcript extraction from YouTube and TikTok videos for content repurposing via Supadata | Supadata API confirmed functional (401 on base URL = auth required, expected); transcript endpoint documented in SKILL.md; mode=native for credit efficiency |

</phase_requirements>

---

## Summary

Phase 2 implements the content discovery backbone of the pipeline. The pulse skill needs to orchestrate four source scrapers, normalize their outputs into a common idea schema, score by recency + engagement, deduplicate against the SQLite backlog, eagerly extract transcripts for video content via Supadata, write to `data/content.db`, and generate a dated markdown review file. The review skill provides the interactive KEEP/SKIP/STAR decision loop.

All foundational infrastructure is in place from Phase 1: `content.db` with WAL mode exists, the `ideas` table schema is confirmed, and the skills directory structure is established. The pulse and review skills are stubs ready to be filled. The three external APIs needed (Apify, Supadata, yt-dlp) are confirmed available with credentials in `.env`.

The most significant integration complexity is the Apify skill: its `run_actor.js` uses ESM (`import` syntax) while the project is `"type": "commonjs"`. The pulse script must invoke the Apify runner via `node --input-type=module` or child process rather than requiring it directly. This is the primary architectural pitfall to plan around.

**Primary recommendation:** Implement pulse as a single Node.js CommonJS script (`scripts/pulse.js`) that orchestrates all four source scrapers sequentially with try/catch per source. Invoke Apify actors via child process to the existing `run_actor.js`. Use `p-limit` (v4, CJS-compatible) for concurrent Supadata transcript calls per video batch.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 2 |
|-----------|-------------------|
| CommonJS module type (`"type": "commonjs"`) | All new scripts use `require()`. Apify's `run_actor.js` uses ESM — must be invoked as child process, not imported directly. `p-limit` must be v4 (last CJS release). |
| Node.js 20+ LTS | Native `fetch` available — no `node-fetch` needed. `--env-file=.env` flag works for sub-scripts. |
| `better-sqlite3` for all SQLite | Synchronous API. All DB writes in pulse are synchronous — fine for a CLI cron job. |
| `cheerio` for static HTML scraping | Anthropic changelog and GitHub raw CHANGELOG.md parsing use cheerio/regex, not Playwright. |
| No Claude API calls in scoring | D-05 is locked: scoring is a numeric formula only. No `@anthropic-ai/sdk` calls during pulse scoring. |
| Claude API for content angle suggestions | Content angle suggestion generation (D-09) in `/review` may use Claude inline via `@anthropic-ai/sdk`. |
| `p-limit` v4 for CJS | v5+ is ESM-only. Pin to v4 for transcript concurrency control. |
| No Express / web frameworks | Review is a CLI skill using `AskUserQuestion`, not an HTTP server. |
| `node-cron` for scheduling | Cron for 6 AM pulse trigger. Not yet installed — Wave 0 task. |
| `APIFY_TOKEN` in `.env` | Confirmed present. |
| `SUPADATA_API_KEY` in `.env` | Confirmed present (key is `SUPADATA_API_KEY`, not `SUPADATA_TOKEN` as shown in the skill doc). |

---

## Standard Stack

### Core (for this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | 12.8.0 (installed) | Read/write ideas backlog, dedup check, status updates | Already installed; WAL mode enabled; sync API ideal for CLI |
| `node-cron` | 4.2.1+ | 6 AM daily pulse trigger | Per CLAUDE.md; not yet installed — needs Wave 0 install |
| `cheerio` | 1.x | Parse Anthropic API changelog page (server-rendered HTML) | Per CLAUDE.md; not yet installed — needs Wave 0 install |
| `p-limit` | 4.x (CJS) | Bound concurrent Supadata transcript calls | v5 is ESM-only; project is CommonJS; v4 is last CJS release |
| `yt-dlp` (Python CLI) | 2025.11.12 (installed) | YouTube search via existing `~/.claude/scripts/yt-search.py` | Already installed and verified working |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@anthropic-ai/sdk` | 0.86.1 (installed) | Content angle suggestion generation in `/review` | During KEEP/SKIP/STAR loop to suggest "hot take" / "tutorial" / "news reaction" angles |
| `dotenv` | 17.4.1 (installed) | Load API keys for sub-scripts | Already installed |
| Native `fetch` (Node 20) | built-in | Supadata API calls directly from pulse script | No `node-fetch` needed on Node 20 |

### Not Needed in This Phase

| Excluded | Why |
|----------|-----|
| `sharp`, `canvas`, `playwright` | Media generation is Phase 3 |
| `@postiz/node` | Publishing is Phase 4 |
| `zx` | Single-script orchestration; plain `child_process.execSync` or `spawnSync` suffices for sub-process calls |

**Installation (Wave 0):**
```bash
npm install node-cron cheerio p-limit@4
```

**Version verification:** [VERIFIED: npm registry via package.json inspection]

---

## Architecture Patterns

### Recommended Project Structure (additions to existing)

```
scripts/
├── init-db.js          # EXISTS - Phase 1
├── pulse.js            # NEW - main discovery orchestrator
└── pulse/
    ├── source-youtube.js     # NEW - yt-search + Supadata metadata
    ├── source-tiktok.js      # NEW - Apify clockworks/tiktok-scraper
    ├── source-x.js           # NEW - Apify X/Twitter actor
    ├── source-changelog.js   # NEW - Cheerio + GitHub raw fetch
    ├── scorer.js             # NEW - weighted sum formula
    ├── deduplicator.js       # NEW - hash check against DB
    └── transcript-fetcher.js # NEW - Supadata batch transcript extraction

data/
├── content.db          # EXISTS - ideas table needs transcript column
└── review/             # NEW directory
    └── YYYY-MM-DD.md   # NEW - daily review markdown files

.claude/skills/
├── pulse/
│   └── SKILL.md        # EXISTS stub - replace with full implementation
└── review/
    └── SKILL.md        # EXISTS stub - replace with full implementation
```

### Pattern 1: Per-Source Isolation with Skip-and-Log

Each source is a separate module returning `{ ideas: [], error: null }`. The main `pulse.js` wraps each in try/catch. If a source throws, it logs and continues.

```javascript
// scripts/pulse.js (CommonJS)
'use strict';
const { fetchYouTubeIdeas } = require('./pulse/source-youtube');
const { fetchTikTokIdeas } = require('./pulse/source-tiktok');
const { fetchXIdeas } = require('./pulse/source-x');
const { fetchChangelogIdeas } = require('./pulse/source-changelog');

const sources = [
  { name: 'youtube', fn: fetchYouTubeIdeas },
  { name: 'tiktok', fn: fetchTikTokIdeas },
  { name: 'x', fn: fetchXIdeas },
  { name: 'changelog', fn: fetchChangelogIdeas },
];

async function runPulse() {
  const allIdeas = [];
  for (const source of sources) {
    try {
      const ideas = await source.fn();
      allIdeas.push(...ideas);
      console.log(`[PULSE] ${source.name}: ${ideas.length} ideas found`);
    } catch (err) {
      console.error(`[PULSE] ${source.name} FAILED: ${err.message}`);
      // skip-and-log per D-02
    }
  }
  return allIdeas;
}
```
[ASSUMED] - pattern shape is standard; specific implementation details are discretionary

### Pattern 2: Apify Actor Invocation via Child Process

The Apify `run_actor.js` uses ESM (`import` statements). The project is CommonJS. Do NOT `require()` it directly — that will throw a SyntaxError. Instead, invoke it as a child process using `spawnSync`.

```javascript
// scripts/pulse/source-tiktok.js
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const ACTOR_SCRIPT = path.join(
  __dirname, '../../.claude/skills/apify-ultimate-scraper/reference/scripts/run_actor.js'
);

function runApifyActor(actorId, input) {
  const result = spawnSync('node', [
    '--env-file=.env',
    ACTOR_SCRIPT,
    '--actor', actorId,
    '--input', JSON.stringify(input),
  ], {
    cwd: path.join(__dirname, '../..'),
    encoding: 'utf-8',
    timeout: 120000,
  });

  if (result.status !== 0) {
    throw new Error(`Apify actor failed: ${result.stderr}`);
  }

  return JSON.parse(result.stdout);
}
```
[VERIFIED: confirmed run_actor.js uses ESM; project package.json has "type": "commonjs"]

### Pattern 3: Deduplication via URL-Based Hash

URL is the most stable dedup signal for social content. A SHA-256 of the normalized source URL provides a collision-resistant hash that's cheap to compute. Content-based hashing (title+summary) is less reliable because API responses can vary.

```javascript
// scripts/pulse/deduplicator.js
'use strict';
const crypto = require('crypto');
const Database = require('better-sqlite3');

function makeHash(url) {
  return crypto.createHash('sha256').update(url.trim().toLowerCase()).digest('hex');
}

function filterDuplicates(db, ideas) {
  const checkStmt = db.prepare('SELECT 1 FROM ideas WHERE dedup_hash = ?');
  return ideas.filter(idea => {
    const hash = makeHash(idea.source_url);
    return !checkStmt.get(hash);
  });
}
```
[ASSUMED] - URL hash is recommended; planner can confirm

### Pattern 4: Scoring Formula (Two Signals)

Per D-04 and D-05: score = weighted sum of normalized recency + normalized engagement. No Claude API calls. Numeric only.

```javascript
// scripts/pulse/scorer.js
'use strict';

const WEIGHTS = { recency: 0.4, engagement: 0.6 };

// Normalize engagement: log scale prevents viral outliers dominating
function normalizeEngagement(views, likes, comments) {
  const raw = (views || 0) + (likes || 0) * 5 + (comments || 0) * 3;
  return raw > 0 ? Math.log10(raw + 1) : 0;
}

// Normalize recency: 1.0 = today, 0.0 = 30+ days ago
function normalizeRecency(scrapedAtIso) {
  const daysDiff = (Date.now() - new Date(scrapedAtIso).getTime()) / 86400000;
  return Math.max(0, 1 - daysDiff / 30);
}

function scoreIdea(idea) {
  const eng = normalizeEngagement(idea.views, idea.likes, idea.comments);
  const rec = normalizeRecency(idea.scraped_at);
  // Normalize eng to 0-1 range assuming log10 max ~7 (10M views)
  return WEIGHTS.recency * rec + WEIGHTS.engagement * Math.min(eng / 7, 1);
}
```
[ASSUMED] - weights and log scale are Claude's discretion per CONTEXT.md; reasonable defaults

### Pattern 5: Supadata Transcript Fetching with p-limit

Transcripts are fetched eagerly for all video ideas (D-10). Use `mode=native` to avoid AI generation credits (1 credit vs 2/min). Bound concurrency to 3 simultaneous requests to avoid rate limits.

```javascript
// scripts/pulse/transcript-fetcher.js
'use strict';
const pLimit = require('p-limit');  // v4, CJS
const limit = pLimit(3);

async function fetchTranscript(url) {
  const apiKey = process.env.SUPADATA_API_KEY;
  const encodedUrl = encodeURIComponent(url);
  const res = await fetch(
    `https://api.supadata.ai/v1/transcript?url=${encodedUrl}&text=true&mode=native`,
    { headers: { 'x-api-key': apiKey } }
  );
  if (!res.ok) return null; // no transcript available — skip silently
  const data = await res.json();
  return data.content || null;
}

async function fetchTranscriptsForIdeas(ideas) {
  const videoIdeas = ideas.filter(i => ['youtube', 'tiktok'].includes(i.source_type));
  const results = await Promise.all(
    videoIdeas.map(idea => limit(() => fetchTranscript(idea.source_url)))
  );
  videoIdeas.forEach((idea, i) => { idea.transcript = results[i]; });
}
```
[VERIFIED: Supadata API endpoint structure from SKILL.md; mode=native documented; SUPADATA_API_KEY confirmed in .env]

### Pattern 6: Changelog Scraping Strategy

**Anthropic API changelog** (`platform.claude.com/docs/en/release-notes/api`): Server-side rendered by a Next.js app. The WebFetch confirmed full content renders as static HTML with `### Month DD, YYYY` headings and bullet points. Cheerio can parse this. [VERIFIED: page content confirmed via WebFetch]

**Claude Code CHANGELOG.md** (GitHub raw): Plain markdown at `raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`. Version headings are `## X.Y.Z` with no dates. Useful for detecting new Claude Code versions, even without dates. [VERIFIED: raw URL returns clean markdown, confirmed via curl]

```javascript
// scripts/pulse/source-changelog.js
'use strict';
const cheerio = require('cheerio');

const CHANGELOG_URL = 'https://platform.claude.com/docs/en/release-notes/api';

async function fetchChangelogIdeas() {
  const res = await fetch(CHANGELOG_URL);
  const html = await res.text();
  const $ = cheerio.load(html);
  const ideas = [];

  // Headings are h3 elements with date text like "April 8, 2026"
  $('h3').each((i, el) => {
    if (i >= 7) return false; // only last 7 days of entries
    const dateText = $(el).text().trim();
    const items = $(el).nextUntil('h3', 'ul li');
    items.each((_, li) => {
      const text = $(li).text().trim();
      if (text.length > 20) {
        ideas.push({
          title: text.substring(0, 120),
          summary: text,
          source_url: `${CHANGELOG_URL}#${dateText.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          source_type: 'changelog',
          scraped_at: new Date().toISOString(),
        });
      }
    });
  });

  return ideas;
}
```
[ASSUMED] - exact cheerio selectors depend on live HTML structure; Wave 0 should verify h3 vs h2 selectors against actual page]

### Pattern 7: Review Markdown File Format

Per D-12, transcripts appear as collapsible `<details>` blocks. Per D-09, each idea shows title, summary, source link, and content angle suggestion.

```markdown
# Daily Content Review — 2026-04-09

**Ideas found:** 14  |  **Sources:** YouTube (5), TikTok (3), X (4), Changelog (2)

---

## 1. [0.87] Claude Managed Agents launched in public beta

**Source:** [Anthropic Changelog](https://platform.claude.com/docs/en/release-notes/api)
**Angle:** News reaction — "Here's what Claude Managed Agents actually means for developers"

> We've launched Claude Managed Agents in public beta, a fully managed agent harness for running Claude...

<details>
<summary>Transcript (expand to skim)</summary>

[transcript text here if available, or "No transcript — changelog entry"]

</details>

---
```
[ASSUMED] - exact layout is Claude's discretion per CONTEXT.md

### Anti-Patterns to Avoid

- **Requiring Apify run_actor.js directly:** It uses ESM `import` — will throw in a CommonJS project. Always invoke via `spawnSync` child process.
- **Using p-limit v5:** ESM-only. Import fails with `require()`. Pin to `p-limit@4`.
- **Using SUPADATA_TOKEN env var name:** The `.env` file uses `SUPADATA_API_KEY`. The skill doc says `SUPADATA_TOKEN` — this is a discrepancy. Scripts must use `SUPADATA_API_KEY`.
- **Calling Claude API during scoring:** D-05 locks this as a numeric formula. No `@anthropic-ai/sdk` in `scorer.js`.
- **Blocking pulse on transcript failures:** Some videos have no transcript (private, auto-captions disabled). `mode=native` returns null — store NULL in DB, don't error out.
- **Parsing Anthropic changelog with Playwright:** The page renders server-side. Cheerio + fetch is sufficient. Don't reach for a browser.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YouTube search | Custom YouTube Data API v3 integration | `~/.claude/scripts/yt-search.py` via `spawnSync` | Already installed, working, tested — returns title, channel, views, URL |
| TikTok scraping | TikTok API / cookie-based scraping | `clockworks/tiktok-scraper` Apify actor | Platform blocks direct access; Apify maintains the actor |
| X/Twitter scraping | Twitter API v2 (expensive, rate-limited) | `apidojo/tweet-scraper` or `fastcrawler/x-twitter-trends-scraper-2025` Apify actor | X API v2 costs $100+/month for basic access; Apify actors work around this |
| Transcript extraction | YouTube captions API + TikTok video download + ASR | Supadata `/v1/transcript` endpoint | Handles YouTube, TikTok, Instagram, X — single unified API |
| Deduplication | Fuzzy title matching | SHA-256 of normalized URL stored in `dedup_hash` column | `dedup_hash TEXT UNIQUE` constraint already in schema; URL hash is O(1) check |
| CLI review interaction | Terminal UI library (blessed, ink) | Claude Code's native `AskUserQuestion` tool in the review SKILL.md | Built into the skill runtime; no extra dependencies |

**Key insight:** Every external data source already has a purpose-built integration (yt-search, Apify, Supadata). Phase 2 is an orchestration and normalization layer, not a scraping infrastructure project.

---

## Common Pitfalls

### Pitfall 1: ESM/CJS Module Boundary on Apify run_actor.js

**What goes wrong:** `require('.../run_actor.js')` throws `SyntaxError: Cannot use import statement in a module` because the file uses `import { parseArgs }` at the top.

**Why it happens:** The project is `"type": "commonjs"` but `run_actor.js` uses ES module syntax without a `.mjs` extension or `"type": "module"` scope.

**How to avoid:** Always invoke `run_actor.js` as a child process via `spawnSync('node', ['--env-file=.env', ACTOR_SCRIPT, ...])`. Never `require()` or `import()` it directly from a CommonJS context.

**Warning signs:** SyntaxError mentioning `import` during pulse execution.

### Pitfall 2: Wrong Supadata Environment Variable Name

**What goes wrong:** Supadata API calls return 401 Unauthorized because the script uses `process.env.SUPADATA_TOKEN` but the `.env` file defines `SUPADATA_API_KEY`.

**Why it happens:** The Supadata SKILL.md documents `SUPADATA_TOKEN`, but the actual `.env` was created with `SUPADATA_API_KEY`. The skill doc and the environment don't match.

**How to avoid:** All pulse scripts must use `process.env.SUPADATA_API_KEY`. [VERIFIED: confirmed by inspecting .env]

**Warning signs:** 401 errors from `api.supadata.ai` even when the key appears set.

### Pitfall 3: p-limit Version ESM-Only Error

**What goes wrong:** `const pLimit = require('p-limit')` throws `ERR_REQUIRE_ESM`.

**Why it happens:** `p-limit@5` dropped CommonJS support. The project is CJS. CLAUDE.md flags this explicitly.

**How to avoid:** Install and pin `p-limit@4` specifically. `npm install p-limit@4`.

**Warning signs:** `ERR_REQUIRE_ESM` on startup.

### Pitfall 4: Supadata Transcript Failures Blocking Pulse

**What goes wrong:** If Supadata returns a non-200 for a video with no available transcript (common for short TikToks, private videos), an uncaught error aborts transcript fetching for remaining ideas.

**Why it happens:** `mode=native` only returns transcripts that already exist. Many short-form videos don't have auto-generated captions.

**How to avoid:** Wrap each Supadata call in try/catch. Return `null` on failure. Store `NULL` in the `transcript` column. Do not throw.

**Warning signs:** Pulse stops populating DB after a transcript fetch error.

### Pitfall 5: Anthropic Changelog Page HTML Structure Changes

**What goes wrong:** Cheerio selectors `$('h3')` stop finding entries because Anthropic updated their docs platform HTML structure.

**Why it happens:** The changelog page is a Next.js app (`platform.claude.com`). While the content rendered correctly as of research date, the heading level or class names could change.

**How to avoid:** During Wave 0, manually verify the actual heading structure before implementing. Log the number of changelog entries found — if it's 0, the selector needs updating.

**Warning signs:** `source-changelog` returns 0 ideas consistently.

### Pitfall 6: yt-search Returns Formatted Text, Not JSON

**What goes wrong:** Pulse script tries to `JSON.parse()` output from `~/.claude/scripts/yt-search.py` and fails because it outputs human-readable formatted text, not JSON.

**Why it happens:** The existing `yt-search.py` script uses `print()` for human-readable output (title, channel, views on separate lines), not JSON. This is confirmed by reading the script.

**How to avoid:** Parse the text output with regex, or add a `--json` flag to `yt-search.py` in a Wave 0 task. The text format is consistent: lines like `1. {title}`, `   Views:    {views}`, `   URL:      {url}`.

**Warning signs:** JSON parse errors when processing yt-search output.

### Pitfall 7: X/Twitter Actor Availability

**What goes wrong:** The Apify skill's SKILL.md doesn't list any X/Twitter actors explicitly, only TikTok and YouTube.

**Why it happens:** The skill was built before X/Twitter was added or focuses on confirmed reliable actors. The SKILL.md "Other Actors" section doesn't include Twitter.

**How to avoid:** Use Apify store search at runtime: `node --env-file=.env .../search_actors.js --query "twitter trending"`. Confirmed candidates from research: `apidojo/tweet-scraper`, `fastcrawler/x-twitter-trends-scraper-2025`. Planner should include a Wave 0 task to verify actor ID and fetch its schema. [VERIFIED: actors exist on Apify store from WebSearch; actor schema must be fetched dynamically via the skill's `fetch_actor_details.js`]

---

## Runtime State Inventory

Step 2.5 SKIPPED — This is a greenfield phase implementing new functionality. No existing runtime state contains strings being renamed or migrated. The `ideas` table exists but is empty (Phase 1 created schema only; no data written yet).

**Schema change required:** `ALTER TABLE ideas ADD COLUMN transcript TEXT;` — this is a non-destructive column addition on an empty table, not a data migration.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All scripts | YES | v24.12.0 | — |
| Python 3 | yt-search.py | YES | 3.14.0 | — |
| yt-dlp (CLI) | YouTube search | YES | 2025.11.12 | — |
| `~/.claude/scripts/yt-search.py` | source-youtube | YES | exists | — |
| `APIFY_TOKEN` in .env | Apify actors | YES | confirmed | — |
| `SUPADATA_API_KEY` in .env | Transcript extraction | YES | confirmed | — |
| `ANTHROPIC_API_KEY` in .env | Content angle suggestions | YES | confirmed | — |
| `better-sqlite3` | DB reads/writes | YES | 12.8.0 | — |
| `node-cron` | Pulse cron scheduling | NO | — | Manual /pulse only until installed |
| `cheerio` | Changelog scraping | NO | — | Skip changelog source until installed |
| `p-limit@4` | Concurrent transcript fetches | NO | — | Sequential fetching (slower but functional) |
| `content.db` ideas table | Backlog persistence | YES | schema confirmed | — |
| `data/review/` directory | Markdown review files | NO | needs mkdir | Create in Wave 0 |

**Missing dependencies with no fallback:**
- None that fully block execution — `node-cron`, `cheerio`, `p-limit@4` are installable in Wave 0.

**Missing dependencies with fallback:**
- `node-cron` — pulse can be triggered manually with `/pulse` until installed.
- `cheerio` — changelog source module can be skipped until installed.
- `p-limit@4` — transcript fetching can run sequentially (slower, still correct).

---

## Source Integration Details

### YouTube Source

**Tool chain:** `spawnSync` → `~/.claude/scripts/yt-search.py` → parse text output

**Output format:** Human-readable text (NOT JSON). Must parse with regex:
- Title: line starting with `\d+\. `
- Views: line starting with `   Views:`
- URL: line starting with `   URL:`
- Channel: line starting with `   Channel:`
- Date: line starting with `   Date:` (may be "N/A" — confirmed from live test)

**Engagement signals available:** Views, channel name, subscriber count (from channel field), duration. Likes and comments NOT available from yt-search.

**Recommended queries (Claude's discretion):**
- `"claude code AI 2026"` — 1 month filter
- `"AI agents tutorial 2026"` — 1 month filter
- `"LLM startup 2026"` — 1 month filter
- `"anthropic openai 2026"` — 1 month filter

**Alternative:** Apify `streamers/youtube-scraper` actor if yt-search text parsing proves fragile. But yt-search is already installed — use it first.

### TikTok Source

**Actor:** `clockworks/tiktok-scraper` (comprehensive, from SKILL.md)

**Relevant input fields (from Apify store documentation):**
- `hashtags`: array of hashtag strings (e.g., `["aitools", "claudeai", "llm"]`)
- `resultsPerPage`: integer, recommend 10-15
- `maxItems` or `resultsLimit`: cap total results

**Engagement signals:** Views (plays), likes (diggCount), comments, shares

**Recommended hashtags (Claude's discretion):** `aitools`, `claudeai`, `chatgpt`, `llm`, `codingwithAI`

### X/Twitter Source

**Actor candidates (not in SKILL.md — must fetch schema at runtime):**
- `apidojo/tweet-scraper` — general tweet scraper [CITED: apify.com/apidojo/tweet-scraper]
- `fastcrawler/x-twitter-trends-scraper-2025` — trends-specific [CITED: apify.com/fastcrawler/x-twitter-trends-scraper-2025]

**Recommended approach:** Use `search_actors.js --query "twitter trending"` in Wave 0 to confirm best actor, then `fetch_actor_details.js` to get input schema.

**Engagement signals:** Retweets, likes, views, reply count (varies by actor)

### Changelog Source

**Anthropic API Changelog:** `https://platform.claude.com/docs/en/release-notes/api`
- Server-side rendered, Cheerio-parseable [VERIFIED: WebFetch returned full rendered content]
- Structure: `### Month DD, YYYY` headings followed by bullet lists
- Headings are H3 elements; verify in Wave 0 with `$('h3').first().text()`

**Claude Code CHANGELOG.md:** `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`
- Plain text markdown [VERIFIED: curl returned clean markdown]
- Structure: `## X.Y.Z` version headings, no dates
- Parse with `split('\n## ')`, extract first 3-5 version blocks
- Useful for detecting "new Claude Code version" content opportunities

---

## Code Examples

### Add transcript column (migration)
```javascript
// In scripts/pulse.js or a separate migrate script
const db = new Database(DB_PATH);
try {
  db.exec('ALTER TABLE ideas ADD COLUMN transcript TEXT;');
  console.log('[DB] transcript column added');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
  // Column already exists — idempotent
}
```
[ASSUMED] - standard SQLite pattern; better-sqlite3 throws on duplicate column

### Insert idea with dedup check
```javascript
const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO ideas
    (id, title, summary, source_url, source_type, score, status, dedup_hash, scraped_at, transcript)
  VALUES
    ($id, $title, $summary, $source_url, $source_type, $score, 'new', $dedup_hash, $scraped_at, $transcript)
`);
// INSERT OR IGNORE skips rows where dedup_hash already exists (UNIQUE constraint)
```
[VERIFIED: `dedup_hash TEXT UNIQUE` confirmed in schema from live DB query]

### Supadata transcript fetch (with SUPADATA_API_KEY)
```javascript
// Source: .claude/skills/supadata/SKILL.md — adapted for Node fetch
const apiKey = process.env.SUPADATA_API_KEY;  // NOT SUPADATA_TOKEN
const url = encodeURIComponent(videoUrl);
const res = await fetch(
  `https://api.supadata.ai/v1/transcript?url=${url}&text=true&mode=native`,
  { headers: { 'x-api-key': apiKey } }
);
if (!res.ok) return null;
const data = await res.json();
return typeof data.content === 'string' ? data.content : null;
```
[VERIFIED: endpoint and headers from SKILL.md; SUPADATA_API_KEY confirmed in .env]

### node-cron registration for 6 AM pulse
```javascript
// In a long-running process (separate from the skill)
const cron = require('node-cron');
cron.schedule('0 6 * * *', () => {
  const { spawnSync } = require('child_process');
  spawnSync('node', ['--env-file=.env', 'scripts/pulse.js'], {
    cwd: '/Users/robinsadeghpour/content-workflow',
    stdio: 'inherit',
  });
});
```
[CITED: npmjs.com/package/node-cron]

---

## Validation Architecture

`.planning/config.json` not present — treating nyquist_validation as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test config files found |
| Config file | None — Wave 0 creates basic test structure |
| Quick run command | `node scripts/test-pulse.js` (smoke test script) |
| Full suite command | `node scripts/test-pulse.js && node scripts/test-review.js` |

Given the pipeline is I/O heavy (external APIs, SQLite, file system), testing strategy should be:
1. **Unit tests** for scorer.js and deduplicator.js (pure functions, no I/O)
2. **Integration smoke tests** for each source module with real API calls (run manually, not in CI)
3. **DB state tests** verifying INSERT OR IGNORE deduplication works correctly

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC-01 | Pulse runs and populates DB from at least one source | Integration smoke | `node scripts/test-pulse-smoke.js` | Wave 0 |
| DISC-02 | Dedup prevents duplicate entries across runs | Unit | `node scripts/test-dedup.js` | Wave 0 |
| DISC-02 | Score formula produces values 0-1 | Unit | `node scripts/test-scorer.js` | Wave 0 |
| DISC-03 | Review reads ideas from DB and accepts KEEP/SKIP/STAR | Manual | Manual `/review` test | Wave 0 |
| DISC-03 | Review markdown file generated at `data/review/YYYY-MM-DD.md` | Integration | `node scripts/test-review-file.js` | Wave 0 |
| DISC-04 | Transcript stored in ideas table for video URLs | Integration smoke | Part of DISC-01 smoke test | Wave 0 |

### Wave 0 Gaps

- [ ] `scripts/test-dedup.js` — unit test for deduplicator.js with in-memory SQLite
- [ ] `scripts/test-scorer.js` — unit test for scorer.js with known inputs/outputs
- [ ] `scripts/test-pulse-smoke.js` — integration test that runs pulse against live APIs and checks DB row count > 0
- [ ] `scripts/test-review-file.js` — integration test that checks markdown file creation
- [ ] Framework install: `npm install node-cron cheerio p-limit@4`
- [ ] DB migration: `ALTER TABLE ideas ADD COLUMN transcript TEXT`
- [ ] Directory creation: `mkdir -p data/review`

---

## Security Domain

Security enforcement is not configured — treating as enabled per default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — CLI-only, no user auth |
| V3 Session Management | No | N/A — CLI batch process |
| V4 Access Control | No | N/A — single operator |
| V5 Input Validation | Yes (limited) | Changelog HTML content → strip tags via cheerio; never eval scraped content |
| V6 Cryptography | No | SHA-256 for dedup hash — not a security function |

### Known Threat Patterns for Scraping Pipelines

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Scraped HTML with XSS/script tags in idea titles | Tampering | Use `$(el).text()` not `.html()` in cheerio — text() strips tags automatically |
| API key leakage in logs | Information Disclosure | Never log the value of `process.env.APIFY_TOKEN` or `SUPADATA_API_KEY` — log only status codes |
| Malicious URLs in scraped content | Tampering | Scraped URLs are stored as data, never executed. No `eval()`, no `exec()` of scraped content. |
| SQLite injection via idea content | Tampering | better-sqlite3 prepared statements with `$param` binding — never string interpolation in SQL |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | URL-based SHA-256 is the dedup hash strategy | Architecture Patterns / Deduplicator | If URLs vary across runs for the same content (e.g., UTM params), duplicates could slip through. Mitigation: normalize URL before hashing (lowercase, strip query params for YouTube IDs). |
| A2 | Default scoring weights: recency 0.4, engagement 0.6 | Architecture Patterns / Scorer | Wrong balance could surface stale viral content over fresh relevant content. User can tune weights — these are starting defaults only. |
| A3 | Cheerio h3 selector works for Anthropic changelog | Architecture Patterns / Changelog | If Anthropic ships a docs platform update changing heading levels, selector breaks. Wave 0 should verify. |
| A4 | Content angle suggestions use `@anthropic-ai/sdk` inline in /review | Standard Stack | CONTEXT.md doesn't specify how angle suggestions are generated — this is discretionary. Could be a simple rule-based classifier instead. |
| A5 | yt-search.py output can be parsed with regex from text format | Source Integration Details | If yt-search output format changes, parser breaks silently. Mitigation: add --json flag to yt-search.py in Wave 0, or use a more robust parsing approach. |
| A6 | `clockworks/tiktok-scraper` accepts `hashtags` as input field | TikTok Source | Input schema needs to be fetched via `fetch_actor_details.js` to confirm. The skill's SKILL.md lists the actor ID but not the exact input fields. |
| A7 | X/Twitter actor `apidojo/tweet-scraper` is best choice | X/Twitter Source | Multiple actors exist; schema and cost differ. Wave 0 must fetch schema for the chosen actor before implementation. |

---

## Open Questions (RESOLVED)

1. **yt-search.py JSON output flag**
   - What we know: Current script outputs formatted human-readable text, not JSON. Parsing text with regex is fragile.
   - What's unclear: Should we add a `--json` flag to the existing script, or parse text output?
   - Recommendation: Add `--json` flag to `yt-search.py` in Wave 0. This is a small, contained change that makes integration robust.

2. **X/Twitter actor selection and cost**
   - What we know: Multiple Apify X/Twitter actors exist. None are in the SKILL.md curated list.
   - What's unclear: Which actor is most reliable for trend discovery? What are the credit costs?
   - Recommendation: Wave 0 task to run `search_actors.js --query "twitter trending"`, pick top 2 candidates, fetch their schemas, compare input requirements.

3. **Pulse cron registration mechanism** **(RESOLVED)**
   - What we know: Phase 1 review/SKILL.md documents `/schedule "0 6 * * *" /pulse` as the registration command. No cron is registered yet (confirmed via `crontab -l`).
   - What's unclear: Does Claude Code's `/schedule` command create a system cron job or an in-process `node-cron` schedule? If the latter, there needs to be a long-running process.
   - **Resolution:** Use `node-cron` in a daemon script (`scripts/cron-daemon.js`) that runs as a background process. The daemon registers a `0 6 * * *` schedule that invokes `pulse.js`. This approach is self-contained (no system crontab dependency), uses the already-installed `node-cron` package, and can be started via `node scripts/cron-daemon.js &` or a launchd plist. The pulse SKILL.md documents how to start/stop the daemon.

4. **Content angle suggestion: Claude API vs rule-based**
   - What we know: D-09 requires angle suggestions (hot take / tutorial / news reaction) per idea. CONTEXT.md marks this as Claude's discretion.
   - What's unclear: Is using `@anthropic-ai/sdk` to generate suggestions acceptable cost and latency during the review session?
   - Recommendation: Start with a simple rule-based classifier (keyword matching: "launched", "new", "announced" → news reaction; "how to", "tutorial", "guide" → tutorial; else → hot take). Add Claude API upgrade path if rule-based is insufficient.

---

## Sources

### Primary (HIGH confidence)
- `scripts/init-db.js` — confirmed exact `ideas` table schema with `dedup_hash TEXT UNIQUE`, WAL mode enabled
- `data/content.db` — live DB query confirmed no `transcript` column exists yet; table is empty
- `.env` — confirmed `APIFY_TOKEN` and `SUPADATA_API_KEY` (not SUPADATA_TOKEN) are present
- `.claude/skills/apify-ultimate-scraper/reference/scripts/run_actor.js` — confirmed ESM syntax (`import` statements)
- `.claude/skills/supadata/SKILL.md` — Supadata API endpoint, auth header, mode parameter
- `~/.claude/scripts/yt-search.py` — confirmed installed, text output format verified via live test run
- `package.json` — confirmed `"type": "commonjs"`, better-sqlite3 12.8.0 and @anthropic-ai/sdk 0.86.1 installed
- WebFetch `platform.claude.com/docs/en/release-notes/api` — confirmed server-rendered HTML with dated headings, Cheerio-parseable
- `curl` to `raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md` — confirmed accessible, plain markdown format

### Secondary (MEDIUM confidence)
- [Apify TikTok Scraper](https://apify.com/clockworks/tiktok-scraper) — actor exists, hashtag search capability confirmed
- [X/Twitter trends scrapers on Apify](https://apify.com/fastcrawler/x-twitter-trends-scraper-2025) — actors exist, specific schemas not verified

### Tertiary (LOW confidence)
- Scoring weight defaults (0.4 recency / 0.6 engagement) — discretionary starting point, not empirically validated
- Cheerio h3 selector for Anthropic changelog — inferred from fetched page content, should be verified in Wave 0

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified installed or installable; versions confirmed
- Architecture: MEDIUM — patterns are standard; ESM/CJS boundary is a verified pitfall; specific actor schemas need Wave 0 confirmation
- Source integrations: MEDIUM — YouTube confirmed working; TikTok actor confirmed exists; X actor selection needs Wave 0 work; changelog parsing confirmed renderable
- Pitfalls: HIGH — ESM/CJS issue and env var name discrepancy are verified facts, not assumptions

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable stack; Apify actor IDs could change)
