---
name: review
version: 0.1.0
description: |
  Morning batch review of discovered content ideas. Presents top ideas from
  data/content.db for KEEP/SKIP/STAR decisions via CLI. Designed for Robin's
  morning session: one focused pass through the idea backlog to select what gets
  turned into content today. Trigger phrases: /review, "morning review",
  "show me ideas", or "what should I post about".
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# Review -- Morning Batch Content Review

> Phase 1 stub. Phase 2 will implement the full review workflow (DISC-03).

## Current Behavior (Phase 1)

This is a stub. When invoked, respond with the following log output:

```
[REVIEW] {current ISO timestamp} -- review triggered (stub, no ideas to review)
Status: Awaiting Phase 2 implementation
Source: data/content.db (ideas table, status='new' or status='starred')
Workflow: Present top ideas -> KEEP/SKIP/STAR -> update status
```

No database reads occur. No decisions are prompted. The invocation is acknowledged and logged only.

## Intended Behavior (Phase 2)

Full implementation will execute these steps in order:

1. **Query ideas** -- Fetch ideas from data/content.db where status is 'new' or 'starred', ordered by score descending
2. **Present as cards** -- Display each idea as a formatted card showing: title, summary, source, score
3. **Prompt for decision** -- For each card, ask Robin: KEEP (generate content), SKIP (mark as skipped), or STAR (save for later)
4. **Update status** -- Write Robin's decision back to data/content.db (status = 'kept', 'skipped', or 'starred')
5. **Hand off to generation** -- Kept ideas are available for Phase 3 content generation via /writing and platform skills

## Schedule

- Manual trigger: User runs /review during morning session
- No cron: Review is human-initiated, not automated. Robin decides when to run it.

## Cron Schedule Summary (all pipeline triggers)

| Time | Command | Phase | Status |
|------|---------|-------|--------|
| 6:00 AM | /pulse | Phase 2 | Stub |
| Manual | /review | Phase 2 | Stub |
| Manual | /writing | Phase 1 | Active |
| 6:00 PM | perf-check | Phase 4 | Not yet created |

Registration commands (per D-07, using Claude Code /schedule):

```
/schedule "0 6 * * *" /pulse
/schedule "0 18 * * *" perf-check
```

Note: /review and /writing are manual -- no cron registration needed.

## INFR-03: Parallel Subagent Execution

INFR-03 (parallel subagent execution for multi-platform content generation) is addressed by Claude Code's native Task tool. No custom infrastructure is needed. The writing skill (Plan 03) uses Skill() invocations, and Phase 3 plans use the Task tool for concurrent multi-platform draft generation (LinkedIn, TikTok EN, TikTok DE, Instagram in parallel).

## Dependencies (Phase 2)

- `data/content.db` -- ideas table populated by /pulse (status='new' records)
- Ideas must exist with status='new' -- requires /pulse to have run at least once before /review has anything to show
