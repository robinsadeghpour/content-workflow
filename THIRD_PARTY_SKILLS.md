# Third-Party Skills

This project depends on four Claude Code skills authored by other people. They are **not vendored** in this repository. Install them yourself before running the pipeline.

The fastest path is the [setup skill](.claude/skills/setup/SKILL.md). Run
`/setup` in Claude Code to install all four and configure API keys. The manual
instructions below are for reference.

---

## Required skills

| Skill | What it does | License | Source |
|-------|--------------|---------|--------|
| `humanizer` | Removes AI-writing tells from drafts. Invoked by the `writing` skill and the critic agent. | MIT | [blader/humanizer](https://github.com/blader/humanizer) |
| `nano-banana` | Gemini image generation fallback when no real visual is available for a slide. | MIT | [kkoppenhaver/cc-nano-banana](https://github.com/kkoppenhaver/cc-nano-banana) |
| `supadata` | YouTube/TikTok/Instagram transcript extraction and web scraping. Used by the pulse pipeline. | See upstream | [Smithery: vm0-ai/supadata](https://smithery.ai/skills/vm0-ai/supadata) |
| `postiz` | Scheduling and publishing to LinkedIn, TikTok, Instagram, etc. Required for `/approve` to actually schedule posts. | **AGPL-3.0** | [gitroomhq/postiz-agent](https://github.com/gitroomhq/postiz-agent) |

> **Postiz is AGPL-3.0.** That license is incompatible with this project's MIT license, which is why it lives outside the repo. If you redistribute Postiz alongside this project, you take on AGPL obligations for the combined work. Most users running this locally for their own publishing won't be affected, but read the license before redistributing.

---

## Manual install

Install each Skill at `.claude/skills/<skill-name>/`. Some workflows invoke
these folders directly, so use the exact locations.

```bash
# 1. Humanizer
git clone --depth=1 https://github.com/blader/humanizer .claude/skills/humanizer
rm -rf .claude/skills/humanizer/.git

# 2. Nano Banana
git clone --depth=1 https://github.com/kkoppenhaver/cc-nano-banana .claude/skills/nano-banana
rm -rf .claude/skills/nano-banana/.git

# 3. Supadata: install via Smithery
#    See https://smithery.ai/skills/vm0-ai/supadata for the latest install command.
#    Place the SKILL.md at .claude/skills/supadata/SKILL.md

# 4. Postiz: read the AGPL-3.0 license before installing
git clone --depth=1 https://github.com/gitroomhq/postiz-agent .claude/skills/postiz
rm -rf .claude/skills/postiz/.git
```

After installing, set the relevant API keys in `.env` (copy from `.env.example`). Sign up for accounts where needed:

- Postiz: [postiz.pro](https://postiz.pro/robin-sadeghpour-faraj)
- Supadata: [supadata.ai](https://supadata.ai/?ref=robin)
- Apify: [apify.com](https://apify.com)
- Gemini: [Google AI Studio](https://aistudio.google.com/apikey)

---

## Why skills aren't vendored

- **License compatibility.** Postiz is AGPL-3.0 — vendoring it under MIT would force this entire project to AGPL.
- **Upstream drift.** Vendored copies go stale. Letting users pull from upstream means they always get the maintained version.
- **Attribution clarity.** Each skill stays under its original license, in its original repo, with full credit to its author.

If a skill author publishes their work as a [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces), prefer `/plugin marketplace add <repo>` over the git-clone instructions above.
