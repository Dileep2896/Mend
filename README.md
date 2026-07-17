# Mend — the accessibility healer

An agent loop that repairs website accessibility in SOURCE code and refuses to
believe itself: every fix must survive four gates (axe re-scan, masked pixel diff,
banned-pattern check, IBM Equal Access second engine) plus an isolated critic
before it counts. Accepted or reverted, every round writes a receipt.

Built at the Loop Engineering Hackathon (tokens&, SF). Bedrock is the brain,
Pomerium is the access, Zero is the ship.

## Use this kit

1. `git init` in this directory, commit everything.
2. Do M0 in TASKS.md yourself or via one supervised Claude Code session:
   fill docs/PLATFORM_NOTES.md from real docs. Do not skip this.
3. `chmod +x loop.sh && ./loop.sh 25`
4. Watch JOURNAL.md, TASKS.md, receipts/, and `npm run dashboard` once M5 lands.
5. Timeboxes are real: mapper gate Sat 12:00, Pomerium 3h Sunday. The loop knows.

## File map

CLAUDE.md prime directives and architecture summary. TASKS.md the plan and the
loop's todo list. LOOP_PROMPT.md + loop.sh the runner. docs/ARCHITECTURE.md
mermaid diagrams and contracts. docs/RUBRIC.md what counts as fixed (the gates,
banned patterns, receipt schema). docs/RISKS.md failure modes with tripwires.
docs/PITCH.md narrative, sourced data, demo script, objection handling.
.claude/agents/critic.md the isolated judge.

## Language rule

Everything this project emits says "fixed and verified" or "reverted, caught by
<gate>". It never says "compliant" or "lawsuit-proof". That rule is load-bearing.
