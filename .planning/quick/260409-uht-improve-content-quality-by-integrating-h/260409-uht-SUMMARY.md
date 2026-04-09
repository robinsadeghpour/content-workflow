---
phase: quick-260409-uht
plan: 01
subsystem: writing-skills
tags: [voice-profiles, storytelling, hooks, content-quality, tiktok, linkedin]
dependency-graph:
  requires: []
  provides:
    - storytelling-framework.md reference file
    - expanded hook patterns in voice-casual.xml and voice-linkedin.xml
    - framework wiring in writing, tiktok-slideshows, generate-content skills
  affects:
    - .claude/skills/writing/data/voice-casual.xml
    - .claude/skills/writing/data/voice-linkedin.xml
    - .claude/skills/writing/data/storytelling-framework.md
    - .claude/skills/writing/SKILL.md
    - .claude/skills/tiktok-slideshows/references/content-strategy.md
    - .claude/skills/generate-content/SKILL.md
tech-stack:
  added: []
  patterns:
    - Hook → Context → Tension → Pivot → Payoff 5-part story structure
    - "You for desires, I for problems" pronoun strategy
    - Open loops and re-hooks for attention retention
    - Research-sourced hooks at weight 6.0 (untested, below Robin's proven patterns)
key-files:
  created:
    - .claude/skills/writing/data/storytelling-framework.md
  modified:
    - .claude/skills/writing/data/voice-casual.xml
    - .claude/skills/writing/data/voice-linkedin.xml
    - .claude/skills/writing/SKILL.md
    - .claude/skills/tiktok-slideshows/references/content-strategy.md
    - .claude/skills/generate-content/SKILL.md
decisions:
  - Research hooks assigned weight 6.0 (below Robin's 7.5-9.5 range) — untested patterns need performance data before elevation
  - storytelling-framework.md kept under 120 lines as a reference guide, not an exhaustive manual
  - Framework wired as an explicit read step in all three generation skills so it cannot be skipped
metrics:
  duration: ~15min
  completed: 2026-04-09
  tasks-completed: 2
  files-modified: 6
---

# Quick Task 260409-uht: Improve Content Quality by Integrating Hook Formulas, Storytelling Framework, and Psychology Techniques

**One-liner:** Added 38+ hook formulas across 10 new categories plus Jade's 5-part story structure and jun_yuh psychology techniques, wired as mandatory reads into all three content generation skills.

## What Was Done

### Task 1: Expand voice profiles + create storytelling framework

**voice-casual.xml** — Added 7 new hook categories (28 new examples total), all at weight 6.0 source="research":
- `lesson` — "this mistake cost me months of progress."
- `cliffhanger` — "i wasn't ready for what they said next."
- `emotional` — "if you've ever felt like giving up, this is for you."
- `controversial` — "i know i'll get hate for saying this, but…"
- `intrigue` — "i wasn't supposed to tell this story…"
- `trigger-phrase` — "nobody mentions this.", "let me save you hours."
- `parameterized` — "[time] of [niche] in 60 seconds", "i tried [blank] for [days]"

All 5 original Robin-sourced hooks preserved unchanged at their original weights (7.5-9.5).

**voice-linkedin.xml** — Added 3 new hook categories plus a `<storytelling-hooks>` section inside `<structural-inspiration>`:
- `lesson` — lesson + retrospective hooks for LinkedIn tone
- `credibility-template` — martinwang time-period templates adapted for LinkedIn
- `trigger-phrase` — richardensjr patterns adapted to sentence case
- `<storytelling-hooks>` — 5-part framework mapped to LinkedIn text format with re-hook patterns

**storytelling-framework.md** — Created 87-line reference guide covering:
1. 5-Part Story Structure (Hook/Context/Tension/Pivot/Payoff with good/bad examples)
2. Psychology Techniques (one-person address, you/I pronoun strategy, us-vs-problem framing)
3. Attention Retention (re-hooks, open loops, cause-effect chains, pivot cadence)
4. Common Mistakes (specificity, empty greetings, rushed payoff, one-idea rule, no emotion)

### Task 2: Wire framework into content generation skills

**writing/SKILL.md** — Three additions:
- Step 2b: explicit read of storytelling-framework.md before applying voice, with 4 evaluation questions
- Step 5 additions: storytelling structure check + psychology pronoun rules
- Two new Important Rules: always-read mandate, weight-adjustment reminder for research hooks

**tiktok-slideshows/references/content-strategy.md** — Two additions:
- New "Storytelling Psychology" section (5 techniques with slide-level application guidance)
- Checklist items 9-10: read framework + apply you/I and open loop techniques

**generate-content/SKILL.md** — Three additions:
- Step 1b: read storytelling-framework.md as the second step after loading the idea
- Step 3: TikTok EN generation guidance with Hook→Payoff structure + open loop requirement
- Step 8: LinkedIn generation guidance with compressed 5-part framework application
- New Key Rule: ALWAYS read storytelling-framework.md before generating content

## Commits

- `da643f1` — feat: expand voice profiles with research hooks and create storytelling framework
- `55a07b0` — feat: wire storytelling framework into content generation skills

## Deviations from Plan

None — plan executed exactly as written. All additions were additive; no existing content was removed or modified.

## Known Stubs

None. All additions are guidance/reference content, not data stubs.

## Self-Check: PASSED

- [x] `.claude/skills/writing/data/voice-casual.xml` — exists, 7 research hooks confirmed
- [x] `.claude/skills/writing/data/voice-linkedin.xml` — exists, 3 research hooks + storytelling-hooks confirmed
- [x] `.claude/skills/writing/data/storytelling-framework.md` — exists, 87 lines
- [x] `.claude/skills/writing/SKILL.md` — 2 references to storytelling-framework confirmed
- [x] `.claude/skills/tiktok-slideshows/references/content-strategy.md` — 2 references confirmed
- [x] `.claude/skills/generate-content/SKILL.md` — 2 references confirmed
- [x] `da643f1` — commit exists
- [x] `55a07b0` — commit exists
