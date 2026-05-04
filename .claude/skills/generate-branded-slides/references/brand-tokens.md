# Brand tokens

CSS custom properties used by the example renderer. Defined inline in `scripts/build.py`.

## Colors

| Token | Default | Role |
|---|---|---|
| `--bg` | `#fafaf8` | Slide background fill (sits behind the bg image) |
| `--accent-600` | `#4f46e5` | Primary accent — kicker text, numerals, rules, list bullets |
| `--accent-500` | `#6366f1` | Secondary accent (rarely used) |
| `--text-950` | `#0f172a` | Primary headline + body text |

Body copy uses `rgba(15, 23, 42, 0.85)` for soft text, `rgba(15, 23, 42, 0.72)` for captions.

## Fonts

Single family: **Inter** (loaded from Google Fonts, weights 400/500/600/700). Falls back to `system-ui, sans-serif`.

Italic Inter is used for inline tags ("the foundation"), pipeline annotations, and pull-quote attributions.

## Layout dimensions

- Canvas: **1080 × 1350 px**
- Outer padding: 56px
- Eyebrow rule height: 112px (logo at 52px tall, anchored bottom-left)
- Type sizes per layout: see CSS in `scripts/build.py`

## Rebranding

To rebrand without touching layout:
1. Drop your logo as `assets/logotype.svg` and your background as `assets/social-background.png`. The `_pick()` resolver in `build.py` prefers these over the example placeholders.
2. Edit the `:root` CSS variables in `build.py` (just the 4 values: `--bg`, `--accent-600`, `--accent-500`, `--text-950`).
3. Optionally swap the `Inter` font family to your own brand typeface.

Layout positions, sizes, and the eyebrow rule structure stay the same.
