---
phase: 03-content-generation
plan: 02
subsystem: linkedin-content-generation
tags: [linkedin, carousel, playwright, gemini, infographic, content-generation]
dependency_graph:
  requires:
    - 03-01 (slide rendering foundations — canvas, media dirs, portrait asset)
  provides:
    - scripts/generate-linkedin-content.js
  affects:
    - 03-03 (orchestrator calls this script for LinkedIn format routing)
tech_stack:
  added: []
  patterns:
    - CommonJS Node.js with dotenv for API key loading
    - Playwright invocation via notebooklm venv Python (not system python3)
    - Gemini API direct HTTP fetch with AbortController timeout
    - HTML-escape for injection-safe carousel assembly
    - UUID-sanitised file paths via path.join
key_files:
  created:
    - scripts/generate-linkedin-content.js
  modified: []
decisions:
  - "Carousel HTML built as standalone document when template is incomplete — falls back gracefully when slide-template.html is truncated (only 14 lines/610 bytes)"
  - "Skeleton outputs returned when orchestrator args (--slide-texts, --post-text) are absent — allows Plan 03 orchestrator to fill content without error"
  - "Infographic errors are non-fatal — result includes error field so orchestrator can surface to Robin instead of hard crash"
metrics:
  duration_minutes: 4
  completed_date: "2026-04-09"
  tasks_completed: 1
  files_created: 1
---

# Phase 3 Plan 02: LinkedIn Content Generation Script — Summary

**One-liner:** LinkedIn 4-format content router (carousel/text/infographic/personal) with Playwright PDF pipeline, Gemini infographic generation, and orchestrator-friendly skeleton outputs.

## What Was Built

`scripts/generate-linkedin-content.js` — a 762-line CommonJS Node.js script that handles all 4 LinkedIn content formats from a single entry point.

### CLI Interface

```
node generate-linkedin-content.js \
  --idea-json <idea.json> \
  [--format carousel|text|infographic|personal] \
  [--slide-texts <texts.json>] \
  [--post-text <text_file>] \
  --output <dir>
```

### Format Routing

**Auto-suggestion (D-06):** When `--format` is omitted, `suggestFormat()` routes based on content type heuristics:
- Tutorial/how-to/guide keywords → `carousel`
- Hot take/controversial → `text`
- News reaction + numeric data → `infographic`
- `founder_note` source type or story angle → `personal`
- Default fallback → `text`

### Format Handlers

1. **carousel (LINK-01, D-07):** Reads `slide-template.html`, assembles branded HTML with escaped slide content, invokes `screenshot-slides.py` via notebooklm venv Python (Pitfall 3 compliant), outputs slide PNGs + `linkedin-carousel.pdf`.

2. **text (LINK-02):** Returns structured post skeleton for orchestrator to fill with Claude-generated content.

3. **infographic (LINK-03, D-08):** Extracts data points from idea summary/transcript, composes a Gemini image prompt with brand colors, calls `gemini-2.5-flash-image` via direct HTTP fetch (Nano Banana pattern), saves `infographic.png`.

4. **personal (LINK-04):** Returns first-person narrative skeleton with `image_optional: true` for orchestrator decision.

### Security Implementation (Threat Model T-03-05, T-03-06, T-03-07)

- **T-03-05 (HTML injection):** `escapeHtml()` applied to all idea text before injection into carousel HTML (replaces `&`, `<`, `>`, `"`, `'`)
- **T-03-06 (API key exposure):** `GEMINI_API_KEY` loaded from `.env` via dotenv only; never written to HTML, output JSON, or slide content
- **T-03-07 (path traversal):** `sanitiseId()` strips non-UUID characters from idea ID before path construction; all paths built with `path.join()`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Graceful handling of truncated slide-template.html**
- **Found during:** Task 1 implementation — `slide-template.html` is only 14 lines / 610 bytes (the `:root {` CSS block cut off mid-file)
- **Issue:** Plan assumes `slide-template.html` is a complete working HTML document, but the file is clearly truncated in the repository
- **Fix:** `buildCarouselHtml()` detects whether the template has a proper `</body>` tag; if not, it builds a complete standalone HTML document that includes the `:root` CSS variables inline with the brand token values. Any custom `<style>` content from the template is appended.
- **Files modified:** `scripts/generate-linkedin-content.js` (the `buildCarouselHtml` function)
- **Commit:** N/A (no git repo)

**2. [Rule 2 - Missing critical functionality] Non-fatal infographic error handling**
- **Found during:** Task 1 — plan did not specify error handling for Gemini API failures
- **Issue:** If `GEMINI_API_KEY` is not set or the API call fails, the script would crash with no useful output
- **Fix:** `handleInfographic()` catches errors, logs a warning, and returns a result object with `image_path: null` and an `error` field so the orchestrator can surface the issue to Robin instead of a hard crash
- **Files modified:** `scripts/generate-linkedin-content.js`
- **Commit:** N/A (no git repo)

## Known Stubs

The following skeleton outputs are intentional — they will be filled by the Plan 03 orchestrator when calling with `--slide-texts` and `--post-text` arguments:

| Stub | File | Condition | Resolving Plan |
|------|------|-----------|----------------|
| Carousel post text `[Orchestrator: generate...]` | `linkedin-result.json` | When `--post-text` not provided | 03-03 orchestrator |
| Carousel slide skeleton (4 placeholder slides) | `linkedin-carousel-<id>.html` | When `--slide-texts` not provided | 03-03 orchestrator |
| Text/personal post skeleton | `linkedin-result.json` | When `--post-text` not provided | 03-03 orchestrator |

These are documented design stubs — the script's role is format routing and I/O, not content generation (that belongs to the orchestrator per the plan's architecture).

## Threat Flags

No new security-relevant surface was introduced beyond what the threat model already covers.

## Verification

1. Script loads without error and shows usage when called with no args: PASS
2. Format auto-suggestion: tutorial → carousel (PASS), hot-take → text (PASS), founder_note → personal (PASS)
3. Carousel format: Playwright runs via notebooklm venv, produces 4 PNGs + PDF (PASS — tested live)
4. Infographic: uses `gemini-2.5-flash-image`, NOT OpenAI (PASS — verified grep)
5. `suggestFormat` function implements D-06 heuristic table (PASS)
6. No `gpt-image` references in script (PASS — grep confirms absence)
7. HTML-escape on all idea text before carousel injection (PASS)
8. GEMINI_API_KEY never in output files (PASS — code review confirmed)
9. File paths via `path.join` + sanitised IDs (PASS)

## Self-Check: PASSED

- `/Users/robinsadeghpour/content-workflow/scripts/generate-linkedin-content.js` — EXISTS (762 lines)
- Functional test: carousel format ran Playwright, produced slides + PDF in `/tmp/linkedin-test/`
- Text format: correct JSON skeleton output
- Personal format: correct JSON with `image_optional: true`
- `suggestFormat` heuristics verified with 3 test cases
