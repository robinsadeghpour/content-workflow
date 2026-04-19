# Instagram Carousel Writing Guide

Write carousels that stop the scroll, deliver one idea cleanly, and end on a reason to follow. Every slide should be readable in under 2 seconds.

The bar: if a slide can't be absorbed in one breath, cut words until it can. Instagram is not LinkedIn — you are not writing paragraphs, you are writing posters.

---

## Voice

Punchy, confident, plain. Same as LinkedIn but **shorter**. Where LinkedIn gets a sentence, Instagram gets a fragment. Where LinkedIn gets a fragment, Instagram gets a word.

Say what you mean in the fewest words that still sound like a person talking. No filler. No throat-clearing. No "here's the thing".

**Banned phrases** (instant AI tells — same list as LinkedIn):
- "game-changer", "unlock", "leverage", "double down"
- "here's the thing", "let that sink in", "unpopular opinion"
- "in today's landscape", "it's important to note"
- One-word dramatic sentences ("Perspective." / "Period.")
- Rhetorical questions as hooks

---

## Headline Rules

**The headline carries 80% of the slide.** It has to land without the body text.

1. **Max 6 words per line, max 4 lines.** The `headline--xl` at 140px runs out of room fast. Count words.
2. **One accent word per headline.** The orange word is what the reader remembers — make it the noun or verb the slide pivots on.
3. **UPPERCASE reads chunkier.** The template uppercases automatically via CSS. Write sentence case in the source.
4. **Break lines intentionally.** Each line is a beat. Use `<br>` to control the rhythm, don't let the browser wrap for you.
5. **No punctuation at line-ends except the final period.** Commas mid-line are fine. No em-dashes.

Good:
> Memory<br>
> **solved.**<br>
> Claude Code<br>
> + Obsidian.

Bad (too many words, no rhythm):
> The complete setup for giving Claude Code persistent memory with Obsidian.

---

## Body Text Rules

Body text is a **supporting caption**, not an essay. Max 2 sentences per slide. Max 30 words.

If the headline is abstract, body is concrete. If the headline is concrete, body is the "why it matters". Never explain what the headline already said.

Good:
> Claude forgets everything when a session ends. Here's the setup that fixes it — permanently.

Bad:
> In this carousel we'll walk through the complete process of setting up persistent memory for Claude Code using Obsidian as a note-taking backend connected via MCP.

---

## Carousel Structure

Not every carousel needs all six parts, but this is the skeleton:

**1. Hook slide** — Big promise. One accent word. Body = one-sentence setup. Label pill = topic category.

**2. Problem slide** — What's broken. Usually a comparison card (`Without this setup`).

**3. Solution slide** — The reveal. Name the thing. Body = 1-sentence what-it-is.

**4. How-it-works slide(s)** — Numbered list or step-by-step. 3-4 rows max per slide. Split if longer.

**5. Proof/payoff slide** — What thriving looks like. Concrete outcome, not a promise.

**6. CTA slide (always last)** — Follow for [specific value prop]. `@robinfaraj`. Button.

Most carousels: 6-10 slides. Fewer than 5 feels thin. More than 12 loses people.

---

## Label Pill Conventions

Each slide's label pill tells the reader where they are in the story. Use the **stage**, not a generic word.

Good labels (specific, stage-based):
- `MEMORY — SOLVED` (hook)
- `THE PROBLEM`
- `THE SOLUTION`
- `HOW IT WORKS`
- `VAULT STRUCTURE`
- `THE MEMORY LOOP`
- `THAT'S A WRAP` (CTA)

Bad labels (generic):
- `INTRO`, `STEP 1`, `CONTENT`, `INFO`

Keep pills under 3 words. Uppercase is automatic via CSS.

---

## Rhythm Across Slides

- **Vary density.** A headline-only slide earns the right to a dense comparison slide next. Don't stack three heavy slides in a row.
- **Swipe motivation.** Every `footer-swipe` line should imply there's something worth swiping for. Use `swipe to know more →`, `swipe for the setup →`, `swipe to see it →` — not just `swipe →`.
- **Callback on the last slide.** The CTA outro should echo the hook's topic ("Memory solved" → "Follow for daily AI drops" works because the category is already established).

---

## Comparison Card Rules

- **Parallel items.** If the neg card has 4 items, the pos card has 4. Same length per item (±3 words).
- **Neg first, pos second.** Left = pain, right = relief. Never flip.
- **No hedging in pos items.** "Can improve X" is weak. "X compounds over time" is strong.
- **Short heads.** `Without this setup` / `With Claude + Obsidian`. Not full sentences.

---

## Numbered List Rules

- **Row title = the action.** Verb-led if possible. "Obsidian runs the MCP server" beats "MCP server explained".
- **Row desc = one sentence, max 20 words.** Cut until it fits.
- **Max 4 rows per slide.** If you have 5+, split or pick the best 4.
- **No nested bullets.** If a step needs sub-steps, it's probably two slides.

---

## Length Targets

- **Headline**: 4-12 words total
- **Body text**: 10-30 words, 1-2 sentences
- **Numbered row title**: 3-7 words
- **Numbered row desc**: 10-25 words
- **Comparison card item**: 4-10 words
- **Total carousel word count**: 150-350 words

If you're over 400 words, you're writing LinkedIn content on Instagram.

---

## Editing Checklist

Every "yes" means something needs to change:

- Can the headline be read in 2 seconds? If no, cut words.
- Is there more than one accent word per headline? Cut one.
- Does any body paragraph exceed 2 sentences? Cut.
- Are the comparison items parallel in length? Fix the long one.
- Does the label pill tell the reader where they are in the story? Or is it generic?
- Is the swipe text specific or generic? Make it specific.
- Does the CTA slide say what they'll get if they follow? Not just "follow me".
- Any banned phrases? Replace with plain language.
- First slide readable without zooming? If not, reduce words.

---

## Source Integrity

Same rules as LinkedIn. Every factual claim traces to research. No invented stats, no fabricated quotes. Robin's opinions and takes are encouraged — facts must be sourced.

Short format is **not** a license to be vague. If you can't source a claim, say the softer version ("changes how X works") instead of inventing a number.
