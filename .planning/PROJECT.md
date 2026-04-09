# Content Workflow

## What This Is

A Claude Code-native content automation system that handles the full pipeline from idea discovery to scheduled publishing across LinkedIn, TikTok (EN + DE), and Instagram. Built with skills, agents, and cron automation to let Robin review and approve content in a single morning batch while the system handles research, drafting, media generation, and scheduling via Postiz.

## Core Value

One morning session turns a curated idea backlog into platform-native content scheduled across all channels — no context-switching, no manual formatting, no copy-pasting between tools.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Automated daily content pulse that scrapes YouTube, web, changelogs, X, TikTok for trending AI/tech topics
- [ ] Idea backlog where pulse results accumulate for review
- [ ] Morning batch workflow: review ideas, select topics, approve drafts, schedule posts
- [ ] Voice profile built from Robin's existing posts + admired accounts
- [ ] Humanizer pass on all AI-generated content to match Robin's voice
- [ ] TikTok/Instagram slideshow generation (merged Larry pipeline + tiktok-slideshows skill): hook slide, content slides, CTA slide
- [ ] TikTok English + German localization from single English master
- [ ] LinkedIn content in multiple formats: PDF slides, standalone text, infographics, personal posts
- [ ] LinkedIn slides use Robin's template with real logos/screenshots/product visuals
- [ ] Photo library with text descriptions for AI image selection without vision calls
- [ ] AI image generation (Nano Banana / Gemini) as fallback when no real visuals available
- [ ] Scheduling and publishing via Postiz across all platforms
- [ ] End-of-day performance check based on impressions
- [ ] Performance feedback loop: adjust topic/format weighting based on results
- [ ] Manual approval required before any post goes live

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
- `tiktok-slideshows` skill — mature cron-based TikTok automation with photo library, performance tracking, learning loop
- `Larry 1.0.0` — battle-tested Node.js slide generation system with text overlays, analytics, and revenue attribution
- `linkedin` skill — working pipeline with browse/card/topic modes, slide + infographic generation
- `humanizer` skill — 29 documented AI patterns to strip, voice calibration from samples
- `postiz` skill — scheduling to 28+ platforms with analytics
- `supadata` skill — YouTube/TikTok/Instagram transcript extraction + web scraping
- `apify-ultimate-scraper` skill — 55+ scraping actors for social media and web
- `yt-search` — YouTube search integration
- `nano-banana` skill — Gemini-based image generation
- `notebooklm` skill — podcast/content generation from sources

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
| Merge Larry 1.0.0 + tiktok-slideshows | Larry has superior slide generation pipeline; tiktok-slideshows has cron automation + learning loop | -- Pending |
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
*Last updated: 2026-04-09 after Phase 2 (Discovery Pipeline) completion — pulse scraping, scoring, dedup, transcripts, and interactive /review all operational*
