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

### Install

```bash
npm install
```

### Environment variables

Create a `.env` in the repo root:

```
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...         # Gemini image fallback via nano-banana
POSTIZ_API_KEY=...
APIFY_API_KEY=...          # apify-ultimate-scraper
SUPADATA_API_KEY=...       # transcript extraction
```

### Connect publishing channels

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
