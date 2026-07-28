---
phase: quick-260728-xqu
plan: 01
subsystem: pulse-x-source
tags: [apify, x-research, compatibility, tests]
dependency-graph:
  requires:
    - shared Apify REST dataset runner
  provides:
    - additive Pulse Tweet Actor selection
    - offline coverage for both Actor contracts
  affects:
    - scripts/pulse/source-x.js
    - test/pulse-source-x.test.js
    - .claude/skills/pulse/SKILL.md
key-files:
  created: []
  modified:
    - scripts/pulse/source-x.js
    - test/pulse-source-x.test.js
    - .claude/skills/pulse/SKILL.md
    - .claude/skills/setup/SKILL.md
    - .env.example
    - README.md
decisions:
  - Keep the existing Tweet Actor route as the Pulse default
  - Select Xquik through PULSE_X_ACTOR_ID
  - Keep each Actor's input contract in a separate branch
metrics:
  completed: 2026-07-28
  tasks-completed: 1
  automated-tests: 20
---

# Quick Task 260728-xqu: Preserve Existing X Actor Route

**One-liner:** Kept the existing Pulse route and made Xquik an explicit option.

## What Was Done

- Restored the existing Tweet Actor as the Pulse default.
- Added strict selection for the existing and Xquik routes.
- Preserved each Actor's native input schema.
- Documented PULSE_X_ACTOR_ID in setup, Pulse, and README guidance.
- Added offline tests for both input contracts and invalid routes.

## Verification

- [x] `node --test test/pulse-source-x.test.js`: 5 passed
- [x] `npm test`: 20 passed
- [x] `node --check scripts/pulse/source-x.js`
- [x] `git diff --check`
- [x] No Actor ran
- [x] No Apify credits were spent

## Known Stubs

None.

Xquik is an independent third-party service. Not affiliated with X Corp. "Twitter" and "X" are trademarks of X Corp.
