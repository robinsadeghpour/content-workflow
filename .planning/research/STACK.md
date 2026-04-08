# Stack Research

**Domain:** Claude Code-native content automation pipeline (LinkedIn, TikTok EN+DE, Instagram)
**Researched:** 2026-04-08
**Confidence:** HIGH (core) / MEDIUM (version specifics)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 20+ LTS | Runtime for all scripts | Larry pipeline is already Node.js; Claude Code skills invoke bash which calls node scripts. Ecosystem depth for image, HTTP, file I/O is unmatched. |
| `@anthropic-ai/sdk` | 0.85.0 | Content generation, translation, humanizer calls | Native to the Claude Code environment. Used in-process for text generation, translation of EN→DE, voice calibration. Current latest as of research date. |
| `@postiz/node` | 1.0.8 | Scheduling + cross-platform publishing | Already integrated as a skill. Official SDK. Supports LinkedIn, TikTok, Instagram, 28+ platforms. Also exposes analytics API needed for feedback loop. Rate limit: 30 req/hr (non-posting). |
| `canvas` (node-canvas) | 2.x | Slide text overlay compositing | Larry 1.0.0 already ships this as `add-text-overlay.js`. Cairo-based, ~800K weekly downloads, longest track record, most compatible with browser Canvas2D API. The existing codebase uses `createCanvas` + `loadImage` from this package — no migration cost. |
| `sharp` | 0.34.5 | Image resize, format conversion, composite assembly | Fastest Node.js image processor (libvips). Used for final slide compositing, logo/screenshot scaling, format conversion (PNG→WebP for Instagram). Text is rendered via canvas, then composited via sharp for output. |
| `playwright` (Python CLI) | 1.x (Playwright sync) | HTML→slide screenshot pipeline | The existing linkedin skill's `screenshot-slides.py` already uses `playwright.sync_api`. This is the proven path: Claude writes HTML, Playwright renders and captures each `.slide` element at 2x DPR. Do not replace this. |
| `node-cron` | 4.2.1+ | Daily pulse cron trigger | 3M weekly downloads, minimal API, zero dependencies, full cron syntax. Used for `0 6 * * *` daily pulse and `0 20 * * *` end-of-day performance check. |
| `better-sqlite3` | latest | Idea backlog, performance history, voice profile cache | Fastest synchronous SQLite for Node.js. Single-user CLI context — sync API is ideal (no callback complexity). Outperforms lowdb by orders of magnitude once rows exceed ~1K. Stores: content ideas, post metadata, performance scores, scrape dedup hashes. |

---

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zx` | 8.x (`@lite` variant) | Shell orchestration in JS scripts | Wrapping multi-step pipeline calls (scrape → generate → overlay → schedule) in a readable async script without raw `child_process`. ~7x smaller than full zx. Use in pipeline runner scripts, not in skill SKILL.md files. |
| `cheerio` | 1.x | HTML parsing for web scraping | Scraping changelog pages, GitHub release pages, and static HTML content. No browser needed — use before reaching for Playwright/Puppeteer. |
| `node-fetch` / native `fetch` | Node 20 built-in | HTTP requests to APIs | Node 20 ships `fetch` natively. Do NOT install `node-fetch` unless targeting Node <18. Use native fetch for Postiz API, Apify actors, Supadata calls. |
| `@napi-rs/canvas` | latest | Alternative canvas if node-canvas install fails | Skia-based, pre-built binaries (no system lib deps like libcairo). 500K weekly downloads. Use as a drop-in fallback if node-canvas native build fails on a fresh machine. |
| `puppeteer` | 22.x | Screenshot fallback / Apify actor integration | Already present conceptually via Apify. Use Playwright for slide rendering (already implemented), Puppeteer only if an Apify actor explicitly requires it. |
| `openai` | latest | Image generation (gpt-image-1.5) | Larry already uses this for `generate-slides.js`. Keep as primary AI image gen. Use `gpt-image-1.5` (NEVER `gpt-image-1` per Larry's explicit warning). |
| `dotenv` | 16.x | Environment variable management | Loading API keys (POSTIZ_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY) in Node scripts. Do not hardcode secrets. |
| `p-limit` | 5.x | Concurrency control for API calls | Parallel image generation or scraping with bounded concurrency (e.g., max 3 concurrent OpenAI image requests). ESM-only in v5+, verify CJS compatibility with project setup. |
| `date-fns` | 3.x | Date manipulation for scheduling | Calculating publish windows, performance lookback periods, post timing by timezone (Berlin/CET for DE, UTC for EN). Smaller and more tree-shakeable than moment. |

---

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Python 3.10+ with `playwright` sync | HTML slide rendering | The linkedin skill's `screenshot-slides.py` uses `playwright.sync_api`. Keep Python for this specific task — migrating to Node Playwright is possible but creates zero value. Run `pip install playwright && playwright install chromium`. |
| `claude` CLI (Claude Code) | Skill invocation, agent orchestration | The primary runtime. Skills are SKILL.md directories loaded dynamically. All pipeline stages triggered via Claude Code slash commands. |
| Postiz web dashboard | Initial channel connection | Connect LinkedIn, TikTok EN, TikTok DE, Instagram accounts once in the dashboard. After that, all scheduling happens via `@postiz/node` SDK. |

---

## Installation

```bash
# Core pipeline scripts
npm install canvas sharp @postiz/node @anthropic-ai/sdk openai

# Utility
npm install zx cheerio dotenv date-fns p-limit

# Dev / optional
npm install -D node-cron

# Python slide renderer (one-time setup)
pip install playwright
playwright install chromium
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `canvas` (node-canvas) | `@napi-rs/canvas` | If Cairo system libs fail to install (Docker, serverless). Drop-in API-compatible replacement. |
| `canvas` (node-canvas) | `skia-canvas` | If SVG rendering quality matters (e.g., complex vector overlays). Lower adoption (~50K downloads vs 800K). |
| `better-sqlite3` | `lowdb` (JSON flat file) | Only for prototype/MVP with fewer than 500 rows and no query needs. Upgrade path to SQLite becomes mandatory around 1K+ ideas in the backlog. |
| `better-sqlite3` | native `node:sqlite` (Node 22+) | If project moves to Node 22+. Native module with zero dependencies, but synchronous API is still experimental as of research date. |
| `node-cron` | `node-schedule` | If you need date-specific one-off scheduling (not recurring). For daily cron patterns, node-cron is simpler. |
| `@anthropic-ai/sdk` for translation | DeepL API | If translation volume is extremely high and you need a translation memory / glossary system. For this project, Claude handles EN→DE translation inline during content generation — no separate translation service needed. |
| `playwright` (Python) | `puppeteer` (Node) | If the Python dependency is unacceptable. Puppeteer is 20-30% faster for single-page Chrome tasks but requires rewriting `screenshot-slides.py`. Not worth it. |
| `cheerio` | `playwright` (full browser) | When page requires JavaScript execution to render content (SPAs, dynamic dashboards). Prefer cheerio for static HTML (changelogs, release pages, static blogs). |
| `zx` | raw `child_process` | Never use raw `child_process.exec` for multi-step pipeline orchestration — error handling becomes unmanageable. zx's `$` template tag is strictly better. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `moment.js` | 67KB bundle, deprecated in favor of date-fns and Luxon. No tree-shaking. | `date-fns` (functional, tree-shakeable, 3.x) |
| `node-fetch` (if Node 20+) | Node 20 ships `fetch` natively. Extra dependency with no benefit on modern Node. | Native `fetch` (built-in) |
| `gpt-image-1` (NOT gpt-image-1.5) | Larry's own scripts document this as a critical mistake with explicit warnings. The two models differ in quality. Always use `gpt-image-1.5`. | `gpt-image-1.5` via `openai` SDK |
| Express / any web framework | This is CLI-first. No HTTP server needed. Building a web layer adds complexity with zero user value for Robin's single-operator workflow. | Claude Code skills invoked via `/command` |
| Prisma / TypeORM / Drizzle | ORMs add migration complexity and abstraction overhead for a single-user, single-process CLI pipeline that makes simple queries. | `better-sqlite3` direct SQL |
| `jimp` | Pure JS image processor with no native bindings — orders of magnitude slower than sharp for resize/composite operations. | `sharp` |
| n8n / Make / Zapier | External automation platforms add a dependency outside of Claude Code's native environment. Robin works in Claude Code daily — all automation should live as skills and scripts, not in a third-party SaaS. | Claude Code skills + `node-cron` |
| Separate translation service (DeepL, Google Translate API) | Unnecessary API key + cost for EN→DE translation of short social media posts. Claude already has the content context and produces better-localized output than a pure translation service because it understands the platform tone. | `@anthropic-ai/sdk` inline translation during content generation |
| `ffmpeg` / video generation | Out of scope (PROJECT.md). No video content. | N/A — static slideshows only |

---

## Stack Patterns by Variant

**For slide image generation (TikTok/Instagram):**
- Use `openai` SDK with `gpt-image-1.5` to generate raw slide images
- Pipe through `canvas` (node-canvas) to add text overlays
- Use `sharp` for final resize (1080x1920 for TikTok/Reels, 1080x1350 for Instagram carousel)
- Reference: Larry's `generate-slides.js` → `add-text-overlay.js` pattern

**For LinkedIn carousel (HTML-based):**
- Claude writes branded HTML with `.slide` elements
- Python `playwright.sync_api` screenshots each `.slide` at 2x DPR (1200px viewport, device_scale_factor=2)
- `sharp` post-processes for quality/size optimization
- Reference: linkedin skill's `screenshot-slides.py`

**For daily content pulse (scraping):**
- `cheerio` for static pages (changelogs, GitHub releases, tech blogs)
- Apify actors (via `apify-ultimate-scraper` skill) for TikTok, X, YouTube trends
- `yt-search` skill for YouTube search integration
- `supadata` skill for transcript extraction from discovered videos
- `better-sqlite3` to store scraped ideas with deduplication hashes

**For German localization:**
- Generate English master content first
- Pass to `@anthropic-ai/sdk` with a localization prompt that adapts for TikTok DE tone ("brooo" energy preserved in German idioms)
- No separate i18n library needed — locale is a content concern, not a code concern

**For performance feedback loop:**
- `@postiz/node` analytics API → fetch impression data for posts from past 24h
- `better-sqlite3` stores format/topic performance scores
- Next pulse query weighted by historical performance (SQL query on scores table)
- `node-cron` triggers at 20:00 Berlin time daily

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|----------------|-------|
| `canvas@2.x` | Node 16, 18, 20, 22 | Requires Cairo system libs. On macOS: `brew install pkg-config cairo pango libpng jpeg giflib librsvg`. Pre-built binaries available for most LTS platforms. |
| `sharp@0.34.x` | Node 18.17.0+ | Ships prebuilt binaries via `@img/sharp-*` platform packages. No system libvips needed. |
| `better-sqlite3` latest | Node 16+ | Requires native build. Pre-built binaries available for LTS versions via `node-pre-gyp`. |
| `playwright` (Python) | Python 3.8+ | `playwright install chromium` downloads ~130MB Chromium. One-time per machine. |
| `@postiz/node@1.0.8` | Node 16+ | Last published 7 months ago. API stable. Rate limit: 30 requests/hour (non-posting ops). |
| `@anthropic-ai/sdk@0.85.0` | Node 18+ | Published April 2026. Frequent updates — pin minor version in package.json. |
| `p-limit@5.x` | ESM only | If using CommonJS (`require`), stay on `p-limit@4.x` (last CJS release). Larry scripts use `require()` — use v4. |
| `zx@8.x` (`@lite`) | Node 18+ | `@lite` build is 7x smaller, zero runtime dependencies. Use `import { $ } from 'zx/core'` for the lite variant. |

---

## Sources

- [sharp npm](https://www.npmjs.com/package/sharp) — v0.34.5 confirmed, Nov 2025
- [sharp changelog v0.34.5](https://sharp.pixelplumbing.com/changelog/v0.34.5/) — official
- [@postiz/node npm](https://www.npmjs.com/package/@postiz/node) — v1.0.8, MCP integration confirmed
- [Postiz Public API docs](https://docs.postiz.com/public-api) — rate limits, endpoint structure
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — v0.85.0 as of April 8 2026
- [node-canvas vs @napi-rs/canvas vs skia-canvas (PkgPulse, 2026)](https://www.pkgpulse.com/blog/node-canvas-vs-napi-rs-canvas-vs-skia-canvas-server-2026) — download stats, comparison
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3) — sync API rationale, performance claims
- [node-cron npm](https://www.npmjs.com/package/node-cron) — v4.2.1, 3M weekly downloads
- [Playwright vs Puppeteer 2025 (Apify)](https://blog.apify.com/playwright-vs-puppeteer/) — cross-browser, auto-wait advantage
- [Claude translation benchmarks (getblend.com, 2025)](https://www.getblend.com/blog/which-llm-is-best-for-translation/) — WMT24 ranking, no dedicated service needed
- [zx GitHub](https://github.com/google/zx) — @lite variant, v8.5.0+ minimal build
- [p-limit npm compare](https://npm-compare.com/) — ESM-only status in v5+
- `/Users/robinsadeghpour/content-workflow/Larry 1.0.0/scripts/add-text-overlay.js` — confirmed node-canvas usage
- `/Users/robinsadeghpour/content-workflow/Larry 1.0.0/scripts/generate-slides.js` — confirmed openai + gpt-image-1.5 usage
- `/Users/robinsadeghpour/.claude/skills/linkedin/scripts/screenshot-slides.py` — confirmed Python Playwright usage

---

*Stack research for: Claude Code-native content automation pipeline*
*Researched: 2026-04-08*
