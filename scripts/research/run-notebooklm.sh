#!/usr/bin/env bash
# run-notebooklm.sh — Phase 06.1 Plan 01 Task 2
#
# Produces data/research/${IDEA_ID}.md for an idea using the NotebookLM CLI.
# Honors: D-02 (NotebookLM primary), D-03 (3-6 sources / fast mode),
# D-04 (last-30-day freshness bias), D-05 (fail-open research-thin stub),
# D-08 (cached per-idea brief, reusable across regenerate runs).
#
# Usage:
#   scripts/research/run-notebooklm.sh <IDEA_ID> <IDEA_TITLE> <IDEA_URL> [TRANSCRIPT_FILE]
#
# Env:
#   FORCE_RESEARCH=1   bypass cache and regenerate brief even if file exists
#
# Parallel-safe rules:
#   - NEVER call the notebooklm context-switch subcommand (writes to
#     ~/.notebooklm/context.json — breaks parallel agents). Always pass -n.
#   - Every subcommand passes -n "$NOTEBOOK_ID" explicitly
#
# Exit codes:
#   0  on success OR research-thin (research-thin is NOT a hard failure, D-05)
#   1  on catastrophic scripting error (missing required args)
#
# Final line of stdout: absolute or repo-relative path to the brief file.

set -uo pipefail

# ---- args ----------------------------------------------------------------

if [ $# -lt 3 ]; then
  echo "usage: $0 <IDEA_ID> <IDEA_TITLE> <IDEA_URL> [TRANSCRIPT_FILE]" >&2
  exit 1
fi

IDEA_ID="$1"
IDEA_TITLE="$2"
IDEA_URL="$3"
TRANSCRIPT_FILE="${4:-}"

# ---- paths ---------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RESEARCH_DIR="$REPO_ROOT/data/research"
BRIEF_PATH="$RESEARCH_DIR/${IDEA_ID}.md"

mkdir -p "$RESEARCH_DIR"

# ---- cache hit (D-08) ----------------------------------------------------

if [ -f "$BRIEF_PATH" ] && [ "${FORCE_RESEARCH:-0}" != "1" ]; then
  echo "[run-notebooklm] cache hit: $BRIEF_PATH" >&2
  echo "$BRIEF_PATH"
  exit 0
fi

# ---- notebooklm pipeline -------------------------------------------------

RESEARCH_THIN="false"
NOTEBOOK_ID=""
ANSWER=""

# 1. Create notebook (fail-open)
NOTEBOOK_ID=$(notebooklm create "Research: $IDEA_TITLE" --json 2>/dev/null | jq -r .id 2>/dev/null || true)

if [ -z "$NOTEBOOK_ID" ] || [ "$NOTEBOOK_ID" = "null" ]; then
  echo "[run-notebooklm] notebooklm create failed — writing research-thin stub" >&2
  RESEARCH_THIN="true"
fi

if [ "$RESEARCH_THIN" = "false" ]; then

  # 2. Optional: add cached transcript as a source
  if [ -n "$TRANSCRIPT_FILE" ] && [ -f "$TRANSCRIPT_FILE" ]; then
    notebooklm source add "$TRANSCRIPT_FILE" -n "$NOTEBOOK_ID" --json >/dev/null 2>&1 || true
  fi

  # 3. Optional: add the idea URL as a source
  if [ -n "$IDEA_URL" ]; then
    notebooklm source add "$IDEA_URL" -n "$NOTEBOOK_ID" --json >/dev/null 2>&1 || true
  fi

  # 4. Auto-discover 3–6 sources via NotebookLM Discover (D-03 fast mode)
  notebooklm source add-research "$IDEA_TITLE last 30 days" \
    --mode fast \
    -n "$NOTEBOOK_ID" \
    --import-all >/dev/null 2>&1 || true

  # 5. Wait for sources to be processed
  if ! notebooklm source wait -n "$NOTEBOOK_ID" --timeout 180 >/dev/null 2>&1; then
    echo "[run-notebooklm] source wait timeout/failed — marking research-thin" >&2
    RESEARCH_THIN="true"
  fi

  # 6. Ask for the structured brief
  if [ "$RESEARCH_THIN" = "false" ]; then
    ANSWER=$(notebooklm ask "Produce a 300-500 word research brief with: (1) 3-5 bullet key facts, (2) 3-5 quotes or stats with attribution, (3) source list with URLs and dates, (4) 2-4 content angle suggestions (contrarian, data-driven, story-driven). Bias toward info from the last 30 days. If you don't have enough information, say so explicitly." \
      -n "$NOTEBOOK_ID" \
      --json 2>/dev/null | jq -r .answer 2>/dev/null || true)
  fi
fi

# ---- heuristic thin detection --------------------------------------------

if [ -z "$ANSWER" ] || [ "$ANSWER" = "null" ] || [ "${#ANSWER}" -lt 200 ]; then
  RESEARCH_THIN="true"
fi

if echo "$ANSWER" | grep -qi "don't have enough"; then
  RESEARCH_THIN="true"
fi

if [ "$RESEARCH_THIN" = "true" ]; then
  ANSWER="(Research returned insufficient info. Writer should lean on idea.title / idea.summary / idea.transcript.)"
fi

# ---- write brief (printf, heredoc-free to avoid EOF-in-answer corruption) -

RESEARCHED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

{
  printf -- '---\nidea_id: %s\nresearched_at: %s\nresearch_thin: %s\nnotebooklm_notebook_id: %s\n---\n\n# Research Brief: %s\n\n' \
    "$IDEA_ID" "$RESEARCHED_AT" "$RESEARCH_THIN" "${NOTEBOOK_ID:-none}" "$IDEA_TITLE"
  printf '%s\n' "$ANSWER"
} > "$BRIEF_PATH"

# ---- final stdout line ---------------------------------------------------

echo "$BRIEF_PATH"
exit 0
