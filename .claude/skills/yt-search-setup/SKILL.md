---
name: yt-search-setup
description: "Set up the /yt-search slash command for Claude Code. Installs yt-dlp, creates the search script, and registers the slash command. Use when the user says 'set up yt-search', 'install youtube search', or '/yt-search-skill-setup'."
---

# YouTube Search Skill Setup

This skill installs the `/yt-search` slash command for Claude Code, enabling YouTube search directly from the CLI.

## What it sets up

1. **yt-dlp** — The CLI tool that powers the search (installed via pip/pipx/brew)
2. **Search script** — `~/.claude/scripts/yt-search.py` — Python script that queries YouTube and formats results
3. **Slash command** — `~/.claude/commands/yt-search.md` — Claude Code command that invokes the script

## Setup steps

### 1. Check and install yt-dlp

```bash
which yt-dlp || pip install yt-dlp
```

If pip fails due to externally-managed-environment, try `pipx install yt-dlp` or `brew install yt-dlp`.

### 2. Create the scripts directory

```bash
mkdir -p ~/.claude/scripts
```

### 3. Create the search script

Write `~/.claude/scripts/yt-search.py` with:
- YouTube search via `yt-dlp --dump-json --flat-playlist`
- `--count N` flag (default: 20 results)
- `--months N` flag (default: 6, filters to recent videos)
- `--no-date-filter` flag (show all results regardless of date)
- Formatted output: title, channel (with subscriber count), views, duration, date, URL

### 4. Create the slash command

Write `~/.claude/commands/yt-search.md` with frontmatter:
```yaml
---
description: "Search YouTube and return structured video results"
argument-hint: "<query> [--count N]"
allowed-tools:
  - Bash
---
```

The command runs `python3 ~/.claude/scripts/yt-search.py $ARGUMENTS`.

### 5. Verify

```bash
python3 ~/.claude/scripts/yt-search.py "test query" --count 3
```

## After setup

The user can search YouTube with:

```
/yt-search claude code skills
/yt-search AI agents --count 10
/yt-search react tutorials --months 3
/yt-search machine learning --no-date-filter
```

## What it returns

For each video:
- Title
- Channel name and subscriber count
- View count
- Duration
- Upload date
- Direct YouTube link
