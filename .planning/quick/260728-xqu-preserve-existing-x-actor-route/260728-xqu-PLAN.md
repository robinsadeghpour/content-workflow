---
phase: quick-260728-xqu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/pulse/source-x.js
  - test/pulse-source-x.test.js
  - .claude/skills/pulse/SKILL.md
  - .claude/skills/setup/SKILL.md
  - .env.example
  - README.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "Pulse keeps its existing Tweet Actor route as the default"
    - "Pulse supports Xquik X Tweet Scraper through explicit configuration"
    - "Each Actor receives only its own input schema"
    - "Tests never start an Actor"
  artifacts:
    - path: "scripts/pulse/source-x.js"
      provides: "Explicit, additive Tweet Actor route selection"
    - path: "test/pulse-source-x.test.js"
      provides: "Offline coverage for both Actor input contracts"
---

<objective>
Make the Xquik Pulse integration additive.

Purpose: Preserve the repository's existing Tweet Actor route while retaining
the new Xquik route and shared authenticated runner.

Output: Explicit Actor selection, Actor-specific inputs, tests, and matching
configuration guidance.
</objective>

<execution_context>
Follow the repository's quick-task plan and summary convention.
The local GSD runtime is unavailable, so execute this plan directly.
</execution_context>

<tasks>

<task type="auto">
  <name>Task 1: Preserve both Pulse Tweet Actor routes</name>
  <files>
    scripts/pulse/source-x.js
    test/pulse-source-x.test.js
    .claude/skills/pulse/SKILL.md
    .claude/skills/setup/SKILL.md
    .env.example
    README.md
  </files>
  <action>
Keep the existing Apify Tweet Actor as the Pulse default. Support Xquik X
Tweet Scraper through the PULSE_X_ACTOR_ID setting. Build each Actor's input
with its own schema. Reject unsupported identifiers before any request.

Add offline tests for both input contracts and explicit route selection.
Document the default and Xquik option without adding an Xquik website link.
  </action>
  <verify>
    <automated>node --test test/pulse-source-x.test.js</automated>
  </verify>
  <done>
    - Existing Pulse behavior remains the default
    - Xquik remains a supported native route
    - Both input contracts have offline tests
    - No Actor runs during verification
  </done>
</task>

</tasks>

<verification>
1. Run the repository test command.
2. Check every changed JavaScript file with Node.
3. Scan the public diff for secrets and private implementation details.
4. Confirm no Actor ran.
</verification>

<success_criteria>
- Xquik is additive instead of replacing the existing route.
- All available checks pass without spending Apify credits.
</success_criteria>

<output>
After completion, create
`.planning/quick/260728-xqu-preserve-existing-x-actor-route/260728-xqu-SUMMARY.md`.
</output>
