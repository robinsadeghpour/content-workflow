# Phase 3: Content Generation - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

A selected topic produces platform-native draft content for all four channels (TikTok EN, TikTok DE, Instagram, LinkedIn) with Robin's voice applied and a critic review completed. Robin only sees critic-approved drafts.

</domain>

<decisions>
## Implementation Decisions

### Slide Pipeline Strategy
- **D-01:** Three rendering approaches coexist, routed by content type and platform:
  - **Photo-first + node-canvas overlay** — primary for TikTok/Instagram slideshows. Real photos from catalog with text overlays via node-canvas (Larry's `add-text-overlay.js` pattern).
  - **AI-generated slides** — for TikTok/Instagram when topic needs custom visuals and no suitable photos exist. Uses Nano Banana / Gemini (not OpenAI gpt-image-1.5 for slides — that's Larry's legacy).
  - **HTML→Playwright screenshot** — LinkedIn PDF carousels only. Claude writes HTML using Robin's branded template, Playwright renders via `screenshot-slides.py`.
- **D-02:** Robin picks the visual approach (photo-first vs AI-generated) at KEEP time during `/review`. This is an explicit choice per topic, not auto-detected.
- **D-03:** LinkedIn keeps its own separate Playwright pipeline. TikTok/Instagram use photo+overlay pipeline. Two pipelines, each optimized for its platform.
- **D-04:** Slide structure is flexible per content type — not a fixed 6-slide arc. Listicles get numbered slides, stories get narrative flow, hot takes get fewer punchy slides. Slide count adapts to topic.
- **D-05:** Text rendering on TikTok/Instagram slides uses node-canvas overlay (Larry's proven pattern). Handles font sizing, safe zones, text wrapping. Output is final PNG per slide.

### LinkedIn Format Routing
- **D-06:** Auto-suggest format based on content type heuristics (tutorial → carousel, hot take → text, data-heavy → infographic, founder note → personal post). Robin can override during approval.
- **D-07:** Single branded template for LinkedIn PDF carousels — Robin's existing branding (colors, logo, layout from `slide-template.html`). Content varies, chrome stays the same.
- **D-08:** LinkedIn infographic posts use AI image generation (Nano Banana / Gemini), not HTML→screenshot.

### German Localization
- **D-09:** Claude-only localization with tone prompt using `voice-casual.xml` as guidance. No DeepL dependency. Claude translates + adapts in one pass.
- **D-10:** German TikTok slides get their own text overlays rendered in German via node-canvas. Same photos/visuals as EN, different text. Fully native German slideshows.
- **D-11:** Instagram does NOT get a German version — only TikTok EN and TikTok DE per project scope.

### Critic Agent
- **D-12:** Critic runs as a separate Claude subagent (Task) after generation completes. Fresh context, no anchoring bias from generating the draft.
- **D-13:** Critic checks three dimensions: (1) voice authenticity against platform voice profile, (2) slide quality (hook strength, text readability, safe zones, visual consistency), (3) factual accuracy against source material and transcripts.
- **D-14:** On rejection: auto-revise + re-check loop up to 2-3 attempts. Robin only sees drafts that pass critic review.
- **D-15:** Brand alignment is NOT a separate check — voice authenticity implicitly covers on-brand tone.

### Claude's Discretion
- Specific heuristics for LinkedIn format auto-suggestion (what signals trigger each format)
- Slide count ranges per content type (how many slides for a listicle vs hot take)
- Critic scoring rubric and pass/fail thresholds
- Photo catalog matching logic (how to find the best photo for a topic)
- Node-canvas text layout details (font choices, overlay positioning, safe zone margins)
- German tone prompt design (how to instruct Claude for casual German)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Slide Generation
- `Larry 1.0.0/scripts/generate-slides.js` — OpenAI image generation pipeline. Reference for AI slide generation approach.
- `Larry 1.0.0/scripts/add-text-overlay.js` — node-canvas text overlay system. PRIMARY reference for TikTok/Instagram text rendering.
- `Larry 1.0.0/SKILL.md` — Full Larry pipeline architecture (47KB). Batch API, analytics, slide generation patterns.
- `.claude/skills/linkedin/scripts/screenshot-slides.py` — Playwright HTML→screenshot pipeline for LinkedIn PDF carousels.
- `.claude/skills/linkedin/references/slide-template.html` — Robin's branded LinkedIn carousel template.

### TikTok/Instagram
- `.claude/skills/tiktok-slideshows/SKILL.md` — Photo catalog system, hook formulas, 6-slide arc patterns, cron automation.
- `.claude/skills/tiktok-slideshows/references/slidegen-guide.md` — Slide generation guide.
- `.claude/skills/tiktok-slideshows/references/photo-management.md` — Photo catalog and selection strategy.
- `.claude/skills/tiktok-slideshows/assets/photo-catalog-template.json` — Photo catalog schema.

### Voice & Humanizer
- `.claude/skills/writing/SKILL.md` — Voice profile management + humanizer orchestration.
- `.claude/skills/writing/data/voice-linkedin.xml` — LinkedIn formal-authentic voice profile.
- `.claude/skills/writing/data/voice-casual.xml` — TikTok/Instagram casual voice profile (also used for German tone adaptation).
- `.claude/skills/humanizer/SKILL.md` — AI pattern detection + removal, voice calibration.

### Image Generation
- `.claude/skills/nano-banana/SKILL.md` — Gemini-based image generation (fallback for slides, primary for LinkedIn infographics).

### Technology Stack
- `CLAUDE.md` — Full recommended tech stack. Relevant: node-canvas, sharp, Playwright, better-sqlite3, @anthropic-ai/sdk for localization.

### Database
- `data/content.db` — Existing schema with ideas (incl. transcripts), drafts, performance tables.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Larry's add-text-overlay.js**: Battle-tested node-canvas text overlay — font sizing, safe zones, wrapping. Direct reuse for TikTok/Instagram slides.
- **Larry's generate-slides.js**: OpenAI image generation pipeline. Reference pattern (uses gpt-image-1.5).
- **screenshot-slides.py**: Playwright HTML→screenshot for LinkedIn carousels. Already working, keep as-is.
- **slide-template.html**: Robin's branded LinkedIn carousel template. Single template per D-07.
- **tiktok-slideshows photo catalog**: JSON-based photo catalog with text descriptions for AI selection without vision calls.
- **Voice profiles**: `voice-linkedin.xml` and `voice-casual.xml` already built from Robin's posts.
- **Humanizer skill**: 12+ AI pattern categories, voice calibration system.
- **Nano Banana skill**: Gemini image generation — use for AI slide fallback and LinkedIn infographics.

### Established Patterns
- Skills are SKILL.md directories under `.claude/skills/`
- Node.js scripts invoked from skills via bash
- SQLite via better-sqlite3 with WAL mode for concurrent access
- CommonJS module type (package.json `type: commonjs`)
- Claude Code Task tool for parallel subagent execution

### Integration Points
- `data/content.db` drafts table — generation writes drafts, critic reads/updates status, approval reads
- `/review` skill — needs to capture Robin's visual approach choice (photo vs AI) and LinkedIn format override
- Writing skill — orchestrates voice application across all generated content
- Postiz skill — downstream consumer of approved drafts (Phase 4)

</code_context>

<specifics>
## Specific Ideas

- Robin explicitly picks visual approach (photo vs AI-generated) per topic at KEEP time — not auto-detected
- LinkedIn format is auto-suggested but Robin can override — avoids both full manual tagging and opaque auto-decisions
- German localization is a creative adaptation, not a mechanical translation — Claude uses the casual voice profile to produce natural German TikTok content
- Critic agent must be a separate subagent to avoid self-review bias
- Three rendering pipelines coexist: photo+overlay (TikTok/IG), AI-generated (fallback), HTML→screenshot (LinkedIn only)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-content-generation*
*Context gathered: 2026-04-09*
