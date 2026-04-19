---
researched_at: 2026-04-11
idea_id: 703369c8-3091-4a20-b338-d0a45ff2a517
---

# Claude Code Plugin Research — 5 Skills

## Summary of Findings

All 5 skills from Sabrina Ramonov's TikTok are real Claude Code plugins/skills from Anthropic's
official repos. The install command format is:

```
/plugin install <plugin-name>@claude-plugins-official
```

or via the in-app UI: `/plugin > Discover > search <name>`

---

## Skill 1: Frontend Design

- **Repo:** https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design
- **Plugin name:** `frontend-design`
- **Install command:** `/plugin install frontend-design@claude-plugins-official`
- **What it does:** Auto-invoked skill for frontend work. Generates distinctive, production-grade
  UIs with bold aesthetic choices, real typography, animations, and brand tokens. Avoids generic
  AI aesthetics.
- **Authors:** Prithvi Rajasekaran + Alexander Bricken (Anthropic)
- **Screenshot target:** https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design

## Skill 2: Code Simplifier (Simplify)

- **Repo:** https://github.com/anthropics/claude-plugins-official/tree/main/plugins/code-simplifier
- **Plugin name:** `code-simplifier`
- **Install command:** `/plugin install code-simplifier@claude-plugins-official`
- **What it does:** Agent that simplifies and refines code — reduces complexity, removes
  redundancy, improves naming, preserves functionality. Run after code works but feels messy.
- **Author:** Anthropic (support@anthropic.com)
- **Screenshot target:** https://github.com/anthropics/claude-plugins-official/tree/main/plugins/code-simplifier

## Skill 3: Skill Creator

- **Repo:** https://github.com/anthropics/claude-plugins-official/tree/main/plugins/skill-creator
- **Plugin name:** `skill-creator`
- **Install command:** `/plugin install skill-creator@claude-plugins-official`
- **What it does:** Create new skills, improve existing skills, measure skill performance with
  evals. Tell it what workflow you want to automate; it generates the skill and benchmarks it.
- **Screenshot target:** https://github.com/anthropics/claude-plugins-official/tree/main/plugins/skill-creator

## Skill 4: Web App Testing (Playwright)

- **Repo:** https://github.com/alpharigel/web-e2e-skill  (community plugin)
  Also: https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/playwright
  (official Microsoft/Playwright external plugin)
- **Plugin name for community skill:** `alpharigel/web-e2e-skill`
- **Install command:** `claude plugin install alpharigel/web-e2e-skill`
- **What it does:** Teaches Claude Code how to set up and write Playwright end-to-end tests —
  config, test patterns, debugging. Claude auto-uses the skill when you ask for web app testing.
- **Screenshot target:** https://github.com/alpharigel/web-e2e-skill

## Skill 5: MCP Builder (mcp-server-dev)

- **Repo:** https://github.com/anthropics/claude-plugins-official/tree/main/plugins/mcp-server-dev
- **Plugin name:** `mcp-server-dev`
- **Install command:** `/plugin install mcp-server-dev@claude-plugins-official`
- **What it does:** Skills for designing and building MCP servers — guides through deployment
  models (remote HTTP, MCPB, local stdio), tool design patterns, auth, and interactive MCP apps.
  Entry point: ask Claude to "help me build an MCP server" or `/mcp-server-dev:build-mcp-server`
- **Author:** Anthropic
- **Screenshot target:** https://github.com/anthropics/claude-plugins-official/tree/main/plugins/mcp-server-dev

---

## Accurate Install Commands for TikTok Slides

| Skill | Command |
|-------|---------|
| Frontend Design | `/plugin install frontend-design@claude-plugins-official` |
| Code Simplifier | `/plugin install code-simplifier@claude-plugins-official` |
| Skill Creator | `/plugin install skill-creator@claude-plugins-official` |
| Web App Testing | `claude plugin install alpharigel/web-e2e-skill` |
| MCP Builder | `/plugin install mcp-server-dev@claude-plugins-official` |

All are free. All install via Claude Code's plugin system.
