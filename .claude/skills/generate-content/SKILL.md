---
name: generate-content
description: |
  Generate platform-native content for all channels from a kept idea. Produces TikTok EN, TikTok DE, Instagram, and LinkedIn drafts with voice profiles applied and critic review completed. Use when user says '/generate-content', 'create content for idea X', or 'generate posts from this topic'.
argument-hint: "[idea-id]"
model: sonnet
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

One command turns a kept idea into platform-native drafts across 4 channels, with critic review applied before Robin sees anything.

## Usage

```
/generate-content <idea_id>
```

`<idea_id>` — UUID of a kept idea from `data/content.db`.

## What It Does

1. **Read the kept idea** from `data/content.db` (must have `status = 'kept'`).
2. **Research pass (D-06)** — produces a structured brief at `data/research/<idea_id>.md` via NotebookLM. Cached on re-runs. Sets `research_thin` flag if sparse.
3. **Pick slide track** — `branded` or `personal`, from `idea.visual_approach` or inferred from the idea title.
4. **Repo screenshot pre-flight** — if the idea references a GitHub repo, the `repo-screenshot` subagent captures a clean PNG of the repo card for use as an `image-overlay` slide.
5. **Per platform**: spawn `writer` → run `critic` loop → render slides → save draft.
   - TikTok EN, TikTok DE: writer produces a `slides_spec` for the chosen track. Rendered via `generate-branded-slides` or `generate-personal-slides`.
   - Instagram: writer produces a caption only. Slides reuse TikTok EN PNGs (cropped if personal track).
   - LinkedIn: always branded. Writer produces a post text + branded `slides_spec`. Rendered via `generate-branded-slides`.
6. **Save drafts** to `data/content.db` with `status = 'critic_approved'`.
7. **Report** the summary table to Robin.

## Implementation

Spawn the **content-orchestrator** agent:

```
Agent(content-orchestrator):
  "Generate content for idea <idea_id>."
```

The orchestrator handles everything: research pass, track selection, repo-screenshot dispatch, writer/critic loops, slide rendering via the two new skills, and DB writes. You do NOT run any scripts directly here.

Present the orchestrator's summary output to Robin when it completes.

## Output to Robin

```
Content generation complete for idea: <idea_id> — "<title>"
Track: <branded|personal>   Repo screenshot: <yes|no>

Platform      | Slides                | Critic            | Draft ID
------------- | --------------------- | ----------------- | --------
TikTok EN     | personal N slides     | critic_approved   | <uuid>
TikTok DE     | personal N slides     | critic_approved   | <uuid>
Instagram     | reuses TikTok EN      | critic_approved   | <uuid>
LinkedIn      | branded N slides      | critic_approved   | <uuid>

Files: media/output/<idea_id>/

Next: /approve to review and schedule.
```

If drafts hit max-iters: `**Warning:** X draft(s) did not pass critic — best-scored iteration kept with did_not_pass_critic=true.`

## Flags Robin Will See

- **research-thin** (amber): research returned insufficient info; writer leaned on idea fields. Advisory.
- **did-not-pass** (red): critic loop hit its 2-revision cap without scoring ≥ 8 on every dimension. Best iteration kept.

Neither blocks approval.

## Key Rules

- **ALWAYS read storytelling-framework.md and the voice profile before generating** (writer enforces this).
- **Slide skill is deterministic by platform.** No track-picking.
  - **LinkedIn** → `generate-branded-slides` (11x cream/clay templates, 1080×1350). Always. Never personal.
  - **TikTok EN/DE** → `generate-personal-slides` (real photos from `media/images/tiktok/catalog.json`, 1080×1920). Always. **Never branded templates on TikTok.**
  - **Instagram** → `generate-personal-slides` (cropped from TikTok EN spec, 1080×1350). Always. Never branded.
- **TikTok DE reuses EN photos** — same `photo_keywords` per slide, only text and caption change.
- **Instagram reuses TikTok EN spec** — re-rendered at 1080×1350. Only its own caption is fresh.
- **Critic runs as a separate agent invocation per platform** (D-12) — fresh context.
- **No post publishes without Robin's approval.** This skill only generates and gates drafts.

## Dependencies

### Agents
- `.claude/agents/content-orchestrator.md` — coordinator
- `.claude/agents/writer.md` — per-platform writer
- `.claude/agents/critic.md` — scoring and revision
- `.claude/agents/repo-screenshot.md` — captures GitHub repo PNGs for image-overlay slides

### Skills
- `.claude/skills/generate-branded-slides/` — universal branded carousel renderer (1080×1350)
- `.claude/skills/generate-personal-slides/` — photo + text overlay renderer (TikTok 1080×1920, IG 1080×1350)
- `.claude/skills/writing/data/voice-casual.xml` — TikTok/Instagram voice profile
- `.claude/skills/writing/data/voice-linkedin.xml` — LinkedIn voice profile
- `.claude/skills/writing/data/storytelling-framework.md` — narrative structure

### Utility Scripts
- `scripts/db-read-idea.js` — read idea from DB
- `scripts/db-write-draft.js` — save draft to DB
- `scripts/research/run-notebooklm.sh` — research pass
- `scripts/generate-tiktok-slides.js` — node-canvas compositor (used by personal slides)
- `scripts/screenshot-github.py` — Playwright fallback for repo-screenshot subagent

### Data
- `data/content.db` — idea backlog and draft storage
- `data/research/<idea_id>.md` — research brief cache
- `media/output/<idea_id>/` — generated slides per platform
- `media/images/tiktok/catalog.json` — personal photo library (used by personal slides)
- `media/overlays/github/` — repo-screenshot cache
