# Project Research Summary

**Project:** Content Workflow — Claude Code-Native Personal Brand Automation Pipeline
**Domain:** AI/tech thought leadership content automation (LinkedIn, TikTok EN/DE, Instagram)
**Researched:** 2026-04-08
**Confidence:** HIGH

## Executive Summary

The technology stack is already largely in place — 8+ mature specialist skills, the Larry 1.0.0 slide pipeline, and the tiktok-slideshows cron infrastructure all exist. The missing piece is orchestration: daily-pulse, create-set, scout-ideas, approve-and-schedule, and perf-check skills that tie the existing components into a cohesive end-to-end pipeline.

The recommended architecture is an orchestrator-specialist pattern with JSON-file state across pipeline stages. No database needed beyond better-sqlite3 for the idea backlog. All scheduling runs via Postiz; all content generation and approval runs inside Claude Code via slash commands and subagent invocations.

## Key Findings

### Stack

- **Node.js 20+** with `canvas` (node-canvas 2.x), `sharp` (0.34.5), `@anthropic-ai/sdk` (0.85.0), `@postiz/node` (1.0.8)
- **Larry pipeline stays as-is:** `generate-slides.js` + `add-text-overlay.js` (node-canvas), `gpt-image-1.5` for AI images (NOT gpt-image-1)
- **Python Playwright** for LinkedIn HTML→slide rendering (already working in linkedin skill)
- **better-sqlite3** for idea backlog (JSON files collapse past ~1K rows)
- **node-cron** for automated pulse (6 AM) and perf-check (6 PM)
- **p-limit must stay v4.x** (v5+ is ESM-only, Larry uses CommonJS)

### Table Stakes Features

- Daily content pulse (automated scraping via Apify + supadata + yt-search)
- Idea backlog with persistent storage
- Morning batch review workflow (scout-ideas CLI)
- Voice profile from Robin's real posts (50+ samples, platform-differentiated)
- Platform-native draft generation (LinkedIn + TikTok EN/DE + Instagram)
- Humanizer pass on all AI outputs
- Larry pipeline for slide generation
- Manual approval gate before any post publishes
- Postiz scheduling across all channels

### Critical Pitfalls

1. **Voice drift** — LinkedIn 360Brew detects AI content (94% accuracy, 30% reach reduction). Prevention: voice profile from 50+ real posts with anti-patterns.
2. **TikTok API audit trap** — unaudited apps force posts to private. Prevention: Postiz exclusively, verify with live test post in Phase 1.
3. **LinkedIn Partner Program wall** — direct API blocked for indie apps. Prevention: Postiz only.
4. **Claude context overflow** — quality degrades after 2-3 items in long batch sessions. Prevention: isolated subagent per content piece.
5. **Vanity metric feedback loop** — optimizing for impressions drifts from consulting inbound goals. Prevention: define business metrics before building analytics.
6. **German localization** — Claude alone underperforms EN→DE. Prevention: DeepL translation + Claude tone adaptation.

### Architecture

Four-layer orchestrator-specialist pattern:
1. **Automation Layer** — cron-triggered skills (daily-pulse, perf-check)
2. **Orchestration Layer** — manual skills (scout-ideas, create-set, approve-and-schedule)
3. **Specialist Layer** — existing mature skills (humanizer, linkedin, tiktok-slideshows, postiz, etc.)
4. **Data Layer** — JSON files in `data/` directory

### Suggested Build Order

1. **Foundation** — data directory + voice profile + Larry wire-in + TikTok public post verification
2. **Pulse** — daily-pulse cron + scout-ideas review
3. **Generation (English)** — create-set orchestration + all EN platform drafts + humanizer
4. **Publishing** — approve-and-schedule + Postiz scheduling
5. **German Localization** — DeepL + Claude tone pass + DE voice profile
6. **Analytics Loop** — perf-check cron + weight updates (needs 2-4 weeks of live data)

## Open Questions

- Postiz TikTok audit status must be verified empirically (Phase 1 gate)
- Does Robin have 50+ existing posts for voice profile, or supplement with admired accounts?
- German-speaking reviewer available for first localization batch?
- Postiz free-tier analytics granularity for profile-visit data?

## Sources

### Primary (HIGH)
- Direct inspection: Larry 1.0.0/scripts/, all 10 existing skills
- Postiz Public API docs, @anthropic-ai/sdk npm (v0.85.0), @postiz/node npm (v1.0.8)
- TikTok Content Posting API audit docs (SELF_ONLY mode for unaudited apps)

### Secondary (MEDIUM)
- LinkedIn Algorithm 2026 (SocialBee) — 360Brew AI detection
- Claude translation benchmarks (getblend.com) — German underperformance
- Social Media API Rules 2026 (Postproxy)

---
*Research completed: 2026-04-08*
*Ready for roadmap: yes*
