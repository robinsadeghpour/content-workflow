---
name: setup
description: One-time setup for the content workflow. Installs the four third-party skills (humanizer, nano-banana, supadata, postiz), creates .env from .env.example, and verifies prerequisites. Run this once after cloning the repo. Trigger - /setup.
---

# Setup

You are guiding the user through one-time setup of the content workflow. This is a fresh-clone install: third-party skills, environment file, and dependency check.

## Steps

Walk through each section in order. Stop and ask the user at the **checkpoints** before continuing — don't blow through everything silently.

### 1. Confirm working directory

Verify you're at the repo root:

```bash
pwd && ls package.json .claude/ 2>&1
```

If not at the repo root, stop and tell the user to `cd` into the cloned repo.

### 2. Check prerequisites

Run these checks in parallel and report results:

```bash
node --version    # need 20+
python3 --version # need 3.10+
which claude      # need Claude Code CLI installed
```

If any are missing, point the user at the README's Setup section and stop.

### 3. Install Node dependencies

```bash
npm install
```

This pulls `better-sqlite3`, `canvas`, `sharp`, `node-cron`, etc. Canvas needs Cairo system libs on macOS — if install fails, run `brew install pkg-config cairo pango libpng jpeg giflib librsvg` and retry.

### 4. Create .env from template

Check if `.env` already exists:

```bash
test -f .env && echo "exists" || echo "missing"
```

If missing, copy the template:

```bash
cp .env.example .env
```

Then **stop** and tell the user to fill in the API keys before continuing. Show them which keys are which:

- `ANTHROPIC_API_KEY` — only needed if scripts call the SDK directly; Claude Code uses your CLI auth
- `APIFY_TOKEN` — required for trend scraping (sign up: https://apify.com)
- `PULSE_X_ACTOR_ID`: optional; keeps the existing route by default
- `SUPADATA_API_KEY` — required for video transcripts (sign up: https://supadata.ai/?ref=robin)
- `GEMINI_API_KEY` — required for nano-banana fallback images (sign up: https://aistudio.google.com/apikey)
- `POSTIZ_API_KEY` — required to actually schedule posts (sign up: https://postiz.pro/robin-sadeghpour-faraj)

**Checkpoint:** Wait for the user to confirm `.env` is filled in (or that they'll do it later). Then continue.

### 5. Install third-party skills

These four skills are not vendored. Install them now to `.claude/skills/<name>/` so the scripts that reference them work. See THIRD_PARTY_SKILLS.md for licenses and source repos.

```bash
mkdir -p .claude/skills

# Humanizer
git clone --depth=1 https://github.com/blader/humanizer .claude/skills/humanizer && \
  rm -rf .claude/skills/humanizer/.git

# Nano Banana
git clone --depth=1 https://github.com/kkoppenhaver/cc-nano-banana .claude/skills/nano-banana && \
  rm -rf .claude/skills/nano-banana/.git

# Postiz
git clone --depth=1 https://github.com/gitroomhq/postiz-agent .claude/skills/postiz && \
  rm -rf .claude/skills/postiz/.git
```

For Supadata, point the user at https://smithery.ai/skills/vm0-ai/supadata for the latest install command — Smithery's CLI may have changed since this skill was written. The skill should land at `.claude/skills/supadata/SKILL.md`.

### 6. Verify install

Confirm all four skill folders exist:

```bash
ls .claude/skills/ | grep -E "humanizer|nano-banana|supadata|postiz"
```

If any are missing, retry that specific install or point the user at THIRD_PARTY_SKILLS.md for the manual fallback.

### 7. Optional: NotebookLM and yt-search

These are used by `/generate-content` and the pulse YouTube source. They're separate one-time installers:

```bash
# In Claude Code:
/notebooklm-setup
/yt-search-setup
```

Mention these to the user but don't run them automatically — both prompt for OAuth/API setup that the user has to handle interactively.

### 8. Connect publishing channels

Postiz channel connections (LinkedIn, TikTok EN, TikTok DE, Instagram) happen in the Postiz web dashboard, not via this skill. Point the user there:

> Open the Postiz dashboard, connect your channels, and copy the integration IDs. The reference IDs for this project's channels are in the project memory under "Postiz TikTok integration IDs" — but yours will differ since they're tied to your accounts.

### 9. Done

Tell the user the next step is `/pulse` to populate the idea backlog, then `/review` to make decisions. Direct them to the README's "Daily workflow" section.

## Notes

- This skill is idempotent up to the git clones — re-running it on existing skill folders will fail because the destination already exists. If the user wants to reinstall, have them `rm -rf .claude/skills/<name>` first.
- Don't commit the third-party skill folders. They're already covered by the project's setup convention (each user installs locally) but if they show up in `git status`, add them to `.gitignore` rather than committing.
