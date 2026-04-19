---
phase: "03-content-generation"
plan: "04"
subsystem: "critic-agent-and-pipeline-skill"
tags: ["critic", "voice-authenticity", "slide-quality", "factual-accuracy", "generate-content-skill", "review-skill", "better-sqlite3", "anthropic-sdk"]
dependency_graph:
  requires:
    - 03-03 (generate-content.js: produces drafts with status='generated' that critic reads)
    - 03-01 (voice-casual.xml, voice-linkedin.xml: critic scoring references)
  provides:
    - "scripts/apply-critic.js: critic agent -- 3-dimension scoring + auto-revise loop"
    - ".claude/skills/generate-content/SKILL.md: one-command pipeline entry point"
    - ".claude/skills/review/SKILL.md: visual approach capture at KEEP time (D-02)"
    - "scripts/review-update.js: --visual-approach argument support"
  affects:
    - "Phase 4: publishing pipeline reads critic_approved drafts from content.db"
    - "Phase 4: visual_approach stored at KEEP time flows to scheduling decisions"
tech_stack:
  added: []
  patterns:
    - "safeJsonParse() applied to all critic and revise Claude API responses (T-03-12)"
    - "Separate Anthropic client instantiation per critic run -- fresh context per D-12 / T-03-13"
    - "MAX_ATTEMPTS=3 retry loop with auto-revise between critic passes (D-14)"
    - "isSlideContent flag routes slide_score evaluation -- non-slide content auto-scores 10"
    - "review-update.js --visual-approach flag: idempotent ALTER TABLE + parameterized UPDATE"
key_files:
  created:
    - scripts/apply-critic.js
    - .claude/skills/generate-content/SKILL.md
  modified:
    - .claude/skills/review/SKILL.md
    - scripts/review-update.js
decisions:
  - "Critic uses separate Anthropic() instantiation with fresh system prompt -- no generation context passed (D-12 / T-03-13)"
  - "slide_score auto-passes (10) for non-slide content (LinkedIn text/personal) -- avoids penalizing posts that have no slides"
  - "visual_approach column added idempotently inside review-update.js --visual-approach path -- no separate migration script needed"
  - "review-update.js accepts optional --visual-approach arg alongside existing --status -- backward compatible, no breaking changes"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-09"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 3 Plan 04: Critic Agent and Pipeline Skill Summary

**One-liner:** Critic agent scores all generated drafts across voice authenticity, slide quality, and factual accuracy with a 3-attempt auto-revise loop; /generate-content skill ties the full pipeline together in one command; /review captures visual approach at KEEP time.

## What Was Built

### Task 1: `scripts/apply-critic.js` (271 lines)

A critic agent that runs as a separate process after `generate-content.js`, reviewing all drafts for a given idea before Robin sees them.

**CLI interface:**
```
node apply-critic.js --idea <idea_uuid>
```

**3-dimension scoring rubric (per RESEARCH.md Pattern 3):**

| Dimension | Pass Threshold | Scope |
|-----------|---------------|-------|
| VOICE AUTHENTICITY | >= 7 | All platforms — scored against platform-specific voice XML |
| SLIDE QUALITY | >= 7 | Only for tiktok_en, tiktok_de, instagram, linkedin_carousel |
| FACTUAL ACCURACY | 10 (binary pass/fail) | All platforms — claims must trace to idea transcript/summary |

**Auto-revise loop:**
- Critic calls Claude with fresh Anthropic client (separate from generation — D-12, T-03-13)
- On failure: separate revise call targets only failing dimensions, preserving passing ones
- MAX_ATTEMPTS = 3; after 3 failures → `status = 'critic_failed'`
- On pass: `status = 'critic_approved'`

**Security (T-03-12):** All critic and revise Claude API responses wrapped in `safeJsonParse()` — strips markdown code fences, catches parse errors, treats invalid JSON as a failed attempt (retries up to MAX_ATTEMPTS).

**Output:** JSON summary with `{ idea_id, total, approved, failed, results[] }` — orchestrator/skill reads this to present results to Robin.

### Task 2a: `.claude/skills/generate-content/SKILL.md`

Claude Code skill entry point for `/generate-content <idea_id>` command.

**What it orchestrates:**
1. `node scripts/generate-content.js --idea <id> [--linkedin-format <format>]`
2. `node scripts/apply-critic.js --idea <id>`
3. Presents critic output as summary table to Robin

**Key rules enforced in SKILL.md:**
- NEVER generate content without reading the voice profile first
- NEVER use gpt-image-1 or gpt-image-1.5 (Gemini only via generate-ai-slides.js per D-01)
- NEVER use DeepL for German localization (Claude + voice-casual.xml localization-de per D-09)
- Critic MUST run as a separate invocation (D-12)
- critic_failed drafts surfaced to Robin with explicit warning

### Task 2b: `.claude/skills/review/SKILL.md` update (D-02)

Added **Step 4a: Capture visual approach when Robin KEEPs an idea** section to the existing review workflow.

When Robin selects KEEP, the skill now:
1. Asks: "Visual approach for this topic? photo or ai"
2. Runs idempotent `ALTER TABLE ideas ADD COLUMN visual_approach TEXT`
3. Calls `scripts/review-update.js --id <id> --status kept --visual-approach <photo|ai>`

All existing KEEP/SKIP/STAR/QUIT functionality preserved — only the KEEP action gains the visual approach prompt.

### Task 2c: `scripts/review-update.js` update

Added `--visual-approach <photo|ai>` optional argument:
- Validates against `['photo', 'ai']`
- Runs idempotent column migration inline
- Issues `UPDATE ideas SET status = ?, visual_approach = ?` when provided
- Falls back to original `UPDATE ideas SET status = ?` when omitted (backward compatible)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] slide_score auto-pass for non-slide LinkedIn content**
- **Found during:** Task 1 implementation
- **Issue:** The critic rubric requires SLIDE QUALITY pass for ALL drafts. LinkedIn `text` and `personal` format drafts have no slides — scoring them on slide quality would always fail.
- **Fix:** Added `isSlideContent` flag that evaluates to true only for `tiktok_en`, `tiktok_de`, `instagram`, and `linkedin_carousel`. Non-slide content auto-scores 10 on SLIDE QUALITY (noted in system prompt as "skip — not slide content, auto-score 10").
- **Files modified:** `scripts/apply-critic.js`

**2. [Rule 2 - Missing critical functionality] Idempotent visual_approach column migration inside review-update.js**
- **Found during:** Task 2 implementation
- **Issue:** The plan instructs adding `ALTER TABLE ideas ADD COLUMN visual_approach TEXT` in the review skill as a bash snippet, but `init-db.js` already adds this column (Phase 3 migration). Running ALTER TABLE twice without catching the duplicate error would crash.
- **Fix:** Wrapped ALTER TABLE in try/catch checking for 'duplicate column' in both the SKILL.md snippet and inside `review-update.js --visual-approach` path. Idempotent on any DB state.
- **Files modified:** `.claude/skills/review/SKILL.md`, `scripts/review-update.js`

## Known Stubs

No stubs — critic agent is fully wired to read generated drafts, score them, auto-revise, and update DB status. The /generate-content skill correctly chains both pipeline scripts.

## Threat Flags

No new network endpoints or auth paths beyond what is specified in the plan's threat model.

## Checkpoint: Task 3 Awaiting Human Verification

Task 3 (checkpoint:human-verify) requires Robin to run `/generate-content <idea_id>` end-to-end and verify all 4 platform outputs plus critic gate behavior. This is a blocking checkpoint — execution paused here.

**Verification steps for Robin:**
1. Run `/generate-content <idea_id>` with a kept idea from the backlog
2. Verify TikTok EN slides are generated in `media/output/<id>/tiktok-en/`
3. Verify TikTok DE slides exist in `media/output/<id>/tiktok-de/` with German text
4. Verify Instagram slides exist in `media/output/<id>/instagram/` at 1080x1350
5. Verify LinkedIn content exists in `media/output/<id>/linkedin/`
6. Check `data/content.db` for drafts with status `critic_approved` or `critic_failed`
7. Run `/review` and verify the visual approach prompt appears when KEEPing an idea

**Resume signal:** Type "approved" or describe issues to fix.

## Self-Check

- `/Users/robinsadeghpour/content-workflow/scripts/apply-critic.js` — EXISTS (271 lines)
- `require('@anthropic-ai/sdk')` present: PASS
- `MAX_ATTEMPTS = 3`: PASS
- `critic_approved` status: PASS
- `critic_failed` status: PASS
- `voice_score`, `slide_score`, `factual_score`, `overall_pass` in rubric: PASS
- `voice-casual.xml` and `voice-linkedin.xml` read: PASS
- No `brand_alignment` dimension (D-15): PASS
- `while` retry loop: PASS
- `UPDATE drafts SET status` for both paths: PASS
- `/Users/robinsadeghpour/content-workflow/.claude/skills/generate-content/SKILL.md` — EXISTS
- Contains `generate-content.js`: PASS
- Contains `apply-critic.js`: PASS
- Contains `voice profile` reference: PASS
- Contains `critic_failed` handling: PASS
- `/Users/robinsadeghpour/content-workflow/.claude/skills/review/SKILL.md` — MODIFIED
- Contains `visual_approach`: PASS
- Contains `photo` and `ai` options: PASS
- KEEP/SKIP/STAR functionality preserved: PASS
- `scripts/review-update.js` syntax valid: PASS
- `--visual-approach` argument: PASS

## Self-Check: PASSED
