#!/usr/bin/env python3
"""Build a branded LinkedIn carousel HTML deck from a JSON spec.

Usage:
  build.py <spec.json> [--filename <stem>]

The output HTML is written next to the assets so that
relative paths to the logo and background image resolve when
Playwright loads file://.

Spec format:
  {
    "filename": "stack-2026-04-28",
    "slides": [
      { "layout": "hook", "kicker": "...", "headline": "..." },
      { "layout": "numbered", "numeral": "01", "headline": "...",
        "tag": "...", "body": ["..."], "pipeline": "..." },
      { "layout": "bullets", "kicker": "...", "headline": "...",
        "bullets": ["...", "..."] },
      { "layout": "quote", "quote": "...", "attribution": "..." }
    ]
  }
"""

import json
import sys
from pathlib import Path
from html import escape

SKILL_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = SKILL_DIR / "assets"

# Asset resolution: prefer a local private brand override at the canonical path,
# fall back to the committed `example-*` placeholders. Drop your own
# `logotype-<brand>.svg` and `social-background-<brand>.png` into assets/ and
# update these paths to use your private brand without touching the public repo.
def _pick(*candidates):
    for c in candidates:
        if c.exists():
            return c
    return candidates[-1]

LOGO_PATH = _pick(ASSETS_DIR / "logotype.svg", ASSETS_DIR / "example-logotype.svg")
BG_PATH = _pick(ASSETS_DIR / "social-background.png", ASSETS_DIR / "example-background.png")

# CSS uses neutral example tokens (Inter font, slate palette, indigo accent).
# Swap these values to rebrand without changing any layout positioning.
CSS = r"""
:root {
  --bg: #fafaf8;
  --accent-600: #4f46e5;
  --accent-500: #6366f1;
  --text-950: #0f172a;
  --frame: #0a0a0a;
  --slide-w: 1080px;
  --slide-h: 1350px;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: #1a1a1a;
  min-height: 100vh;
  display: flex; flex-direction: column; align-items: center;
  gap: 24px; padding: 32px 16px 64px;
}
.slide-frame { width: var(--slide-w); height: var(--slide-h); flex-shrink: 0; }
.slide {
  width: 100%; height: 100%;
  background-color: var(--bg);
  background-image: url("__BG_URL__");
  background-size: cover; background-position: center;
  color: var(--text-950);
  position: relative; overflow: hidden;
  display: flex; flex-direction: column;
}
.top-rule {
  position: relative; padding: 54px 56px 0;
  flex-shrink: 0; z-index: 2; height: 112px;
}
.top-rule__logotype {
  height: 52px; width: auto; object-fit: contain; display: block;
  position: absolute; left: 56px; bottom: 22px; z-index: 2;
}
.top-rule__logo-underline {
  position: absolute; left: 56px; width: 20px; bottom: 22px;
  height: 3px; background: var(--accent-600);
}
.top-rule__line {
  position: absolute; left: 136px; right: 56px; bottom: 22px;
  height: 3px; background: var(--accent-600);
}
.top-rule__line-bottom {
  position: absolute; left: 56px; right: 56px; bottom: 14px;
  height: 3px; background: var(--accent-600);
}

/* HOOK */
.slide--hook .slide-content {
  position: relative; z-index: 2; padding: 56px 56px 0;
  display: flex; flex-direction: column; align-items: flex-start;
}
.slide-kicker {
  font-family: "Inter", system-ui, sans-serif; font-weight: 500;
  font-size: 110px; line-height: 1.2; letter-spacing: -0.01em;
  color: var(--accent-600); display: inline-block;
  margin-bottom: 32px; border-bottom: 4px solid var(--accent-600);
}
.slide-headline {
  font-family: "Inter", system-ui, sans-serif; font-weight: 500;
  font-size: 96px; line-height: 1.1; letter-spacing: -0.02em;
  color: var(--text-950); max-width: 13ch;
}

/* NUMBERED */
.slide--numbered .slide-content {
  position: relative; z-index: 2; padding: 72px 56px 56px;
  display: flex; flex-direction: column; align-items: flex-start; flex: 1;
}
.slide-numeral {
  font-family: "Inter", system-ui, sans-serif; font-weight: 500;
  font-size: 160px; line-height: 1; letter-spacing: -0.02em;
  color: var(--accent-600); display: inline-block;
  margin-bottom: 40px; padding-bottom: 4px;
  border-bottom: 4px solid var(--accent-600);
}
.slide-tool-headline {
  font-family: "Inter", system-ui, sans-serif; font-weight: 500;
  font-size: 84px; line-height: 1.05; letter-spacing: -0.02em;
  color: var(--text-950); max-width: 14ch; margin-bottom: 16px;
}
.slide-tool-tag {
  font-family: "Inter", system-ui, sans-serif; font-style: italic;
  font-weight: 500; font-size: 32px; color: var(--accent-600);
  margin-bottom: 36px; letter-spacing: 0.01em;
}
.slide-body {
  font-family: "Inter", system-ui, sans-serif; font-weight: 400;
  font-size: 34px; line-height: 1.35;
  color: rgba(15, 23, 42, 0.85); align-self: stretch; max-width: 84%;
}
.slide-body + .slide-body { margin-top: 22px; }
.pipeline {
  font-family: "Inter", system-ui, sans-serif; font-weight: 500;
  font-style: italic; font-size: 30px; line-height: 1.5;
  color: var(--accent-600); margin-top: 8px; margin-bottom: 22px;
}

/* BULLETS */
.slide--bullets .slide-content {
  position: relative; z-index: 2; padding: 72px 56px 56px;
  display: flex; flex-direction: column; align-items: flex-start; flex: 1;
}
.slide--bullets .slide-kicker {
  font-size: 64px; line-height: 1.1; letter-spacing: 0.02em;
  margin-bottom: 28px; padding-bottom: 2px;
  border-bottom: 3px solid var(--accent-600); text-transform: uppercase;
}
.slide--bullets .slide-headline {
  font-size: 72px; max-width: 14ch; margin-bottom: 48px;
}
.slide-bullets {
  list-style: none; display: flex; flex-direction: column; gap: 24px;
  margin: 0; padding: 0; align-self: stretch;
}
.slide-bullets li {
  font-family: "Inter", system-ui, sans-serif; font-weight: 400;
  font-size: 32px; line-height: 1.3; color: var(--text-950);
  position: relative; padding-left: 32px;
}
.slide-bullets li::before {
  content: ""; position: absolute; left: 0; top: 16px;
  width: 12px; height: 12px; background: var(--accent-600);
}

/* IMAGE-OVERLAY */
.slide--image-overlay .slide-content {
  position: relative; z-index: 2; padding: 56px 56px 56px;
  display: flex; flex-direction: column; align-items: flex-start; flex: 1;
}
.slide--image-overlay .slide-kicker {
  font-family: "Inter", system-ui, sans-serif; font-weight: 500;
  font-size: 64px; line-height: 1.1; letter-spacing: 0.02em;
  color: var(--accent-600); display: inline-block;
  margin-bottom: 20px; padding-bottom: 2px;
  border-bottom: 3px solid var(--accent-600); text-transform: uppercase;
}
.slide--image-overlay .slide-headline {
  font-family: "Inter", system-ui, sans-serif; font-weight: 500;
  font-size: 56px; line-height: 1.1; letter-spacing: -0.02em;
  color: var(--text-950); max-width: 18ch; margin-bottom: 32px;
}
.slide-image-frame {
  align-self: stretch; flex: 1; display: flex;
  align-items: center; justify-content: center;
  background: var(--bg);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.10);
  padding: 24px; min-height: 0;
}
.slide-image-frame img {
  max-width: 100%; max-height: 100%; width: auto; height: auto;
  object-fit: contain; display: block;
}
.slide-image-caption {
  font-family: "Inter", system-ui, sans-serif; font-style: italic;
  font-weight: 400; font-size: 28px; line-height: 1.35;
  color: rgba(15, 23, 42, 0.72); margin-top: 24px; align-self: stretch;
}

/* QUOTE */
.slide--quote .slide-content {
  position: relative; z-index: 2; padding: 56px 96px;
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; text-align: center; flex: 1;
}
.slide-quotemark {
  font-family: "Inter", system-ui, sans-serif; font-weight: 500;
  font-size: 240px; line-height: 0.8; color: var(--accent-600);
  display: block; margin-bottom: 24px;
}
.slide-quote {
  font-family: "Inter", system-ui, sans-serif; font-weight: 500;
  font-style: italic; font-size: 72px; line-height: 1.15;
  letter-spacing: -0.01em; color: var(--text-950);
  max-width: 16ch; margin-bottom: 40px;
}
.slide-attribution {
  font-family: "Inter", system-ui, sans-serif; font-weight: 500;
  font-size: 28px; line-height: 1.3; letter-spacing: 0.02em;
  color: var(--accent-600); text-transform: uppercase;
}
"""


def _br(s: str) -> str:
    """Allow only <br/> as inline markup; escape everything else."""
    parts = s.split("<br/>")
    return "<br/>".join(escape(p) for p in parts)


def _br_list(items):
    return [_br(i) for i in items]


def _eyebrow():
    return (
        '<div class="top-rule">'
        f'<img class="top-rule__logotype" src="file://{LOGO_PATH}" alt="" />'
        '<span class="top-rule__logo-underline"></span>'
        '<span class="top-rule__line"></span>'
        '<span class="top-rule__line-bottom"></span>'
        '</div>'
    )


def render_hook(s):
    headline = _br(s["headline"])
    kicker = f'<span class="slide-kicker">{_br(s["kicker"])}</span>' if s.get("kicker") else ""
    return f"""
  <div class="slide-frame">
    <div class="slide slide--hook">
      {_eyebrow()}
      <div class="slide-content">
        {kicker}
        <h1 class="slide-headline">{headline}</h1>
      </div>
    </div>
  </div>"""


def render_numbered(s):
    body_html = ""
    for line in s.get("body", []):
        body_html += f'<p class="slide-body">{_br(line)}</p>'
    pipeline = ""
    if s.get("pipeline"):
        pipeline = f'<p class="pipeline">{_br(s["pipeline"])}</p>'
    tag = ""
    if s.get("tag"):
        tag = f'<p class="slide-tool-tag">{_br(s["tag"])}</p>'
    return f"""
  <div class="slide-frame">
    <div class="slide slide--numbered">
      {_eyebrow()}
      <div class="slide-content">
        <span class="slide-numeral">{_br(s["numeral"])}</span>
        <h1 class="slide-tool-headline">{_br(s["headline"])}</h1>
        {tag}
        {body_html}
        {pipeline}
      </div>
    </div>
  </div>"""


def render_bullets(s):
    kicker = ""
    if s.get("kicker"):
        kicker = f'<span class="slide-kicker">{_br(s["kicker"])}</span>'
    items = "".join(f'<li>{_br(b)}</li>' for b in s.get("bullets", []))
    return f"""
  <div class="slide-frame">
    <div class="slide slide--bullets">
      {_eyebrow()}
      <div class="slide-content">
        {kicker}
        <h1 class="slide-headline">{_br(s["headline"])}</h1>
        <ul class="slide-bullets">{items}</ul>
      </div>
    </div>
  </div>"""


def render_quote(s):
    attribution = ""
    if s.get("attribution"):
        attribution = f'<span class="slide-attribution">{_br(s["attribution"])}</span>'
    return f"""
  <div class="slide-frame">
    <div class="slide slide--quote">
      {_eyebrow()}
      <div class="slide-content">
        <span class="slide-quotemark" aria-hidden="true">&ldquo;</span>
        <p class="slide-quote">{_br(s["quote"])}</p>
        {attribution}
      </div>
    </div>
  </div>"""


def render_image_overlay(s):
    image = s.get("image")
    if not image:
        raise ValueError("image-overlay layout requires an absolute 'image' path")
    image_path = Path(image)
    if not image_path.is_absolute():
        raise ValueError(f"image path must be absolute: {image}")
    if not image_path.exists():
        raise ValueError(f"image not found: {image}")
    kicker = ""
    if s.get("kicker"):
        kicker = f'<span class="slide-kicker">{_br(s["kicker"])}</span>'
    headline = ""
    if s.get("headline"):
        headline = f'<h1 class="slide-headline">{_br(s["headline"])}</h1>'
    caption = ""
    if s.get("caption"):
        caption = f'<p class="slide-image-caption">{_br(s["caption"])}</p>'
    return f"""
  <div class="slide-frame">
    <div class="slide slide--image-overlay">
      {_eyebrow()}
      <div class="slide-content">
        {kicker}
        {headline}
        <div class="slide-image-frame">
          <img src="file://{image_path}" alt="" />
        </div>
        {caption}
      </div>
    </div>
  </div>"""


RENDERERS = {
    "hook": render_hook,
    "numbered": render_numbered,
    "bullets": render_bullets,
    "quote": render_quote,
    "image-overlay": render_image_overlay,
}


def main():
    if len(sys.argv) < 2:
        print("Usage: build.py <spec.json> [--filename <stem>]", file=sys.stderr)
        sys.exit(2)

    spec_path = Path(sys.argv[1])
    if not spec_path.exists():
        print(f"Spec not found: {spec_path}", file=sys.stderr)
        sys.exit(2)

    spec = json.loads(spec_path.read_text())
    filename = spec.get("filename", "deck")
    if "--filename" in sys.argv:
        i = sys.argv.index("--filename")
        filename = sys.argv[i + 1]

    slides_html = []
    for idx, s in enumerate(spec.get("slides", []), 1):
        layout = s.get("layout")
        if layout not in RENDERERS:
            print(f"Slide {idx}: unsupported layout {layout!r}", file=sys.stderr)
            sys.exit(2)
        slides_html.append(RENDERERS[layout](s))

    if not slides_html:
        print("Spec has no slides", file=sys.stderr)
        sys.exit(2)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(filename)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>{CSS.replace("__BG_URL__", f"file://{BG_PATH}")}</style>
</head>
<body>
{''.join(slides_html)}
</body>
</html>
"""

    out_dir = Path.cwd()
    if "--output" in sys.argv:
        i = sys.argv.index("--output")
        out_dir = Path(sys.argv[i + 1]).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{filename}.html"
    out_path.write_text(html)
    print(str(out_path))


if __name__ == "__main__":
    main()
