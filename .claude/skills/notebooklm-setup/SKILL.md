---
name: notebooklm-setup
description: "Set up notebooklm-py and the NotebookLM Claude Code skill from scratch. Installs the CLI, Playwright browser, and Claude Code integration. Use when the user says 'set up notebooklm', 'install notebooklm', '/notebooklm-setup', or needs to get notebooklm-py working on a new machine. Also use if notebooklm commands are failing and a reinstall might help."
model: haiku
---

# NotebookLM Setup

Install [notebooklm-py](https://github.com/teng-lin/notebooklm-py) — an unofficial Python CLI for Google NotebookLM — and register its Claude Code skill.

## What gets installed

| Component | Purpose |
|-----------|---------|
| **pipx** | Isolated Python app installer (if not already present) |
| **notebooklm-py** | CLI for NotebookLM (`notebooklm` command) |
| **Playwright chromium** | Headless browser used for Google OAuth login |
| **Claude Code skill** | `~/.claude/skills/notebooklm/SKILL.md` — enables `/notebooklm` and natural language automation |

## Setup steps

Run each step in order. Check the output before proceeding — if a step fails, troubleshoot before continuing.

### 1. Install pipx

pipx manages Python CLI tools in isolated virtual environments, avoiding conflicts with system Python.

```bash
which pipx || brew install pipx
```

If Homebrew isn't available, fall back to `python3 -m pip install --user pipx`.

### 2. Install notebooklm-py

The `[browser]` extra pulls in Playwright, which is needed for the login flow.

```bash
pipx install "notebooklm-py[browser]"
```

If already installed, upgrade instead:

```bash
pipx upgrade notebooklm-py
```

Verify the CLI is available:

```bash
notebooklm --version
```

### 3. Install Playwright chromium

Playwright needs its own bundled Chromium binary. Install it inside the notebooklm-py virtualenv:

```bash
~/.local/pipx/venvs/notebooklm-py/bin/playwright install chromium
```

On Linux, you may also need system dependencies: `playwright install-deps chromium`.

### 4. Install the Claude Code skill

This copies the skill file into `~/.claude/skills/notebooklm/`:

```bash
notebooklm skill install
```

### 5. Authenticate with Google

This step requires user interaction — a browser window opens for Google OAuth. Tell the user to run this themselves:

```bash
notebooklm login
```

After login, verify auth works:

```bash
notebooklm auth check
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `externally-managed-environment` error from pip | Use pipx instead of pip |
| `playwright: command not found` | Use the full venv path: `~/.local/pipx/venvs/notebooklm-py/bin/playwright` |
| Auth errors after setup | Re-run `notebooklm login` |
| Skill not showing in Claude Code | Re-run `notebooklm skill install`, then restart Claude Code session |
| `notebooklm: command not found` after pipx install | Run `pipx ensurepath` and restart your shell |

## After setup

Once authenticated, the user can:
- Use `/notebooklm` slash command in Claude Code
- Ask naturally: "create a podcast about X", "summarize these URLs", "generate a quiz"
- Run CLI commands directly: `notebooklm list`, `notebooklm create "Title"`, etc.
