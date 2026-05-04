---
name: generate-personal-slides
description: "Render personal photo + text-overlay slides for TikTok and Instagram. Pulls real photos from the catalog at media/images/tiktok/catalog.json, composites the headline text on top, optionally adds a real-image inset (screenshot, repo card, chart). TikTok = 1080×1920, Instagram = 1080×1350. NOT for LinkedIn (use generate-branded-slides instead)."
allowed-tools: Bash, Read, Write, Edit
argument-hint: "<spec.json> [--output <dir>] [--filename <stem>]"
---

# generate-personal-slides

Renders **personal-track** slides for TikTok (1080×1920) and Instagram (1080×1350) by laying text over a real photo from the project's photo library. Optional inset overlay using a real image (screenshot, repo card, chart, product UI).

This is the counterpart to `generate-branded-slides`. Use this skill for personal / POV / story / hot-take content. Use `generate-branded-slides` for tactical / list / framework / quote content.

**Not used on LinkedIn** — LinkedIn ships branded slides only.

**No synthesized fake-terminal overlays.** Real images only. If you need a CLI screenshot, take a real screenshot and pass the path. If you want a GitHub repo card, dispatch the `repo-screenshot` subagent and pass the returned path.

## When to use

- Caller has finalized slide text and wants real-photo backgrounds
- Personal POV, story, reaction, or hot-take content for TikTok / Instagram
- `/generate-content` orchestrator delegates the personal visual step here

## When NOT to use

- Caller wants on-brand 11x cream/clay templates → `generate-branded-slides`
- Target platform is LinkedIn → `generate-branded-slides`
- Caller hasn't decided slide copy → upstream content skill first

---

## Inputs

### Required: a slide spec (JSON)

```json
{
  "platform": "tiktok",
  "filename": "claude-code-stack-2026-04-28",
  "slides": [
    {
      "text": "Wait... this actually works??",
      "photo": "auto",
      "photo_keywords": ["coding", "macbook", "workspace"],
      "overlay": null
    },
    {
      "text": "I run my whole outbound\nfrom one folder of prompts",
      "photo": "auto",
      "photo_keywords": ["home office", "creator setup"],
      "overlay": { "image": "/Users/robinsadeghpour/content-workflow/media/overlays/github/addyosmani-agent-skills.png" }
    },
    {
      "text": "Same outbound. No SaaS tax.",
      "photo": "/absolute/path/to/photo.jpg",
      "overlay": null
    }
  ]
}
```

### Slide fields

| Field | Required | Notes |
|---|---|---|
| `text` | ✅ | Headline string. Use `\n` for manual line breaks. 4-6 words per line. No emoji. |
| `photo` | ✅ | `"auto"` (match by `photo_keywords` against catalog) or absolute path |
| `photo_keywords` | when `photo: "auto"` | Array of strings matched against catalog `description` / `best_for` |
| `overlay` | optional | `null` for no overlay, or `{ "image": "/abs/path.png" }` for an image inset |

### Overlay (optional, real images only)

```json
{ "image": "/abs/path/to/screenshot.png" }
```

The image composites as a 75%-width inset, centered at 68% from top, with white border + drop shadow.

`build.js` validates the path is absolute and that the file exists. Use this for product screenshots, dashboards, before/after charts, GitHub repo cards (via the `repo-screenshot` subagent), real terminal screenshots, etc.

### Flags

- `--output <dir>` — where to write rendered PNGs (default: current working dir)
- `--filename <stem>` — overrides JSON `filename`

---

## Steps

### 1. Build slides from spec

```bash
cd /Users/robinsadeghpour/content-workflow
node .claude/skills/generate-personal-slides/scripts/build.js \
  <spec.json> --output <dir>
```

`build.js` handles the full pipeline:
1. Resolves each `photo: "auto"` against `media/images/tiktok/catalog.json` using keyword matching
2. Validates each `overlay.image` path
3. Calls `scripts/generate-tiktok-slides.js` to composite text + photo + overlay → 1080×1920 PNGs
4. If `platform: "instagram"`, sharp-crops each slide to 1080×1350 (center, cover)

### 2. Output

- `<output-dir>/slide-01.png` … `slide-NN.png`
- TikTok: 1080×1920 each
- Instagram: 1080×1350 each
- JSON summary printed to stdout: `{ slides, format, photos_used }`

---

## Photo catalog

Source of truth: `media/images/tiktok/catalog.json` (31 photos as of 2026-02-16).

Categories: `workspace`, `outdoor`, `travel`, `casual`, `proof`.

Each photo entry has `description`, `mood`, `best_for[]` — the auto-matcher scores these against `photo_keywords` (case-insensitive substring + token overlap).

**Same photos are used for TikTok EN, TikTok DE, and Instagram.** Only the text differs across language variants.

---

## Key rules

- **No emoji in slide text** — node-canvas can't render them
- **No synthesized overlays.** Overlays must be real PNG/JPG files. For GitHub repos, use the `repo-screenshot` subagent. For screenshots of real apps/terminals, take an actual screenshot.
- **Slide count: 2–12** — enforced by the underlying renderer
- **Instagram is cropped from a 1080×1920 render**, not generated independently
- **TikTok DE reuses the same photos as EN** — caller passes the German `text`, photos stay
- **No personal slides on LinkedIn** — caller should route LinkedIn through `generate-branded-slides`

---

## Notes

- The renderer is `scripts/generate-tiktok-slides.js` (node-canvas, project root). The skill is a thin orchestrator over it — it doesn't reimplement compositing.
- Catalog path is hardcoded to `media/images/tiktok/catalog.json`. If the catalog moves, update `build.js`.
