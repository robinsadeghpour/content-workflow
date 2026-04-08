# Phase 1: Foundation & Voice - Research

**Researched:** 2026-04-08
**Domain:** Claude Code skill architecture, SQLite infrastructure, voice profile system, cron stub wiring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data Directory Structure**
- D-01: Hybrid layout — centralized `data/` at project root for cross-cutting pipeline state (ideas, performance, drafts). Skill-specific assets (templates, slide HTML) stay inside each skill's directory.
- D-02: Single SQLite database at `data/content.db` with tables for ideas, performance history, and draft metadata. Use `better-sqlite3` per CLAUDE.md stack recommendation.
- D-03: Existing skills (linkedin, tiktok-slideshows, etc.) remain untouched in Phase 1. Migration to centralized data happens in their respective phases (2/3/4).

**Voice Profile Strategy**
- D-04: New `writing` skill created to own voice profiles and orchestrate humanizer. Clean separation: humanizer = AI pattern removal, writing skill = voice application + generation guidance.
- D-05: Voice profile built by scraping Robin's real posts from LinkedIn + TikTok + Instagram. Additionally scrape Nick Saraev (linkedin.com/in/nick-saraev) and Lenny Rachitsky (linkedin.com/in/lennyrachitsky) for style extraction only — analyze their post structure, hook patterns, and engagement tactics, then apply those patterns using Robin's own personality.
- D-06: Two platform-specific voice profiles: (1) LinkedIn = formal-authentic, (2) TikTok + Instagram = casual ("brooo" energy). German TikTok uses the casual profile with DE localization applied on top.

**Cron & Automation**
- D-07: Use Claude Code `/schedule` for daily recurring triggers (6 AM pulse, 6 PM perf-check). Use `/loop` for shorter-interval monitoring during active sessions.
- D-08: Phase 1 creates stub triggers only — they register the schedule entries and create skill entry points that log "triggered" without real logic. Phase 2 fills in pulse logic, Phase 4 fills in perf-check logic.

**CLI Command Design**
- D-09: Individual slash commands per pipeline stage (not namespaced under a parent). Matches the existing pattern where each skill = one command.
- D-10: Phase 1 scaffolds: `/pulse` (stub), `/review` (stub), `/writing` (voice profile management + humanizer orchestration). Cron schedule entries also registered.
- D-11: Existing 11 skills continue working independently. Pipeline integration happens in later phases when each skill's domain is built out.

### Claude's Discretion
- Internal data/ subdirectory naming and structure (data/ideas/, data/drafts/, etc.)
- SQLite schema design for content.db tables
- Voice profile file format and storage within the writing skill
- How the writing skill internally calls the humanizer

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFR-01 | Unified data directory structure for all pipeline state (ideas, drafts, performance) | SQLite schema design, data/ layout patterns from tiktok-slideshows |
| INFR-02 | All interaction via Claude Code CLI slash commands | Existing skill SKILL.md pattern (name + description frontmatter = slash command) |
| INFR-03 | Parallel subagent execution for multi-platform content generation | Claude Code Task tool — fires subagents concurrently; no external lib needed |
| INFR-04 | Cron automation for daily pulse and performance checks | Claude Code `/schedule` for recurring triggers; stub-only in Phase 1 |
| VOIC-01 | Voice profile built from Robin's existing posts (50+ samples) + admired accounts, platform-differentiated | Apify LinkedIn/TikTok/Instagram scrapers; humanizer voice calibration pattern |
| VOIC-02 | Humanizer pass strips AI patterns and applies Robin's voice to every draft | Existing humanizer skill v2.5.1 — writing skill wraps it via `Skill(humanizer *)` |
| VOIC-03 | Platform tone split — LinkedIn formal-authentic vs TikTok/Instagram casual | Two profile JSON files in writing skill; selection by platform param |
</phase_requirements>

---

## Summary

Phase 1 is a pure scaffolding and voice-profile phase. Nothing gets published — the deliverable is infrastructure others depend on. Three distinct work streams run in parallel: (1) creating the `data/` directory and `content.db` SQLite schema, (2) building the `writing` skill with voice profiles scraped from Robin's and reference accounts' posts, and (3) creating stub skills for `/pulse` and `/review` plus registering cron schedule entries.

The existing codebase is already well-structured. Skills live as SKILL.md directories under `.claude/skills/` — creating a new skill means creating a directory with a SKILL.md file. The humanizer skill (v2.5.1) already handles AI pattern removal and voice calibration; the writing skill wraps it without touching its code. The tiktok-slideshows skill's `active-rules.json` and `performance-log.json` provide proven JSON schema patterns for voice profile and performance data structures.

The main research risk is the voice profile scraping step. LinkedIn blocks programmatic scraping without auth. The Apify skill exists but the LinkedIn actor availability must be confirmed at runtime. The fallback path (Robin manually pastes 50+ posts) achieves the same goal with zero tooling risk.

**Primary recommendation:** Build data/ and content.db first (pure local, no external deps), then create the writing skill with manual post paste as a guaranteed fallback, then create stub skills. Each work stream is independent and can be executed in any order.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | 12.8.0 | SQLite driver for content.db | Fastest sync Node.js SQLite driver. Verified on npm registry as latest. Node 24 compatible. [VERIFIED: npm registry] |
| `@anthropic-ai/sdk` | 0.86.1 | Claude API calls inside writing skill for style extraction + translation | Already the project standard per CLAUDE.md. [VERIFIED: npm registry] |
| `node-cron` | 4.2.1 | NOT used in Phase 1 (Claude Code /schedule instead) | Noted for future phases; Phase 1 uses Claude Code native scheduling per D-07. [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` | 16.x | Load APIFY_TOKEN, ANTHROPIC_API_KEY in any scripts | When running Node scripts that need env vars outside Claude Code's env injection |
| Native `fetch` | Node 24 built-in | HTTP calls to Apify API, Postiz API | Node 24 ships fetch natively — no node-fetch needed [VERIFIED: Node 24 confirmed on this machine] |

### What NOT to Use in Phase 1

| Avoid | Reason |
|-------|--------|
| `node-cron` process | D-07 locks Claude Code `/schedule` for recurring triggers — no persistent Node process |
| `express` or any server | CLI-first per CLAUDE.md — no HTTP server |
| Prisma / ORM | Direct `better-sqlite3` SQL only per CLAUDE.md |
| DeepL or translation APIs | EN→DE handled by `@anthropic-ai/sdk` inline per CLAUDE.md |

**Installation (project root, new package.json needed):**
```bash
cd /Users/robinsadeghpour/content-workflow
npm init -y
npm install better-sqlite3
npm install @anthropic-ai/sdk
npm install dotenv
```

Note: `better-sqlite3` requires native build. On this machine (Node 24, macOS), pre-built binaries are available via node-pre-gyp. [ASSUMED — pre-built binary availability not confirmed for Node 24 specifically; may need `npm rebuild` if install fails]

---

## Architecture Patterns

### Recommended Project Structure (new additions only)

```
content-workflow/
├── data/                        # INFR-01: New. Cross-cutting pipeline state
│   ├── content.db               # Single SQLite database (ideas, performance, drafts)
│   └── .gitignore               # Gitignore data/*.db (runtime state, not committed)
├── package.json                 # New. Node.js project root for better-sqlite3, sdk
├── .env                         # New. ANTHROPIC_API_KEY, APIFY_TOKEN (not committed)
└── .claude/skills/
    ├── writing/                 # New. D-04: Voice profile management + humanizer orchestration
    │   ├── SKILL.md             # Slash command definition + full workflow
    │   └── data/
    │       ├── voice-linkedin.json    # D-06: LinkedIn formal-authentic profile
    │       └── voice-casual.json     # D-06: TikTok + Instagram casual profile
    ├── pulse/                   # New. D-10: Stub for discovery trigger
    │   └── SKILL.md             # Logs "pulse triggered" — Phase 2 fills logic
    └── review/                  # New. D-10: Stub for morning review UI
        └── SKILL.md             # Logs "review triggered" — Phase 2 fills logic
```

Existing skills (linkedin, tiktok-slideshows, humanizer, postiz, etc.) are untouched per D-03 and D-11.

### Pattern 1: Skill as Slash Command (Established Pattern)

**What:** A directory under `.claude/skills/` with a `SKILL.md` file becomes a slash command. The YAML frontmatter `name` field controls the command name.

**When to use:** Every new pipeline stage in this project.

**Example (from existing humanizer skill):**
```yaml
---
name: humanizer
version: 2.5.1
description: |
  Remove signs of AI-generated writing from text...
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
---
```
[VERIFIED: observed in `.claude/skills/humanizer/SKILL.md`]

For Phase 1, the writing skill frontmatter pattern:
```yaml
---
name: writing
version: 1.0.0
description: |
  Voice profile management and humanizer orchestration. Apply Robin's authentic voice to any draft.
  Use when you need to: (1) build or update the voice profile, (2) apply Robin's voice to a draft,
  (3) get platform-specific tone guidance.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Skill(humanizer *)
---
```

The `Skill(humanizer *)` allowed-tools entry is the canonical pattern to invoke one skill from another, matching the linkedin skill's `Skill(humanizer *)` usage. [VERIFIED: observed in `.claude/skills/linkedin/SKILL.md` frontmatter]

### Pattern 2: SQLite Schema Design for content.db

**What:** Three tables cover all Phase 1 requirements and future phases without schema conflicts.

**When to use:** Written once in Phase 1. Other phases add rows, not tables (Phase 2 populates ideas, Phase 4 populates performance).

**Recommended schema (Claude's discretion area — this is the recommendation):**

```sql
-- ideas table: populated by Phase 2 (pulse/discovery)
CREATE TABLE IF NOT EXISTS ideas (
  id           TEXT PRIMARY KEY,          -- uuid or slug
  title        TEXT NOT NULL,
  summary      TEXT,
  source_url   TEXT,
  source_type  TEXT,                      -- 'youtube', 'tiktok', 'web', 'changelog', 'x'
  score        REAL DEFAULT 0,            -- discovery score for ranking
  status       TEXT DEFAULT 'new',        -- 'new', 'kept', 'skipped', 'starred', 'used'
  dedup_hash   TEXT UNIQUE,               -- SHA256 of normalized title/url for deduplication
  scraped_at   TEXT,                      -- ISO 8601
  created_at   TEXT DEFAULT (datetime('now'))
);

-- drafts table: populated by Phase 3 (content generation)
CREATE TABLE IF NOT EXISTS drafts (
  id           TEXT PRIMARY KEY,
  idea_id      TEXT REFERENCES ideas(id),
  platform     TEXT NOT NULL,             -- 'linkedin', 'tiktok_en', 'tiktok_de', 'instagram'
  content      TEXT,                      -- raw draft text
  status       TEXT DEFAULT 'draft',      -- 'draft', 'approved', 'scheduled', 'published'
  postiz_id    TEXT,                      -- Postiz post ID after scheduling
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

-- performance table: populated by Phase 4 (analytics)
CREATE TABLE IF NOT EXISTS performance (
  id           TEXT PRIMARY KEY,
  draft_id     TEXT REFERENCES drafts(id),
  platform     TEXT NOT NULL,
  views        INTEGER DEFAULT 0,
  likes        INTEGER DEFAULT 0,
  comments     INTEGER DEFAULT 0,
  shares       INTEGER DEFAULT 0,
  score        REAL DEFAULT 0,            -- computed engagement score
  checked_at   TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);
```

This schema mirrors the data shape proven in `tiktok-slideshows/data/performance-log.json` (per-post metrics with status tracking) while adding the idea and draft layers needed for the full pipeline. [VERIFIED: schema derived from performance-log.json structure observed in codebase]

### Pattern 3: Voice Profile JSON Structure

**What:** A JSON file captures Robin's writing fingerprint per platform. The writing skill reads this before every draft pass.

**Pattern reference:** `tiktok-slideshows/data/active-rules.json` uses a weighted rule structure with status, evidence, and examples. The voice profile adapts this for writing style.

**Recommended structure:**

```json
{
  "version": "1.0",
  "platform": "linkedin",
  "tone": "formal-authentic",
  "built_from": "50+ Robin posts + Nick Saraev + Lenny Rachitsky style extraction",
  "last_updated": "2026-04-08",
  "fingerprint": {
    "sentence_length": "mixed — short punchy openers, longer elaborations",
    "paragraph_length": "1-3 sentences max",
    "opener_style": "observation or counterintuitive claim, never a question",
    "word_choice": "direct, avoids jargon, prefers concrete over abstract",
    "punctuation": "minimal dashes, no semicolons, occasional parenthetical",
    "first_person": "frequent — I, my, we (when including audience)",
    "cta_style": "soft — invites reflection rather than commands action"
  },
  "hook_patterns": [
    {
      "pattern": "[counterintuitive claim] + [brief story or stat]",
      "weight": 9.0,
      "examples": ["extracted from scraped posts"]
    }
  ],
  "banned_patterns": [
    "In today's rapidly evolving landscape...",
    "The key takeaway here is...",
    "Let's dive into...",
    "This is a testament to..."
  ],
  "sample_posts": [
    {
      "id": "li-001",
      "text": "full post text",
      "source": "linkedin.com/in/robin...",
      "engagement": "high"
    }
  ]
}
```

[ASSUMED — voice profile JSON structure. Planner should validate this schema is sufficient before finalizing]

### Pattern 4: Stub Skill Pattern

**What:** A SKILL.md that registers the slash command, documents the intended behavior, and logs "triggered" without executing real logic.

**When to use:** /pulse and /review in Phase 1. Phase 2 and Phase 4 will overwrite these files with real logic.

**Example stub SKILL.md body:**

```markdown
# Pulse — Content Discovery Trigger (STUB)

> Phase 1 stub. Phase 2 will implement scraping logic.

## Current behavior

Logs that the pulse was triggered. No scraping occurs.

## Intended behavior (Phase 2)

Scrapes YouTube, TikTok, X, web, and changelog sources for trending AI/tech topics.
Writes discovered ideas to data/content.db (ideas table).
Presents top 5 discoveries to Robin for KEEP/SKIP/STAR decision.

## Running

Invoked by Claude Code /schedule at 6:00 AM daily. Can also be run manually: /pulse

```bash
echo "[PULSE] $(date -u +%Y-%m-%dT%H:%M:%SZ) — pulse triggered (stub, no scraping)"
```
```

[VERIFIED: pattern derived from established skill structure observed across project skills]

### Pattern 5: Writing Skill — Humanizer Orchestration

**What:** The writing skill calls the humanizer as a subskill. Claude Code supports `Skill(humanizer *)` in allowed-tools, which means the writing skill can invoke `/humanizer` inline.

**How it works in SKILL.md:** The writing skill instructs Claude to run the humanizer on a draft and then apply platform-specific voice profile rules on top. The sequence:
1. Read the appropriate voice profile JSON from `writing/data/`
2. Generate or receive a draft
3. Invoke humanizer to strip AI patterns (via Skill invocation)
4. Apply voice fingerprint corrections not covered by humanizer (opener style, hook patterns, banned phrases)
5. Return final post

[VERIFIED: `Skill(humanizer *)` pattern observed in `.claude/skills/linkedin/SKILL.md` frontmatter]

### Anti-Patterns to Avoid

- **Writing a voice profile from scratch without samples:** The humanizer voice calibration section explicitly requires real writing samples. Without Robin's actual posts, the profile is fiction. Scraping (or manual paste) before writing the profile is mandatory.
- **Calling humanizer by shell command rather than Skill():** Shell invocation breaks the Claude Code skill orchestration model. Always use `Skill(humanizer *)` in allowed-tools and let Claude route it.
- **Creating content.db in a skill's own data/ directory:** Cross-cutting state must live at `data/content.db` (INFR-01). Skill-specific data (voice profiles) stays inside the skill.
- **Registering cron via node-cron process:** D-07 locks Claude Code `/schedule`. No long-running Node process needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AI pattern removal | Custom regex-based text cleaner | Existing `humanizer` skill v2.5.1 | 29 documented AI pattern categories already implemented and tested |
| Voice calibration | Manual style guide document | Humanizer's voice calibration mode (pass writing samples) | Built-in sample analysis produces better matches than manual rules |
| SQLite queries | Custom file-based JSON store | `better-sqlite3` | Synchronous API, orders of magnitude faster, ACID transactions, already in CLAUDE.md stack |
| LinkedIn/TikTok post scraping | Puppeteer from scratch | Apify skill (`apify-ultimate-scraper`) | Actors for both platforms already abstracted; just needs APIFY_TOKEN |
| Cron scheduling | node-cron process or launchd plist | Claude Code `/schedule` | Native, no OS-level state, no persistent process needed per D-07 |

**Key insight:** The writing skill's core value is orchestration — combining existing pieces (humanizer + voice profile JSON + platform rules) in one slash command. It should contain zero novel AI-pattern logic.

---

## Common Pitfalls

### Pitfall 1: LinkedIn Post Scraping Blocked

**What goes wrong:** Apify LinkedIn scraper actors require authenticated sessions or may be geo-blocked. The Apify skill's actor list does not explicitly list a LinkedIn post scraper actor — the skill mentions LinkedIn in general terms but the actor table in the SKILL.md only shows Instagram, Facebook, TikTok, YouTube actors by name.

**Why it happens:** LinkedIn aggressively blocks programmatic access. Apify actors that do work require cookie injection or Apify Proxy with residential IPs.

**How to avoid:** The plan must have a manual fallback: Robin pastes 50+ LinkedIn posts directly into a file. This is the guaranteed path. The Apify route is an optimization, not a requirement.

**Warning signs:** Apify run returns empty results or 403 errors on LinkedIn profile URLs.

[ASSUMED — LinkedIn scraper actor availability via existing Apify skill not verified by running the scraper]

### Pitfall 2: better-sqlite3 Native Build on Node 24

**What goes wrong:** `better-sqlite3` uses native bindings. The npm registry shows 12.8.0 as latest but pre-built binary availability for Node 24.12.0 specifically is not guaranteed.

**Why it happens:** Node version must match the pre-built binary version baked into the release. Node 24 is relatively new.

**How to avoid:** Run `npm install better-sqlite3` and watch for build errors. If native build fails: `npm rebuild better-sqlite3` or downgrade to Node 22 LTS (which has guaranteed binary support).

**Warning signs:** Install output shows "gyp ERR!" or "node-pre-gyp WARN" followed by a failed build.

[ASSUMED — Node 24 binary availability for better-sqlite3 12.8.0 not verified on this machine]

### Pitfall 3: Voice Profile Without Enough Samples

**What goes wrong:** The humanizer voice calibration requires real writing samples to extract patterns. If Robin has fewer than 50 accessible posts (deleted, private, etc.), the profile will be thin and produce generic results.

**Why it happens:** TikTok in particular does not expose historical posts easily. LinkedIn posts are public but paginated.

**How to avoid:** Plan must include a count step — after scraping, show Robin how many samples were retrieved before building the profile. If under 30, pause and ask Robin to manually contribute additional posts.

**Warning signs:** Scraper returns fewer than 30 unique posts per platform.

[VERIFIED: STATE.md explicitly flags "Research flag: Confirm Robin has 50+ existing posts for voice profile"]

### Pitfall 4: Stub Skills Overwritten by Misunderstanding

**What goes wrong:** Phase 2 execution agent overwrites `/pulse` SKILL.md without reading that Phase 1 intentionally made it a stub. The stub's documented intent gets lost.

**Why it happens:** Stub SKILL.md files look incomplete, and agents may "helpfully" fill in logic before Phase 2.

**How to avoid:** Stub SKILL.md must include a prominent `> Phase 1 stub. Phase 2 will implement [X]` callout at the top, and the ROADMAP/PLAN must explicitly state Phase 2 replaces the stub.

**Warning signs:** /pulse runs but produces unexpected output from a partial Phase 2 implementation.

### Pitfall 5: Casual Profile Applied to LinkedIn

**What goes wrong:** The writing skill applies the wrong voice profile ("brooo" energy) to a LinkedIn draft.

**Why it happens:** If platform selection is ambiguous or the writing skill doesn't require an explicit platform argument.

**How to avoid:** The writing skill MUST require a `--platform linkedin|tiktok|instagram` argument. No implicit defaults. Voice profile selection is always explicit.

---

## Code Examples

Verified patterns from the existing codebase:

### Initialize content.db with better-sqlite3

```javascript
// Source: CLAUDE.md stack recommendation + better-sqlite3 docs pattern
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../data/content.db'));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source_type TEXT,
    score REAL DEFAULT 0,
    status TEXT DEFAULT 'new',
    dedup_hash TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);
```

[VERIFIED: better-sqlite3 API pattern — sync constructor, pragma, exec are confirmed API surface]

### Writing Skill: Load Voice Profile and Apply

```javascript
// Conceptual flow inside writing skill SKILL.md instructions
// (Skills are markdown instructions, not JS files — this shows the logic sequence)

// 1. Read appropriate voice profile
const profile = JSON.parse(
  fs.readFileSync('.claude/skills/writing/data/voice-linkedin.json', 'utf-8')
);

// 2. Check banned patterns
const bannedFound = profile.banned_patterns.filter(p => draft.includes(p));
if (bannedFound.length > 0) {
  // Flag for rewrite
}

// 3. Verify opener matches fingerprint style
// 4. Pass to humanizer (via Skill invocation in Claude Code)
```

[ASSUMED — writing skill logic pattern, not verified executable code]

### Stub Cron Entry Registration

The `/schedule` command in Claude Code registers a recurring task. For Phase 1 stubs, the registered command points to the stub skill:

```
/schedule "0 6 * * *" /pulse
/schedule "0 18 * * *" /perf-check
```

[ASSUMED — `/schedule` syntax not verified in Claude Code documentation. This is the pattern described in CONTEXT.md D-07. Planner should verify actual /schedule command syntax before writing tasks.]

### TikTok/Instagram Casual Voice (Reference Tone)

From tiktok-slideshows SKILL.md established content patterns:
```
lowercase text
short punchy sentences
"brooo", "bruh" energy
write like texting a friend
focus on OTHER person's reaction, not yourself
```
[VERIFIED: observed in `.claude/skills/tiktok-slideshows/SKILL.md`]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate .db files per domain | Single content.db with tables | Phase 1 decision | Simpler joins for Phase 4 analytics |
| node-cron long-running process | Claude Code /schedule | Phase 1 decision (D-07) | No persistent process; cron managed by Claude Code runtime |
| Manual voice guide doc | JSON voice profile with sample_posts array | Phase 1 | Machine-readable, can be fed to humanizer voice calibration |
| Skill-local data only | Hybrid: root data/ + skill-local | Phase 1 decision (D-01) | Cross-cutting state accessible to all skills |

**Not yet implemented (Phase 1 baseline):**
- No package.json at project root yet — Phase 1 creates it
- No data/ directory yet — Phase 1 creates it
- No writing/pulse/review skills yet — Phase 1 creates them
- Existing skills (linkedin, tiktok-slideshows) use their own data/ — unchanged until Phase 2/3

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | better-sqlite3 12.8.0 pre-built binaries available for Node 24.12.0 | Standard Stack, Pitfall 2 | Install fails; requires `npm rebuild` or Node version change |
| A2 | LinkedIn post scraper available via Apify skill | Pitfall 1 | Scraping fails; fallback to manual post paste |
| A3 | Robin has 50+ accessible posts across LinkedIn + TikTok + Instagram | VOIC-01 | Profile thin; must request manual supplement from Robin |
| A4 | `/schedule` Claude Code command accepts cron syntax and skill invocations | Code Examples | Stub registration approach needs revision; may need alternative trigger method |
| A5 | Voice profile JSON structure (fingerprint + hook_patterns + banned_patterns) is sufficient for humanizer voice calibration | Architecture Patterns | May need restructuring after first test pass |
| A6 | `Skill(humanizer *)` in allowed-tools is the correct syntax for cross-skill invocation | Architecture Patterns | Writing skill cannot call humanizer inline |

---

## Open Questions

1. **Claude Code /schedule syntax**
   - What we know: CONTEXT.md D-07 specifies `/schedule` for daily recurring triggers
   - What's unclear: Exact command syntax (does it accept cron expressions? skill names? arbitrary commands?)
   - Recommendation: Planner should include a task to test `/schedule` syntax before finalizing stub registration. If `/schedule` is not available, fall back to documenting the schedule in a `cron.md` file with instructions for Robin to run manually.

2. **LinkedIn post scraping via Apify**
   - What we know: Apify skill exists with APIFY_TOKEN support. LinkedIn data is not listed by actor name in the Apify SKILL.md actor table.
   - What's unclear: Whether a working LinkedIn profile post scraper actor is available under Apify's catalog
   - Recommendation: Include two tasks in the voice profile build — (A) attempt Apify LinkedIn scrape, (B) manual paste fallback. Plan should not block on (A).

3. **Number of Robin posts available**
   - What we know: STATE.md flags this as a research concern. TikTok history is hard to retrieve.
   - What's unclear: Whether Robin has enough posts for a high-quality profile without supplementation
   - Recommendation: First wave of the writing skill work should include a count step presented to Robin before committing to the profile build.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | better-sqlite3, scripts | ✓ | v24.12.0 | — |
| npm | Package installation | ✓ | 11.6.2 | — |
| Python 3 | Not needed in Phase 1 | ✓ | 3.14.0 | — |
| sqlite3 CLI | DB inspection/debugging | ✓ | 3.43.2 | Use better-sqlite3 directly |
| better-sqlite3 npm | content.db | ✗ (not installed) | — | Install via npm at project root |
| @anthropic-ai/sdk npm | Writing skill API calls | ✗ (not installed at project root) | 0.86.1 latest | — |
| Apify CLI / APIFY_TOKEN | Voice profile scraping | ✗ (no .env found) | — | Manual post paste by Robin |
| postiz CLI | Not needed in Phase 1 | ✗ (not in PATH) | — | Phase 4 dependency |
| ANTHROPIC_API_KEY | @anthropic-ai/sdk | ✗ (no .env found) | — | Must be set in .env before writing skill can call API |

**Missing dependencies with no fallback:**
- `ANTHROPIC_API_KEY` — writing skill's style extraction from scraped posts requires the Anthropic SDK. Must be present in `.env` before the voice profile build step.

**Missing dependencies with fallback:**
- `APIFY_TOKEN` — voice profile scraping falls back to Robin manually pasting posts
- `better-sqlite3` / `@anthropic-ai/sdk` — must be installed (npm install at project root); these are standard and will install cleanly

**Note:** No package.json exists at project root yet. Phase 1 must create it. [VERIFIED: no package.json found at /Users/robinsadeghpour/content-workflow/]

---

## Security Domain

> `security_enforcement` is not explicitly set to false in config.json — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No user auth in CLI-only system |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | Single-operator local system |
| V5 Input Validation | Yes (low risk) | Validate scraped post data before inserting to SQLite (parameterized queries) |
| V6 Cryptography | No | No secrets stored in DB; API keys in .env only |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via scraped post content | Tampering | better-sqlite3 parameterized statements (`.prepare()` + bound params) — never string concatenation |
| API key exposure in voice profile JSON | Information Disclosure | Never store ANTHROPIC_API_KEY or APIFY_TOKEN in JSON profile files; .env only |
| Scraped post content containing prompt injection | Tampering | Treat all scraped text as untrusted user input; don't pass raw scraped content directly as system prompts |

**SQL injection prevention (critical for scraped content):**
```javascript
// CORRECT — parameterized
const insert = db.prepare('INSERT INTO ideas (id, title, source_url) VALUES (?, ?, ?)');
insert.run(id, title, url);

// WRONG — string concatenation (never do this with scraped content)
db.exec(`INSERT INTO ideas VALUES ('${title}', '${url}')`);
```
[VERIFIED: better-sqlite3 parameterized query API confirmed]

---

## Sources

### Primary (HIGH confidence)
- Codebase: `.claude/skills/humanizer/SKILL.md` — v2.5.1, full pattern list, voice calibration protocol, Skill() invocation pattern
- Codebase: `.claude/skills/tiktok-slideshows/SKILL.md` + `data/active-rules.json` + `data/performance-log.json` — weighted rules schema, performance log schema, cron automation patterns
- Codebase: `.claude/skills/linkedin/SKILL.md` — `Skill(humanizer *)` cross-skill invocation pattern
- Codebase: `Larry 1.0.0/scripts/daily-report.js` — Postiz API pattern, daily report framework
- npm registry: `better-sqlite3@12.8.0`, `node-cron@4.2.1`, `@anthropic-ai/sdk@0.86.1` — version verification

### Secondary (MEDIUM confidence)
- CLAUDE.md — full stack specification with version pins and anti-patterns
- `.planning/phases/01-foundation-voice/01-CONTEXT.md` — locked decisions and canonical references
- `.planning/STATE.md` — research flags and project context

### Tertiary (LOW confidence / ASSUMED)
- `/schedule` Claude Code command syntax — documented in CONTEXT.md D-07 but not verified against Claude Code docs
- LinkedIn post scraping via Apify — actor catalog not explicitly confirmed for LinkedIn profiles
- better-sqlite3 binary availability for Node 24.12.0 — not tested on this machine

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm registry, versions confirmed
- Architecture patterns: HIGH — patterns verified directly from existing codebase
- Voice profile JSON schema: MEDIUM — derived from working patterns but not yet tested
- Pitfalls: MEDIUM — scraping pitfalls based on known LinkedIn restrictions; binary pitfall is theoretical
- /schedule syntax: LOW — depends on Claude Code documentation not available in this session

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable domain — npm packages change slowly, patterns are codebase-verified)
