# Phase 1: Foundation & Voice - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the project infrastructure skeleton (data directory, CLI scaffolding, cron stubs, parallel agent support) and Robin's voice profile system so every downstream phase has a stable foundation and authentic output.

</domain>

<decisions>
## Implementation Decisions

### Data Directory Structure
- **D-01:** Hybrid layout — centralized `data/` at project root for cross-cutting pipeline state (ideas, performance, drafts). Skill-specific assets (templates, slide HTML) stay inside each skill's directory.
- **D-02:** Single SQLite database at `data/content.db` with tables for ideas, performance history, and draft metadata. Use `better-sqlite3` per CLAUDE.md stack recommendation.
- **D-03:** Existing skills (linkedin, tiktok-slideshows, etc.) remain untouched in Phase 1. Migration to centralized data happens in their respective phases (2/3/4).

### Voice Profile Strategy
- **D-04:** New `writing` skill created to own voice profiles and orchestrate humanizer. Clean separation: humanizer = AI pattern removal, writing skill = voice application + generation guidance.
- **D-05:** Voice profile built by scraping Robin's real posts from LinkedIn + TikTok + Instagram. Additionally scrape Nick Saraev (linkedin.com/in/nick-saraev) and Lenny Rachitsky (linkedin.com/in/lennyrachitsky) for style extraction only — analyze their post structure, hook patterns, and engagement tactics, then apply those patterns using Robin's own personality.
- **D-06:** Two platform-specific voice profiles: (1) LinkedIn = formal-authentic, (2) TikTok + Instagram = casual ("brooo" energy). German TikTok uses the casual profile with DE localization applied on top.

### Cron & Automation
- **D-07:** Use Claude Code `/schedule` for daily recurring triggers (6 AM pulse, 6 PM perf-check). Use `/loop` for shorter-interval monitoring during active sessions.
- **D-08:** Phase 1 creates stub triggers only — they register the schedule entries and create skill entry points that log "triggered" without real logic. Phase 2 fills in pulse logic, Phase 4 fills in perf-check logic.

### CLI Command Design
- **D-09:** Individual slash commands per pipeline stage (not namespaced under a parent). Matches the existing pattern where each skill = one command.
- **D-10:** Phase 1 scaffolds: `/pulse` (stub), `/review` (stub), `/writing` (voice profile management + humanizer orchestration). Cron schedule entries also registered.
- **D-11:** Existing 11 skills continue working independently. Pipeline integration happens in later phases when each skill's domain is built out.

### Claude's Discretion
- Internal data/ subdirectory naming and structure (data/ideas/, data/drafts/, etc.)
- SQLite schema design for content.db tables
- Voice profile file format and storage within the writing skill
- How the writing skill internally calls the humanizer

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Technology Stack
- `CLAUDE.md` — Full recommended tech stack with version pins, alternatives, and anti-patterns. Covers better-sqlite3, node-cron, canvas, sharp, Playwright, Postiz SDK.

### Existing Skills (reusable patterns)
- `.claude/skills/humanizer/SKILL.md` — v2.5.1 voice calibration system, 12+ AI pattern categories, soul-injection guidance. The writing skill wraps this.
- `.claude/skills/tiktok-slideshows/SKILL.md` — Cron automation patterns (4 daily slots), weighted rules engine, performance tracking loop.
- `.claude/skills/tiktok-slideshows/data/active-rules.json` — Weighted persona system with status tracking (locked/active/experimental/retired). Pattern reference for voice profile structure.
- `.claude/skills/tiktok-slideshows/data/performance-log.json` — Performance tracking format with hook/persona/cron metadata.

### Pipeline Reference Code
- `Larry 1.0.0/scripts/daily-report.js` — Cron + analytics diagnostic framework. Reference for perf-check stub design.
- `Larry 1.0.0/SKILL.md` — Full pipeline architecture (47KB). Reference for slide generation, analytics, batch API patterns.

### Voice Inspiration Sources
- https://www.linkedin.com/in/nick-saraev/ — Style extraction target (post structure, hooks, engagement tactics)
- https://www.linkedin.com/in/lennyrachitsky/ — Style extraction target (post structure, hooks, engagement tactics)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Humanizer skill** (`.claude/skills/humanizer/SKILL.md`): Full voice calibration from writing samples, 12+ AI pattern detection categories. Writing skill will call this internally.
- **Weighted rules engine** (`active-rules.json`): Status-tracked rules with performance thresholds (viral/success/failure/dead). Pattern reference for voice profile weight management.
- **Performance log format** (`performance-log.json`): 14 tracked posts with metadata. Schema reference for content.db performance table.
- **Daily report script** (`Larry 1.0.0/scripts/daily-report.js`): Cron + Postiz + analytics cross-reference. Reference for perf-check cron stub.

### Established Patterns
- Skills are SKILL.md directories under `.claude/skills/` — each is a self-contained slash command
- Skill-local data stored in `skill-name/data/` subdirectories (tiktok-slideshows pattern)
- Node.js scripts invoked from skills via bash (Larry pattern)
- No package.json at project root yet — scripts are modular

### Integration Points
- New `writing` skill goes in `.claude/skills/writing/`
- New `pulse` and `review` stub skills go in `.claude/skills/pulse/` and `.claude/skills/review/`
- `data/` directory at project root — new location, no conflicts
- `data/content.db` — new SQLite database, no existing DB to migrate

</code_context>

<specifics>
## Specific Ideas

- Voice profile should extract structure/hooks/engagement patterns from Nick Saraev and Lenny Rachitsky, not blend their voice with Robin's. "Write like Robin but structured like Nick."
- Robin prefers skills that can call other skills — the writing skill calls humanizer internally rather than the user running both manually.
- Cron jobs should use Claude Code native scheduling (/schedule, /loop) rather than external processes.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-voice*
*Context gathered: 2026-04-08*
