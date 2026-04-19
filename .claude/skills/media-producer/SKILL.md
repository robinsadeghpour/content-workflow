---
name: media-producer
version: 1.0.0
model: sonnet
description: |
  Render visual media for any platform from content JSON. Wraps all rendering scripts (canvas text overlays, Gemini AI images, Playwright carousels, sharp cropping) behind a unified interface. Use when generating TikTok slides, Instagram carousels, LinkedIn carousels/infographics, or any visual content from structured data.
allowed-tools:
  - Read
  - Bash
  - Glob
---

# media-producer — Visual Media Rendering

Produces platform-ready media files from structured content data. This skill is the single entry point for all visual rendering — it delegates to the appropriate script per platform.

## When To Use

- `/generate-content` orchestrator needs slides rendered after the writer generates text
- LinkedIn drafts need a carousel or infographic rendered
- TikTok / Instagram drafts need slide PNGs with text overlays
- Any workflow that needs to turn content JSON into visual files

## Interface

You need these inputs:
- **platform**: `tiktok_en` | `tiktok_de` | `instagram` | `linkedin`
- **content**: The structured content JSON from the writer (slides, captions, post text, etc.)
- **visual_approach**: `photo_overlay` | `ai_generated` | `html_screenshot` | `none`
- **output_dir**: Absolute path to write rendered files
- **idea_json_path**: (LinkedIn only) Path to idea JSON file

## Rendering Routes

### TikTok EN / TikTok DE (`photo_overlay` approach)

1. **Match photos to slides** — Use the photo catalog at `media/images/tiktok/catalog.json` to select photos per slide based on keyword matching from `photo_description` fields.

2. **Write temp files** for the renderer:
   ```bash
   # Write photos array (absolute paths) to a temp JSON file
   # Write texts array (slide text strings) to a temp JSON file
   ```

3. **Plan inset overlays (optional per slide)** — For tutorial/command posts, tactical slides carry more weight when the claim is backed by a visual (CLI output, benchmark chart, product UI). Overlay behaviour:
   - Size: 75% of canvas width, auto-scaled height, center at 68% from top — stays above TikTok's bottom 20% caption/UI safe zone and below the 30%-anchored hook text.
   - White border + drop shadow applied by the renderer automatically.
   - Pass `null` for slides that don't need one (hook slide, payoff slide).

4. **Render CLI / terminal overlays** via `scripts/render-cli-overlay.js` (see CLI Overlay section below). Save to `media/overlays/<draft_id>/<slide_name>.png`.

5. **Render slides:**
   ```bash
   cd /Users/robinsadeghpour/content-workflow
   node scripts/generate-tiktok-slides.js \
     --photos /tmp/photos-<uuid>.json \
     --texts /tmp/texts-<uuid>.json \
     --overlays /tmp/overlays-<uuid>.json \
     --output <output_dir>
   ```
   The `--overlays` flag is optional; omit for no-overlay slides, or pass an array of absolute paths/nulls (same length as photos/texts).

6. **Output:** `slide-01.png`, `slide-02.png`, ... (1080x1920 each) + JSON summary on stdout.

### CLI Overlay Spec

`scripts/render-cli-overlay.js` produces clean terminal-look PNGs for command/output slides. Input spec:

```json
{
  "title": "claude code",
  "lines": [
    { "kind": "prompt", "text": "ultrathink refactor" },
    { "kind": "output", "text": "thinking..." },
    { "kind": "dim",    "text": "analyzing 14 files" },
    { "kind": "accent", "text": "✓ plan ready" }
  ]
}
```

Line `kind` options: `prompt` (green `$` + white command), `output` (light gray), `dim` (muted gray), `accent` (green), `warn` (yellow), `err` (red).

**Rules:**
- **≤30 chars per line.** Longer lines clip at the overlay right edge. Keep output realistic but terse.
- **3-5 lines per overlay.** Canvas auto-sizes height to content; more than 5 lines makes the overlay too tall.
- **No emoji in lines** — use ascii glyphs (`✓`, `→`, `↻`) which render reliably in Menlo.
- **Title is optional.** Use `"claude code"`, `"terminal"`, or omit.

Usage:
```bash
node scripts/render-cli-overlay.js --spec <spec.json> --output <out.png>
```

### TikTok EN / TikTok DE (`ai_generated` approach)

1. **Write prompts** — Extract `photo_description` from each slide into a prompts JSON array.

2. **Generate base images:**
   ```bash
   cd /Users/robinsadeghpour/content-workflow
   node scripts/generate-ai-slides.js \
     --prompts /tmp/prompts-<uuid>.json \
     --output <output_dir>/base
   ```

3. **Add text overlays** — Use the same canvas renderer on the generated base images:
   ```bash
   node scripts/generate-tiktok-slides.js \
     --photos /tmp/base-photos.json \
     --texts /tmp/texts-<uuid>.json \
     --output <output_dir>
   ```

4. **Output:** Same as photo_overlay — `slide-01.png`, `slide-02.png`, ... (1080x1440 each).

### Instagram (`crop` from TikTok EN)

Instagram reuses TikTok EN slides, center-cropped to 4:5 ratio. No separate generation needed.

1. **Ensure TikTok EN slides exist** in the sibling `tiktok-en/` directory.

2. **Crop each slide:**
   ```bash
   cd /Users/robinsadeghpour/content-workflow
   node -e "
   const sharp = require('sharp');
   const fs = require('fs');
   const path = require('path');
   const enDir = '<tiktok_en_output_dir>';
   const outDir = '<output_dir>';
   fs.mkdirSync(outDir, { recursive: true });
   const files = fs.readdirSync(enDir).filter(f => /^slide-\\d+\\.png$/.test(f)).sort();
   (async () => {
     for (const f of files) {
       await sharp(path.join(enDir, f))
         .resize(1080, 1350, { fit: 'cover', position: 'centre' })
         .toFile(path.join(outDir, f));
     }
     console.log(JSON.stringify({ slides: files.length, format: '1080x1350' }));
   })();
   "
   ```

3. **Output:** `slide-01.png`, `slide-02.png`, ... (1080x1350 each).

### LinkedIn

LinkedIn has 3 visual sub-routes based on format:

#### Carousel (`html_screenshot`)
```bash
cd /Users/robinsadeghpour/content-workflow
node scripts/generate-linkedin-content.js \
  --idea-json <idea_json_path> \
  --format carousel \
  --slide-texts /tmp/slide-texts-<uuid>.json \
  --output <output_dir>
```
Output: `linkedin-result.json` + PDF + individual slide PNGs.

#### Infographic (`ai_generated`)
```bash
cd /Users/robinsadeghpour/content-workflow
node scripts/generate-linkedin-content.js \
  --idea-json <idea_json_path> \
  --format infographic \
  --post-text /tmp/post-text-<uuid>.txt \
  --output <output_dir>
```
Output: `linkedin-result.json` + portrait PNG (1080x1350).

#### Text / Personal (`none`)
```bash
cd /Users/robinsadeghpour/content-workflow
node scripts/generate-linkedin-content.js \
  --idea-json <idea_json_path> \
  --format <text|personal> \
  --post-text /tmp/post-text-<uuid>.txt \
  --output <output_dir>
```
Output: `linkedin-result.json` (text only, no visual media).

## Temp File Convention

Write temp input files to `/tmp/media-producer-<uuid>/` and clean up after rendering completes:
```bash
rm -rf /tmp/media-producer-<uuid>/
```

## Key Rules

- **NEVER use gpt-image-1 or gpt-image-1.5.** AI slides use Gemini via `generate-ai-slides.js` (per D-01).
- **Instagram is ALWAYS cropped from TikTok EN.** Never generate Instagram slides independently (per TIKT-07).
- **Instagram does NOT get a German version** (per D-11).
- **TikTok DE reuses the SAME photos as EN** — only text changes (per D-10).
- **No emoji in slide text** — canvas cannot render them.
- **Slide count: 2-12** — the renderer enforces this range.

## Dependencies

| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `scripts/generate-tiktok-slides.js` | Canvas text + inset overlay compositor | photos.json + texts.json (+ optional overlays.json) | slide-NN.png (1080x1920) |
| `scripts/render-cli-overlay.js` | Synthetic terminal/CLI overlay | spec.json (title + lines[]) | overlay PNG (1000 wide, auto-height) |
| `scripts/generate-ai-slides.js` | Gemini image generation | prompts.json | slide-NN.png (base images) |
| `scripts/generate-linkedin-content.js` | LinkedIn multi-format | idea.json + format + texts | linkedin-result.json + media |
| `sharp` (via inline node) | Instagram cropping | TikTok EN PNGs | slide-NN.png (1080x1350) |
