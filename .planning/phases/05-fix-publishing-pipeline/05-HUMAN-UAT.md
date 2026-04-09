---
status: partial
phase: 05-fix-publishing-pipeline
source: [05-VERIFICATION.md]
started: 2026-04-09T00:00:00Z
updated: 2026-04-09T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-End Postiz Scheduling
Configure real integration IDs in `config/schedule-defaults.json`, then approve a critic_approved draft.
expected: Draft reaches `scheduled` status and appears in Postiz dashboard. All 4 integration IDs are currently `FILL_AT_SETUP` (documented user_setup step, not a code defect).
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
