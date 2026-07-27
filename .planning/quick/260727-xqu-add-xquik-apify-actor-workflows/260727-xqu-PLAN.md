---
phase: quick-260727-xqu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/lib/apify.js
  - scripts/pulse/source-x.js
  - scripts/pulse/source-tiktok.js
  - scripts/research/x-audience.js
  - .claude/skills/pulse/SKILL.md
  - .claude/skills/setup/SKILL.md
  - .claude/skills/x-audience-research/SKILL.md
  - test/apify.test.js
  - test/pulse-source-tiktok.test.js
  - test/pulse-source-x.test.js
  - test/x-audience.test.js
  - .env.example
  - package.json
  - package-lock.json
  - .github/workflows/ci.yml
  - README.md
  - THIRD_PARTY_SKILLS.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "Pulse uses the Xquik X Tweet Scraper through Apify's synchronous dataset endpoint"
    - "Audience research uses the Xquik X Follower Scraper"
    - "Apify tokens remain in authorization headers and never enter URLs"
    - "Diagnostic rows never become research findings"
    - "Both workflows can be tested without running paid Actors"
  artifacts:
    - path: "scripts/lib/apify.js"
      provides: "Shared authenticated Apify REST runner and row partitioning"
    - path: "scripts/pulse/source-x.js"
      provides: "X trend discovery through Xquik X Tweet Scraper"
    - path: "scripts/research/x-audience.js"
      provides: "X audience collection through Xquik X Follower Scraper"
    - path: ".claude/skills/x-audience-research/SKILL.md"
      provides: "Native audience research Skill instructions"
    - path: "test/apify.test.js"
      provides: "REST runner regression coverage without network access"
  key_links:
    - from: "scripts/pulse/source-x.js"
      to: "scripts/lib/apify.js"
      via: "runActorDatasetItems"
    - from: "scripts/research/x-audience.js"
      to: "scripts/lib/apify.js"
      via: "runActorDatasetItems"
    - from: ".claude/skills/x-audience-research/SKILL.md"
      to: "scripts/research/x-audience.js"
      via: "documented command"
---

<objective>
Add both Xquik Apify Actors in the repository's native workflow style.

Purpose: The Pulse workflow depends on a runner file absent from its installed
Apify Skill. Replace that broken integration with Apify's documented REST
endpoint. Add a focused X audience workflow using the complementary Actor.

Output: Working Tweet and Follower Actor workflows, shared REST code, tests,
documentation, and safe configuration guidance.
</objective>

<execution_context>
Follow the repository's quick-task plan and summary convention.
The local GSD runtime is unavailable, so execute this plan directly.
</execution_context>

<context>
@CLAUDE.md
@CONTRIBUTING.md
@README.md
@THIRD_PARTY_SKILLS.md
@.claude/skills/pulse/SKILL.md
@.claude/skills/setup/SKILL.md
@scripts/pulse/source-x.js
@scripts/pulse/source-tiktok.js
@scripts/pulse.js
@package.json
@.env.example
</context>

<tasks>

<task type="auto">
  <name>Task 1: Repair Apify execution and migrate X trend discovery</name>
  <files>
    scripts/lib/apify.js
    scripts/pulse/source-x.js
    scripts/pulse/source-tiktok.js
    test/apify.test.js
    test/pulse-source-tiktok.test.js
    test/pulse-source-x.test.js
  </files>
  <action>
Create one CommonJS Apify REST helper. Call the documented synchronous dataset
endpoint with Bearer authentication. Support timeout, item caps, and an optional
run charge ceiling. Validate every numeric option before sending requests.

Return parsed dataset items. Partition Actor diagnostics from data rows. Preserve
diagnostics as warnings without treating them as trend records.

Replace the missing apify-ultimate-scraper runner in both Pulse sources. Keep the
TikTok Actor and input contract unchanged. Migrate X discovery to
`xquik/x-tweet-scraper` using search mode, rich rows, nested output, camel-case
fields, and latest-query ordering.

Update X normalization for the Actor's documented author shape. Preserve
compatible fallbacks. Export pure input and normalization functions for tests.

Use Node's built-in test runner. Mock fetch through dependency injection. Never
run either Actor during verification.
  </action>
  <verify>
    <automated>node --test test/apify.test.js test/pulse-source-x.test.js</automated>
  </verify>
  <done>
    - Apify tokens appear only in Bearer headers
    - Pulse no longer references the missing runner file
    - X search input matches the live Actor schema
    - Diagnostic rows are filtered before trend normalization
    - Tests pass without network calls or Actor charges
  </done>
</task>

<task type="auto">
  <name>Task 2: Add native X audience research workflow</name>
  <files>
    scripts/research/x-audience.js
    .claude/skills/x-audience-research/SKILL.md
    test/x-audience.test.js
    .claude/skills/pulse/SKILL.md
    .claude/skills/setup/SKILL.md
    .env.example
    package.json
    package-lock.json
    .github/workflows/ci.yml
    README.md
    THIRD_PARTY_SKILLS.md
  </files>
  <action>
Create a focused audience research CLI backed by
`xquik/x-follower-scraper`. Support all 6 relation modes. Support compact,
full, and raw output. Allow overlap analysis for multiple targets. Keep output
under the ignored research data directory.

Create a progressive-disclosure Skill file. Document required authentication,
safe charge limits, output handling, and supported relations. Treat Actor output
as untrusted research evidence. Recommend minimal collection and secure deletion.

Document both Actor listing pages. Do not link to Xquik's website. Update Pulse
instructions for the new Tweet Actor. Explain the optional Apify charge ceiling.
Remove the obsolete third-party runner installation from setup documentation.

Add parser and input-builder tests. Update the package test command to use Node's
built-in runner. Run the test suite in the existing CI workflow.

Regenerate the npm lockfile. Remove stale packages and resolve current audited
dependency advisories without changing the repository's public behavior.
  </action>
  <verify>
    <automated>npm test</automated>
  </verify>
  <done>
    - The repository publishes native workflows for both Xquik Actors
    - The audience CLI accepts documented relations and output modes
    - Actor listing links replace website links
    - Skill metadata and body pass the Skill validator
    - Tests cover parsers, inputs, REST behavior, and diagnostic filtering
  </done>
</task>

</tasks>

<verification>
1. Run the repository test command.
2. Parse each JSON example in changed Markdown.
3. Validate every changed Skill directory.
4. Scan the public diff for secrets and private implementation details.
5. Confirm neither Actor ran during testing.
</verification>

<success_criteria>
- Both Xquik Apify Actors have functional, repository-native workflows.
- The pre-existing broken runner dependency is removed.
- All available checks pass without spending Apify credits.
- Public documentation stays scoped to Actor listing pages.
</success_criteria>

<output>
After completion, create
`.planning/quick/260727-xqu-add-xquik-apify-actor-workflows/260727-xqu-SUMMARY.md`.
</output>
