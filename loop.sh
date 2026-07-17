#!/usr/bin/env bash
# Mend loop runner — Ralph-style. State lives in git + TASKS.md + JOURNAL.md.
# Usage: ./loop.sh [max_iterations]   (default 25)
set -euo pipefail

MAX_ITERS="${1:-25}"
PROMPT_FILE="LOOP_PROMPT.md"
LOG_DIR="runs/loop-logs"
mkdir -p "$LOG_DIR"

# Auth per docs/PLATFORM_NOTES.md (M0, verified Jul 17 2026):
# default = subscription login (works today). Opt into Bedrock with
# CLAUDE_CODE_USE_BEDROCK=1 once the Anthropic use-case form is accepted.
if [[ "${CLAUDE_CODE_USE_BEDROCK:-0}" == "1" ]]; then
  export CLAUDE_CODE_USE_BEDROCK=1
  export AWS_REGION="${AWS_REGION:-us-east-1}"
  export AWS_PROFILE="${AWS_PROFILE:-default}"
  export ANTHROPIC_MODEL="${ANTHROPIC_MODEL:-us.anthropic.claude-sonnet-4-6}"
  export ANTHROPIC_SMALL_FAST_MODEL="${ANTHROPIC_SMALL_FAST_MODEL:-us.anthropic.claude-haiku-4-5-20251001-v1:0}"
fi

for i in $(seq 1 "$MAX_ITERS"); do
  TS="$(date +%Y%m%d-%H%M%S)"
  echo "=== Mend iteration $i/$MAX_ITERS @ $TS ==="

  set +e
  claude -p "$(cat "$PROMPT_FILE")" \
    --dangerously-skip-permissions \
    --output-format text \
    2>&1 | tee "$LOG_DIR/iter-$i-$TS.log"
  STATUS=$?
  set -e

  # Belt and suspenders: never leave the tree dirty between iterations.
  if [[ -n "$(git status --porcelain)" ]]; then
    git add -A
    git commit -m "loop: checkpoint after iteration $i (auto)" >/dev/null
  fi

  if grep -q "MEND_LOOP_DONE" "$LOG_DIR/iter-$i-$TS.log"; then
    echo "Loop reports done after $i iterations."
    break
  fi
  if [[ $STATUS -ne 0 ]]; then
    echo "Iteration $i exited $STATUS — continuing (state is in git)." >&2
  fi
  sleep 3
done

echo "Loop finished. Review JOURNAL.md, TASKS.md, receipts/, and git log."
