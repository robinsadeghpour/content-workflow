---
status: partial
phase: 02-discovery-pipeline
source: [02-VERIFICATION.md]
started: 2026-04-09T11:00:00Z
updated: 2026-04-09T11:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-End Pulse Execution
expected: Run `node scripts/pulse.js` with valid APIFY_TOKEN and SUPADATA_API_KEY in .env. All four sources scrape, ideas are inserted into data/content.db, and data/review/YYYY-MM-DD.md is generated with collapsible transcript blocks.
result: [pending]

### 2. Interactive /review Workflow
expected: Run `/review` in Claude Code CLI after pulse has populated ideas. Ideas are presented one-by-one with title, source, angle (no score), and KEEP/SKIP/STAR prompt. Decisions persist to data/content.db. Starred ideas from prior sessions reappear.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
