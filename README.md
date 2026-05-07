# Content Workflow

A Claude Code-native content automation system that handles the full pipeline from idea discovery to scheduled publishing across LinkedIn, TikTok (EN + DE), and Instagram.

**Core value:** One morning session turns a curated idea backlog into platform-native content scheduled across all channels — no context-switching, no manual formatting, no copy-pasting between tools.

---

## Daily workflow

Four slash commands run in order. `/pulse` fires automatically overnight; the other three are Robin's morning batch.

| Step | Command | What it does | When |
|------|---------|--------------|------|
| 1 | `/pulse` | Scrapes YouTube, X/Twitter, TikTok, and Anthropic changelogs for trending AI/tech topics. Scores, deduplicates, pulls video transcripts, writes everything to `data/content.db` and a dated review file at `data/review/YYYY-MM-DD.md`. | Auto, 06:00 Berlin via `scripts/cron-daemon.js`. Run manually any time with `/pulse`. |
| 2 | `/review` | Presents the top ideas from the backlog for KEEP / SKIP / STAR decisions in the CLI. One focused pass to pick what becomes content today. | Morning batch. |
| 3 | `/generate-content` | For each KEPT idea, produces TikTok EN, TikTok DE, Instagram, and LinkedIn drafts. Applies Robin's voice profile, runs a humanizer pass, and scores drafts with the critic agent. Renders slides, carousels, and infographics via the `media-producer` skill. | Morning batch, after `/review`. |
| 4 | `/approve` | Interactive approval: shows before/after humanizer diffs and voice scores per platform. Approve, reject, or edit. Approved drafts are scheduled to Postiz for publishing. | Morning batch, after `/generate-content`. |

The end-of-day `perf-check` job (20:00 Berlin) pulls Postiz analytics for posts from the last 24h and updates topic/format multipliers. The next `/pulse` run uses those multipliers to weight discovery — the feedback loop closes without Robin doing anything.

---

## Dashboard

A local web UI for browsing ideas, drafts, and performance without leaving the browser.

```bash
node scripts/dashboard/server.js
```

Then open http://localhost:3456. The dashboard can also trigger `/pulse`, `/review`, `/generate-content`, and `/approve` runs via the `claude` CLI.

---

## Setup

### Prerequisites

- **Node.js 20+ LTS**
- **Python 3.10+** with Playwright (`pip install playwright && playwright install chromium`) — used by `scripts/dashboard/screenshot-slides.py` and the LinkedIn carousel renderer
- **Cairo system libs** (macOS only, for `canvas`): `brew install pkg-config cairo pango libpng jpeg giflib librsvg`
- **Claude Code CLI** — the primary runtime; every slash command above lives as a skill in `.claude/skills/`
- **NotebookLM CLI** — `/generate-content` runs a research pass via `notebooklm-py` before drafting, and reuses its venv Python to drive Playwright for LinkedIn slide screenshots. Install once with `/notebooklm-setup`.

### Quick setup (recommended)

After cloning, run `/setup` in Claude Code. It walks you through prerequisite checks, `npm install`, `.env` creation, and installing the five third-party skills this project depends on (with a checkpoint for the AGPL-licensed Postiz skill so you opt in knowingly). See [THIRD_PARTY_SKILLS.md](THIRD_PARTY_SKILLS.md) for licensing details.

### Manual setup

If you'd rather not use `/setup`, do the steps below.

**1. Install Node dependencies**

```bash
npm install
```

**2. Create `.env`**

```bash
cp .env.example .env
```

Then fill in the keys. Required keys:

- `ANTHROPIC_API_KEY` — only if scripts call the SDK directly; Claude Code uses your CLI auth
- `APIFY_TOKEN` — trend scraping
- `SUPADATA_API_KEY` — video transcripts
- `GEMINI_API_KEY` — fallback image generation
- `POSTIZ_API_KEY` — scheduling and publishing

**3. Install third-party skills**

These five skills are authored by other people and not vendored. Install each into `.claude/skills/<name>/` (several scripts hard-code these paths). Read [THIRD_PARTY_SKILLS.md](THIRD_PARTY_SKILLS.md) for license details — Postiz is AGPL-3.0 and has redistribution implications.

```bash
# Apify Ultimate Scraper (Apache-2.0)
git clone --depth=1 https://github.com/apify/agent-skills /tmp/apify-skills
cp -r /tmp/apify-skills/skills/apify-ultimate-scraper .claude/skills/
rm -rf /tmp/apify-skills

# Humanizer (MIT)
git clone --depth=1 https://github.com/blader/humanizer .claude/skills/humanizer
rm -rf .claude/skills/humanizer/.git

# Nano Banana (MIT)
git clone --depth=1 https://github.com/kkoppenhaver/cc-nano-banana .claude/skills/nano-banana
rm -rf .claude/skills/nano-banana/.git

# Supadata — install via Smithery (see https://smithery.ai/skills/vm0-ai/supadata)
# Place the resulting SKILL.md at .claude/skills/supadata/SKILL.md

# Postiz (AGPL-3.0) — read the license before installing
git clone --depth=1 https://github.com/gitroomhq/postiz-agent .claude/skills/postiz
rm -rf .claude/skills/postiz/.git
```

**4. Install the optional research/discovery skills**

Both have their own setup commands:

```
/notebooklm-setup    # Google NotebookLM CLI (used by /generate-content)
/yt-search-setup     # YouTube search (seeds /pulse discovery)
```

**5. Connect publishing channels**

Open the Postiz dashboard once and connect LinkedIn, TikTok EN, TikTok DE, and Instagram. After that, all scheduling happens via the `@postiz/node` SDK called from `/approve`.

---

## Data

Everything lives in a single SQLite file: `data/content.db` (WAL mode, so `/pulse` writes and the dashboard can read concurrently). Tables:

- **ideas** — scraped content ideas with source, score, transcript, and review decision
- **drafts** — generated drafts per platform with voice scores and humanizer diffs
- **performance** — daily Postiz analytics snapshots
- **voice_profile** — Robin's voice calibration built from scraped posts
- **photos** — photo library with text descriptions for AI-free image selection

Review files for each day land in `data/review/YYYY-MM-DD.md`.

---

## Project structure

```
.claude/skills/   Pipeline skills (pulse, review, generate-content, approve, writing,
                  humanizer, media-producer, postiz, supadata, apify-ultimate-scraper,
                  nano-banana, notebooklm-py, notebooklm-setup, yt-search-setup)
scripts/          Node.js implementations called by the skills
  pulse/          Scrapers, scorers, transcript fetcher
  dashboard/      Local web UI (server.js + public/)
  generate-*.js   Per-platform rendering scripts
  cron-daemon.js  node-cron scheduler for /pulse and perf-check
.planning/        GSD planning artifacts (phases, decisions, requirements)
data/             content.db, photo library, daily review files
```

---

## Constraints

- **Human-in-the-loop.** No post publishes without Robin's explicit approval in `/approve`.
- **Voice.** Every draft passes through the humanizer and voice profile before the critic scores it. LinkedIn leans slightly formal; TikTok and Instagram are casual.
- **Language.** English master content, German localization for TikTok DE only.
- **Media priority.** Real visuals (logos, screenshots, product images) preferred over AI-generated imagery. Nano Banana / Gemini is the fallback.
- **No video.** Slideshows and static formats only.
