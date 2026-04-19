# Instagram Carousel Slide Template

Generate carousel slides as a single HTML file. Each slide is **1080x1350px** following the AGENCY brand — same dark tokens as LinkedIn, but with chunkier caps typography (IG energy) instead of Cormorant serif elegance.

This template is a **component library** — pick the components that fit your content. Do NOT force a rigid slide structure.

## Visual Identity vs LinkedIn

| | LinkedIn | Instagram |
|---|---|---|
| Dimensions | 1080x1350 | 1080x1350 |
| Headline font | Cormorant Garamond (serif) | Outfit 800 UPPERCASE |
| Tone | Elegant, editorial | Chunky, punchy, scroll-stopping |
| Accent | Gradient text | Solid orange `#F8863A` |
| Counter/label | Optional handle | **Always** label pill + counter |
| Body font | Outfit 300 | Outfit 400 |
| Person photo | Common (hook slide) | Optional |

Brand tokens (`--bg`, `--fg`, `--accent`, gradient, etc.) are **identical** to LinkedIn. Only the headline treatment and component set change.

## Full CSS + working example

Copy `slide-template.html` verbatim as your starting point. It contains a complete `<style>` block plus four working example slides (hook, solution with comparison cards, how-it-works with numbered list, CTA outro).

## Slide Structure

Every slide has:
1. **4px gradient bar** at top (`::before` pseudo-element)
2. **Header**: `.label-pill` left (category tag with dot), `.slide-counter` right (e.g. `3 / 10`)
3. **Content area**: flex-grow, vertically centered
4. **Footer** (middle slides): `.footer-handle` left (`@robinfaraj`), `.footer-swipe` right (`swipe to know more →`)
5. **Last slide (CTA)**: no footer, centered content, `cta-handle` + `cta-button`

```html
<div class="slide">
  <div class="slide-header">
    <span class="label-pill"><span class="dot"></span>Category Name</span>
    <span class="slide-counter">3 / 10</span>
  </div>
  <div class="slide-content">
    <!-- content here -->
  </div>
  <div class="slide-footer">
    <span class="footer-handle">@robinfaraj</span>
    <span class="footer-swipe">swipe to know more →</span>
  </div>
</div>
```

## Slide Components

### Hook Slide (always first)
Massive chunky headline with one accent word. Label pill = topic, counter = `1 / N`. Body text sets up the promise.

```html
<h1 class="headline headline--xl">
  Big <span class="accent">hook</span><br>
  headline here.
</h1>
<p class="body-text">One-sentence promise of what they'll learn.</p>
```

Headline size guidance:
- `headline--xl` (140px) — 4-6 words, 3-4 lines. Use on hook slide.
- `headline--lg` (118px) — middle slides with headlines + body.
- `headline--md` (96px) — when you need room for a comparison or list underneath.
- `headline--sm` (72px) — rare; when headline shares space with heavy components.

### Comparison Slide (Without / With)
Signature IG component. Use for "old way vs new way", "problem vs solution", "before vs after".

```html
<div class="compare">
  <div class="compare-card neg">
    <div class="compare-head">Without this setup</div>
    <ul>
      <li>Pain point 1</li>
      <li>Pain point 2</li>
    </ul>
  </div>
  <div class="compare-card pos">
    <div class="compare-head">With [solution]</div>
    <ul>
      <li>Benefit 1</li>
      <li>Benefit 2</li>
    </ul>
  </div>
</div>
```

Max 4 items per card. Keep items parallel in length.

### Numbered List Slide
For step-by-step explanations or ordered takeaways. Each row is a surface card with an orange circle number, a bold title, and a short description.

```html
<div class="numbered-list">
  <div class="numbered-row">
    <div class="circle">1</div>
    <div class="row-body">
      <div class="row-title">Step title</div>
      <div class="row-desc">One-sentence explanation.</div>
    </div>
  </div>
  <!-- repeat for 2, 3, ... -->
</div>
```

Max 4 numbered rows per slide (they're generous). For 5+ items, split across two slides.

### Solution/Explanation Slide
Label pill + headline + body paragraph. Use as the payoff after the hook.

```html
<h2 class="headline headline--lg">
  Obsidian is<br>
  your <span class="accent">Claude's</span><br>
  brain.
</h2>
<p class="body-text">Explanation paragraph.</p>
```

### CTA Slide (always last)
Centered content, no footer. Headline with accent, divider, body text, handle, follow button.

```html
<div class="slide slide--cta">
  <div class="slide-header">
    <span class="label-pill"><span class="dot"></span>That's a wrap</span>
    <span class="slide-counter">10 / 10</span>
  </div>
  <div class="slide-content">
    <h2 class="headline headline--lg">
      Follow for<br>
      <span class="accent">daily AI</span><br>
      drops.
    </h2>
    <div class="divider" style="margin: 40px auto;"></div>
    <p class="body-text" style="text-align: center;">One-line value prop.</p>
    <div class="cta-handle">@robinfaraj</div>
    <div class="cta-button">Follow for daily AI drops</div>
  </div>
</div>
```

## Accent Rules

- **One accent word per headline maximum.** Two accent words per slide absolute max. The accent is for the single word that carries the promise.
- Use `.accent` (solid orange) by default. Use `.accent-gradient` only when the word is long enough (4+ letters) to show the gradient.
- Never accent a generic word ("the", "is", "with"). Accent the noun or verb that the slide pivots on.

## Person Photo (optional)

Same pattern as LinkedIn — absolute-positioned at the bottom center. Use on hook slide when the post is personal/narrative. Skip it on info-dense slides (comparison, numbered list).

```html
<img class="person-photo" src="robin-portrait-clear-background.png" alt="Robin" style="height: 600px;">
```

## Slide Count Guidelines

Instagram carousels perform best with **8-10 slides**. Design slide count based on content, not a fixed template:
- **Single insight post** → hook + 3 body slides + CTA (5 total)
- **How-to / tutorial** → hook + solution + 3-5 step slides + CTA (6-8 total)
- **List post ("N things")** → hook + N item slides + takeaway + CTA (N+3 total)
- First slide always has biggest headline (`headline--xl`)
- Last slide is always the CTA outro

## After Generating

Run the existing screenshot script (shared with LinkedIn) to export each `.slide` element as a PNG:
```bash
~/.local/pipx/venvs/notebooklm-py/bin/python3 ~/.claude/skills/linkedin/scripts/screenshot-slides.py <html-file> <output-dir>
```

The script captures every `.slide` at 2x DPR — same pipeline as LinkedIn, no new script needed.
