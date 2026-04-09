# Roadmap: Content Workflow

## Overview

Four phases turn a collection of mature specialist skills into a cohesive end-to-end pipeline. Phase 1 wires up the infrastructure and voice profile so every downstream phase has a stable foundation and authentic output. Phase 2 builds the automated discovery and morning review loop. Phase 3 assembles the full content generation layer — TikTok/Instagram slideshows, LinkedIn formats, German localization, and the critic agent. Phase 4 closes the loop with publishing approval, Postiz scheduling across all channels, and the performance feedback cycle.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Voice** - Infrastructure skeleton, data directory, CLI scaffolding, and Robin's voice profile (completed 2026-04-09)
- [x] **Phase 2: Discovery Pipeline** - Daily pulse cron, idea backlog, and morning batch review workflow (completed 2026-04-09)
- [x] **Phase 3: Content Generation** - TikTok/Instagram slideshows, LinkedIn formats, German localization, and critic agent (completed 2026-04-09)
- [x] **Phase 4: Publishing & Analytics** - Approval gate, Postiz scheduling across all platforms, and performance feedback loop (completed 2026-04-09)

## Phase Details

### Phase 1: Foundation & Voice
**Goal**: The project infrastructure is in place and every AI-generated draft can be filtered through Robin's authentic voice
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, VOIC-01, VOIC-02, VOIC-03
**Success Criteria** (what must be TRUE):
  1. A unified `data/` directory exists and all pipeline state (ideas, drafts, performance) writes there without conflicts
  2. All pipeline interactions are accessible via Claude Code CLI slash commands with no manual file navigation required
  3. Subagent invocations can run in parallel (multiple platform drafts simultaneously without blocking)
  4. The cron skeleton is registered and fires at configured times (6 AM pulse, 6 PM perf-check)
  5. A voice profile built from 50+ real Robin posts exists per platform — LinkedIn formal-authentic, TikTok/Instagram casual — and the humanizer correctly applies it to a sample AI-generated draft
**Plans:** 3/3 plans complete

Plans:
- [x] 01-01-PLAN.md — Project infrastructure: package.json, data/ directory, SQLite schema
- [x] 01-02-PLAN.md — CLI stub skills (/pulse, /review) and cron schedule documentation
- [x] 01-03-PLAN.md — Voice profiles from Robin's posts and /writing skill with humanizer orchestration

### Phase 2: Discovery Pipeline
**Goal**: Topics flow automatically into a managed backlog and Robin can review and prioritize them in a single morning CLI session
**Depends on**: Phase 1
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04
**Success Criteria** (what must be TRUE):
  1. The daily-pulse cron runs automatically and populates the backlog with scored, deduplicated AI/tech topics from YouTube, X, TikTok, web, and changelogs
  2. Robin can run a single CLI command in the morning and see the top ideas with KEEP/SKIP/STAR decisions — no manual file editing required
  3. Transcript extraction from YouTube and TikTok URLs works and the output is available for content generation
  4. The backlog persists correctly across days with no duplicate topics appearing in review
**Plans:** 2/2 plans complete

Plans:
- [x] 02-01-PLAN.md — Pulse discovery pipeline: source scrapers, scoring, dedup, transcripts, markdown review generation
- [x] 02-02-PLAN.md — Interactive /review skill with KEEP/SKIP/STAR decision workflow

### Phase 3: Content Generation
**Goal**: A selected topic produces platform-native draft content for all four channels (TikTok EN, TikTok DE, Instagram, LinkedIn) with Robin's voice applied and a critic review completed
**Depends on**: Phase 2
**Requirements**: TIKT-01, TIKT-02, TIKT-03, TIKT-04, TIKT-05, TIKT-06, TIKT-07, LINK-01, LINK-02, LINK-03, LINK-04, VOIC-04
**Success Criteria** (what must be TRUE):
  1. A TikTok/Instagram slideshow (hook → content slides → CTA) renders with correct text overlays, safe zones, and real visuals sourced from the photo library or AI generation fallback
  2. TikTok EN content is ready to publish and TikTok DE is a properly localized version of the same master (not a direct translation — tone-adapted)
  3. Instagram carousel reuses the TikTok slide format with no extra production step
  4. LinkedIn produces the correct format for the content type: PDF slide carousel using Robin's template for tutorial/listicle topics, standalone text for opinion/hot-take topics, infographic for data topics, personal post for founder notes
  5. A critic agent has reviewed every draft for voice authenticity and brand alignment before Robin sees it — Robin reviews critic-approved drafts only
**Plans:** 4/4 plans complete

Plans:
- [x] 03-01-PLAN.md — Foundation: install canvas+sharp, migrate drafts schema, create TikTok slide renderer and AI slide generator
- [x] 03-02-PLAN.md — LinkedIn content pipeline: 4-format routing (carousel/text/infographic/personal)
- [x] 03-03-PLAN.md — Content orchestrator: Claude API generation for all platforms, German localization, Instagram crop
- [x] 03-04-PLAN.md — Critic agent with auto-revise loop, /generate-content skill, /review visual approach capture

### Phase 4: Publishing & Analytics
**Goal**: Approved content reaches all platforms via Postiz on schedule, and daily performance data feeds back into the discovery weighting so the system improves over time
**Depends on**: Phase 3
**Requirements**: PUBL-01, PUBL-02, PUBL-03, PUBL-04, PUBL-05, ANLY-01, ANLY-02, ANLY-03
**Success Criteria** (what must be TRUE):
  1. No post can reach Postiz scheduling without Robin's explicit approval — rejected drafts stay in draft state
  2. Approved posts are scheduled to LinkedIn, TikTok EN, TikTok DE, and Instagram via Postiz with correct timing
  3. Robin can see a per-platform review of content with humanizer diff (before/after voice pass) before approving
  4. The end-of-day perf-check cron pulls impression data from Postiz and persists it to performance history
  5. Topic and format weighting in the discovery layer updates based on performance results — high-performing topics surface more often
**Plans:** 3/3 plans complete

Plans:
- [x] 04-01-PLAN.md — Approval gate + Postiz scheduling across all platforms
- [x] 04-02-PLAN.md — Analytics feedback loop: perf-check cron, performance weights, scorer integration
- [x] 04-03-PLAN.md — Gap closure: humanizer diff (before/after voice pass) in approval review (PUBL-05)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Voice | 3/3 | Complete   | 2026-04-09 |
| 2. Discovery Pipeline | 2/2 | Complete   | 2026-04-09 |
| 3. Content Generation | 4/4 | Complete   | 2026-04-09 |
| 4. Publishing & Analytics | 3/3 | Complete   | 2026-04-09 |
