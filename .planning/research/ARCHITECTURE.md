# Architecture Research

**Domain:** Claude Code CLI content automation pipeline
**Researched:** 2026-04-08
**Confidence:** HIGH (based on direct inspection of existing skills, Larry pipeline, and PROJECT.md)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AUTOMATION LAYER (Cron)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ /daily-pulse │  │  /perf-check │  │  /morning-brief (future) │   │
│  │  6:00 AM     │  │  6:00 PM     │  │      8:00 AM             │   │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘   │
└─────────┼─────────────────┼──────────────────────-┼─────────────────┘
          │                 │                        │
┌─────────▼─────────────────▼────────────────────────▼─────────────────┐
│                      ORCHESTRATION LAYER (Skills)                      │
│                                                                         │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────┐    │
│  │ /scout-ideas │   │  /create-set │   │   /approve-and-schedule  │    │
│  │ (discovery)  │   │ (generation) │   │    (human gate + post)   │    │
│  └──────┬───────┘   └──────┬───────┘   └────────────┬─────────────┘   │
│         │                  │                         │                  │
│         ▼                  ▼                         ▼                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   SPECIALIST SKILLS                              │   │
│  │  supadata  │  apify  │  humanizer  │  linkedin  │  tiktok-      │   │
│  │            │         │             │            │  slideshows   │   │
│  │  nano-banana  │  postiz  │  yt-search  │  notebooklm            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
          │
┌─────────▼─────────────────────────────────────────────────────────────┐
│                       DATA LAYER (JSON Files)                           │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐    │
│  │ idea-backlog/  │  │ content-queue/ │  │  performance-history/  │    │
│  │ ideas.json     │  │ drafts.json    │  │  perf-log.json         │    │
│  │ pulse-log.json │  │ approved.json  │  │  active-rules.json     │    │
│  └────────────────┘  └────────────────┘  └────────────────────────┘    │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐    │
│  │  voice-profile/│  │  photo-library/│  │  workspace/            │    │
│  │  samples.txt   │  │  catalog.json  │  │  [date]/[topic]/       │    │
│  │  calibration   │  │  images/       │  │  slides/               │    │
│  └────────────────┘  └────────────────┘  └────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
          │
┌─────────▼──────────────────────────────────────────────────────────────┐
│                     EXECUTION LAYER (Node.js + External APIs)            │
│                                                                           │
│  Larry Pipeline          Postiz API            External Scrapers          │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────────────┐     │
│  │ generate-slides│  │ POST /posts      │  │ supadata (transcripts│     │
│  │ add-text-      │  │ GET /analytics   │  │ apify (social scrape)│     │
│  │   overlay.js   │  │ POST /media      │  │ yt-search            │     │
│  │ check-         │  └──────────────────┘  └──────────────────────┘     │
│  │   analytics.js │                                                       │
│  └────────────────┘                                                       │
└───────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|---------------|----------------|
| **daily-pulse** (cron skill) | Scrape trending AI/tech content from YouTube, X, changelogs, web; write scored ideas to `idea-backlog/ideas.json` | Orchestrates supadata + apify + yt-search as subagents |
| **perf-check** (cron skill) | Fetch Postiz analytics for posts from past 48h; update `performance-history/`; adjust rule weights in `active-rules.json` | Calls Postiz analytics API, writes JSON |
| **scout-ideas** (manual skill) | Present idea backlog for Robin to review and KEEP/SKIP/STAR items | Reads `ideas.json`, writes status flags |
| **create-set** (manual skill) | Turn a KEPT idea into a full content set: LinkedIn post + TikTok EN slides + TikTok DE slides + Instagram slides | Orchestrates generation subagents in parallel |
| **approve-and-schedule** (manual skill) | Present generated drafts for Robin's approval; on approval, call Postiz to schedule | Human gate — nothing posts without this |
| **humanizer** (specialist) | Strip AI writing patterns, apply Robin's voice calibration | Invoked by linkedin and tiktok-slideshows during generation |
| **linkedin** (specialist) | Research topic → write post → optionally generate carousel HTML or infographic | Calls NotebookLM, humanizer; writes workspace HTML |
| **tiktok-slideshows** (specialist) | Generate 6-slide story arc → select photos from catalog → upload via Postiz as draft | Calls humanizer, Larry pipeline for overlays |
| **Larry pipeline** (Node.js scripts) | Generate slides with text overlays (canvas), run analytics | `generate-slides.js`, `add-text-overlay.js`, `check-analytics.js` |
| **nano-banana** (specialist) | Gemini image generation for fallback visuals when no real screenshots exist | Called by linkedin + tiktok-slideshows when photo catalog lacks match |
| **supadata** (specialist) | Extract transcripts from YouTube/TikTok/Instagram/X; scrape web pages | Data source for daily-pulse and linkedin topic research |
| **apify** (specialist) | Scrape social media (55+ actors) for trending content signals | Data source for daily-pulse |
| **postiz** (specialist) | Schedule and publish across platforms; retrieve analytics | Terminal publishing sink; also analytics source |
| **notebooklm** (specialist) | Deep research synthesis from multiple sources | Called by linkedin for authority content |
| **voice-profile** (data asset) | Robin's writing samples + calibration for humanizer | File set read by humanizer on invocation |
| **photo-library** (data asset) | Cataloged real photos with text descriptions; no vision API needed at selection time | `catalog.json` with descriptions; images directory |

## Recommended Project Structure

```
content-workflow/
├── .claude/
│   ├── skills/                    # All installed specialist skills
│   │   ├── tiktok-slideshows/     # Mature — 6-slide arc + photo library + cron
│   │   ├── linkedin/              # Mature — browse/card/topic modes + slide gen
│   │   ├── humanizer/             # Mature — 29 AI patterns, voice calibration
│   │   ├── postiz/                # Mature — scheduling + analytics API
│   │   ├── supadata/              # Mature — transcripts + web scraping
│   │   ├── apify-ultimate-scraper/# Mature — 55+ social scraping actors
│   │   ├── nano-banana/           # Mature — Gemini image generation
│   │   └── notebooklm/            # Mature — deep research synthesis
│   └── commands/                  # Global slash commands (yt-search here)
├── skills/                        # Project-local orchestration skills (TO BUILD)
│   ├── daily-pulse.md             # Cron: scrape + score + write to idea backlog
│   ├── perf-check.md              # Cron: analytics pull + rule weight updates
│   ├── scout-ideas.md             # Manual: review idea backlog
│   ├── create-set.md              # Manual: orchestrate full content generation
│   └── approve-and-schedule.md   # Manual: human gate + Postiz scheduling
├── Larry 1.0.0/                   # Existing Node.js slide pipeline (merge target)
│   ├── scripts/
│   │   ├── generate-slides.js
│   │   ├── add-text-overlay.js
│   │   └── check-analytics.js
│   └── SKILL.md
├── data/
│   ├── idea-backlog/
│   │   ├── ideas.json             # Accumulated pulse results with scores
│   │   └── pulse-log.json         # History of each pulse run
│   ├── content-queue/
│   │   ├── drafts/                # Generated content sets awaiting approval
│   │   │   └── [date]-[slug]/
│   │   │       ├── meta.json      # Topic, platform targets, creation timestamp
│   │   │       ├── linkedin.md    # LinkedIn post copy
│   │   │       ├── tiktok-en/     # 6 slide captions + photo selections
│   │   │       ├── tiktok-de/     # German localized version
│   │   │       └── instagram/     # Identical to tiktok-en (same format)
│   │   └── approved.json          # Postiz post IDs after scheduling
│   ├── performance-history/
│   │   ├── perf-log.json          # Per-post metrics (views, likes, comments)
│   │   └── active-rules.json      # Hook weights, format weights (from tiktok-slideshows)
│   └── voice-profile/
│       ├── samples/               # Robin's existing LinkedIn + TikTok posts
│       └── calibration.md         # Extracted voice patterns for humanizer
├── media/
│   ├── photo-library/
│   │   ├── catalog.json           # Text descriptions of all photos
│   │   └── images/                # Source photos
│   └── workspace/                 # Generated output (gitignored)
│       └── [date]/
│           └── [topic-slug]/
│               ├── linkedin-slides.html
│               ├── tiktok-en/     # Final slide images
│               ├── tiktok-de/
│               └── instagram/
└── prompts/                       # Reference documents (existing)
    ├── 11x-agency-information.md
    └── jens-heitmann-pipeline.md
```

### Structure Rationale

- **skills/ (project-local):** Orchestration skills live here, not in `.claude/skills/` — they are specific to this project's pipeline, not reusable across projects. The specialist skills remain in `.claude/skills/` where they can be invoked by any project.
- **data/:** All state in one place, with sub-directories per pipeline stage. This makes it easy for cron jobs and orchestration skills to find what they need without guessing paths.
- **media/workspace/:** Gitignored generated output. Each run gets its own dated/slugged folder so parallel runs don't collide and past work is auditable.
- **Larry 1.0.0/:** Kept as-is initially — the Node.js scripts are called by the unified tiktok-slideshows skill. A later phase can relocate scripts to `scripts/` if needed.

## Architectural Patterns

### Pattern 1: Orchestrator-Specialist (Primary Pattern)

**What:** A "thin" orchestration skill coordinates multiple specialist skills as subagents. The orchestrator owns the workflow logic; specialists own domain knowledge.

**When to use:** Any time a single user action (e.g., `/create-set`) needs to invoke multiple distinct capabilities in sequence or parallel.

**Trade-offs:** Clear separation means skills stay modular and independently improvable. The orchestrator can be thin. Downside: debugging across skill boundaries requires checking multiple files.

**Example — create-set orchestration:**
```
/create-set "Claude Code agents explained"
  ├── [agent 1] linkedin skill → linkedin.md draft
  ├── [agent 2] tiktok-slideshows → EN captions + photo picks
  ├── [agent 3] tiktok-slideshows (DE mode) → German captions
  └── humanizer invoked by each agent independently
  → merge outputs to data/content-queue/drafts/[date]-[slug]/
```

Agents 1-3 run in parallel. Humanizer is called within each agent, not at the orchestrator level.

### Pattern 2: JSON-File State Machine

**What:** Pipeline state is stored in JSON files that skills read and write. No database, no external state store. Each skill reads current state at start, writes updated state at end.

**When to use:** Single-operator CLI systems with no concurrency requirements. Eliminates infrastructure complexity entirely.

**Trade-offs:** Simple, no moving parts, inspectable by hand. Breaks if multiple concurrent writes happen (not a risk here — Robin is the sole operator). Must be careful about file schema evolution.

**State schema — idea:**
```json
{
  "id": "uuid",
  "title": "Claude Code agents explained",
  "source": "youtube",
  "url": "https://...",
  "score": 8.2,
  "status": "KEPT",
  "created": "2026-04-08T06:00:00Z",
  "pulseRun": "2026-04-08-morning"
}
```

**Status transitions:** `NEW` → `KEPT | SKIPPED | STARRED` → `IN_DRAFT` → `APPROVED` → `SCHEDULED`

### Pattern 3: Cron-Triggered Agent with Approval Gate

**What:** Cron jobs automate data collection and reporting. All content creation and publishing requires explicit Robin approval. The system never posts autonomously.

**When to use:** Any automated action that touches live platforms or produces content.

**Trade-offs:** Ensures trust in the system early. Slower throughput, but each post is intentional. The approval gate is not a pitfall — it's a feature.

**Cron pattern:**
```
cron 6:00 AM → /daily-pulse → writes ideas.json (no approval needed)
cron 6:00 PM → /perf-check → reads Postiz analytics, updates weights (no approval)
manual → /scout-ideas → Robin reviews, sets KEPT/SKIPPED
manual → /create-set → generates drafts (no posting yet)
manual → /approve-and-schedule → Robin approves each platform post → Postiz schedules
```

### Pattern 4: Platform-Divergent Media, Shared Copy Core

**What:** One piece of research and one core angle produces platform-native outputs — not the same content blasted everywhere. LinkedIn gets format-appropriate structure; TikTok EN and DE get the slideshow arc; Instagram gets the same slideshow as TikTok EN.

**When to use:** Always. The whole system is built around this.

**Trade-offs:** Requires per-platform generation steps. Worth it — copy-pasting the same text across platforms produces low-quality content on each.

**Copy lineage:**
```
Research (supadata + apify + yt-search)
  → Core angle + key points (shared)
    → LinkedIn post (platform-native format + optional carousel HTML)
    → TikTok EN 6-slide arc (captions only → photos selected from catalog)
    → TikTok DE (translated + localized from EN captions)
    → Instagram (identical structure to TikTok EN — same Postiz upload)
```

## Data Flow

### Automated Daily Pulse (6:00 AM Cron)

```
cron trigger
  ↓
/daily-pulse skill launches
  ├── [agent] supadata → scrape YouTube/TikTok/Instagram trending in AI/tech
  ├── [agent] apify → scrape X, changelogs, Reddit for trending topics
  └── [agent] yt-search → search YouTube for recent AI/tech uploads
  ↓ (merge results)
score each item (recency × engagement signals × relevance to Robin's niche)
  ↓
append to data/idea-backlog/ideas.json (status: NEW)
write pulse-log.json entry (timestamp, source counts, top scores)
```

### Morning Review Workflow (Manual)

```
Robin: /scout-ideas
  ↓
skill reads ideas.json (filter: status=NEW, sort by score desc)
presents top 10 ideas in formatted list
Robin: marks each KEPT / SKIPPED / STARRED
  ↓
writes status flags back to ideas.json
Robin picks 1-4 KEPT/STARRED ideas to produce today
  ↓
Robin: /create-set [idea-id]
```

### Content Generation (Parallel Subagents)

```
/create-set [idea-id]
  ↓
reads idea from ideas.json, sets status → IN_DRAFT
creates data/content-queue/drafts/[date]-[slug]/ directory
  │
  ├── [agent 1] linkedin skill
  │   ├── research (NotebookLM synthesis or YouTube transcript via supadata)
  │   ├── write post draft (markdown)
  │   ├── humanizer pass (voice calibration from voice-profile/)
  │   └── optionally generate carousel HTML → media/workspace/[date]/[slug]/linkedin-slides.html
  │
  ├── [agent 2] tiktok-slideshows (EN)
  │   ├── generate 6-slide story arc
  │   ├── humanizer pass
  │   ├── select 6 photos from catalog.json (text match, no vision API)
  │   └── write tiktok-en/ captions + photo-selections.json
  │
  └── [agent 3] tiktok-slideshows (DE)
      ├── read EN captions from agent 2 output
      ├── translate + localize to German (TikTok DE voice)
      └── write tiktok-de/ captions

  ↓ (all agents complete)
write meta.json to draft folder (topic, idea-id, agent outputs, creation timestamp)
notify Robin: "Draft ready for [topic]. Run /approve-and-schedule to review."
```

### Approval and Publishing

```
Robin: /approve-and-schedule [draft-id]
  ↓
skill reads draft folder contents
presents each platform's content for review:
  - LinkedIn post copy (+ carousel HTML preview if generated)
  - TikTok EN 6 captions + 6 selected photo descriptions
  - TikTok DE 6 captions
  - Instagram (same as TikTok EN)

Robin: approves / requests edits per platform
  ↓ (on full approval)
postiz skill:
  ├── upload slide images via POST /public/v1/media (TikTok EN, DE, Instagram)
  ├── create scheduled posts via POST /public/v1/posts with target datetime
  └── return post IDs

write approved.json with Postiz post IDs + scheduled times
update ideas.json status → SCHEDULED
```

### Performance Check (6:00 PM Cron)

```
cron trigger
  ↓
/perf-check skill
  ├── GET /public/v1/posts (last 48h) → collect post IDs
  ├── GET /public/v1/analytics/post/{id} per post → views, likes, comments
  └── GET /public/v1/analytics/{integrationId} → platform-level trends
  ↓
cross-reference post IDs with approved.json (find topic + format for each post)
calculate performance vs thresholds (active-rules.json):
  - 100K+ views → weight +5.0 for that hook/format
  - 50K-100K → weight +2.0
  - 10K-50K → weight +0.5
  - <10K → weight -1.0
  - <3K (after 7 days) → retire pattern
  ↓
write updated weights to active-rules.json
append to perf-log.json
produce daily summary: "Top performer: [topic] [views]. Rule updates: [n changes]."
```

## Scaling Considerations

This is a single-operator CLI system. Traditional user-scale thinking does not apply. Constraints are:
- API rate limits (Postiz, supadata, apify, Gemini)
- Claude Code context window (long orchestration sessions can hit limits)
- Parallelization budget (how many agents can run concurrently)

| Concern | Current Scale (4 posts/day) | Future Scale (8+ posts/day) |
|---------|----------------------------|-----------------------------|
| Context length | Each skill invocation is a fresh context — no problem | Orchestration skills with large idea backlogs may need pagination |
| API rate limits | supadata/apify have free tier limits — may need paid tiers | Upgrade tiers; add retry/backoff logic to pulse skill |
| Agent parallelization | 3 parallel agents per /create-set is fine | Cap at 4-5 parallel agents; Claude Code handles this natively |
| Photo library growth | catalog.json is readable at <1000 photos | Above 500 photos, consider splitting catalog by theme |
| Slide rendering | Larry pipeline renders locally — fast | No scaling concern; local Node.js is not a bottleneck |

## Anti-Patterns

### Anti-Pattern 1: Monolithic Master Skill

**What people do:** Put all pipeline logic (pulse + generation + approval + scheduling) into a single skill file.

**Why it's wrong:** Context windows get exhausted mid-task. Debugging is impossible. Skills can't be independently improved or replaced. The humanizer can't be called cleanly from within a 2000-line skill.

**Do this instead:** Thin orchestrators that call specialist skills as subagents. Each specialist skill owns one domain and does it well. The orchestrator only handles sequencing and state transitions.

### Anti-Pattern 2: Vision API for Photo Selection

**What people do:** Pass photo thumbnails to the AI model to select the "best" image for each slide.

**Why it's wrong:** Vision calls are expensive and slow. The existing tiktok-slideshows skill already solved this correctly: maintain a text-description catalog (`catalog.json`) and select photos by semantic text matching. No vision API needed at selection time.

**Do this instead:** Keep catalog.json updated with rich text descriptions when photos are added (a one-time cost). Query by description at selection time.

### Anti-Pattern 3: Scheduled Publishing via Postiz API

**What people do:** Have the system fully automate publishing — generate, approve, post, all without manual steps.

**Why it's wrong:** TikTok's algorithm detects and penalizes scheduled posts. The Larry pipeline explicitly documents this as a retired pattern with evidence. Additionally, Robin wants manual approval on all posts.

**Do this instead:** Post to Postiz as drafts (privacy: SELF_ONLY for TikTok). Robin adds trending music and publishes manually from the app. LinkedIn and Instagram can be scheduled via Postiz; TikTok must be manual.

### Anti-Pattern 4: Rebuilding What Exists

**What people do:** Write new skills for capabilities that existing skills already have.

**Why it's wrong:** The humanizer, tiktok-slideshows, linkedin, postiz, supadata, apify, and nano-banana skills are already mature. Duplicating their logic creates drift and maintenance burden.

**Do this instead:** The missing piece is orchestration — daily-pulse, create-set, approve-and-schedule. Build those. Call existing skills as subagents or via Skill() invocations.

### Anti-Pattern 5: Inventing Robin's Voice

**What people do:** Prompt the AI to "write in a casual, authentic voice" without grounding it in real samples.

**Why it's wrong:** Generic "casual voice" prompts produce AI-isms. Robin has a very specific voice (LinkedIn: direct, slightly formal but real; TikTok: "brooo", "bruh" energy, mostly lowercase). This must be calibrated from actual writing samples.

**Do this instead:** Build a voice-profile/ directory with Robin's real LinkedIn posts and TikTok captions. The humanizer skill already supports voice calibration from samples — use it.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Postiz** | REST API via `postiz` skill (CLI wraps API) | Primary publishing sink + analytics source. `POSTIZ_API_URL` env var required. Use for all platforms except TikTok scheduling (manual only). |
| **supadata** | curl to `https://api.supadata.ai/` via `supadata` skill | `SUPADATA_TOKEN` env var. 1 credit per transcript. Rate limited on free tier — monitor during daily pulse. |
| **Apify** | `apify-ultimate-scraper` skill | 55+ actors. Use for X/Twitter, Reddit, changelog scraping. |
| **Gemini (Nano Banana)** | Python direct API via `nano-banana` skill | `GEMINI_API_KEY` env var. Use `gemini-2.5-flash-image` for speed. Fallback only — real photos preferred. |
| **NotebookLM** | `notebooklm` skill | For LinkedIn authority content that needs deep synthesis. |
| **yt-search** | Global command (already installed) | YouTube search. Feeds daily pulse. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **daily-pulse → idea-backlog** | Writes `data/idea-backlog/ideas.json` | Append-only during pulse; scout-ideas reads and updates status |
| **scout-ideas → create-set** | Idea ID passed as argument; both read same JSON file | Status field is the handoff contract |
| **create-set → linkedin skill** | Skill() invocation with topic context | linkedin writes to draft folder path it receives |
| **create-set → tiktok-slideshows** | Skill() invocation with idea + target path | Returns 6 captions + photo-selections.json |
| **tiktok-slideshows → humanizer** | Skill(humanizer *) invocation inside tiktok-slideshows | Already supported by tiktok-slideshows skill |
| **linkedin → humanizer** | allowed-tools: Skill(humanizer *) in linkedin SKILL.md | Already wired |
| **tiktok-slideshows → Larry pipeline** | `node scripts/generate-slides.js` via Bash | Larry handles canvas rendering; tiktok-slideshows handles content logic |
| **approve-and-schedule → postiz** | Skill() invocation | Postiz handles media upload + scheduling |
| **perf-check → postiz** | Skill() invocation for analytics GET calls | Returns raw analytics; perf-check applies rule weights |
| **perf-check → active-rules.json** | Direct file write | Shared with tiktok-slideshows which reads this file for hook weighting |

## Suggested Build Order

Dependencies determine order. The data layer and voice profile must exist before generation skills can produce quality output.

```
Phase 1 — Foundation
  1a. Unify data directory (create data/ structure, migrate tiktok-slideshows data files)
  1b. Build voice profile (collect Robin's posts, run humanizer calibration)
  1c. Wire Larry pipeline into tiktok-slideshows (currently separate)
  → Existing skills now have shared state to read/write

Phase 2 — Pulse (Automated Discovery)
  2a. Build /daily-pulse skill (supadata + apify + yt-search orchestration)
  2b. Build /scout-ideas skill (review UI over ideas.json)
  → Idea backlog starts populating

Phase 3 — Generation (Content Set Creation)
  3a. Build /create-set skill (parallel agent orchestration)
  3b. Extend linkedin skill to write to draft folder path (minor change)
  3c. Add TikTok DE mode to tiktok-slideshows (translation pass)
  → Full content sets are producible from a single command

Phase 4 — Publishing (Approval Gate + Scheduling)
  4a. Build /approve-and-schedule skill
  4b. Integrate postiz for LinkedIn + Instagram scheduling
  → Full pipeline end-to-end

Phase 5 — Analytics Loop (Feedback)
  5a. Build /perf-check cron skill
  5b. Wire rule weight updates from perf-check to active-rules.json
  → System starts learning and improving
```

## Sources

- Direct inspection of existing skills: tiktok-slideshows, linkedin, humanizer, postiz, supadata, nano-banana, apify-ultimate-scraper, notebooklm
- Direct inspection of Larry 1.0.0 pipeline (scripts/, references/analytics-loop.md, references/slide-structure.md)
- PROJECT.md requirements and constraints
- tiktok-slideshows/references/performance-rules.md (weighted rule system, retired patterns including scheduled publishing)
- tiktok-slideshows/references/automation-workflow.md (cron patterns, content mix strategy)
- Larry 1.0.0/references/analytics-loop.md (Postiz analytics API, feedback loop design)
- linkedin/references/slide-template.md (HTML carousel generation approach)
- Jens Heitmann pipeline reference (content radar → creator pack → viral generation pattern)
- Instagram carousel creator reference (research → image sourcing → Python rendering pattern)

---
*Architecture research for: Claude Code CLI content automation pipeline*
*Researched: 2026-04-08*
