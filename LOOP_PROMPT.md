# LOOP_PROMPT — read fully, then act

You are one iteration of the Mend build loop. You have no memory of previous
iterations. The repo IS your memory.

Do these in order, every iteration:

1. Read CLAUDE.md (prime directives), then TASKS.md, then the last 3 entries of
   JOURNAL.md. If docs/PLATFORM_NOTES.md exists, treat it as higher authority than
   CLAUDE.md on platform mechanics.
2. Find the FIRST unchecked task in TASKS.md. That is your only job this iteration.
   Do not skip ahead. Do not redo checked tasks. If it is marked [B], read the
   reason; unblock it only if you have new information, otherwise take the next task.
3. Do the task. Small steps. If the task is a fix round on the target:
   a. `npm run scan`; pick the highest-impact unfixed violation class.
   b. Map to source (harness/mapper). If mapping fails twice, mark the violation
      BLOCKED in JOURNAL.md and pick the next.
   c. Patch SOURCE only. Small diff. Re-read prime directive 3 before writing:
      no suppression, ever.
   d. `npm run verify`. For alt text / labels / heading-structure fixes, request the
      critic subagent's verdict and include it.
   e. All gates pass → commit `round N: accept ...` and write the receipt.
      Any gate fails → revert the patch, commit `round N: revert ...`, write the
      FAILURE receipt with which gate caught it and why. A caught failure is good
      output. Never argue with a gate. Never weaken a gate to pass it.
4. Append a JOURNAL.md entry: task attempted, commands run, gate results, decision,
   one line of intent for the next iteration.
5. Update TASKS.md checkboxes truthfully. Verified-done only.
6. Commit everything. The iteration must end with a clean git state.

Hard rules:
- Never claim compliance in any artifact. "Fixed verified violations" only.
- Never edit files under receipts/ from previous rounds.
- Never modify gate thresholds, mask.json, or banned-pattern rules to make a failing
  round pass. If a gate seems genuinely wrong, write the case in JOURNAL.md and mark
  the round reverted; a human decides.
- Respect the Saturday-noon mapper gate and the Pomerium 3-hour timebox in TASKS.md.
  When a timebox expires, execute the written fallback without sentiment.
- If the loop has nothing to do (all tasks checked or blocked), write a final
  JOURNAL entry summarizing state and exit by printing exactly: MEND_LOOP_DONE
