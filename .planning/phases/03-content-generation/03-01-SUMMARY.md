---
phase: "03-content-generation"
plan: "01"
subsystem: "slide-rendering"
tags: ["canvas", "sharp", "gemini", "tiktok", "instagram", "media", "db-migration"]
dependency_graph:
  requires: []
  provides:
    - "generate-tiktok-slides.js: node-canvas text overlay renderer for TikTok/Instagram slides"
    - "generate-ai-slides.js: Gemini API fallback image generator"
    - "media/images/tiktok/catalog.json: empty photo catalog with template schema"
    - "media/images/linkedin/robin-portrait.png: portrait image at repo-relative path"
    - "drafts.visual_approach + drafts.media_dir columns"
    - "ideas.visual_approach column (D-02 KEEP-time choice)"
  affects:
    - "Phase 3 Plan 02: LinkedIn content generation (portrait path)"
    - "Phase 3 Plan 03: TikTok/Instagram orchestrator (calls both scripts)"
    - "Phase 4: publishing pipeline reads visual_approach + media_dir from drafts"
tech_stack:
  added:
    - "canvas@3.2.3: node-canvas for PNG text overlay compositing"
    - "sharp@0.34.5: image resize and format conversion"
  patterns:
    - "Larry fork pattern: generate-tiktok-slides.js inherits Larry's proven safe zone + font math"
    - "Gemini direct API pattern: native fetch + AbortController timeout + p-limit(3) concurrency"
    - "Idempotent ALTER TABLE pattern: try/catch duplicate column for schema migrations"
key_files:
  created:
    - scripts/generate-tiktok-slides.js
    - scripts/generate-ai-slides.js
    - media/images/tiktok/catalog.json
    - media/images/linkedin/robin-portrait.png
  modified:
    - scripts/init-db.js
    - package.json
decisions:
  - "canvas@3.2.3 installed (vs @napi-rs/canvas fallback): native build succeeded on macOS, Cairo libs available"
  - "generate-tiktok-slides accepts --photos JSON array instead of scanning directory: enables orchestrator control over photo selection from catalog"
  - "generate-ai-slides uses native fetch (Node 20): no node-fetch dependency needed"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-09"
  tasks_completed: 2
  files_created: 4
  files_modified: 2
---

# Phase 3 Plan 01: Slide Rendering Foundations Summary

**One-liner:** node-canvas text overlay renderer + Gemini AI slide generator installed with migrated DB schema and photo catalog for TikTok/Instagram/LinkedIn media pipeline.

## What Was Built

Two core rendering scripts plus foundational media assets that Phase 3 Plan 03 (orchestrator) will invoke for TikTok EN, TikTok DE, and Instagram content generation.

### generate-tiktok-slides.js (174 lines)

Forked from Larry 1.0.0's `add-text-overlay.js` with the key change: variable slide count (2-12) replaces the hardcoded 6-slide constraint. Accepts `--photos` (JSON array of absolute paths), `--texts` (JSON array), `--output` (directory). Preserves Larry's proven text rendering math verbatim — 6.5% font size, 75% max width, 10%/80% safe zones, white fill + black outline, center-aligned at 30% from top. Outputs `slide-01.png` through `slide-N.png` with JSON summary to stdout.

### generate-ai-slides.js (161 lines)

Gemini API fallback for when no real photos are in the catalog. Uses `gemini-2.5-flash-image` model via direct HTTPS with native fetch. Implements all four STRIDE mitigations from the threat model: emoji stripping via wrapText (T-03-01), GEMINI_API_KEY from dotenv only (T-03-02), response structure validation before writing (T-03-03), p-limit(3) + 30s AbortController timeout (T-03-04). Outputs same file naming convention as the photo overlay script.

### DB Schema Migrations

Three new columns added to `scripts/init-db.js` using the existing idempotent ALTER TABLE pattern:
- `drafts.visual_approach TEXT` — stores selected visual approach for Phase 4 publishing
- `drafts.media_dir TEXT` — stores path to generated slide directory for Phase 4 pickup
- `ideas.visual_approach TEXT` — stores Robin's explicit choice made at KEEP time (D-02)

### Media Assets

- `media/images/tiktok/catalog.json`: Empty catalog initialized from template schema, `"photos": []`, ready for Robin to populate with real photos
- `media/images/linkedin/robin-portrait.png`: Robin's portrait copied from `~/WebstormProjects/11x/public/robin_cutout.png` to a portable repo-relative path (1064x1064 PNG RGBA)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

- The `gpt-image` acceptance criterion (script must NOT contain `gpt-image`) was nearly tripped by a documentation comment. Resolved by rewording to "Nano Banana pattern, not OpenAI image models" without mentioning the model name.
- canvas installed as v3.2.3 (not 2.x as in CLAUDE.md tech stack table) — npm resolved the latest. The API is identical; no compatibility issue.

## Known Stubs

- `media/images/tiktok/catalog.json` has `"photos": []` intentionally — Robin populates this catalog manually per project design. The orchestrator (Plan 03) falls back to `generate-ai-slides.js` when catalog is empty. This is not a stub — it is the intended initial state.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes at trust boundaries beyond what was specified in the plan's threat model.

## Self-Check

Files created/exist:
- scripts/generate-tiktok-slides.js: 174 lines (min 120) — FOUND
- scripts/generate-ai-slides.js: 161 lines (min 60) — FOUND
- media/images/tiktok/catalog.json: `"photos": []`, `"version": "1.0"` — FOUND
- media/images/linkedin/robin-portrait.png: 1064x1064 PNG RGBA — FOUND

DB schema verified via SQLite pragma:
- drafts columns: id, idea_id, platform, content, status, postiz_id, created_at, updated_at, visual_approach, media_dir — CONFIRMED
- ideas columns: ..., transcript, visual_approach — CONFIRMED

npm packages:
- canvas@3.2.3 — importable OK
- sharp@0.34.5 — importable OK

## Self-Check: PASSED
