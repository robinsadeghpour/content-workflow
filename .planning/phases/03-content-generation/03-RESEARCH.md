# Phase 3: Content Generation — Research

**Researched:** 2026-04-09
**Domain:** Multi-platform content generation, slide rendering pipelines, voice application, critic agent
**Confidence:** HIGH (all findings verified against live codebase or canonical skill files)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Slide Pipeline Strategy**
- D-01: Three rendering approaches coexist, routed by content type and platform:
  - Photo-first + node-canvas overlay — primary for TikTok/Instagram slideshows
  - AI-generated slides — TikTok/Instagram fallback via Nano Banana / Gemini (not OpenAI gpt-image-1.5)
  - HTML→Playwright screenshot — LinkedIn PDF carousels only
- D-02: Robin picks visual approach (photo-first vs AI-generated) at KEEP time during `/review`
- D-03: LinkedIn keeps its own Playwright pipeline. TikTok/Instagram use photo+overlay pipeline
- D-04: Slide structure is flexible per content type — not a fixed 6-slide arc
- D-05: Text rendering on TikTok/Instagram slides uses node-canvas overlay (Larry's pattern). Output is final PNG per slide

**LinkedIn Format Routing**
- D-06: Auto-suggest format based on content type heuristics (tutorial → carousel, hot take → text, data-heavy → infographic, founder note → personal post). Robin can override during approval
- D-07: Single branded template for LinkedIn PDF carousels — `slide-template.html`. Content varies, chrome stays the same
- D-08: LinkedIn infographic posts use AI image generation (Nano Banana / Gemini), not HTML→screenshot

**German Localization**
- D-09: Claude-only localization with tone prompt using `voice-casual.xml`. No DeepL dependency
- D-10: German TikTok slides get their own text overlays rendered in German via node-canvas. Same photos/visuals as EN
- D-11: Instagram does NOT get a German version — only TikTok EN and TikTok DE

**Critic Agent**
- D-12: Critic runs as a separate Claude subagent (Task) after generation completes. Fresh context, no anchoring bias
- D-13: Critic checks three dimensions: (1) voice authenticity, (2) slide quality (hook strength, text readability, safe zones, visual consistency), (3) factual accuracy against source material
- D-14: On rejection: auto-revise + re-check loop up to 2-3 attempts. Robin only sees critic-approved drafts
- D-15: Brand alignment is NOT a separate check — voice authenticity implicitly covers on-brand tone

### Claude's Discretion
- Specific heuristics for LinkedIn format auto-suggestion (what signals trigger each format)
- Slide count ranges per content type (how many slides for a listicle vs hot take)
- Critic scoring rubric and pass/fail thresholds
- Photo catalog matching logic (how to find the best photo for a topic)
- Node-canvas text layout details (font choices, overlay positioning, safe zone margins)
- German tone prompt design (how to instruct Claude for casual German)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TIKT-01 | Slideshow generation using merged Larry + tiktok-slideshows pipeline (hook → content → CTA) | Larry's `add-text-overlay.js` is the proven node-canvas implementation; tiktok-slideshows has hook formulas + photo catalog |
| TIKT-02 | Text overlay rendering on slide images with proper safe zones and formatting | Directly implemented in `add-text-overlay.js`: 6.5% font, 75% maxWidth, 10% top / 80% bottom safe zones, white+black-outline style |
| TIKT-03 | Photo library with text descriptions for AI selection without vision calls | `photo-catalog-template.json` is the schema; `media/images/tiktok/` is the project-local home; catalog.json manages descriptions |
| TIKT-04 | AI image generation fallback via Nano Banana / Gemini when no real visuals available | Nano Banana SKILL.md: `gemini-2.5-flash-image` model, direct API via Python script or inline call |
| TIKT-05 | TikTok English master content published to EN account | Content saved as draft in `drafts` table, handed to Phase 4 for Postiz scheduling |
| TIKT-06 | TikTok German localization from English master for DE account | Writing skill has explicit `tiktok_de` platform mode + `<localization-de>` in `voice-casual.xml` |
| TIKT-07 | Instagram carousel/slideshow reuses TikTok slide format | Same PNG slides, different Postiz integration ID; no second render pass needed |
| LINK-01 | PDF slide carousel posts using Robin's template with real logos/screenshots | `slide-template.html` + `screenshot-slides.py` pipeline is working. PDF via Pillow already implemented |
| LINK-02 | Standalone text-only posts | Writing skill + humanizer pass; no visual pipeline needed |
| LINK-03 | Infographic posts with data/insights visualizations | Nano Banana skill: `gemini-2.5-flash-image` or `gemini-3-pro-image-preview` for portrait infographics |
| LINK-04 | Personal posts from rough notes refined into polished posts with optional image | Writing skill `--platform linkedin` + optional Nano Banana image call |
| VOIC-04 | Critic agent reviews every draft for quality, authenticity, and brand alignment before user review | Task tool for separate critic subagent; voice profiles are the scoring reference |
</phase_requirements>

---

## Summary

Phase 3 builds on two proven pipelines that already exist in the project: Larry's `add-text-overlay.js` (node-canvas, battle-tested) and the LinkedIn Playwright/screenshot pipeline. The core challenge is not invention — it's **integration**: wiring these existing components into a unified `generate-content` skill that accepts a `kept` idea ID, routes to the correct pipeline(s) based on content type and visual approach, runs all four platforms in parallel via Claude Code's `Task` tool, then gates output through a critic subagent before saving approved drafts to `content.db`.

The `drafts` table schema exists and is ready (`drafts.status` tracks the generation → critic-approved → ready-for-publishing lifecycle). The `ideas` table has 5 `kept` records ready for testing. The primary gap is **missing npm packages**: `canvas` and `sharp` are not installed in `content-workflow` (only referenced from Larry's standalone directory). These must be installed as Wave 0 work. Python Playwright is available via the notebooklm venv (`~/.local/pipx/venvs/notebooklm-py`), so the LinkedIn screenshot pipeline is functional without new installs.

The photo library at `media/images/tiktok/` is currently empty — this is intentional (photos added on explicit user request). A `catalog.json` must be initialized in Wave 0 as an empty catalog using the template schema. The `generate-content` skill should handle the case where the catalog is empty (fall through to AI generation).

**Primary recommendation:** Build a single `generate-content` skill that orchestrates all four content channels from one command, uses `Task` for parallel platform generation, and gates on critic approval before writing to `drafts`. Keep all Node.js pipeline scripts in `scripts/` and invoke them from the skill via `Bash`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `canvas` (node-canvas) | 3.2.3 | Text overlay rendering on TikTok/Instagram slides | Larry's `add-text-overlay.js` already uses it; `createCanvas` + `loadImage` API [VERIFIED: npm registry] |
| `sharp` | 0.34.5 | Image resize, format conversion, final compositing | Fastest Node.js image processor (libvips). Used for output resize (1080x1440 TikTok, 1080x1350 Instagram) [VERIFIED: npm registry] |
| `@anthropic-ai/sdk` | 0.86.1 | Content generation, German localization, critic agent | Already in package.json at `^0.86.1` [VERIFIED: package.json] |
| `better-sqlite3` | 12.8.0 | Reading kept ideas, writing drafts | Already installed, WAL mode active [VERIFIED: package.json] |
| Python playwright (notebooklm venv) | Available | LinkedIn HTML→screenshot pipeline | `~/.local/pipx/venvs/notebooklm-py/bin/python3 -c "import playwright"` passes [VERIFIED: shell check] |
| Gemini API (direct HTTP) | gemini-2.5-flash-image | AI slide fallback + LinkedIn infographics | Nano Banana SKILL.md uses direct Python urllib call; no extra install needed [VERIFIED: SKILL.md] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` | 17.4.1 | Load GEMINI_API_KEY, ANTHROPIC_API_KEY | All scripts that call external APIs [VERIFIED: package.json] |
| `p-limit` | 4.0.0 (CJS) | Bound parallel image generation calls | When generating multiple AI slides concurrently (max 3) [VERIFIED: package.json] |
| `PIL` (Pillow, Python) | Available | PNG-to-PDF assembly for LinkedIn carousel | Already used by `screenshot-slides.py` — `from PIL import Image` [VERIFIED: live check] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node-canvas 3.x | `@napi-rs/canvas` | Drop-in if Cairo system libs fail. canvas 3.2.3 requires Cairo; @napi-rs ships prebuilt Skia binaries. Use if `npm install canvas` fails on fresh machine |
| Gemini direct API | OpenAI gpt-image-1.5 | Larry legacy only. D-01 explicitly prohibits gpt-image-1.5 for slides in this phase; Gemini via Nano Banana is the locked choice |
| DeepL | `@anthropic-ai/sdk` inline | D-09 locked; Claude handles EN→DE in one pass with `<localization-de>` section of voice-casual.xml |

**Installation (Wave 0):**
```bash
cd /path/to/content-workflow
npm install canvas sharp
```

Note: `canvas` requires Cairo system libs on macOS:
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

---

## Architecture Patterns

### Recommended Project Structure
```
scripts/
├── generate-content.js      # Main orchestrator — reads idea, routes pipelines, saves drafts
├── generate-tiktok-slides.js # node-canvas overlay pipeline for TikTok/Instagram PNGs
├── generate-linkedin-html.js # Claude writes HTML using slide-template.html as base
├── generate-ai-slides.js    # Nano Banana / Gemini fallback image generation
├── apply-critic.js          # Critic subagent invocation via @anthropic-ai/sdk
└── init-db.js               # (existing) — Phase 3 will add ALTER TABLE for new columns

.claude/skills/
└── generate-content/
    └── SKILL.md             # Entry point skill — /generate-content --idea <id>

data/
└── content.db               # drafts table is Phase 3's primary write target
    
media/
└── images/
    ├── tiktok/              # Robin's personal photos (currently empty — user adds explicitly)
    │   └── catalog.json     # Initialized in Wave 0 with empty schema
    └── linkedin/            # Logos, screenshots for carousel slides
```

### Pattern 1: Parallel Platform Generation via Task Tool

**What:** Fire 4 subagents simultaneously (TikTok EN, TikTok DE, Instagram, LinkedIn), each reads their voice profile independently, and each runs the correct pipeline for the platform.

**When to use:** Always — this is the core INFR-03 pattern documented in `writing/SKILL.md`.

**Example:**
```
// Source: .claude/skills/writing/SKILL.md (Parallel Subagent Support section)
Task 1: Generate TikTok EN slides — photo+overlay pipeline, voice-casual.xml
Task 2: Generate TikTok DE slides — same photos as EN, German text via voice-casual.xml <localization-de>
Task 3: Generate Instagram carousel — reuse TikTok EN PNGs, no second render
Task 4: Generate LinkedIn content — format-routed (carousel/text/infographic/personal)

Parent waits for all 4, then runs critic on all outputs.
```

### Pattern 2: Content Type → LinkedIn Format Routing (D-06 heuristics)

**What:** Auto-suggest the correct LinkedIn format based on the idea's `source_type`, `title` keywords, and `content_angle_suggestion` from the review skill.

**Decision table (Claude's Discretion — recommended):**
```
content_angle = "Tutorial breakdown" OR title has (how to, guide, step, tutorial, tips) → carousel (PDF slides)
content_angle = "Hot take" OR title has (wrong, actually, unpopular, controversial, opinion) → text-only post
content_angle = "News reaction" AND has data/numbers → infographic
content_angle = "News reaction" AND no data → text-only post
source_type = "founder_note" OR pillar = "story" → personal post
default → text-only post (safest fallback)
```

Robin can override at approval time (Phase 4). The suggestion is saved in the draft as `linkedin_format` metadata.

### Pattern 3: Critic Agent as Separate Task (D-12)

**What:** After all platform content is generated, spawn a separate Claude subagent with the drafts + voice profiles as context. The critic has no memory of the generation pass — avoids self-review anchoring bias.

**Critic prompt structure (recommended rubric — Claude's Discretion):**
```
You are a content critic reviewing draft posts for Robin Faraj.
Score each draft on 3 dimensions (0-10 each):

1. VOICE AUTHENTICITY: Does it match the voice profile exactly?
   - Check against: [voice profile XML excerpt]
   - Red flags: banned patterns, wrong opener style, wrong sentence rhythm
   - Pass threshold: ≥7

2. SLIDE QUALITY (TikTok/Instagram/LinkedIn carousel only):
   - Hook slide: strong enough to stop scroll?
   - Text: readable, within safe zones, no emoji (canvas limitation)?
   - Narrative flow: does progression make sense?
   - Pass threshold: ≥7

3. FACTUAL ACCURACY:
   - Every claim must trace to source transcript or idea summary
   - No invented personal experiences
   - Pass threshold: all claims verified (binary)

OVERALL PASS: all three dimensions pass.
On failure: return specific rewrite instructions per dimension.
```

**Retry loop (D-14):**
```
attempts = 0
MAX_ATTEMPTS = 3
while !critic_pass and attempts < MAX_ATTEMPTS:
  regenerate failing sections with critic feedback as constraint
  re-run critic
  attempts++
if still failing: save with status='critic_failed', flag for Robin
```

### Pattern 4: Draft DB Schema + Metadata (D-05, D-06)

The existing `drafts` table stores `content TEXT` which is sufficient for text posts. For slide-based content, the `content` field should store structured JSON:

```json
{
  "type": "tiktok_slideshow",
  "slides": [
    {"slide": 1, "text": "...", "photo": "photo-01.jpg", "file": "media/output/idea-abc/tiktok/slide-01.png"},
    ...
  ],
  "hook_formula": "person-conflict-transform",
  "slide_count": 5
}
```

For LinkedIn, `content` stores:
```json
{
  "type": "linkedin_carousel",
  "post_text": "...",
  "html_path": "media/output/idea-abc/linkedin/slides.html",
  "pdf_path": "media/output/idea-abc/linkedin/carousel.pdf",
  "format": "carousel",
  "slide_count": 7
}
```

The `drafts` table needs two additional columns for Phase 3 (added via ALTER TABLE in `init-db.js`):
- `visual_approach TEXT` — `photo_overlay` | `ai_generated` | `html_screenshot` | `none`
- `media_dir TEXT` — path to generated slide PNGs / PDF for this draft

### Anti-Patterns to Avoid

- **Hardcoding 6 slides:** `add-text-overlay.js` hardcodes `texts.length !== 6` with `process.exit(1)`. D-04 says slide count is flexible. The new `generate-tiktok-slides.js` must lift this constraint and accept variable slide counts.
- **Generating TikTok DE slides from scratch:** D-10 says same photos as EN, different text. The pipeline should generate EN slide PNGs first, then re-run node-canvas overlay with German text on the same photos — not generate new photos.
- **Instagram rendering as a separate pipeline:** D-03 + TIKT-07 — Instagram reuses the exact TikTok EN PNGs. The only difference is Postiz integration ID and aspect ratio (1080x1350 crop vs 1080x1440). A `sharp` resize/crop pass can handle the dimension difference.
- **Running critic on the same context as generation:** D-12. Critic MUST be a separate Task subagent with its own fresh context. Never run self-review in the same generation pass.
- **Missing voice profile read before generation:** Per writing/SKILL.md "NEVER generate content without reading the voice profile first." The skill must read `voice-linkedin.xml` or `voice-casual.xml` before writing any draft text.
- **Using gpt-image-1 or gpt-image-1.5 for AI slides:** D-01 locks this to Nano Banana / Gemini. Larry's `generate-slides.js` uses OpenAI — do not replicate that script for this phase.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text overlay on slide images | Custom canvas text renderer | Larry's `add-text-overlay.js` | Battle-tested: font sizing, safe zones, word wrap, emoji stripping all solved |
| HTML→PNG slide rendering | Custom headless browser | `screenshot-slides.py` via notebooklm venv | Already working; Playwright handles 2x DPR, font loading wait, `.slide` element query |
| PDF assembly from PNGs | Custom PDF writer | Pillow (`PIL.Image.save(..., save_all=True)`) | Already used in `screenshot-slides.py`; proven pattern |
| AI image generation | Custom Gemini HTTP client | Nano Banana SKILL.md Method 1 (direct API) | Already documented with error handling and retry guidance |
| German localization | DeepL + custom tone pass | `@anthropic-ai/sdk` with `<localization-de>` voice profile section | D-09 locked decision; Claude adapts idiomatically in one pass |
| Voice fingerprint application | Custom text post-processor | Writing skill (`/writing --platform <platform>`) | Voice profiles are already built from 50 Robin posts; humanizer orchestration is built in |
| Parallel platform generation | Custom async queue | Claude Code `Task` tool | Native multi-agent parallelism, no infrastructure needed (INFR-03 pattern) |

**Key insight:** This phase is 80% integration work. Every hard problem (rendering, voice, localization, parallelism) is already solved by existing skills and scripts. The main new code is the orchestrator that wires them together and the critic loop.

---

## Common Pitfalls

### Pitfall 1: canvas 3.x breaks Larry's 6-slide hardcode

**What goes wrong:** `add-text-overlay.js` line 47 does `if (texts.length !== 6) { process.exit(1) }`. D-04 requires flexible slide counts. Importing the script as-is will break for 4-slide hot takes or 8-slide listicles.

**Why it happens:** Larry's original use case was always exactly 6 slides.

**How to avoid:** The new `generate-tiktok-slides.js` should be a modified fork of `add-text-overlay.js` with the hardcoded `!== 6` check replaced by a minimum check (e.g., `< 2 || > 12`). Keep the original file untouched for backward compatibility.

**Warning signs:** `process.exit(1)` in stdout when testing with non-6-slide content.

### Pitfall 2: canvas requires Cairo system libs (macOS)

**What goes wrong:** `npm install canvas` fails with `Could not find cairo` or native build errors.

**Why it happens:** canvas 2.x/3.x uses node-gyp to compile Cairo bindings. System libraries are not installed by default.

**How to avoid:** Wave 0 must check and install system deps:
```bash
brew list cairo 2>/dev/null || brew install pkg-config cairo pango libpng jpeg giflib librsvg
npm install canvas
```
Fallback: if brew install fails, switch to `@napi-rs/canvas` which ships prebuilt Skia binaries.

**Warning signs:** `node-pre-gyp` errors during `npm install canvas`.

### Pitfall 3: Playwright runs in notebooklm venv, not system Python

**What goes wrong:** `python3 ~/.claude/skills/linkedin/scripts/screenshot-slides.py` uses system Python (3.14.0). `playwright` is NOT installed in system Python — `playwright CLI not found`, `playwright not installed`. [VERIFIED: shell check]

**Why it happens:** Playwright was installed into `~/.local/pipx/venvs/notebooklm-py` as a dependency of notebooklm. [VERIFIED: shell check — notebooklm venv playwright check passes]

**How to avoid:** Always invoke screenshot-slides.py via the notebooklm venv Python:
```bash
~/.local/pipx/venvs/notebooklm-py/bin/python3 ~/.claude/skills/linkedin/scripts/screenshot-slides.py <html> <output_dir>
```
Document this in the generate-content skill explicitly. Do NOT use bare `python3`.

**Warning signs:** `ModuleNotFoundError: No module named 'playwright'` when using system `python3`.

### Pitfall 4: TikTok DE re-renders photos unnecessarily

**What goes wrong:** Generating TikTok DE by running the full image generation pipeline again (AI generation or photo selection) instead of reusing EN slide base images.

**Why it happens:** Naive implementation treats TikTok DE as a completely separate pipeline.

**How to avoid:** Per D-10, German TikTok uses the SAME photos/visuals as EN. The pipeline should:
1. Generate EN slides (photos selected + overlaid)
2. Take the raw photos used for EN (pre-overlay)
3. Re-run node-canvas overlay with German text on those same photos
This halves compute time and guarantees visual consistency.

### Pitfall 5: drafts table missing media path column

**What goes wrong:** Phase 4 (publishing) can't find the slide PNGs or PDF because the path wasn't persisted in `drafts`.

**Why it happens:** The existing schema has `content TEXT` but no dedicated `media_dir` column.

**How to avoid:** Wave 0 must run a schema migration in `init-db.js`:
```javascript
// Idempotent ALTER TABLE pattern (same as transcript column in Phase 2)
try {
  db.exec('ALTER TABLE drafts ADD COLUMN visual_approach TEXT');
  db.exec('ALTER TABLE drafts ADD COLUMN media_dir TEXT');
} catch (err) {
  if (!err.message.includes('duplicate column')) throw err;
}
```

### Pitfall 6: Critic anchoring from shared context

**What goes wrong:** Running the critic review in the same Claude conversation as content generation causes self-serving approval — the model defends its own output.

**Why it happens:** Shared context creates implicit bias toward approving what was just written.

**How to avoid:** D-12 mandates a separate `Task` subagent for the critic. The parent agent spawns the critic as a fresh Task, passes only: (1) the generated draft text, (2) the relevant voice profile XML, (3) the source transcript/summary for fact-checking. No generation history is passed.

### Pitfall 7: Instagram aspect ratio mismatch

**What goes wrong:** Publishing TikTok 1080x1440 (3:4) PNGs to Instagram, which prefers 1080x1350 (4:5) for carousels.

**Why it happens:** TIKT-07 says "reuse TikTok slide format" but the optimal Instagram aspect ratio is slightly different.

**How to avoid:** After TikTok EN slides are generated, apply a `sharp` center-crop:
```javascript
// Source: CLAUDE.md stack patterns
sharp('tiktok-slide.png')
  .resize(1080, 1350, { fit: 'cover', position: 'centre' })
  .toFile('instagram-slide.png');
```
This is a lightweight post-process step, not a separate render.

---

## Code Examples

### Node-canvas text overlay (existing, verified)

```javascript
// Source: Larry 1.0.0/scripts/add-text-overlay.js
// Safe zones: top 10%, bottom 20%
const minY = img.height * 0.10;
const maxY = img.height * 0.80 - totalTextHeight;
// Font: 6.5% of image width, bold Arial, white fill + black outline
const fontSize = Math.round(img.width * 0.065);
ctx.font = `bold ${fontSize}px Arial`;
// Max text width: 75% (TikTok UI padding)
const maxWidth = img.width * 0.75;
```

### Variable slide count version (new — removes hardcoded 6-check)

```javascript
// generate-tiktok-slides.js — modified fork for Phase 3
const texts = JSON.parse(fs.readFileSync(textsPath, 'utf-8'));
const photoPaths = JSON.parse(fs.readFileSync(photosPath, 'utf-8')); // new arg
if (texts.length < 2 || texts.length > 12) {
  console.error('Slide count must be 2-12');
  process.exit(1);
}
if (texts.length !== photoPaths.length) {
  console.error('texts and photos arrays must be same length');
  process.exit(1);
}
```

### LinkedIn HTML screenshot (existing, verified)

```bash
# Source: .claude/skills/linkedin/SKILL.md
# MUST use notebooklm venv — system python3 does NOT have playwright
~/.local/pipx/venvs/notebooklm-py/bin/python3 \
  ~/.claude/skills/linkedin/scripts/screenshot-slides.py \
  /tmp/linkedin-carousel-<topic>.html \
  /tmp/linkedin-slides/
# Outputs: slide-1.png ... slide-N.png + linkedin-carousel.pdf
```

### German TikTok localization via @anthropic-ai/sdk

```javascript
// Source: .claude/skills/writing/SKILL.md + voice-casual.xml <localization-de>
// Step 1: apply casual voice profile to EN draft
// Step 2: localize to German — adapt, do NOT literal-translate
// Key principle from voice-casual.xml <localization-de>:
// "brooo" → "Alter, Bruder, krass"
// Keep lowercase where German grammar allows
// Avoid formal German grammar — use spoken German
const systemPrompt = `You are localizing Robin's TikTok content from English to German.
Rules from voice-casual.xml <localization-de>:
- Preserve raw energy — find German phrases with same casual punch
- "brooo" energy in German: Alter, Bruder, krass
- Keep lowercase where German grammar allows
- Adapt milestone posts to German entrepreneur culture
- Do NOT literal-translate — find German idioms with same casual energy
- Avoid formal German grammar — use spoken German`;
```

### Nano Banana AI slide generation (Gemini direct API)

```python
# Source: .claude/skills/nano-banana/SKILL.md — Method 1 Direct API
import base64, json, urllib.request
MODEL = "gemini-2.5-flash-image"  # fast generation
payload = {
    "contents": [{"parts": [{"text": "portrait slide image for TikTok, 1080x1440..."}]}],
    "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]}
}
url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}"
```

### Drafts table write (new schema)

```javascript
// generate-content.js — write draft after critic approval
const stmt = db.prepare(`
  INSERT INTO drafts (id, idea_id, platform, content, status, visual_approach, media_dir)
  VALUES (?, ?, ?, ?, 'critic_approved', ?, ?)
`);
stmt.run(draftId, ideaId, platform, JSON.stringify(contentPayload), visualApproach, mediaDir);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed 6-slide arc (Larry) | Flexible slide count per content type (D-04) | Phase 3 design | Listicles get N slides, hot takes get 3-4 punchy slides |
| TikTok: user adds text manually in app | node-canvas text overlay baked into PNG | Phase 3 design | Fully automated text render; Robin reviews output PNGs |
| Each platform as separate manual skill | Unified generate-content skill with parallel Task subagents | Phase 3 design | One command → 4 platform drafts |
| No critic gate | Critic subagent reviews before Robin sees anything | Phase 3 design (D-12) | Robin only reviews pre-screened drafts |
| OpenAI gpt-image-1.5 for AI slides (Larry legacy) | Nano Banana / Gemini for AI slides (D-01) | Phase 3 design | Decoupled from OpenAI dependency for slide visual generation |

**Deprecated/outdated:**
- Larry's fixed 6-slide `add-text-overlay.js`: still valid for 6-slide content, but cannot be used as-is for Phase 3's variable slide counts. Fork and generalize.
- tiktok-slideshows' "upload plain photos, user adds text in app" workflow: Phase 3 replaces this with server-side text overlay baking (final PNGs). The tiktok-slideshows SKILL.md documents the old manual workflow — do not follow it for Phase 3.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Instagram carousel optimal at 1080x1350 (4:5) vs TikTok 1080x1440 (3:4) | Pitfall 7 + Code Examples | If Instagram accepts 1080x1440 without cropping, the sharp resize step is unnecessary overhead — low risk |
| A2 | Critic pass/fail thresholds of ≥7/10 per dimension are appropriate | Pattern 3 critic rubric | Thresholds are Claude's Discretion — may need calibration after first run. Low risk to start at 7 |
| A3 | LinkedIn format heuristics based on content_angle_suggestion keyword matching are sufficient | Pattern 2 | If heuristics route incorrectly often, Robin's approval override (D-06) catches it — low risk |

**All other claims verified against live codebase files, shell environment checks, or npm registry.**

---

## Open Questions

1. **Photo catalog location for Phase 3**
   - What we know: `media/images/tiktok/` directory exists but is empty. The tiktok-slideshows SKILL.md references `~/.openclaw/workspace/slidegen/photos/` which does not exist on this machine.
   - What's unclear: Should `generate-content` skill use `media/images/tiktok/` as the canonical photo home, or keep photos under `.claude/skills/tiktok-slideshows/`?
   - Recommendation: Use `media/images/tiktok/` as the project-local photo home, and place `catalog.json` there. The generate-content skill reads `media/images/tiktok/catalog.json`. This centralizes all media under `media/` consistent with Phase 1's data directory structure.

2. **LinkedIn `slide-template.html` persona references**
   - What we know: The linkedin skill references `~/WebstormProjects/11x/public/robin-portrait-clear-background.png` for the first slide photo. This path is machine-specific and outside the content-workflow repo.
   - What's unclear: Should generate-content copy this to `media/` or reference it from its current location?
   - Recommendation: Copy `robin-portrait-clear-background.png` to `media/images/linkedin/robin-portrait.png` in Wave 0. Update `slide-template.html` or pass it as a parameter so the path is repo-relative and portable.

3. **Critic failure handling when all 3 attempts fail**
   - What we know: D-14 says auto-revise up to 2-3 attempts, then Robin only sees approved drafts.
   - What's unclear: What happens to a draft that fails 3 critic passes? Should it surface with a warning, or be silently dropped?
   - Recommendation: Save with `status='critic_failed'` and include it in the review output with a clear flag: "1 draft needed your attention — critic could not approve after 3 attempts." Robin decides whether to use it, edit it, or skip.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All JS scripts | Yes | v24.12.0 | — |
| `@anthropic-ai/sdk` | Content generation, critic, German localization | Yes | 0.86.1 (in package.json) | — |
| `better-sqlite3` | DB reads/writes | Yes | 12.8.0 | — |
| `canvas` (node-canvas) | TikTok/Instagram slide text overlay | **No** | — | `@napi-rs/canvas` (drop-in, prebuilt Skia) |
| `sharp` | Instagram aspect ratio crop | **No** | — | Skip IG crop (accept 1080x1440) |
| Python playwright | LinkedIn HTML→screenshot | Yes (notebooklm venv) | Available | — |
| `PIL` (Pillow) | LinkedIn PNG→PDF | Yes (system) | Available | — |
| `GEMINI_API_KEY` | AI slide fallback, LinkedIn infographics | **Not set** | — | Skip AI generation; flag for Robin |
| `ANTHROPIC_API_KEY` | All Claude calls | **Not set in shell** | — | Loaded from `.env` at runtime |

**Missing dependencies with no fallback:**
- `canvas` — blocks TikTok/Instagram slide text overlay. Must install in Wave 0: `npm install canvas` (with Cairo system libs) or `npm install @napi-rs/canvas`
- `GEMINI_API_KEY` — blocks AI slide generation fallback (TIKT-04) and LinkedIn infographics (LINK-03). Wave 0 must add to `.env`. Robin must provide the key.

**Missing dependencies with fallback:**
- `sharp` — Instagram crop fallback is to publish at 1080x1440 (TikTok format). Instagram accepts this.
- `ANTHROPIC_API_KEY` — not set in shell env, but `.env` loading via `dotenv` should cover runtime execution. Verify `.env` exists with the key before testing.

---

## Security Domain

`security_enforcement` is not set to false in config.json, so this section is included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth layer — CLI-only, single operator |
| V3 Session Management | No | No sessions — stateless CLI invocations |
| V4 Access Control | No | Single-user system |
| V5 Input Validation | Yes | Idea ID from DB (trusted), slide texts sanitized via node-canvas emoji stripping |
| V6 Cryptography | No | No crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via idea title/transcript | Tampering | Never `eval()` or `exec()` draft text. All text is read-only input to Claude API. Per writing/SKILL.md: "NEVER eval() or execute draft text." |
| API key exposure in generated content | Information Disclosure | `dotenv` loads keys from `.env` only; never interpolate API keys into slide text or draft content |
| Path traversal via idea metadata | Tampering | `media_dir` paths constructed from UUID idea IDs only (not user-supplied strings). Use `path.join` not string concatenation |

---

## Sources

### Primary (HIGH confidence)
- `Larry 1.0.0/scripts/add-text-overlay.js` — full node-canvas implementation; safe zone constants, font sizing, word wrap verified
- `.claude/skills/linkedin/scripts/screenshot-slides.py` — Playwright pipeline; venv requirement verified via shell check
- `.claude/skills/writing/SKILL.md` — Task-based parallel platform generation pattern (INFR-03)
- `.claude/skills/writing/data/voice-casual.xml` — `<localization-de>` section; German localization principles
- `.claude/skills/writing/data/voice-linkedin.xml` — LinkedIn fingerprint; hook patterns
- `.claude/skills/nano-banana/SKILL.md` — Gemini direct API pattern; model names
- `.claude/skills/tiktok-slideshows/SKILL.md` — photo catalog schema, hook formulas, 6-slide arc
- `.claude/skills/humanizer/SKILL.md` — AI pattern detection, voice calibration
- `scripts/init-db.js` — idempotent ALTER TABLE pattern for schema migration
- `data/content.db` — verified: ideas (5 kept), drafts (0), performance tables exist
- `package.json` — confirmed: `canvas` and `sharp` NOT installed; `@anthropic-ai/sdk`, `better-sqlite3`, `p-limit` v4 ARE installed
- Shell environment check — node v24.12.0, python 3.14.0, playwright in notebooklm venv only, Pillow available, canvas/sharp/openai NOT in content-workflow node_modules

### Secondary (MEDIUM confidence)
- npm registry — canvas 3.2.3 (latest), sharp 0.34.5 (latest) [VERIFIED: npm view]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified via package.json, npm registry, and shell environment checks
- Architecture patterns: HIGH — derived directly from canonical skill files and existing working scripts
- Pitfalls: HIGH — most verified empirically (playwright venv issue, canvas not installed, hardcoded 6-slide check)
- German localization: HIGH — voice-casual.xml `<localization-de>` section is the locked specification

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable codebase, no fast-moving dependencies)
