---
phase: 01-foundation-voice
plan: 03
subsystem: voice
tags: [writing-skill, voice-profiles, humanizer, linkedin, tiktok, instagram, platform-voice]

# Dependency graph
requires:
  - phase: 01-foundation-voice plan 01
    provides: package.json and data/ directory structure
  - phase: 01-foundation-voice plan 02
    provides: pulse and review stub skills
provides:
  - .claude/skills/writing/SKILL.md — /writing slash command with voice profile management and humanizer orchestration
  - .claude/skills/writing/data/voice-linkedin.json — LinkedIn formal-authentic voice profile (50 posts analyzed)
  - .claude/skills/writing/data/voice-casual.json — TikTok/Instagram casual voice profile (50 posts analyzed)
  - .claude/skills/writing/data/sample-posts-linkedin.md — 50 LinkedIn posts as reference corpus
  - .claude/skills/writing/data/sample-posts-casual.md — 50 X/Twitter posts as casual voice corpus
affects:
  - phase-03 (content generation uses /writing to apply voice to all drafts)
  - phase-04 (humanizer integration pattern established here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Voice profile JSON with fingerprint + hook_patterns + banned_patterns + structural_inspiration"
    - "Humanizer orchestrated as subskill via Skill(humanizer *) in allowed-tools"
    - "Required --platform argument to prevent cross-platform voice application"
    - "Task tool documented for parallel subagent execution across platforms (INFR-03)"

key-files:
  created:
    - .claude/skills/writing/SKILL.md
    - .claude/skills/writing/data/voice-linkedin.json
    - .claude/skills/writing/data/voice-casual.json
    - .claude/skills/writing/data/sample-posts-linkedin.md
    - .claude/skills/writing/data/sample-posts-casual.md
  modified: []

key-decisions:
  - "X/Twitter posts used as casual voice corpus — Robin's casual writing on X is the clearest signal for TikTok/Instagram tone"
  - "Structural inspiration from Nick Saraev and Lenny Rachitsky stored as separate section in voice-linkedin.json, not blended into fingerprint"
  - "22 banned patterns added to LinkedIn profile — includes both standard AI patterns and Robin-specific anti-patterns observed in real posts"
  - "German TikTok localization guidance embedded in voice-casual.json rather than a separate profile — same casual profile with DE adaptation on top"

requirements-completed: [VOIC-01, VOIC-02, VOIC-03]

# Metrics
duration: ~15min
completed: 2026-04-08
---

# Phase 01 Plan 03: Voice Profile System Summary

**Robin's voice profile system: two platform-specific voice profiles built from 100 real posts (50 LinkedIn + 50 X/Twitter), plus /writing skill that orchestrates humanizer + voice application per platform**

## Status

PAUSED AT CHECKPOINT — Tasks 1 and 2 completed, awaiting Robin's verification of voice profile accuracy (Task 3).

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-08
- **Completed:** 2026-04-08 (tasks 1-2)
- **Tasks:** 2 of 3 complete (Task 3 is a human-verify checkpoint)
- **Files created:** 5

## Accomplishments

- Collected Robin's 50 LinkedIn posts and 50 X/Twitter posts as real writing samples
- Analyzed posts for sentence length, opener patterns, first-person frequency, punctuation habits, CTA styles, and hook patterns
- Built voice-linkedin.json with 7-key fingerprint, 5 weighted hook patterns, 22 banned phrases, and Nick Saraev/Lenny Rachitsky structural inspiration
- Built voice-casual.json with 7-key fingerprint, 5 weighted hook patterns, German localization guidance, and 13 banned patterns
- Created /writing SKILL.md with 3 modes (apply, update, show), humanizer orchestration, parallel subagent support via Task tool
- Required --platform argument enforced: linkedin, tiktok, instagram, tiktok_de

## Task Commits

Each task was committed atomically:

1. **Task 1: Collect Robin's posts and build voice sample files** — `d486d83` (feat)
2. **Task 2: Create voice profiles and /writing skill** — `13e47ed` (feat)

## Files Created

- `.claude/skills/writing/data/sample-posts-linkedin.md` — 50 LinkedIn posts + Structural Inspiration section (Nick Saraev, Lenny Rachitsky)
- `.claude/skills/writing/data/sample-posts-casual.md` — 50 X/Twitter posts as casual voice baseline
- `.claude/skills/writing/data/voice-linkedin.json` — LinkedIn formal-authentic profile built from real posts
- `.claude/skills/writing/data/voice-casual.json` — TikTok/Instagram casual profile with DE localization guidance
- `.claude/skills/writing/SKILL.md` — /writing skill with humanizer orchestration and 3 operating modes

## Key Voice Observations from Analysis

### LinkedIn Voice Fingerprint
- **Sentences:** 45% short (<=8 words), 43% medium, only 12% long — mixed rhythm, punchy openers
- **First person:** 72% of posts use I/my/I've — personal experience is the credibility signal
- **Openers:** Statement/claim (never question) — "Anthropic just dropped", "I quit my job", "Chat interfaces are terrible"
- **Emojis:** Sparse — only 24% of posts, typically 1-2 max
- **CTAs:** Soft and conversational — "Would love to hear what's worked", never aggressive

### Casual Voice Fingerprint
- **Lines:** 51.5% are 5 words or fewer — extremely short, standalone punchy lines
- **Openers:** lowercase (32%), ALL CAPS celebration (6%), pov: format (4%), contrarian takes
- **Signature patterns:** milestone ALL CAPS ("WE CROSSED $1000 MRR"), self-deprecating ("I'm stupid"), vulnerable admits ("still haven't made it")
- **No slang overload:** Casual tone comes from brevity and raw honesty, not from manufactured slang

## Decisions Made

- X/Twitter posts used as the casual voice corpus because Robin's Twitter is his most unfiltered writing — clearest signal for TikTok energy
- Nick Saraev and Lenny Rachitsky structural patterns stored separately in `structural_inspiration` key — they inform post structure but never blend into Robin's voice
- German TikTok uses the same casual profile with DE adaptation layer — no separate profile needed per D-06

## Deviations from Plan

### Auto-fixed Issues

None.

### Process Deviation: Casual Voice Source

The plan specified scraping TikTok/Instagram for casual posts. However, the important context note indicated X/Twitter posts were already available (raw-x-posts.json). Robin's X/Twitter posts are actually a cleaner casual voice signal than Instagram captions — they are pure unedited writing without visual context. Used X posts as the primary casual corpus. Instagram-specific patterns can be refined if Robin provides Instagram captions in a future update.

## Known Stubs

None — all voice profile fields are populated with real observations from Robin's posts.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. Voice profiles are local JSON files. No API keys stored in profiles (T-01-06 mitigated).

## Awaiting

Robin's verification at Task 3 checkpoint:
1. Run `/writing show my voice` — verify profile summary matches actual writing style
2. Review voice-linkedin.json fingerprint values — do they accurately describe LinkedIn writing?
3. Review voice-casual.json fingerprint — does it match TikTok/Instagram tone?
4. Quick test: provide a draft, run `/writing --platform linkedin`
5. Check structural inspiration section in sample-posts-linkedin.md

## Self-Check

### Files exist:
- [x] `.claude/skills/writing/SKILL.md` — confirmed (168 lines)
- [x] `.claude/skills/writing/data/voice-linkedin.json` — confirmed (valid JSON)
- [x] `.claude/skills/writing/data/voice-casual.json` — confirmed (valid JSON)
- [x] `.claude/skills/writing/data/sample-posts-linkedin.md` — confirmed (1134 lines, 50 posts)
- [x] `.claude/skills/writing/data/sample-posts-casual.md` — confirmed (543 lines, 50 posts)

### Commits exist:
- [x] d486d83 — feat(01-03): collect Robin's posts and build voice sample files
- [x] 13e47ed — feat(01-03): create voice profiles and /writing skill

## Self-Check: PASSED

---
*Phase: 01-foundation-voice*
*Completed: 2026-04-08 (checkpoint pending)*
