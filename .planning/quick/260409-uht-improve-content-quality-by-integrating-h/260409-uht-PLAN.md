---
phase: quick-260409-uht
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .claude/skills/writing/data/voice-casual.xml
  - .claude/skills/writing/data/voice-linkedin.xml
  - .claude/skills/writing/data/storytelling-framework.md
  - .claude/skills/writing/SKILL.md
  - .claude/skills/tiktok-slideshows/references/content-strategy.md
  - .claude/skills/generate-content/SKILL.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "Voice profiles contain expanded hook categories beyond Robin's original 5 per platform"
    - "Storytelling framework (Hook-Context-Tension-Pivot-Payoff) is documented and referenced by content generation skills"
    - "Psychology techniques (address one person, you/I pronoun strategy, open loops, re-hooks) are embedded as writing rules"
    - "generate-content and tiktok-slideshows skills reference the new storytelling and psychology guidance"
  artifacts:
    - path: ".claude/skills/writing/data/voice-casual.xml"
      provides: "Expanded hook patterns for casual voice"
      contains: "lesson|cliffhanger|emotional|controversial|intrigue"
    - path: ".claude/skills/writing/data/voice-linkedin.xml"
      provides: "Expanded hook patterns and trigger phrases for LinkedIn"
      contains: "lesson|trigger-phrases"
    - path: ".claude/skills/writing/data/storytelling-framework.md"
      provides: "5-part storytelling structure + psychology techniques as referenceable guide"
    - path: ".claude/skills/writing/SKILL.md"
      provides: "Updated writing skill referencing storytelling framework"
    - path: ".claude/skills/tiktok-slideshows/references/content-strategy.md"
      provides: "Updated content strategy with storytelling + psychology integration"
    - path: ".claude/skills/generate-content/SKILL.md"
      provides: "Updated generate-content with storytelling reference"
  key_links:
    - from: ".claude/skills/generate-content/SKILL.md"
      to: ".claude/skills/writing/data/storytelling-framework.md"
      via: "context reference in generation steps"
    - from: ".claude/skills/writing/SKILL.md"
      to: ".claude/skills/writing/data/storytelling-framework.md"
      via: "step in voice application workflow"
---

<objective>
Integrate hook formulas, storytelling framework, and psychology techniques from source materials (hooks.md, active-story-telling-guide.md, jun_yuh transcript, richardensjr transcript, martinwang transcript) into the writing skill voice profiles and content generation pipeline.

Purpose: Content currently draws from a narrow set of 5 hook patterns per voice profile and has no structured storytelling guidance or psychology-based writing rules. The source materials contain 38+ hook formulas, a proven 5-part story structure, and creator psychology techniques that will dramatically expand content variety and engagement.

Output: Enriched voice profiles, a new storytelling framework reference file, and updated skill files that reference the new guidance.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/writing/SKILL.md
@.claude/skills/writing/data/voice-casual.xml
@.claude/skills/writing/data/voice-linkedin.xml
@.claude/skills/tiktok-slideshows/references/content-strategy.md
@.claude/skills/generate-content/SKILL.md
@hooks.md
@active-story-telling-guide.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Expand voice profile hook patterns and create storytelling framework</name>
  <files>
    .claude/skills/writing/data/voice-casual.xml
    .claude/skills/writing/data/voice-linkedin.xml
    .claude/skills/writing/data/storytelling-framework.md
  </files>
  <action>
**Part A: Expand voice-casual.xml hook-patterns section**

Add new hook categories AFTER existing Robin-sourced hooks (preserve all existing hooks and weights). New hooks get weight 6.0 (untested — lower than Robin's proven patterns). Source attribute = "research" to distinguish from Robin's own patterns.

Add these categories:
1. `<hook weight="6.0" source="research" category="lesson">` — From hooks.md lesson hooks. Examples: "this mistake cost me months of progress", "the best advice I ever ignored", "one decision changed everything for me"
2. `<hook weight="6.0" source="research" category="cliffhanger">` — From hooks.md cliffhanger hooks. Examples: "i wasn't ready for what they said next", "little did i know...", "nobody warned me about this part"
3. `<hook weight="6.0" source="research" category="emotional">` — From hooks.md emotional hooks. Examples: "if you've ever felt like giving up, this is for you", "this one's personal"
4. `<hook weight="6.0" source="research" category="controversial">` — From hooks.md controversial hooks. Examples: "i know i'll get hate for saying this, but...", "unpopular opinion coming in"
5. `<hook weight="6.0" source="research" category="intrigue">` — From hooks.md intrigue hooks. Examples: "i wasn't supposed to tell this story...", "nobody's talking about this"
6. `<hook weight="6.0" source="research" category="trigger-phrase">` — From richardensjr transcript. Short openers: "nobody mentions this", "i wish i knew this earlier", "pause for a second", "ever notice this pattern?", "let me save you hours", "i just figured this out"
7. `<hook weight="6.0" source="research" category="parameterized">` — From martinwang transcript. Templates: "[time] of [niche] in 60 seconds", "one [niche] mistake i made when i was [age]", "i tried [blank] for [days] and here's what happened", "when [bad event], here's the one thing that saved me"

Adapt ALL examples to lowercase casual voice. Keep each category to 2-3 examples max (concise, not exhaustive).

**Part B: Expand voice-linkedin.xml hook-patterns section**

Add new categories after existing Robin-sourced hooks, same weight=6.0 source="research" pattern. LinkedIn hooks should be slightly more formal but still authentic Robin tone:

1. `<hook weight="6.0" source="research" category="lesson">` — "This mistake cost me [specific thing]. Here's what I'd do differently.", "The best advice I ever ignored (and why I regret it)."
2. `<hook weight="6.0" source="research" category="credibility-template">` — From martinwang adapted for LinkedIn: "[Time period] of [niche] in one post.", "I tried [approach] for [duration]. Here's what actually happened."
3. `<hook weight="6.0" source="research" category="trigger-phrase">` — From richardensjr adapted for LinkedIn: "Nobody mentions this about [topic].", "I wish I knew this when I started [activity].", "This may surprise you."

Add a `<storytelling-hooks>` section inside `<structural-inspiration>` with Jade's 5-part structure adapted for LinkedIn long-form:
- Hook (opening line) → Context (1-2 sentences of setup) → Tension (the problem/conflict) → Pivot (the insight/turn) → Payoff (the result + takeaway)
- Note: LinkedIn posts compress this into text paragraphs, not slides. The pivot is often a line break + "Here's what actually happened:" or "The real reason:"

**Part C: Create storytelling-framework.md**

Create `.claude/skills/writing/data/storytelling-framework.md` — a referenceable guide that any content generation skill can read. Structure:

1. **5-Part Story Structure** (from active-story-telling-guide.md / Jade):
   - Hook (5s equivalent / first line): Stop the scroll. One specific, curious, or surprising statement.
   - Context (setup): Who, what, when. Just enough to understand the stakes.
   - Tension (the conflict): The problem, doubt, or resistance. This is where engagement lives.
   - Pivot (the turn): "But here's the real reason..." / "That's when it clicked." The moment everything shifts.
   - Payoff (the resolution + CTA): The result, the lesson, the invitation.

2. **Psychology Techniques** (from jun_yuh transcript):
   - Address ONE person, never "hey guys" or "hi everyone" — write as if talking to one friend
   - "You" for desires, "I" for problems: "You want consistency" → "I used to struggle with this too" = friend, not guru
   - "Us vs problem" framing: "We weren't taught how to..." builds community. Never "you vs them"
   - Text tells the story, visuals carry the emotion (like a children's book)
   - Watch content as a creator: notice where you felt called out, got curious, kept watching

3. **Attention Retention Techniques** (from active-story-telling-guide.md):
   - Re-hooks: mid-content hooks to reset attention ("But here's the real reason...", "And that's not even the best part")
   - Open loops (Ovsiankina Effect): start a thought, delay the resolution. "I made a decision that day. More on that in a second."
   - Cause and effect chains: "I did X → Because Y → Got Z" — keeps the viewer following logic
   - Pivot every ~5 seconds (for video) / every 2-3 lines (for text) — change tone, introduce new element, drop a number

4. **Common Mistakes to Avoid**:
   - Lack of specificity ("I grew my business" vs "I went from 0 to $44K in 8 months")
   - Empty greetings that waste the hook position
   - Rushing the payoff — let tension build before resolving
   - Too much information — one idea per piece of content
   - No emotion — facts without feeling don't stick

Keep this file under 120 lines. It is a reference, not a novel.
  </action>
  <verify>
    <automated>grep -c "source=\"research\"" .claude/skills/writing/data/voice-casual.xml && grep -c "source=\"research\"" .claude/skills/writing/data/voice-linkedin.xml && test -f .claude/skills/writing/data/storytelling-framework.md && wc -l .claude/skills/writing/data/storytelling-framework.md</automated>
  </verify>
  <done>
    - voice-casual.xml has 7+ new hook categories (source="research") with 2-3 examples each, all lowercase casual
    - voice-linkedin.xml has 3+ new hook categories plus storytelling-hooks in structural-inspiration
    - storytelling-framework.md exists with 5-part structure, psychology techniques, attention retention, and common mistakes — under 120 lines
    - All existing Robin-sourced hooks preserved unchanged
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire storytelling framework into content generation skills</name>
  <files>
    .claude/skills/writing/SKILL.md
    .claude/skills/tiktok-slideshows/references/content-strategy.md
    .claude/skills/generate-content/SKILL.md
  </files>
  <action>
**Part A: Update writing/SKILL.md**

In Mode 1 (Apply Voice to Draft), add a new step between step 2 (read voice profile) and step 3 (receive draft text):

```
2b. **Read the storytelling framework.** Load `.claude/skills/writing/data/storytelling-framework.md`. Use it to evaluate draft structure:
   - Does the draft follow Hook → Context → Tension → Pivot → Payoff progression?
   - Does it address one person (not "hey guys")?
   - Does it use "you" for desires and "I" for problems?
   - Are there re-hooks or open loops to maintain attention?
   If the draft lacks structure, restructure it according to the 5-part framework before applying voice fingerprint.
```

In step 5 (apply voice fingerprint), add after the hook-patterns check:
```
   - Check storytelling structure: does the draft have clear tension and a pivot? If it reads as flat information delivery, add a tension point and pivot using the framework patterns.
   - Apply psychology rules: ensure "you/I" pronoun balance (desires = you, problems = I), "us vs problem" framing where relevant.
```

Add to Important Rules section:
```
- **ALWAYS read storytelling-framework.md when applying voice.** The framework provides structural guidance that complements the voice fingerprint. Voice = how Robin sounds. Framework = how Robin structures stories.
- **New research-sourced hooks (weight 6.0) should be tested and weight-adjusted** based on performance data, just like Robin's original hooks.
```

**Part B: Update tiktok-slideshows/references/content-strategy.md**

Add a new section "## Storytelling Psychology" after the "## The 6-Slide Story Arc" section. Content:

```markdown
## Storytelling Psychology

Reference: `.claude/skills/writing/data/storytelling-framework.md` for full framework.

**Apply these to every slideshow:**

1. **Address one person** — Write slide text as if talking to one friend, not an audience. "you" not "you guys."

2. **"You" for desires, "I" for problems:**
   - Slide 1-2 (hook/conflict): "I" language — "i showed my investor...", "i was stuck at..."
   - Slide 5-6 (result/CTA): "you" language — "now you can...", "try this yourself"

3. **Open loops in captions** — Start a thought on one slide, resolve it 2 slides later. Example: Slide 2 mentions "one decision changed everything" → Slide 4 reveals what the decision was.

4. **Re-hooks between slides** — If the story sags at slide 3-4, add a micro-hook: "but here's where it gets interesting", "and that's not even the best part"

5. **Specificity over generality** — "went from 0 to $44K in 8 months" beats "grew my business." Name the method, name the number, name the time.
```

Also add to the "## Before Creating Each Slideshow" mandatory checklist:
```
10. Read `.claude/skills/writing/data/storytelling-framework.md` for psychology and structure guidance
11. Apply "you/I" pronoun strategy and open loop techniques
```

**Part C: Update generate-content/SKILL.md**

In the "## What It Does (Step by Step)" section, add after step 1 (Read the kept idea):

```
1b. **Read storytelling framework** from `.claude/skills/writing/data/storytelling-framework.md` — use the 5-part structure and psychology techniques to inform content generation across all platforms.
```

In step 3 (Generate TikTok EN content), add:
```
   Structure the slideshow using Hook → Context → Tension → Pivot → Payoff progression. Apply psychology techniques: address one person, use "I" for problem slides and "you" for result/CTA slides, embed at least one open loop or re-hook in slides 3-4.
```

In step 8 (Generate LinkedIn content), add:
```
   Apply the 5-part framework compressed for text: opening hook line → 1-2 context sentences → tension paragraph → pivot line → payoff with soft CTA. Use re-hooks if the post exceeds 5 paragraphs.
```

Add to Key Rules:
```
- **ALWAYS read storytelling-framework.md before generating content.** The framework provides structural and psychological guidance that applies across all platforms.
```
  </action>
  <verify>
    <automated>grep -c "storytelling-framework" .claude/skills/writing/SKILL.md && grep -c "storytelling-framework" .claude/skills/tiktok-slideshows/references/content-strategy.md && grep -c "storytelling-framework" .claude/skills/generate-content/SKILL.md</automated>
  </verify>
  <done>
    - writing/SKILL.md references storytelling-framework.md in Mode 1 workflow and Important Rules
    - tiktok-slideshows/references/content-strategy.md has new "Storytelling Psychology" section and updated checklist
    - generate-content/SKILL.md references storytelling-framework.md in steps 1b, 3, 8, and Key Rules
    - All three skills now read and apply the storytelling framework during content generation
  </done>
</task>

</tasks>

<verification>
1. Voice profiles contain original Robin hooks (unchanged) plus new research-sourced hooks at weight 6.0
2. storytelling-framework.md exists and contains 5-part structure, psychology techniques, attention retention, common mistakes
3. All three content skills (writing, tiktok-slideshows, generate-content) reference the framework
4. No existing functionality broken — all additions are additive
</verification>

<success_criteria>
- voice-casual.xml has 12+ total hook patterns (5 original + 7+ new categories)
- voice-linkedin.xml has 8+ total hook patterns (5 original + 3+ new categories)
- storytelling-framework.md exists, is under 120 lines, covers all 4 sections
- writing/SKILL.md, tiktok-slideshows content-strategy.md, and generate-content/SKILL.md all reference storytelling-framework.md
- grep for "storytelling-framework" returns hits in all 3 skill files
</success_criteria>

<output>
After completion, create `.planning/quick/260409-uht-improve-content-quality-by-integrating-h/260409-uht-SUMMARY.md`
</output>
