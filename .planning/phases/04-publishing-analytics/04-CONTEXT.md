# Phase 4: Publishing & Analytics - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Approved content reaches all platforms via Postiz on schedule, and daily performance data feeds back into the discovery weighting so the system improves over time. This phase delivers the approval gate, Postiz scheduling across LinkedIn/TikTok EN/TikTok DE/Instagram, and the performance feedback loop.

</domain>

<decisions>
## Implementation Decisions

### Approval Workflow
- **D-01:** Single `/approve` command with optional `--platform` flag (e.g., `/approve --linkedin`). Default shows all pending critic-approved drafts across all platforms.
- **D-02:** Approval review shows humanized text + voice authenticity score from the critic. No before/after diff displayed — Robin trusts the voice pass and just reads the final text.
- **D-03:** Three actions per draft: Approve (schedule it), Reject (move to rejected state), Edit (open text for quick tweaks before approving).
- **D-04:** Robin's edits during approval are final — no re-critic pass. Edited + approved drafts go straight to scheduling.

### Scheduling Strategy
- **D-05:** Staggered auto-schedule with configurable per-platform default posting times (e.g., LinkedIn 9 AM CET, TikTok 12 PM CET, Instagram 6 PM CET). Defaults stored in a config file. On approve, posts auto-slot into the next available window for their platform.
- **D-06:** Per-post time override available during `/approve` — Robin can set a custom schedule time for any individual post instead of using the default.
- **D-07:** Scheduling failures (Postiz API down, rate limit, auth expired) handled with queue + retry. Failed posts stay in 'pending-schedule' state. Next cron run or manual `/approve` retries them. Robin notified of failures but doesn't need to act unless persistent.

### Performance Feedback Loop
- **D-08:** Performance score = impressions weighted by engagement rate (likes + comments + shares / impressions). Matches the existing `performance` table schema in content.db.
- **D-09:** Feedback loop tracks performance by both topic category AND format type. High-performing topics/formats get a score multiplier in the next pulse's discovery scoring. Simple multiplicative boost.
- **D-10:** 14-day rolling lookback window for performance weighting. Recent trends dominate, old data drops off naturally.
- **D-11:** Perf-check cron writes a daily human-readable summary to `data/performance/YYYY-MM-DD.md` showing top performers, underperformers, and trend signals. Robin can glance at it during the morning session.

### Draft State Machine
- **D-12:** Six draft states: `draft` -> `critic-approved` -> `user-approved` -> `scheduled` -> `published` -> `tracked`. Plus `rejected` as a terminal state.
- **D-13:** State transitions: (1) critic pass -> critic-approved, (2) Robin approves -> user-approved, (3) Postiz scheduling succeeds -> scheduled, (4) Postiz confirms publish -> published, (5) perf-check pulls data -> tracked.
- **D-14:** Rejected drafts get `rejected` status. Stay in DB for reference (signal that topic/approach didn't work). Don't appear in approval queue. Robin can optionally re-generate from the same idea later.

### Claude's Discretion
- Default posting times per platform (optimize for engagement based on common social media best practices)
- Schedule config file format and location
- Retry logic details (backoff strategy, max retries, notification mechanism)
- Performance score formula details (exact weights for impressions vs engagement rate)
- Topic/format category taxonomy for performance tracking
- Daily performance report layout and formatting
- How `pending-schedule` retries are triggered (cron-based vs on next `/approve`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Postiz Integration
- `.claude/skills/postiz/SKILL.md` -- Full Postiz CLI reference: authentication, post creation, scheduling, analytics, media upload, missing release ID handling.

### Database Schema
- `scripts/init-db.js` -- Existing schema with `ideas`, `drafts` (incl. postiz_id, visual_approach, media_dir), and `performance` tables. Phase 4 populates performance table and extends draft status values.

### Existing Pipeline Scripts
- `scripts/generate-content.js` -- Content generation orchestrator. Upstream producer of drafts that feed into approval.
- `scripts/apply-critic.js` -- Critic agent. Produces critic-approved drafts that enter the approval queue.
- `scripts/review-update.js` -- Review workflow. Reference for interactive CLI patterns.
- `scripts/cron-daemon.js` -- Cron skeleton. Phase 4 fills in the 6 PM perf-check logic.

### Voice & Writing
- `.claude/skills/writing/data/voice-linkedin.xml` -- LinkedIn voice profile for voice score context.
- `.claude/skills/writing/data/voice-casual.xml` -- TikTok/Instagram voice profile for voice score context.

### Discovery (Feedback Target)
- `scripts/pulse/scorer.js` -- Pulse scoring logic. Phase 4 performance feedback modifies scoring weights here.
- `scripts/pulse.js` -- Pulse orchestrator. Integration point for performance-boosted scoring.

### Technology Stack
- `CLAUDE.md` -- Full recommended tech stack. Relevant: better-sqlite3, @postiz/node SDK, node-cron, date-fns for timezone handling.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Postiz skill** (`.claude/skills/postiz/SKILL.md`): Full CLI reference for scheduling, analytics, media upload. Supports `posts:create` with date scheduling, `analytics:platform` and `analytics:post` for impressions/engagement data.
- **content.db performance table**: Already defined with draft_id, platform, views, likes, comments, shares, score, checked_at. Ready for Phase 4 population.
- **content.db drafts table**: Has postiz_id column for linking drafts to Postiz post IDs after scheduling.
- **cron-daemon.js**: Cron skeleton with 6 PM perf-check stub. Phase 4 fills in the real logic.
- **review-update.js**: Interactive CLI patterns for KEEP/SKIP/STAR decisions. Reference for approve/reject/edit interaction design.

### Established Patterns
- Skills are SKILL.md directories under `.claude/skills/` -- `/approve` follows this pattern
- Node.js scripts invoked from skills via bash
- SQLite via better-sqlite3 with WAL mode for concurrent access
- CommonJS module type (package.json `type: commonjs`)
- Claude Code Task tool for parallel subagent execution

### Integration Points
- `data/content.db` drafts table -- approval reads critic-approved drafts, updates status through the state machine
- `data/content.db` performance table -- perf-check writes daily metrics
- `scripts/pulse/scorer.js` -- performance feedback modifies scoring multipliers
- Postiz API -- scheduling writes, analytics reads
- `data/performance/` directory -- new, perf-check generates daily summary markdown files here

</code_context>

<specifics>
## Specific Ideas

- Single `/approve` command with optional platform filter matches the "one morning session" core value -- no command-switching
- Humanized text + score (no diff) keeps the review flow fast -- Robin trusts the voice system and just reads final output
- Per-post time override during approval gives Robin control without requiring it every time
- 14-day lookback window chosen for responsiveness -- Robin's content cadence is daily, so trends shift quickly
- Daily performance summary file fits the morning review pattern -- Robin glances at yesterday's results before today's approvals

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 04-publishing-analytics*
*Context gathered: 2026-04-09*
