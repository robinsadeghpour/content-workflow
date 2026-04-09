# Requirements: Content Workflow

**Defined:** 2026-04-08
**Core Value:** One morning session turns a curated idea backlog into platform-native content scheduled across all channels

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Discovery

- [x] **DISC-01**: Automated daily pulse scrapes YouTube, X, TikTok, web, changelogs for trending AI/tech topics via cron
- [x] **DISC-02**: Idea backlog persists discovered topics with scoring and deduplication
- [x] **DISC-03**: Morning batch review presents top ideas for KEEP/SKIP/STAR decisions via CLI
- [x] **DISC-04**: Transcript extraction from YouTube and TikTok videos for content repurposing via Supadata

### Voice & Brand

- [ ] **VOIC-01**: Voice profile built from Robin's existing posts (50+ samples) + admired accounts, platform-differentiated
- [ ] **VOIC-02**: Humanizer pass strips AI patterns and applies Robin's voice to every draft
- [ ] **VOIC-03**: Platform tone split — LinkedIn formal-authentic vs TikTok/Instagram casual
- [ ] **VOIC-04**: Critic agent reviews every draft for quality, authenticity, and brand alignment before user review

### Content Generation — TikTok/Instagram

- [ ] **TIKT-01**: Slideshow generation using merged Larry + tiktok-slideshows pipeline (hook → content → CTA)
- [ ] **TIKT-02**: Text overlay rendering on slide images with proper safe zones and formatting
- [ ] **TIKT-03**: Photo library with text descriptions for AI image selection without vision calls
- [ ] **TIKT-04**: AI image generation fallback via Nano Banana / Gemini when no real visuals available
- [ ] **TIKT-05**: TikTok English master content published to EN account
- [ ] **TIKT-06**: TikTok German localization from English master for DE account
- [ ] **TIKT-07**: Instagram carousel/slideshow reuses TikTok slide format

### Content Generation — LinkedIn

- [ ] **LINK-01**: PDF slide carousel posts using Robin's template with real logos/screenshots
- [ ] **LINK-02**: Standalone text-only posts
- [ ] **LINK-03**: Infographic posts with data/insights visualizations
- [ ] **LINK-04**: Personal posts from rough user notes refined into polished posts with optional image

### Publishing

- [ ] **PUBL-01**: Manual approval gate — nothing publishes without Robin's explicit sign-off
- [ ] **PUBL-02**: Postiz scheduling for LinkedIn posts
- [ ] **PUBL-03**: Postiz scheduling for TikTok EN + DE posts
- [ ] **PUBL-04**: Postiz scheduling for Instagram posts
- [ ] **PUBL-05**: Draft review shows content per-platform with humanizer diff

### Analytics & Feedback

- [ ] **ANLY-01**: End-of-day performance check pulls impressions from Postiz analytics
- [ ] **ANLY-02**: Performance feedback loop adjusts topic/format weighting based on results
- [ ] **ANLY-03**: Performance history persisted for trend analysis

### Infrastructure

- [x] **INFR-01**: Unified data directory structure for all pipeline state (ideas, drafts, performance)
- [x] **INFR-02**: All interaction via Claude Code CLI slash commands
- [x] **INFR-03**: Parallel subagent execution for multi-platform content generation
- [x] **INFR-04**: Cron automation for daily pulse and performance checks

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Discovery

- **DISC-05**: Creator pack validation (Jens Heitmann-style — analyze how other creators performed on same topic)
- **DISC-06**: Content radar with cross-platform insight correlation

### Advanced Analytics

- **ANLY-04**: Business-goal metric tracking (profile visits, DM volume, not just impressions)
- **ANLY-05**: Revenue attribution connecting posts to inbound client opportunities

### Content Expansion

- **CONT-01**: Video content support (reels, talking head)
- **CONT-02**: Newsletter/blog output from social content
- **CONT-03**: Lead magnet generation from high-performing topics

### Platform Expansion

- **PLAT-01**: Instagram German localization
- **PLAT-02**: X/Twitter integration

## Out of Scope

| Feature | Reason |
|---------|--------|
| Fully autonomous publishing | Single bad post damages months of brand trust; 15-30 min/day approval is acceptable |
| Video content (reels, talking head) | Different production complexity; slideshows perform well for AI/tech topics |
| Web dashboard or mobile app | Robin works in Claude Code; separate UI doubles maintenance for no benefit |
| Paid ad management | Completely different domain (budgets, targeting, approval chains) |
| Multi-user/team collaboration | Solo operator system; team features add wasted complexity |
| Engagement/community management automation | Inauthentic at-scale engagement penalized by platforms; personal brand requires real replies |
| A/B split testing | 1 post/day/platform insufficient volume for statistical significance |
| Cross-platform verbatim duplication | Algorithms penalize cross-posts; audiences expect platform-native content |
| Direct LinkedIn/TikTok API | Partner Program blocks indie apps (LinkedIn), audit trap (TikTok) — Postiz only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 1 | Complete |
| INFR-02 | Phase 1 | Complete |
| INFR-03 | Phase 1 | Complete |
| INFR-04 | Phase 1 | Complete |
| VOIC-01 | Phase 1 | Pending |
| VOIC-02 | Phase 1 | Pending |
| VOIC-03 | Phase 1 | Pending |
| DISC-01 | Phase 2 | Complete |
| DISC-02 | Phase 2 | Complete |
| DISC-03 | Phase 2 | Complete |
| DISC-04 | Phase 2 | Complete |
| TIKT-01 | Phase 3 | Pending |
| TIKT-02 | Phase 3 | Pending |
| TIKT-03 | Phase 3 | Pending |
| TIKT-04 | Phase 3 | Pending |
| TIKT-05 | Phase 3 | Pending |
| TIKT-06 | Phase 3 | Pending |
| TIKT-07 | Phase 3 | Pending |
| LINK-01 | Phase 3 | Pending |
| LINK-02 | Phase 3 | Pending |
| LINK-03 | Phase 3 | Pending |
| LINK-04 | Phase 3 | Pending |
| VOIC-04 | Phase 3 | Pending |
| PUBL-01 | Phase 4 | Pending |
| PUBL-02 | Phase 4 | Pending |
| PUBL-03 | Phase 4 | Pending |
| PUBL-04 | Phase 4 | Pending |
| PUBL-05 | Phase 4 | Pending |
| ANLY-01 | Phase 4 | Pending |
| ANLY-02 | Phase 4 | Pending |
| ANLY-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0

---
*Requirements defined: 2026-04-08*
*Last updated: 2026-04-08 after roadmap creation*
