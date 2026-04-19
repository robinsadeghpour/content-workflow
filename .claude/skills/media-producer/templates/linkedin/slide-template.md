# LinkedIn Carousel Slide Template

Generate carousel slides as a single HTML file. Each slide is 1080x1350px following the AGENCY brand.

This template is a **component library** — pick the components that fit your content. Do NOT force a rigid 5-slide structure.

## Gold Standard Reference

Always also read `~/WebstormProjects/11x/public/linkedin-slides-saas-dying.html` for a complete working example.

## Full CSS

Copy this CSS block verbatim into every carousel HTML file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LinkedIn Carousel Slides</title>

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500&family=JetBrains+Mono:wght@400;500&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">

  <style>
    /* --- Brand Tokens --- */
    :root {
      --bg: #050505;
      --fg: #FAFAFA;
      --surface: #141414;
      --border: #2A2A2A;
      --text-secondary: #B5B5B5;
      --text-muted: #8A8A8A;
      --gradient-rgb: linear-gradient(
        90deg,
        #33090F 0%, #C93B32 13%, #F8863A 25%,
        #C8D47A 38%, #6A8E50 50%, #002211 62%,
        #001A3D 74%, #3B7FCC 86%, #99CCFF 97%
      );
      --gradient-text: linear-gradient(
        90deg,
        #D4907A 0%, #E8B87A 35%, #CDD48A 65%, #8AAE6A 100%
      );
      --slide-w: 1080px;
      --slide-h: 1350px;
    }

    /* --- Reset & Page --- */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: #1a1a1a;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 48px;
      padding: 60px 20px;
      font-family: 'Outfit', sans-serif;
    }

    .page-label {
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      width: var(--slide-w);
      max-width: 100%;
    }

    /* --- Slide Base --- */
    .slide {
      width: var(--slide-w);
      height: var(--slide-h);
      background: var(--bg);
      color: var(--fg);
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }

    /* --- Gradient Top Bar --- */
    .slide::before {
      content: "";
      display: block;
      width: 100%;
      height: 4px;
      background: var(--gradient-rgb);
      flex-shrink: 0;
    }

    /* --- Header --- */
    .slide-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 40px 64px 0;
      flex-shrink: 0;
    }

    .header-name {
      font-family: 'Outfit', sans-serif;
      font-weight: 500;
      font-size: 36px;
      color: var(--fg);
      letter-spacing: -0.01em;
    }

    .header-handle {
      font-family: 'JetBrains Mono', monospace;
      font-size: 24px;
      font-weight: 400;
      color: var(--text-muted);
      letter-spacing: 0.02em;
    }

    /* --- Footer --- */
    .slide-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 64px 48px;
      flex-shrink: 0;
    }

    .footer-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 28px;
      font-weight: 400;
      color: var(--text-muted);
      letter-spacing: 0.02em;
    }

    .footer-arrow {
      font-size: 40px;
      color: var(--text-muted);
      line-height: 1;
    }

    /* --- Content Area --- */
    .slide-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 0 64px;
    }

    /* --- Typography --- */
    .headline {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-weight: 600;
      line-height: 1.15;
      letter-spacing: -0.03em;
      color: var(--fg);
    }

    .headline--xl { font-size: 96px; }
    .headline--lg { font-size: 84px; }
    .headline--md { font-size: 72px; }

    .body-text {
      font-family: 'Outfit', sans-serif;
      font-weight: 300;
      font-size: 40px;
      line-height: 1.55;
      color: var(--text-secondary);
    }

    .body-text + .body-text { margin-top: 28px; }

    .quote-text {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-weight: 500;
      font-style: italic;
      font-size: 64px;
      line-height: 1.25;
      color: var(--fg);
      letter-spacing: -0.01em;
    }

    .label-text {
      font-family: 'JetBrains Mono', monospace;
      font-size: 26px;
      font-weight: 400;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    /* --- Command label (for feature/tool names) --- */
    .command {
      font-family: 'JetBrains Mono', monospace;
      font-size: 28px;
      font-weight: 500;
      color: var(--fg);
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 8px 20px;
      border-radius: 6px;
      display: inline-block;
      margin-bottom: 16px;
    }

    /* --- Gradient Text Accent --- */
    .accent {
      background: var(--gradient-text);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* --- Divider --- */
    .divider {
      width: 80px;
      height: 3px;
      background: var(--gradient-rgb);
      margin: 40px 0;
    }

    /* --- Inline Quote --- */
    .inline-quote {
      border-left: 3px solid;
      border-image: var(--gradient-rgb) 1;
      padding-left: 28px;
      margin: 32px 0;
    }

    .inline-quote p {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-weight: 500;
      font-style: italic;
      font-size: 52px;
      line-height: 1.3;
      color: var(--fg);
    }

    /* --- Person Photo --- */
    .person-photo {
      position: absolute;
      bottom: -20px;
      left: 50%;
      transform: translateX(-50%);
      height: 520px;
      width: auto;
      object-fit: contain;
      pointer-events: none;
    }

    /* --- Numbered List --- */
    .numbered-item {
      display: flex;
      gap: 24px;
      align-items: baseline;
      margin-bottom: 36px;
    }

    .numbered-item .num {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-weight: 600;
      font-size: 72px;
      line-height: 1;
      background: var(--gradient-text);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      flex-shrink: 0;
    }

    .numbered-item .item-text {
      font-family: 'Outfit', sans-serif;
      font-weight: 400;
      font-size: 38px;
      line-height: 1.4;
      color: var(--text-secondary);
    }
  </style>
</head>
```

## Slide Structure

Every slide has:
1. **4px gradient bar** at top (via `::before` pseudo-element)
2. **Header**: `.header-name` (Outfit 500, 36px) left, optional `.header-handle` (JetBrains Mono 24px, muted) right — use for slide counter like "3/6"
3. **Content area**: flex-grow, vertically centered
4. **Footer** (middle slides): `.footer-label` ("swipe →") left, `.footer-arrow` ("→") right
5. **No footer** on the last slide (or empty footer-label)

```html
<div class="slide">
  <div class="slide-header">
    <span class="header-name">Robin Faraj</span>
    <span class="header-handle">1/5</span>  <!-- optional counter -->
  </div>
  <div class="slide-content">
    <!-- content here -->
  </div>
  <div class="slide-footer">
    <span class="footer-label">swipe →</span>
    <span class="footer-arrow">→</span>
  </div>
</div>
```

## Slide Components (pick what fits the content)

### Hook Slide (always first)
Big headline + person photo. No footer.
```html
<div class="slide slide--hook">
  <div class="slide-header">
    <span class="header-name">Robin Faraj</span>
  </div>
  <div class="slide-content" style="justify-content: flex-start; padding-top: 80px;">
    <h1 class="headline headline--xl">
      Big <span class="accent">hook</span><br>
      headline here.
    </h1>
  </div>
  <img class="person-photo" src="robin-portrait-clear-background.png" alt="Robin" style="height: 700px;">
</div>
```

### Quote Slide
Key quote + supporting paragraph.
```html
<div class="slide slide--quote">
  <!-- header -->
  <div class="slide-content">
    <p class="quote-text" style="font-size: 56px;">
      "Quote text with <span class="accent">accent words</span>."
    </p>
    <div class="divider"></div>
    <p class="body-text">Supporting paragraph.</p>
  </div>
  <!-- footer with "swipe →" -->
</div>
```

### Point/Implication Slide
Label + headline + body. Use for each key point in a series.
```html
<div class="slide slide--text">
  <!-- header -->
  <div class="slide-content">
    <span class="label-text" style="margin-bottom: 32px;">Point #1</span>
    <h2 class="headline headline--lg">
      Headline with <span class="accent">accent</span>.
    </h2>
    <div class="divider"></div>
    <p class="body-text">Explanation text.</p>
  </div>
  <!-- footer with "swipe →" -->
</div>
```

### Command/Feature Slide
For showcasing tools, features, or commands.
```html
<div class="slide slide--feature">
  <!-- header -->
  <div class="slide-content">
    <span class="command">/tool-name</span>
    <h2 class="headline headline--lg">
      What it <span class="accent">does</span>.
    </h2>
    <div class="divider"></div>
    <p class="body-text">Description.</p>
  </div>
  <!-- footer with "swipe →" -->
</div>
```

### Numbered List Slide
For summaries, takeaways, lists.
```html
<div class="slide slide--closing">
  <!-- header -->
  <div class="slide-content" style="align-items: center; text-align: center;">
    <span class="label-text" style="margin-bottom: 48px;">The takeaway</span>
    <h2 class="headline headline--md" style="margin-bottom: 56px;">
      Headline <span class="accent">here</span>.
    </h2>
    <div class="numbered-item" style="text-align: left;">
      <span class="num">1</span>
      <span class="item-text">First item</span>
    </div>
    <div class="numbered-item" style="text-align: left;">
      <span class="num">2</span>
      <span class="item-text">Second item</span>
    </div>
    <div class="numbered-item" style="text-align: left;">
      <span class="num">3</span>
      <span class="item-text">Third item</span>
    </div>
  </div>
  <!-- no footer on last slide -->
</div>
```

### Inline Quote Block
Use within any slide's content area.
```html
<div class="inline-quote">
  <p>"Quoted text here."</p>
</div>
```

## Person Photos

- Robin: `~/WebstormProjects/11x/public/robin-portrait-clear-background.png`
- Joschua: `~/WebstormProjects/11x/public/joschua_cutout.png`

Always verify paths exist before use. Use absolute paths in the HTML `src` attribute.

## Slide Count Guidelines

Design slide count based on content, not a fixed template:
- **N distinct points** → hook + N point slides (+ optional closing)
- **Story arc** → hook + 2-3 narrative slides + closing
- **Single insight** → hook + quote + 1-2 body slides
- First slide always has person photo
- Last slide has no "swipe →" footer

## After Generating

Run the screenshot script to export each slide as PNG and combine into PDF:
```bash
~/.local/pipx/venvs/notebooklm-py/bin/python3 ~/.claude/skills/linkedin/scripts/screenshot-slides.py <html-file> <output-dir>
```
