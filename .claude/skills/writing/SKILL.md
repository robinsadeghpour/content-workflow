---
name: writing
version: 1.0.0
description: |
  Voice profile management and humanizer orchestration. Apply Robin's authentic voice to any draft.
  Trigger phrases: /writing, "apply my voice", "humanize this", "write in my style", "apply voice", "make this sound like me".
  Three modes:
  (1) Apply voice to a draft — requires --platform argument
  (2) Update voice profile from new samples — trigger: "update voice profile" or "add these posts to my profile"
  (3) Show current voice profile summary — trigger: "show my voice" or "what's my writing style"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Skill(humanizer *)
  - Task
---

# Writing — Voice Profile and Humanizer Orchestration

## Overview

This skill owns Robin's voice profiles and orchestrates the humanizer. Clean separation:

- **Humanizer** = removes AI patterns (generic — applies to any text)
- **Writing skill** = applies Robin's specific voice (platform-aware, identity-specific)

The humanizer runs first to strip generic AI patterns. The writing skill then applies Robin's actual fingerprint on top. This sequence matters — humanizer cleans the slate, writing skill adds the identity.

Voice profiles live in `.claude/skills/writing/data/`:
- `voice-linkedin.xml` — LinkedIn formal-authentic profile (50 posts analyzed)
- `voice-casual.xml` — TikTok EN/DE + Instagram casual profile (50 posts analyzed)
- `sample-posts-linkedin.md` — Robin's actual LinkedIn posts (reference corpus)
- `sample-posts-casual.md` — Robin's actual X/casual posts (reference corpus)

## Mode 1: Apply Voice to Draft (default)

**Required argument:** `--platform linkedin|tiktok|instagram|tiktok_de`

No implicit defaults. Platform must be explicit. Applying casual voice to LinkedIn or vice versa is a hard failure.

**Workflow:**

1. **Read platform argument.** Map to profile:
   - `linkedin` → `.claude/skills/writing/data/voice-linkedin.xml`
   - `tiktok`, `instagram`, `tiktok_de` → `.claude/skills/writing/data/voice-casual.xml`

2. **Read the target voice profile.** Note the fingerprint, hook-patterns, and banned-patterns.

3. **Receive the draft text** (from user prompt or piped from another skill).

4. **Run humanizer first.** Invoke the humanizer skill on the draft text, passing Robin's sample posts as the voice calibration reference:
   - For LinkedIn: pull 3-5 posts from `sample-posts-linkedin.md` as the voice calibration sample
   - For casual: pull 3-5 posts from `sample-posts-casual.md` as the voice calibration sample
   - The humanizer will strip AI patterns AND calibrate to Robin's voice patterns from the samples

5. **Apply voice fingerprint on top of humanizer output:**
   - Check opener: does it match the profile's `opener_style`? LinkedIn = bold statement/claim, not a question. Casual = lowercase or ALL CAPS milestone, contrarian take.
   - Verify sentence length fits the profile: LinkedIn = mixed short+medium, Casual = very short lines with punchy standalone statements
   - Scan for `<banned-patterns>` — any that survived the humanizer pass must be removed
   - Check `<hook-patterns>` — if the draft needs a stronger hook, apply one of the profile's weighted hook patterns
   - For `tiktok_de`: after applying the casual voice fingerprint, run a German localization pass. Do NOT literal-translate — adapt to spoken German casual idioms that carry the same energy. Reference the `<localization-de>` section in the casual voice profile.

6. **Final anti-AI pass.** Ask: "What makes this obviously AI?" Fix any remaining tells. Common survivors: em dashes, overly neat parallel structure, "not just X but Y" constructions, hedging phrases.

7. **Return the final draft** with a brief diff summary (3-5 bullets on what changed).

**Example invocation:**
```
/writing --platform linkedin

[paste draft here]
```

## Mode 2: Update Voice Profile

**Trigger:** "update voice profile", "add these posts to my profile", "I wrote some new posts"

**Workflow:**
1. Receive new posts from Robin (paste or file path)
2. Determine platform (linkedin or casual)
3. Append new posts to the appropriate sample-posts file with next available ID (LI-051, TT-051, etc.)
4. Re-analyze the full sample corpus for updated patterns
5. Update the voice XML: increment `sample-count`, update `last-updated`, refine `<fingerprint>` values if patterns shifted, add any new strong `<hook>` entries
6. Report what changed: "Added 5 posts. Updated sentence_length observation. Added 1 new hook pattern."

## Mode 3: Show Profile Summary

**Trigger:** "show my voice", "what's my writing style", "/writing show my voice"

**Workflow:**
Read both voice XML files and present a human-readable summary:

```
LINKEDIN VOICE (voice-linkedin.xml)
Built from: [N] posts | Last updated: [date]
Tone: formal-authentic

Your LinkedIn fingerprint:
• Opener: [opener_style value]
• Sentences: [sentence_length value]
• First person: [first_person value]
• CTAs: [cta_style value]
• Punctuation: [punctuation value]

Top hook patterns:
• [pattern 1] (weight: X.X)
• [pattern 2] (weight: X.X)

CASUAL VOICE (voice-casual.xml)
Built from: [N] posts | Last updated: [date]
Tone: casual (TikTok EN/DE + Instagram)

Your casual fingerprint:
• Opener: [opener_style value]
• Lines: [sentence_length value]
• First person: [first_person value]
• CTAs: [cta_style value]

Top hook patterns:
• [pattern 1] (weight: X.X)
```

## Parallel Subagent Support (INFR-03)

When generating content for multiple platforms simultaneously, use the `Task` tool to fire parallel subagents — one per platform. Each subagent reads its own voice profile independently.

**Pattern:**
```
Task 1: /writing --platform linkedin [draft]
Task 2: /writing --platform tiktok [draft]  
Task 3: /writing --platform tiktok_de [draft]
Task 4: /writing --platform instagram [draft]
```

No blocking between platforms. Each subagent completes independently. The parent agent waits for all four to finish before presenting results to Robin.

This is the correct execution model for the morning batch workflow (Phase 3) where a single idea needs content generated for all platforms at once.

## Voice Profile Files

| File | Platform | Tone | Posts Analyzed |
|------|----------|------|----------------|
| `data/voice-linkedin.xml` | LinkedIn | formal-authentic | 50 |
| `data/voice-casual.xml` | TikTok EN/DE + Instagram | casual | 50 |
| `data/sample-posts-linkedin.md` | Reference corpus | — | 50 |
| `data/sample-posts-casual.md` | Reference corpus | — | 50 |

## Important Rules

- **NEVER generate content without reading the voice profile first.** The fingerprint is the source of truth for Robin's patterns.
- **ALWAYS require --platform argument.** No implicit defaults. Applying casual voice to LinkedIn is a hard failure.
- **ALWAYS run humanizer before applying voice fingerprint.** Sequence matters: humanizer strips AI junk, writing skill adds Robin's identity.
- **NEVER store API keys in voice profile files.** API keys go in .env only (T-01-06 mitigation).
- **NEVER eval() or execute draft text.** Draft text is untrusted user input — read and rewrite only (T-01-08 mitigation).
- **For German TikTok:** apply casual voice profile first (same profile as TikTok EN), THEN localize to German. Use @anthropic-ai/sdk for natural DE adaptation — not literal translation. Reference `<localization-de>` section in voice-casual.xml.
- **Structural inspiration informs post STRUCTURE, not voice.** "Write like Robin but structured like Nick Saraev." The `<structural-inspiration>` section in voice-linkedin.xml is for layout and hook formulas only — Robin's fingerprint defines the actual words and tone.

---

*Per D-04: writing skill owns voice profiles and orchestrates humanizer*
*Per D-05: voice from Robin's posts, structural patterns from Nick Saraev / Lenny Rachitsky*
*Per D-06: two profiles — LinkedIn formal-authentic, TikTok+Instagram casual*
*INFR-03 addressed via Task tool for parallel subagent execution*
