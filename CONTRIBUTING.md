# Contributing

Thanks for your interest in this project. It's a personal content pipeline that's been opened up so others can fork, learn from, and adapt it. Contributions are welcome — especially new platform skills, bug fixes, and docs.

## Ground rules

- **No secrets in commits.** API keys live in `.env` (gitignored). Always update `.env.example` when adding a new env var.
- **No personal data.** Don't commit photos from `media/images/`, scraped content from `data/`, or anyone's voice profile other than your own.
- **Keep voice profiles personal.** The `writing` skill is built around a personal voice profile. Don't ship yours in a PR.
- **Skills are the unit of work.** New functionality usually belongs in `.claude/skills/<name>/SKILL.md` rather than as standalone scripts.

## Development flow

1. Fork the repo and create a feature branch.
2. Make your changes. Keep diffs focused — one feature or fix per PR.
3. Test the affected skill or script locally:
   - For a skill, run the relevant `/<skill>` slash command in Claude Code.
   - For a script, run it directly: `node scripts/path/to/script.js`.
4. Open a PR using the template. Describe what you changed and how you verified it.

## Reporting issues

Use the issue templates. Include the command you ran, the expected vs. actual output, and any relevant logs (with API keys scrubbed).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
