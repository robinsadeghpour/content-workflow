---
phase: quick-260727-xqu
plan: 01
subsystem: apify-research-skills
tags: [apify, x-research, pulse, audience, tests, security]
dependency-graph:
  requires: []
  provides:
    - shared Apify REST dataset runner
    - Xquik X Tweet Scraper Pulse source
    - Xquik X Follower Scraper audience Skill
    - offline Actor contract tests
  affects:
    - scripts/lib/apify.js
    - scripts/pulse/source-x.js
    - scripts/pulse/source-tiktok.js
    - scripts/research/x-audience.js
    - .claude/skills/pulse/SKILL.md
    - .claude/skills/setup/SKILL.md
    - .claude/skills/x-audience-research/SKILL.md
tech-stack:
  added: []
  patterns:
    - Bearer-authenticated Apify synchronous dataset requests
    - dependency injection for offline Actor tests
    - data and diagnostic row partitioning
    - relation-to-target policy mapping
key-files:
  created:
    - scripts/lib/apify.js
    - scripts/research/x-audience.js
    - .claude/skills/x-audience-research/SKILL.md
    - test/apify.test.js
    - test/pulse-source-tiktok.test.js
    - test/pulse-source-x.test.js
    - test/x-audience.test.js
  modified:
    - scripts/pulse/source-x.js
    - scripts/pulse/source-tiktok.js
    - .claude/skills/pulse/SKILL.md
    - .claude/skills/setup/SKILL.md
    - .github/workflows/ci.yml
    - .env.example
    - README.md
    - THIRD_PARTY_SKILLS.md
    - package.json
    - package-lock.json
decisions:
  - Use Apify's documented synchronous dataset endpoint directly
  - Keep authentication tokens in Bearer headers
  - Treat Actor diagnostic rows separately from research data
  - Support all 6 Follower Actor relations through explicit target policies
  - Keep audience reports private, ignored, and non-overwriting
  - Remove the missing third-party runner from setup
  - Run the new test suite in existing CI
metrics:
  completed: 2026-07-27
  tasks-completed: 2
  automated-tests: 18
---

# Quick Task 260727-xqu: Add Xquik Apify Actor Workflows

**One-liner:** Added native Tweet and Follower Actor workflows while repairing
the repository's broken Apify runner integration.

## What Was Done

### Task 1: Repair Apify execution and migrate Pulse

Created `scripts/lib/apify.js` as the canonical Apify boundary.

- Calls the synchronous dataset endpoint.
- Converts Store slugs to API identifiers.
- Sends tokens only through Bearer headers.
- Supports timeouts, result caps, and optional charge ceilings.
- Rejects malformed options before requests.
- Separates diagnostic rows from data rows.
- Sanitizes untrusted diagnostic text before logging.

Migrated both Pulse sources to the shared runner.

- X now uses `xquik/x-tweet-scraper`.
- X requests rich, nested, camel-case rows.
- X supports current and legacy author shapes.
- TikTok keeps its existing Actor and input contract.
- Both sources removed temporary files and duplicate process spawning.

### Task 2: Add X audience research

Created the `x-audience-research` Skill and CLI.

- Supports followers, following, and verified followers.
- Supports list members and list followers.
- Supports community members.
- Supports compact, full, and raw output.
- Supports merged overlap analysis.
- Confines output to ignored research storage.
- Creates private files without overwriting existing reports.
- Keeps profiles and diagnostics in separate report fields.

Updated README, Pulse, setup, and third-party documentation.

- Added both Apify Actor listing pages.
- Removed the obsolete third-party runner installation.
- Added the optional charge ceiling variable.
- Added the new Skill to the project structure.

### Repository Improvements

Added 18 offline tests with Node's built-in test runner.

- Tests never call Apify or run an Actor.
- Tests cover REST authentication and URL construction.
- Tests cover diagnostics, normalization, and deduplication.
- Tests cover all audience target classes.
- Existing CI now runs the test suite.

Regenerated the npm lockfile.

- Removed a stale undeclared SDK.
- Updated vulnerable transitive networking code.
- Updated `sharp` to the patched stable release.
- Aligned the lockfile license with `package.json`.

## Deviations From Plan

The audience CLI expanded from 3 profile relations to all 6 relations.
CI and dependency remediation were added after repository review.

## Verification

- [x] `npm ci`
- [x] Every JavaScript file passes `node --check`
- [x] `npm test`: 18 passed, 0 failed
- [x] Node 20.20.2: 18 passed, 0 failed
- [x] `npm audit --audit-level=low`: 0 vulnerabilities
- [x] Changed Skill directories pass `quick_validate.py`
- [x] Tweet and Follower input keys match live Actor schemas
- [x] `sharp` resize smoke test passes
- [x] `cheerio` parse smoke test passes
- [x] `git diff --check`
- [x] No Actor ran during implementation or verification
- [x] No Apify credits were spent

## Known Stubs

None.

Xquik is an independent third-party service. Not affiliated with X Corp. "Twitter" and "X" are trademarks of X Corp.
