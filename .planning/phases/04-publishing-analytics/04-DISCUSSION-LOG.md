# Phase 4: Publishing & Analytics - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 04-publishing-analytics
**Areas discussed:** Approval workflow, Scheduling strategy, Performance feedback loop, Draft state machine

---

## Approval Workflow

### Approval Flow Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Batch review | Single /approve command shows all pending drafts across platforms | |
| Per-platform review | Separate review per platform (/approve-linkedin, etc.) | |
| Single queue | All platforms in one flat list, no grouping | |
| Other | User input: "approve command with optional flag param" | ✓ |

**User's choice:** Single `/approve` command with optional `--platform` flag for filtering
**Notes:** Combines batch review convenience with optional platform focus

### Humanizer Diff Display

| Option | Description | Selected |
|--------|-------------|----------|
| Side-by-side diff | Show original AI text and humanized text side-by-side | |
| Humanized only + score | Show only final humanized version with voice authenticity score | ✓ |
| Collapsible diff | Humanized text by default, expandable details block for original | |

**User's choice:** Humanized only + score
**Notes:** Robin trusts the voice pass system, just wants to read final text

### Actions Per Draft

| Option | Description | Selected |
|--------|-------------|----------|
| Approve / Reject / Edit | Three actions covering all cases | ✓ |
| Approve / Reject only | Two actions, re-generate for changes | |
| Approve / Skip / Edit | No explicit reject, skipped drafts stay pending | |

**User's choice:** Approve / Reject / Edit (Recommended)

### Re-critic After Edit

| Option | Description | Selected |
|--------|-------------|----------|
| No re-critic | Robin's edits are final, no re-critic pass | ✓ |
| Optional re-critic | Robin chooses after editing | |
| Always re-critic | Any edit triggers fresh critic pass | |

**User's choice:** No re-critic (Recommended)

---

## Scheduling Strategy

### Post Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Staggered auto-schedule | Per-platform default times, auto-slot on approve | ✓ |
| Robin picks time per post | Manual time selection per post | |
| Same time, all platforms | All posts at one configured time | |

**User's choice:** Staggered auto-schedule (Recommended)

### Failure Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Queue + retry | Failed posts stay pending, retry on next run | ✓ |
| Fail loud, block | Stop session, require resolution | |
| You decide | Claude picks best approach | |

**User's choice:** Queue + retry (Recommended)

### Time Override

| Option | Description | Selected |
|--------|-------------|----------|
| Configurable defaults | Default times in config file, no per-post override | |
| Per-post override | Robin can set custom time during /approve | ✓ |
| Fixed defaults only | Hardcoded times | |

**User's choice:** Per-post override

---

## Performance Feedback Loop

### Metrics

| Option | Description | Selected |
|--------|-------------|----------|
| Impressions + engagement rate | Score = impressions weighted by engagement rate | ✓ |
| Impressions only | Pure reach metric | |
| You decide | Claude designs formula based on Postiz data | |

**User's choice:** Impressions + engagement rate (Recommended)

### Feedback Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Topic + format weighted boost | Track by topic AND format, multiplicative boost | ✓ |
| Topic-only weighting | Only topic performance matters | |
| Manual review only | Data stored but no automated feedback | |

**User's choice:** Topic + format weighted boost (Recommended)

### Lookback Window

| Option | Description | Selected |
|--------|-------------|----------|
| 30-day rolling window | Last 30 days influences scoring | |
| 14-day window | More responsive to recent trends | ✓ |
| All-time with decay | Exponential decay, never loses data | |

**User's choice:** 14-day window

### Performance Report

| Option | Description | Selected |
|--------|-------------|----------|
| Daily summary file | Write daily report to data/performance/ | ✓ |
| Silent DB update | Just update tables, no visible output | |
| Weekly digest only | Daily silent, weekly summary | |

**User's choice:** Daily summary file (Recommended)

---

## Draft State Machine

### States

| Option | Description | Selected |
|--------|-------------|----------|
| 6 states | draft -> critic-approved -> user-approved -> scheduled -> published -> tracked | ✓ |
| 4 states | draft -> approved -> scheduled -> published | |
| You decide | Claude designs based on workflow needs | |

**User's choice:** 6 states (Recommended)

### Rejection Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Move to 'rejected' state | Stay in DB, don't appear in queue | ✓ |
| Delete from DB | Remove entirely | |
| Back to 'draft' for re-generation | Revert and re-queue | |

**User's choice:** Move to 'rejected' state (Recommended)

---

## Claude's Discretion

- Default posting times per platform
- Schedule config file format and location
- Retry logic details (backoff, max retries, notifications)
- Performance score formula weights
- Topic/format category taxonomy
- Daily performance report layout
- Pending-schedule retry trigger mechanism

## Deferred Ideas

None -- discussion stayed within phase scope
