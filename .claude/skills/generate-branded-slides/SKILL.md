---
name: generate-branded-slides
description: "Render branded LinkedIn carousel slides from a structured spec using example brand templates. Always 1080×1350. Use when the caller has finalized slide copy and wants on-brand LinkedIn visuals. NOT a content writer — caller supplies the slide copy."
allowed-tools: Bash, Read, Write, Edit
argument-hint: "<spec.json> [--output <dir>] [--format html|png|pdf|all] [--filename <stem>]"
---

# generate-branded-slides

Branded slide renderer for **LinkedIn**. Outputs **1080×1350** PNGs (and optional PDF) using example brand templates. **Output only** — does not write copy, do research, or invoke humanizer.

**LinkedIn only.** TikTok and Instagram NEVER use branded templates — they use `generate-personal-slides` (real photos from the catalog). The skill itself is platform-agnostic at the renderer level, but the project rule is firm: branded = LinkedIn, personal = TikTok/Instagram.

## When to use

- LinkedIn carousel post — caller has finalized post copy and a slide breakdown
- `/generate-content` orchestrator delegates the LinkedIn visual step here

## When NOT to use

- Target platform is TikTok or Instagram → use `generate-personal-slides` (real photos)
- Caller hasn't decided slide copy → upstream content skill first
- Output isn't carousel slides (e.g., infographic) → use platform-specific skill

---

## Inputs

### Required: a slide spec (JSON)

```json
{
  "filename": "stack-2026-04-28",
  "slides": [
    {
      "layout": "hook",
      "kicker": "6 Tools",
      "headline": "The Claude Code stack<br/>running my<br/>Outbound."
    },
    {
      "layout": "numbered",
      "numeral": "01",
      "headline": "gtm-skills",
      "tag": "marketplace",
      "body": [
        "The whole pipeline as skills.",
        "Each step is a markdown file. Edit one prompt and the whole pipeline rewires."
      ],
      "pipeline": "hypothesis → list → enrichment → email gen → verification → send"
    },
    {
      "layout": "bullets",
      "kicker": "Feature 02",
      "headline": "What you get",
      "bullets": [
        "Parallel execution across subagents",
        "Isolated context windows per agent"
      ]
    },
    {
      "layout": "quote",
      "quote": "Same outbound. Without the SaaS tax.",
      "attribution": "— A folder of prompts & a few API keys"
    }
  ]
}
```

### Layout types

| `layout` | Required keys | Optional keys | Use for |
|---|---|---|---|
| `hook` | `headline` | `kicker` | Slide 1 — title card |
| `numbered` | `numeral`, `headline` | `tag`, `body[]`, `pipeline` | Numbered list items |
| `bullets` | `headline`, `bullets[]` | `kicker` | Feature lists |
| `quote` | `quote` | `attribution` | Pull quote / closing |
| `image-overlay` | `image` (absolute path) | `kicker`, `headline`, `caption` | Real screenshot / chart / repo card proof slide. Caller passes an absolute PNG path. For GitHub repo cards, dispatch the `repo-screenshot` subagent and use its returned path. **No synthesized fake-terminal overlays.** |

`headline` and `body[]` accept inline `<br/>` for line breaks. No other HTML.

### Flags

- `--output <dir>` — where to write the HTML (default: current working dir). Render outputs land here too unless overridden.
- `--filename <stem>` (overrides JSON `filename`)
- `--format html|png|pdf|all` (default: `all`) — controls what renders ships back

---

## Steps

### 1. Build HTML from spec

The skill is **self-contained** — templates and assets are vendored in `templates/` and `assets/`. The builder embeds absolute `file://` paths to `assets/example-logotype.svg` and `assets/example-background.png`, so the generated HTML works from any output directory.

```bash
~/.local/pipx/venvs/notebooklm-py/bin/python3 \
  .claude/skills/generate-branded-slides/scripts/build.py \
  <spec.json> --output <dir>
```

The builder prints the absolute HTML path on success.

### 2. Render (skip if `--format html`)

```bash
~/.local/pipx/venvs/notebooklm-py/bin/python3 \
  .claude/skills/generate-branded-slides/scripts/render.py \
  <html-path> <output-dir>
```

This produces:
- `<output-dir>/slide-1.png` … `slide-N.png` (1080×1350, 2× DPR)
- `<output-dir>/<filename>.pdf` (combined)

### 3. Filter outputs by `--format`

- `html` — leave only `<filename>.html` in the output dir
- `png` — copy slide-*.png to output dir, drop the PDF
- `pdf` — copy `<filename>.pdf`, drop the PNGs
- `all` (default) — keep everything

### 4. Open the result

- PDF: `open -R <pdf_path>`
- PNGs: `open <output-dir>` (Finder)
- HTML: `open <html_path>` (browser)

---

## Brand contract (DO NOT drift)

Read `references/brand-tokens.md` for the full palette, fonts, and spacing tokens.

Quick reference:

- **Slide:** 1080 × 1350 px, neutral `#fafaf8` bg with optional `example-background.png` overlay
- **Accent:** accent-600 `#4f46e5`
- **Body text:** text-950 `#0f172a`
- **Fonts:** Inter (kicker/numeral), Inter (headline/body), no others
- **Eyebrow rule:** example-logotype.svg @ 52px height, 20px accent tick under logo, top line offset to `left: 136px`, bottom line full-width
- **No emojis, no AI gradient bars, no person photos** (all of these are *old* template patterns — strip if you see them)

---

## Output

After running, present the user:

1. Paths to outputs (HTML / PNGs / PDF as applicable)
2. Slide count
3. `open -R <pdf>` invocation if PDF was produced

Do not generate a preview image inline — let the user open it themselves.

---

## Notes

- **Templates are read-only references.** Do not edit `the local private brand source` — that path is for the local private brand. The builder composes new files from `references/layout-library.md`.
- **If the spec asks for a layout that isn't `hook | numbered | bullets | quote`**, fail loudly — do not invent a fifth layout.
- **Aspect ratio is always 1080×1350.** This skill ships one canvas size on purpose. On TikTok the slide displays centered with neutral padding — that's the brand look. For full-bleed 9:16 visuals, use `generate-personal-slides`.
