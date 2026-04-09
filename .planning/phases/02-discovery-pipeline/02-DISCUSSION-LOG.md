# Phase 2: Discovery Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 02-discovery-pipeline
**Areas discussed:** Source strategy, Scoring & ranking, Review workflow, Transcript handling

---

## Source Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| YouTube (yt-search + Supadata) | Search for trending AI/tech videos, extract metadata | ✓ |
| TikTok (Apify actor) | Trending AI/tech TikToks via Apify scraper | ✓ |
| X/Twitter (Apify actor) | Trending posts/threads in AI/tech | ✓ |
| Web changelogs & GitHub releases | Product updates from tools Robin covers | ✓ |

**User's choice:** All four sources selected
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Skip and log | Log failure, continue with remaining sources | ✓ |
| Retry once then skip | One retry with backoff, then skip | |
| Fail entire pulse | Abort whole run if any source fails | |

**User's choice:** Skip and log
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Core AI tools only | Claude/Anthropic, OpenAI, Cursor, Codex | |
| Broader AI ecosystem | Core tools + Vercel AI SDK, LangChain, etc. | |
| You decide | Claude picks initial list | |

**User's choice:** Claude/Anthropic only for now
**Notes:** User typed custom answer — narrower than "Core AI tools only", just Anthropic changelogs to start

---

## Scoring & Ranking

| Option | Description | Selected |
|--------|-------------|----------|
| Engagement metrics | Views, likes, comments from source platform | ✓ |
| Recency / freshness | How new the topic is | ✓ |
| Topic relevance to Robin's niche | AI/tech keyword/semantic matching | |
| Source authority | Weight by source credibility | |

**User's choice:** Recency/freshness and engagement metrics only
**Notes:** Two signals selected out of four

| Option | Description | Selected |
|--------|-------------|----------|
| Weighted sum | Numeric formula, fast, no API cost | ✓ |
| Claude evaluation | Claude scores each idea, smarter but costly | |
| Hybrid | Weighted sum + Claude re-ranks top 10-15 | |

**User's choice:** Weighted sum
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| 10-20 ideas | Enough variety, ~5 min review | ✓ |
| 5-10 ideas | Highly curated, fewer choices | |
| 20-50 ideas | Wide net, longer review sessions | |

**User's choice:** 10-20 ideas
**Notes:** None

---

## Review Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| One at a time | Card-by-card Tinder-style | |
| Full list then decide | Show all ideas as ranked list | |
| Batch of 5 | Show 5 at a time | |

**User's choice:** Full list in a local file (markdown) — scan first, then decide
**Notes:** User provided custom answer — wants to see everything in one file before making interactive decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown file | data/review/YYYY-MM-DD.md | ✓ |
| HTML file | Styled page with checkboxes | |
| CSV/spreadsheet | Opens in Google Sheets | |

**User's choice:** Markdown file
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Interactive /review after scan | Read overview, then walk through one by one | ✓ |
| Edit markdown directly | Mark decisions in the file | |
| You decide | Claude picks approach | |

**User's choice:** Interactive /review after scan
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Title + summary | Headline and 1-2 sentence summary | ✓ |
| Source + link | Where it came from with URL | ✓ |
| Score breakdown | Engagement + recency scores | |
| Content angle suggestion | One-liner suggesting content approach | ✓ |

**User's choice:** Title + summary, Source + link, Content angle suggestion (no score breakdown)
**Notes:** None

---

## Transcript Handling

| Option | Description | Selected |
|--------|-------------|----------|
| On-demand when KEPT | Extract only for KEEP decisions | |
| Eager during pulse | Extract for all video ideas during pulse | ✓ |
| Lazy on content generation | Defer to Phase 3 | |

**User's choice:** Eager during pulse
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| In the ideas table | Add transcript TEXT column to existing table | ✓ |
| Separate transcripts table | New table with idea_id FK | |
| Markdown files on disk | data/transcripts/{idea_id}.md | |

**User's choice:** In the ideas table
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| First 200 words as preview | Truncated preview in review file | |
| No — link only | Just show source link | |
| Collapsible full transcript | Details/summary tags for expandable text | ✓ |

**User's choice:** Collapsible full transcript
**Notes:** None

---

## Claude's Discretion

- Search queries/keywords per source
- Deduplication hash algorithm
- Weighted sum formula and default weights
- Markdown review file layout
- Content angle suggestion generation
- Starred idea re-surfacing behavior

## Deferred Ideas

None — discussion stayed within phase scope
