---
name: approve
description: "Review critic-approved content drafts and schedule them for publishing via Postiz. Shows final humanized text with voice score per platform. Approve, reject, or edit drafts. Use when Robin says '/approve', 'approve content', 'schedule posts', 'publish content', or wants to review pending drafts."
---

# /approve — Content Approval & Scheduling

Interactive approval workflow for publishing content through Postiz.

## Activation Triggers

- `/approve`
- `approve content`
- `schedule posts`
- `review drafts for publishing`
- `publish content`

## Platform Filter

If Robin specifies a platform, pass it through:
- `/approve linkedin` or `/approve --linkedin` → `--platform linkedin`
- Same for `tiktok_en`, `tiktok_de`, `instagram`

## Workflow

### Step 1: Fetch Pending Drafts

```bash
cd /Users/robinsadeghpour/content-workflow && node scripts/approve-draft.js --list
```

If Robin specified a platform filter:
```bash
cd /Users/robinsadeghpour/content-workflow && node scripts/approve-draft.js --list --platform <platform>
```

Parse the JSON array output. If the array is empty, tell Robin:
> No drafts pending approval. Run `/generate-content` first to create drafts.

### Step 2: Check for Failed Retries

```bash
cd /Users/robinsadeghpour/content-workflow && node scripts/approve-draft.js --list-pending
```

If any pending-schedule drafts exist, inform Robin and offer to retry them.

### Step 3: Present Each Draft for Review

For each draft from `--list` output, use `AskUserQuestion` to present:

```
## [PLATFORM_BADGE] Draft: <draft_id>

**Voice Score:** <voice_score from critic>/10
**Visual:** <visual_approach> (<slide_count> slides)

---

<full final text — the humanized caption or post_text>

---

**Scheduled for:** <default schedule time from config>

→ **Approve** / **Reject** / **Edit** / **Skip**
```

Display fields:
- **Platform badge**: LINKEDIN / TIKTOK_EN / TIKTOK_DE / INSTAGRAM
- **Draft ID**: from the list output
- **Voice score**: critic's voice authenticity score (from content JSON if present)
- **Full final text**: the humanized content — show `caption` for tiktok/instagram, `post_text` for linkedin
- **Visual approach + slide count**: if applicable
- **Default schedule time**: computed from config/schedule-defaults.json

### Step 4: Handle Robin's Response

**Approve:**
```bash
cd /Users/robinsadeghpour/content-workflow && node scripts/approve-draft.js --id <draft_id> --action approve
```
If Robin provided a custom time:
```bash
cd /Users/robinsadeghpour/content-workflow && node scripts/approve-draft.js --id <draft_id> --action approve --schedule-at "<ISO8601>"
```

**Reject:**
```bash
cd /Users/robinsadeghpour/content-workflow && node scripts/approve-draft.js --id <draft_id> --action reject
```

**Edit:**
Ask Robin for the updated text. Then:
```bash
cd /Users/robinsadeghpour/content-workflow && node scripts/approve-draft.js --id <draft_id> --action edit --content "<updated_text>"
```
The script auto-schedules after edit (no re-critic pass — edits are final per D-04).

**Skip:**
Move to the next draft without any action.

### Step 5: Summary

After all drafts are processed, print a summary:
- How many approved / rejected / edited / skipped
- List scheduled times for all approved posts
- Note any scheduling failures (the script handles failures gracefully — drafts move to pending-schedule status, not crash)

## Important Rules

- **NEVER** schedule a post without Robin's explicit per-draft approval (PUBL-01)
- Show the **final humanized text**, NOT a before/after diff (D-02)
- Edits are **final** — no re-critic pass happens after edit (D-04)
- If scheduling fails for a draft, **inform Robin but continue** to the next draft (D-07)
- If a draft has media (slides), the script handles upload to Postiz automatically before scheduling
