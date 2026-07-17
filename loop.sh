#!/usr/bin/env bash
# Mend loop runner — Ralph-style. State lives in git + TASKS.md + JOURNAL.md.
# Usage: ./loop.sh [max_iterations]   (default 25)
set -euo pipefail

MAX_ITERS="${1:-25}"
PROMPT_FILE="LOOP_PROMPT.md"
LOG_DIR="runs/loop-logs"
mkdir -p "$LOG_DIR"

# Bedrock wiring — confirm exact vars against docs/PLATFORM_NOTES.md (M0).
export CLAUDE_CODE_USE_BEDROCK="${CLAUDE_CODE_USE_BEDROCK:-1}"
# export AWS_REGION=...   # set per PLATFORM_NOTES.md
# export ANTHROPIC_MODEL=...  # set per PLATFORM_NOTES.md

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
