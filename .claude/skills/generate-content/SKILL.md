---
name: generate-content
version: 1.0.0
description: |
  Generate platform-native content for all channels from a kept idea. Produces TikTok EN, TikTok DE, Instagram, and LinkedIn drafts with voice profiles applied and critic review completed. Use when Robin says '/generate-content', 'create content for idea X', or 'generate posts from this topic'.
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---

# generate-content — Full Pipeline Content Generation

One command turns a kept idea into platform-native drafts across all 4 channels, with critic review applied before Robin sees anything.

## Usage

```
/generate-content <idea_id> [--linkedin-format <carousel|text|infographic|personal>]
```

- `<idea_id>` — the UUID of a kept idea from `data/content.db`
- `--linkedin-format` — override the auto-suggested LinkedIn format (optional)

## What It Does (Step by Step)

1. **Read the kept idea** from `data/content.db` (must have `status = 'kept'`)
1b. **Read storytelling framework** from `.claude/skills/writing/data/storytelling-framework.md` — use the 5-part structure and psychology techniques to inform content generation across all platforms.
2. **Determine visual approach** from `idea.visual_approach` in DB; falls back to `photo_overlay` if photo catalog has photos, `ai_generated` if not
3. **Generate TikTok EN content** via Claude API using `voice-casual.xml` — 3-8 slides with hook, body, CTA. Structure the slideshow using Hook → Context → Tension → Pivot → Payoff progression. Apply psychology techniques: address one person, use "I" for problem slides and "you" for result/CTA slides, embed at least one open loop or re-hook in slides 3-4.
4. **Render TikTok EN slides**:
   - `photo_overlay` path: keyword-match slides to catalog photos → `generate-tiktok-slides.js`
   - `ai_generated` path: `generate-ai-slides.js` for base images → `generate-tiktok-slides.js` for text overlay
5. **Generate TikTok DE content** via Claude API with `<localization-de>` rules from `voice-casual.xml` — reuses EN photo paths, only text changes
6. **Render TikTok DE slides** using the same slide renderer with German texts
7. **Generate Instagram carousel** by cropping TikTok EN slides to 1080x1350 via sharp — no second render, no German version
8. **Generate LinkedIn content** via Claude API using `voice-linkedin.xml` — auto-suggests format from content angle; calls `generate-linkedin-content.js`. Apply the 5-part framework compressed for text: opening hook line → 1-2 context sentences → tension paragraph → pivot line → payoff with soft CTA. Use re-hooks if the post exceeds 5 paragraphs.
9. **Run critic agent** as a SEPARATE process (fresh context — per D-12) on all 4 platform drafts
10. **Save critic-approved drafts** to `data/content.db` with `status = 'critic_approved'`
11. **Report results** to Robin — summary table of all drafts and their critic status

## Implementation

Run these commands in sequence:

```bash
cd /Users/robinsadeghpour/content-workflow
node scripts/generate-content.js --idea <idea_id> [--linkedin-format <format>]
node scripts/apply-critic.js --idea <idea_id>
```

Then read the critic output (JSON on stdout) and present results to Robin as a summary table.

## Output to Robin

After both scripts complete, display:

```
Content generation complete for idea: <idea_id>

Platform      | Format     | Status
------------- | ---------- | ------
TikTok EN     | slideshow  | critic_approved
TikTok DE     | slideshow  | critic_approved
Instagram     | carousel   | critic_approved
LinkedIn      | <format>   | critic_approved

Files: media/output/<idea_id>/

Next step: Run /review to approve drafts for scheduling, then /postiz to schedule in Phase 4.
```

If any drafts have `status = 'critic_failed'`, display a warning:

> "**Warning:** X draft(s) failed critic review after 3 attempts — review manually before scheduling."

## Key Rules

- **ALWAYS read storytelling-framework.md before generating content.** The framework provides structural and psychological guidance that applies across all platforms. Path: `.claude/skills/writing/data/storytelling-framework.md`
- **NEVER generate content without reading the voice profile first.** `voice-casual.xml` and `voice-linkedin.xml` must be read before any generation pass (per writing/SKILL.md).
- **NEVER use gpt-image-1 or gpt-image-1.5 for slide generation.** All AI slide images use Gemini via `generate-ai-slides.js` (per D-01).
- **NEVER use DeepL for German localization.** German TikTok content is localized inline by Claude using `@anthropic-ai/sdk` with the `<localization-de>` rules from `voice-casual.xml` (per D-09).
- **Critic MUST run as a separate invocation.** `apply-critic.js` is called as its own `node` process with fresh context — never inline inside `generate-content.js` (per D-12).
- **If `critic_failed` drafts exist**, present them to Robin with a clear warning. Robin decides whether to manually revise or skip.
- **No post publishes without Robin's explicit approval.** This skill generates and gates drafts — Phase 4 handles scheduling after Robin approves.

## Dependencies

- `scripts/generate-content.js` — orchestrator (TikTok EN/DE, Instagram crop, LinkedIn)
- `scripts/apply-critic.js` — critic agent (voice, slide quality, factual accuracy)
- `scripts/generate-tiktok-slides.js` — slide renderer with text overlay
- `scripts/generate-ai-slides.js` — Gemini AI slide image generator
- `scripts/generate-linkedin-content.js` — LinkedIn PDF/infographic/text generator
- `.claude/skills/writing/data/voice-casual.xml` — TikTok/Instagram voice profile
- `.claude/skills/writing/data/voice-linkedin.xml` — LinkedIn voice profile
- `data/content.db` — idea backlog and draft storage
- `media/output/<idea_id>/` — generated slide files
