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
  - Agent
  - SendMessage
  - Skill
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
1.5. **Research pass (D-06)** — produces a structured research brief at `data/research/<idea_id>.md` via NotebookLM (primary synthesizer per D-02). Uses cached `ideas.transcript` when available, adds the source URL, and supplements with fresh web research (`notebooklm source add-research`). One research pass feeds all 4 platform writers (consistent facts). Falls back to a research-thin stub if NotebookLM is unavailable — the `research_thin` flag is set on every draft so Robin can see which posts were generated from sparse research. Briefs are cached — if `data/research/<idea_id>.md` already exists, it's reused on re-runs. One research pass fires only when Robin invokes `/generate-content` for a kept idea — NEVER during the pulse discovery run (D-01). Only ideas Robin picks get researched.
2. **Determine visual approach** from `idea.visual_approach` in DB; falls back to `photo_overlay` if photo catalog has photos, `ai_generated` if not
3. **Generate TikTok EN content** via Claude API using `voice-casual.xml` — 3-8 slides with hook, body, CTA. Structure the slideshow using Hook → Context → Tension → Pivot → Payoff progression. Apply psychology techniques: address one person, use "I" for problem slides and "you" for result/CTA slides, embed at least one open loop or re-hook in slides 3-4.
4. **Render TikTok EN slides**:
   - `photo_overlay` path: keyword-match slides to catalog photos → `generate-tiktok-slides.js`
   - `ai_generated` path: `generate-ai-slides.js` for base images → `generate-tiktok-slides.js` for text overlay
5. **Generate TikTok DE content** via Claude API with `<localization-de>` rules from `voice-casual.xml` — reuses EN photo paths, only text changes
6. **Render TikTok DE slides** using the same slide renderer with German texts
7. **Generate Instagram carousel** by cropping TikTok EN slides to 1080x1350 via sharp — no second render, no German version
8. **Generate LinkedIn content** via Claude API using `voice-linkedin.xml` — auto-suggests format from content angle; calls `generate-linkedin-content.js`. Apply the 5-part framework compressed for text: opening hook line → 1-2 context sentences → tension paragraph → pivot line → payoff with soft CTA. Use re-hooks if the post exceeds 5 paragraphs.
9. **Run critic loop** per platform — scores hook / facts / economy (D-14), per-dimension pass bar at 8/10 (D-11), hard cap of 2 revisions (D-10). Revise output fully replaces the prior draft (D-13 — fixes the old CR-01 merge bug). On max-iters, the best-scored iteration is kept and flagged `did_not_pass_critic = 1`.
10. **Save critic-approved drafts** to `data/content.db` with `status = 'critic_approved'`
11. **Report results** to Robin — summary table of all drafts and their critic status

## Implementation

Spawn the **content-orchestrator** agent, which coordinates the full pipeline:

```
Agent(content-orchestrator):
  "Generate content for idea <idea_id>. LinkedIn format override: <format or 'auto'>."
```

The orchestrator handles all generation (writer agents), quality review (critic agents), media rendering (media-producer skill), and DB writes (db-write-draft.js). You do NOT need to run any scripts directly.

Present the orchestrator's summary output to Robin when it completes.

**Do NOT run `node scripts/generate-content.js` or `node scripts/apply-critic.js`** — these scripts were deleted in Phase 06.1. The pipeline now runs entirely through `.claude/agents/content-orchestrator.md` (invoked via `Agent(content-orchestrator)`), which spawns writer and critic sub-agents and invokes `scripts/research/run-notebooklm.sh` for the research pass.

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

## Flags Robin Will See

Two advisory flags may appear on draft cards in the dashboard and `/approve` view:

- **research-thin** (amber badge): The research pass returned insufficient info (NotebookLM unavailable, auth expired, source timeout, or empty answer). The writer leaned on the idea's own title/summary/transcript. Advisory only — Robin decides whether to regenerate or approve anyway.
- **did-not-pass** (red badge): The critic loop hit its 2-revision cap without scoring >= 8 on every dimension. The best-scored iteration is what you see. Review carefully before approving.

Neither flag blocks approval — they are informational.

## Key Rules

- **ALWAYS read storytelling-framework.md before generating content.** The framework provides structural and psychological guidance that applies across all platforms. Path: `.claude/skills/writing/data/storytelling-framework.md`
- **NEVER generate content without reading the voice profile first.** `voice-casual.xml` and `voice-linkedin.xml` must be read before any generation pass (per writing/SKILL.md).
- **NEVER use gpt-image-1 or gpt-image-1.5 for slide generation.** All AI slide images use Gemini via `generate-ai-slides.js` (per D-01).
- **NEVER use DeepL for German localization.** German TikTok content is localized by the writer agent using the `<localization-de>` rules from `voice-casual.xml` (per D-09).
- **Critic MUST run as a separate agent invocation.** Each critic evaluation spawns a fresh agent with its own context — never inline (per D-12).
- **If `critic_failed` drafts exist**, present them to Robin with a clear warning. Robin decides whether to manually revise or skip.
- **No post publishes without Robin's explicit approval.** This skill generates and gates drafts — Phase 4 handles scheduling after Robin approves.

## Dependencies

### Agents (spawned by content-orchestrator)
- `.claude/agents/content-orchestrator.md` — pipeline coordinator
- `.claude/agents/writer.md` — content generation per platform
- `.claude/agents/critic.md` — quality scoring and revision

### Skills
- `.claude/skills/media-producer/SKILL.md` — visual rendering (TikTok slides, Instagram crop, LinkedIn carousel/infographic)
- `.claude/skills/writing/data/voice-casual.xml` — TikTok/Instagram voice profile
- `.claude/skills/writing/data/voice-linkedin.xml` — LinkedIn voice profile
- `.claude/skills/writing/data/storytelling-framework.md` — narrative structure

### Utility Scripts
- `scripts/db-read-idea.js` — read idea from DB by UUID
- `scripts/db-write-draft.js` — save draft to DB

### Rendering Scripts (called via media-producer skill)
- `scripts/generate-tiktok-slides.js` — canvas text overlay
- `scripts/generate-ai-slides.js` — Gemini AI slide image generator
- `scripts/generate-linkedin-content.js` — LinkedIn PDF/infographic/text generator

### Data
- `data/content.db` — idea backlog and draft storage
- `media/output/<idea_id>/` — generated slide files
