# Phase 1: Foundation & Voice - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 01-foundation-voice
**Areas discussed:** Data directory structure, Voice profile strategy, Cron & automation wiring, CLI command design

---

## Data Directory Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Project root data/ | data/ at project root, gitignored for runtime state | |
| Inside .planning/data/ | Colocate with planning artifacts | |
| .claude/data/ | Under Claude Code config directory | |

**User's choice:** Either root data/ or nested within relevant skill — depends on what skills exist

---

| Option | Description | Selected |
|--------|-------------|----------|
| Centralized data/ | Root data/ with subdirs for all pipeline state | |
| Hybrid — shared + skill-local | Root data/ for cross-cutting, skill-specific stays in skill | |
| Keep per-skill, add symlinks | Each skill keeps own data/, symlinks from root | |

**User's choice:** Hybrid — cross-reference data in root data/, skill-specific data stays in skills. Mentioned wanting a "writing skill" that owns voice profile internally.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Single content.db | One SQLite file with tables for ideas, performance, drafts | :white_check_mark: |
| Separate DBs per domain | data/ideas.db, data/performance.db, etc. | |
| JSON files, no SQLite yet | Start with flat files, upgrade later | |

**User's choice:** Single content.db
**Notes:** No additional notes

---

| Option | Description | Selected |
|--------|-------------|----------|
| Leave untouched | Existing skills keep working as-is, wired in later phases | :white_check_mark: |
| Migrate data references now | Update existing skills to use new data/ | |

**User's choice:** Leave untouched

---

## Voice Profile Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Scrape existing posts | Use Apify/Supadata to pull Robin's posts | |
| Manual paste of best posts | Robin hand-picks 50+ posts | |
| Hybrid — scrape + curate | Scrape everything, Robin reviews | |

**User's choice:** Scrape Robin's posts + get posts from Nick Saraev (linkedin.com/in/nick-saraev) and Lenny Rachitsky (linkedin.com/in/lennyrachitsky)
**Notes:** These are inspiration/reference accounts for style extraction

---

| Option | Description | Selected |
|--------|-------------|----------|
| Style extraction only | Analyze structure/hooks/patterns, apply using Robin's personality | :white_check_mark: |
| Blended voice model | Mix elements from all three into one profile | |
| Separate reference profiles | Keep as modular inspiration profiles | |

**User's choice:** Style extraction only

---

| Option | Description | Selected |
|--------|-------------|----------|
| New writing skill | Dedicated skill owning voice profiles, calls humanizer internally | :white_check_mark: |
| Extend humanizer | Add voice profile management to existing humanizer | |
| You decide | Claude picks | |

**User's choice:** New writing skill

---

| Option | Description | Selected |
|--------|-------------|----------|
| Two profiles | LinkedIn formal-authentic + TikTok/Instagram casual | :white_check_mark: |
| Three profiles | LinkedIn, TikTok, Instagram each separate | |
| One profile + tone modifiers | Single base with platform-specific knobs | |

**User's choice:** Two profiles

---

## Cron & Automation Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Claude Code triggers | /schedule for recurring remote agents | |
| node-cron in local process | Long-running Node.js process | |
| System crontab | macOS launchd or crontab | |

**User's choice:** Either /schedule or /loop — both Claude Code native
**Notes:** /schedule for daily recurring, /loop for shorter-interval session monitoring

---

| Option | Description | Selected |
|--------|-------------|----------|
| Stub triggers | Register schedule entries with stub logic, filled in later phases | :white_check_mark: |
| Full pulse skeleton | Working pulse that scrapes at least one source | |
| Just document the schedule | No registration, document only | |

**User's choice:** Stub triggers

---

## CLI Command Design

| Option | Description | Selected |
|--------|-------------|----------|
| Individual commands | /pulse, /review, /draft, /approve, /publish | :white_check_mark: |
| Master /content command | /content pulse, /content review, etc. | |
| Minimal new commands | Only /pulse and /review, reuse existing skills | |

**User's choice:** Individual commands

---

| Option | Description | Selected |
|--------|-------------|----------|
| Core pipeline + writing skill | /pulse (stub), /review (stub), /writing | :white_check_mark: |
| Writing skill only | Only /writing in Phase 1 | |
| All pipeline commands as stubs | Full CLI surface from day 1 | |

**User's choice:** Core pipeline + writing skill

---

## Claude's Discretion

- Internal data/ subdirectory naming
- SQLite schema design
- Voice profile file format
- Writing skill's internal humanizer integration

## Deferred Ideas

None — discussion stayed within phase scope
