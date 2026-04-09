# Phase 3: Content Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 03-content-generation
**Areas discussed:** Slide pipeline strategy, LinkedIn format routing, German localization, Critic agent design

---

## Slide Pipeline Strategy

### Pipeline approach for TikTok/Instagram

| Option | Description | Selected |
|--------|-------------|----------|
| Photo-first | Real photos from catalog + text overlays via node-canvas. AI gen only as fallback. | |
| AI-generated slides | OpenAI gpt-image-1.5 generates custom slide images per topic. | |
| HTML→screenshot | Extend LinkedIn Playwright pipeline to TikTok/Instagram. | |

**User's choice:** All three, routed by topic/content type. Photo-first is primary, AI-generated when no photos fit, HTML→screenshot for LinkedIn only (not TikTok/Instagram).
**Notes:** Robin clarified this is a routing decision, not a single pipeline choice.

### LinkedIn pipeline separation

| Option | Description | Selected |
|--------|-------------|----------|
| Keep separate | LinkedIn keeps Playwright, TikTok/Instagram uses photo+overlay. | ✓ |
| Unify everything | Single rendering pipeline for all platforms. | |

**User's choice:** Keep separate
**Notes:** None

### Visual approach routing

| Option | Description | Selected |
|--------|-------------|----------|
| Robin picks during review | Robin chooses 'use photos' or 'generate visuals' at KEEP time. | ✓ |
| Auto-detect + override | System checks catalog, falls back to AI. Robin can override. | |
| Always photo-first | Always start with catalog, AI only on explicit request. | |

**User's choice:** Robin picks during review
**Notes:** None

### Slide structure

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 6-slide arc | Hook → 4 content → CTA. Consistent, proven format. | |
| Flexible per topic | Slide count and structure varies by content type. | ✓ |

**User's choice:** Flexible per topic
**Notes:** None

### Text rendering on slides

| Option | Description | Selected |
|--------|-------------|----------|
| node-canvas overlay | Larry's add-text-overlay.js pattern. Battle-tested. | ✓ |
| Sharp composite | Render text as transparent PNG, composite with sharp. | |
| Upload plain photos | Skip text overlays, add captions manually in TikTok app. | |

**User's choice:** node-canvas overlay
**Notes:** None

---

## LinkedIn Format Routing

### Format selection method

| Option | Description | Selected |
|--------|-------------|----------|
| Robin picks at KEEP time | Manual format tagging during review. | |
| Auto-suggest + override | Heuristic suggestion, Robin can override during approval. | ✓ |
| Claude decides | Claude picks format, Robin sees result during approval. | |

**User's choice:** Auto-suggest + override
**Notes:** None

### Template strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Single branded template | One template with Robin's branding. Consistent identity. | ✓ |
| Multiple templates | 2-3 variations for visual variety. | |
| You decide | Claude's discretion. | |

**User's choice:** Single branded template
**Notes:** None

### Infographic visual approach

| Option | Description | Selected |
|--------|-------------|----------|
| HTML→Playwright screenshot | Claude generates HTML infographic, Playwright screenshots. | |
| AI image generation | Nano Banana/Gemini generates infographic as image. | ✓ |
| You decide | Claude's discretion per topic. | |

**User's choice:** AI image generation
**Notes:** None

---

## German Localization

### EN→DE approach

| Option | Description | Selected |
|--------|-------------|----------|
| Claude-only with tone prompt | Claude translates + adapts in one pass using voice-casual.xml. | ✓ |
| DeepL + Claude tone pass | DeepL translates, Claude rewrites for tone. | |
| Claude localization (not translation) | Create German version from scratch with same core message. | |

**User's choice:** Claude-only with tone prompt
**Notes:** None

### German slide text

| Option | Description | Selected |
|--------|-------------|----------|
| German text overlays | Re-render slides with German text via node-canvas. Same visuals. | ✓ |
| English slides + DE caption | Reuse English slide images, German in caption only. | |

**User's choice:** German text overlays
**Notes:** None

---

## Critic Agent Design

### Rejection handling

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-revise + re-check | Critic feedback → revision → re-check, up to 2-3 loops. | ✓ |
| Flag for Robin with notes | Pass draft + critique to Robin for decision. | |
| Auto-revise once, then flag | One revision attempt, then flag if still fails. | |

**User's choice:** Auto-revise + re-check
**Notes:** None

### Critic scope

| Option | Description | Selected |
|--------|-------------|----------|
| Voice authenticity | Check against platform voice profile. | ✓ |
| Brand alignment | On-brand positioning, no off-topic content. | |
| Slide quality | Hook strength, readability, safe zones, visual consistency. | ✓ |
| Factual accuracy | Cross-check claims against source material. | ✓ |

**User's choice:** Voice authenticity, Slide quality, Factual accuracy (multiselect)
**Notes:** Brand alignment not selected as separate check — implicitly covered by voice authenticity.

### Critic architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Separate subagent | Critic runs as own Claude Task after generation. Fresh context. | ✓ |
| Same agent, second pass | Generation agent self-reviews. Faster but potential blind spots. | |
| You decide | Claude's discretion on architecture. | |

**User's choice:** Separate subagent
**Notes:** None

---

## Claude's Discretion

- LinkedIn format auto-suggestion heuristics
- Slide count ranges per content type
- Critic scoring rubric and thresholds
- Photo catalog matching logic
- Node-canvas layout details (fonts, positioning, safe zones)
- German tone prompt design

## Deferred Ideas

None — discussion stayed within phase scope
