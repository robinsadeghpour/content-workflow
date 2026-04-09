---
name: review
version: 1.0.0
description: |
  Morning batch review of discovered content ideas. Presents top ideas from
  data/content.db for KEEP/SKIP/STAR decisions via CLI. Designed for Robin's
  morning session: one focused pass through the idea backlog to select what gets
  turned into content today. Trigger phrases: /review, "morning review",
  "show me ideas", or "what should I post about".
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# Review -- Morning Batch Content Review

Interactive morning review workflow for KEEP/SKIP/STAR decisions on discovered content ideas. One focused pass through the backlog, ~5 minutes, then hand off to content generation.

## Workflow

When `/review` is invoked, execute the following steps in order.

---

### Step 1: Check for today's review file

Run:
```bash
cat data/review/$(date +%Y-%m-%d).md 2>/dev/null
```

If the file exists, display a brief summary to Robin:

> "Today's pulse found {N} ideas. Here's the overview:"

Then show the file content (or a condensed version with titles and sources).

If no file exists, tell Robin:

> "No pulse has run today. Run /pulse first, or I can review ideas from previous days."

Continue to Step 2 regardless — there may be pending ideas in the DB from earlier pulse runs.

---

### Step 2: Query pending ideas from the database

Run:
```bash
node -e "
  const db = require('better-sqlite3')('data/content.db');
  const ideas = db.prepare(\"SELECT id, title, summary, source_url, source_type, score, status, transcript FROM ideas WHERE status IN ('new', 'starred') ORDER BY score DESC\").all();
  console.log(JSON.stringify(ideas));
  db.close();
"
```

Parse the JSON output. If the array is empty, tell Robin:

> "No pending ideas to review. All caught up! Run /pulse to discover new ideas."

Stop here if nothing to review.

---

### Step 3: Present ideas and collect decisions

Initialize counters: kept=0, skipped=0, starred=0, remaining=total_count.

For each idea (iterate in order, score DESC):

**Display this format:**

```
--- Idea {N}/{total} ---

{title}

Source: {source_type} | {source_url}
Angle:  {content_angle_suggestion}

> {summary}

[Transcript available: yes/no]
```

**Content angle suggestion logic** (evaluate in order, first match wins):
- `source_type === 'changelog'` → "News reaction"
- title contains (case-insensitive) "tutorial", "how to", "guide", or "learn" → "Tutorial breakdown"
- title contains (case-insensitive) "wrong", "actually", "unpopular", "hot take", or "controversial" → "Hot take"
- title contains (case-insensitive) "vs", "compare", "comparison", or "better" → "Comparison"
- default → "Topic breakdown"

**DO NOT show score or score breakdown.** (Per D-09 — Robin doesn't need to see the math.)

**After presenting the idea**, use `AskUserQuestion` to ask:

> "**KEEP** (k) — generate content | **SKIP** (s) — dismiss | **STAR** (st) — save for later | **QUIT** (q) — stop reviewing"

Accept these inputs case-insensitively:
- `k` or `keep` → status: `kept`
- `s` or `skip` → status: `skipped`
- `st` or `star` → status: `starred`
- `q` or `quit` → stop the loop, go to Step 5

---

### Step 4: Update status in database (after each decision)

After Robin makes a decision for an idea, immediately run:

```bash
node scripts/review-update.js --id <actual_idea_id> --status <actual_status>
```

Where `<actual_idea_id>` is the real UUID from the query results and `<actual_status>` is `kept`, `skipped`, or `starred`.

**CRITICAL:** Never use inline `node -e` with placeholder strings like `'{id}'` or `'{status}'` for DB updates — always use `scripts/review-update.js` with the actual values interpolated into the CLI arguments. The script uses a parameterized UPDATE query.

Update counters after each decision:
- kept++ if kept
- skipped++ if skipped
- starred++ if starred
- remaining-- for each idea reviewed

If Robin typed `quit`, stop iterating and go directly to Step 5.

---

### Step 5: Show review summary

After all ideas are reviewed (or Robin quits), display:

```
Review complete!
- Kept:      {kept} ideas (ready for content generation)
- Skipped:   {skipped} ideas
- Starred:   {starred} ideas (will appear in next review)
- Remaining: {remaining} ideas (not yet reviewed)
```

If kept > 0, add:
> "Run a content generation skill (/linkedin, /tiktok-slideshows, etc.) on any kept idea to create platform-native content."

---

## Important Behavioral Rules

- **D-08:** Decisions happen ONLY via this interactive command. Never instruct Robin to edit the markdown file.
- **D-09:** Show title + summary, source + link, and content angle. Do NOT show the numeric score.
- **Previously starred ideas** appear alongside new ideas (status IN ('new', 'starred')), sorted by score DESC. No separate view needed.
- **Transcript content** is not shown inline during card review. If Robin asks about a specific idea's transcript, run:
  ```bash
  node -e "const db=require('better-sqlite3')('data/content.db'); const r=db.prepare('SELECT transcript FROM ideas WHERE id=?').get('<id>'); console.log(r && r.transcript || 'No transcript available.'); db.close();"
  ```
  and display the result.
- **Quit at any time:** Robin can type `q` or `quit` to exit the loop immediately and see the summary.

---

## Schedule

| Time | Command | Phase | Status |
|------|---------|-------|--------|
| 6:00 AM | /pulse | Phase 2 | Active |
| Manual | /review | Phase 2 | Active |
| Manual | /linkedin, /tiktok-slideshows | Phase 3 | Active |
| 6:00 PM | perf-check | Phase 4 | Not yet created |

Registration commands (per D-07, using Claude Code /schedule):

```
/schedule "0 6 * * *" /pulse
/schedule "0 18 * * *" perf-check
```

Note: /review and content generation skills are manual — no cron registration needed.

---

## Dependencies

- `data/content.db` — ideas table populated by /pulse (status='new' records)
- `scripts/review-update.js` — CLI script for safe DB status updates
- Ideas must exist with status='new' or 'starred' — requires /pulse to have run at least once
