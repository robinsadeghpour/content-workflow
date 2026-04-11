# Content Workflow

## What This Is

A Claude Code-native content automation system that handles the full pipeline from idea discovery to scheduled publishing across LinkedIn, TikTok (EN + DE), and Instagram. Built with skills, agents, and cron automation to let Robin review and approve content in a single morning batch while the system handles research, drafting, media generation, and scheduling via Postiz.

## Core Value

One morning session turns a curated idea backlog into platform-native content scheduled across all channels — no context-switching, no manual formatting, no copy-pasting between tools.

## Requirements

### Validated

- [x] TikTok/Instagram slideshow generation (merged Larry pipeline + tiktok-slideshows skill): hook slide, content slides, CTA slide — Validated in Phase 3: content-generation
- [x] TikTok English + German localization from single English master — Validated in Phase 3: content-generation
- [x] LinkedIn content in multiple formats: PDF slides, standalone text, infographics, personal posts — Validated in Phase 3: content-generation
- [x] Photo library with text descriptions for AI image selection without vision calls — Validated in Phase 3: content-generation
- [x] AI image generation (Nano Banana / Gemini) as fallback when no real visuals available — Validated in Phase 3: content-generation
- [x] Humanizer pass on all AI-generated content to match Robin's voice — Validated in Phase 3: content-generation (critic agent with voice scoring)
- [x] Scheduling and publishing via Postiz across all platforms — Validated in Phase 4: publishing-analytics
- [x] End-of-day performance check based on impressions — Validated in Phase 4: publishing-analytics
- [x] Performance feedback loop: adjust topic/format weighting based on results — Validated in Phase 4: publishing-analytics
- [x] Manual approval required before any post goes live — Validated in Phase 4: publishing-analytics
- [x] Draft review shows humanizer diff (before/after) per-platform — Validated in Phase 4: publishing-analytics (gap closure)

### Active

- [ ] Automated daily content pulse that scrapes YouTube, web, changelogs, X, TikTok for trending AI/tech topics
- [ ] Idea backlog where pulse results accumulate for review
- [ ] Morning batch workflow: review ideas, select topics, approve drafts, schedule posts
- [ ] Voice profile built from Robin's existing posts + admired accounts
- [ ] LinkedIn slides use Robin's template with real logos/screenshots/product visuals

### Out of Scope

- Fully autonomous publishing — Robin approves everything in v1
- Video content (reels, talking head) — slideshows and static formats only
- Paid ad creation or management — organic content only
- Real-time chat or community management automation
- Mobile app — CLI-first workflow
- Multi-user support — Robin is the sole operator

## Context

**Business context:** Robin is building personal brand authority in AI & Tech to generate inbound for 11x Agency (Berlin-based AI automation consulting). Target audience: developers, founders, AI enthusiasts who know Claude Code, Codex, etc.

**Existing assets:**
- `Larry 1.0.0` — battle-tested Node.js slide generation system with text overlays, analytics, and revenue attribution (merged into `generate-content` orchestrator in Phase 3)
- `humanizer` skill — 29 documented AI patterns to strip, voice calibration from samples
- `postiz` skill — scheduling to 28+ platforms with analytics
- `supadata` skill — YouTube/TikTok/Instagram transcript extraction + web scraping
- `apify-ultimate-scraper` skill — 55+ scraping actors for social media and web
- `yt-search` — YouTube search integration
- `nano-banana` skill — Gemini-based image generation

**Inspiration:**
- Jens Heitmann's pipeline: content radar pulse → creator pack validation → viral content generation
- Instagram carousel creator: research → image sourcing → Python/Pillow slide rendering with profile overlays

**Platform posting cadence:** 1 post/day each for LinkedIn, TikTok EN, TikTok DE, Instagram (4 total, content repurposed across platforms).

**Content flow:** Same core information adapted per platform — TikTok + Instagram share identical slideshow format, LinkedIn gets its own native format (varies by content type).

## Constraints

- **Tech stack**: Claude Code skills + agents as primary architecture, Node.js scripts where needed (Larry pipeline)
- **Publishing**: All scheduling through Postiz API
- **Language**: English master content, German localization for TikTok DE only
- **Human-in-the-loop**: No post publishes without Robin's explicit approval
- **Voice**: Must sound authentically Robin — LinkedIn slightly formal but real, TikTok/Instagram casual ("brooo", "bruh" energy)
- **Media priority**: Real visuals (logos, screenshots, product images) preferred over AI-generated imagery

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Merge Larry 1.0.0 + tiktok-slideshows | Larry has superior slide generation pipeline; tiktok-slideshows has cron automation + learning loop | Resolved 2026-04-11 — slide generation reimplemented inside the `generate-content` orchestrator (Phase 3); standalone `tiktok-slideshows` skill removed |
| CLI-first interaction model | Robin works in Claude Code daily, no need for separate UI | -- Pending |
| Automated daily pulse (not on-demand) | Consistent idea flow without manual triggers | -- Pending |
| Morning batch review workflow | Concentrated decision-making, no context-switching throughout the day | -- Pending |
| Voice profile from scraped posts | More authentic than defining from scratch — captures real patterns | -- Pending |
| Postiz as publishing backbone | Already integrated, supports all target platforms + analytics | -- Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-09 after Phase 4 (Publishing & Analytics) completion — approval gate, Postiz scheduling, performance feedback loop, and humanizer diff all operational*
