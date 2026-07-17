# MEND — the accessibility healer

A self-verifying repair loop. Mend scans a website with axe-core, maps each violation
back to source, patches the source, then must PROVE the fix through hard gates before
it counts: violations gone, pixels unchanged, no banned suppression patterns, and an
independent second rule engine agreeing. Every accepted fix produces a receipt.

Built for the Loop Engineering Hackathon (tokens&, SF, July 2026).

## Prime directives (never violate)

1. VERIFY, DON'T TRUST. No fix is "done" because the code looks right. A fix is done
   when `npm run verify` passes all gates. If gates can't run, the fix doesn't exist.
2. FIX SOURCE, NEVER RUNTIME. We patch source files. No injected scripts, no runtime
   DOM mutation, no overlay behavior of any kind. That is the villain we replace.
3. NEVER SUPPRESS. Making a violation invisible to the scanner is failure, not success.
   The banned-pattern gate (docs/RUBRIC.md section 4) is checked on every diff BEFORE
   the critic sees it. Adding aria-hidden, alt="" on informative images, display:none,
   or deleting elements to silence axe = auto-reject the round.
4. NEVER CLAIM COMPLIANCE. In code comments, receipts, dashboard copy, and pitch:
   we "fix verified violations." We never say "makes you compliant," "ADA compliant,"
   or "lawsuit-proof." Overclaiming is what got accessiBe fined by the FTC.
5. HONEST RECEIPTS. Receipts record failures and reverts too. A caught failure is
   evidence the harness works; hiding it destroys the whole thesis.
6. RESPECT THE TIMEBOXES in TASKS.md. The Saturday-noon source-mapper gate and the
   3-hour Pomerium timebox are hard decisions, not suggestions.

## What we are building (and not building)

Building: the verification harness around an agent. Scorers, gates, critic, receipts,
dashboard, and the loop runner that wires them together.
Not building: a general accessibility platform, auth, billing, multi-site crawling,
a browser extension, or anything speculative. One vendored target site. Weekend scope.

## Architecture (full detail in docs/ARCHITECTURE.md)

Loop runner (loop.sh → Claude Code headless) drives rounds. Each round:
scan → pick violations → map DOM nodes to source → patch → rebuild →
gate 1 axe re-scan → gate 2 pixel diff → gate 3 banned patterns →
gate 4 second engine (IBM Equal Access) → critic verdict (isolated subagent) →
accept (commit + receipt) or revert (commit the revert + failure receipt).
Dashboard tails state over WebSocket. Zero deploys the healed site at the end.

## Tech stack

- Node 20, npm. Playwright (chromium) for rendering and screenshots.
- @axe-core/playwright — primary scanner (gate 1).
- accessibility-checker (IBM Equal Access, npm) — independent second engine (gate 4).
  Lighthouse is NOT a valid second opinion: it runs axe under the hood. Never cite it
  as independent. It may appear once in the pitch as a "familiar score" only.
- pixelmatch + pngjs — visual regression (gate 2), with masking + animation freeze.
- Claude via AWS Bedrock. Claude Code runs with CLAUDE_CODE_USE_BEDROCK=1 (verify
  exact env vars against real docs in M0 — see docs/PLATFORM_NOTES.md).
- express + ws for the live dashboard. Plain HTML/JS dashboard, no build step.
- Pomerium (docker compose) in front of the target site — agent reaches the patient
  through an identity-aware policy, never raw credentials. M4, timeboxed.
- Zero (zero.xyz) — the agent deploys the healed site to a shareable link itself.

## Repo layout

```
mend/
  CLAUDE.md            you are here
  TASKS.md             milestones + hard gates. The loop's todo list.
  JOURNAL.md           append-only. Every round writes what happened and why.
  LOOP_PROMPT.md       the prompt loop.sh feeds Claude Code each iteration
  loop.sh              the Ralph-style runner
  docs/
    ARCHITECTURE.md    mermaid diagrams + component contracts
    RUBRIC.md          violation scope, gates, critic scoring, banned patterns
    RISKS.md           known failure modes + mitigations + tripwires
    PITCH.md           narrative, demo script, data with sources, objection handling
    PLATFORM_NOTES.md  M0 output: verified facts about Bedrock/Pomerium/Zero from
                       their real docs. Higher authority than this file on platform
                       mechanics when they conflict.
  .claude/agents/
    critic.md          the isolated critic subagent
  target/              vendored target site (chosen in M1, criteria in TASKS.md)
  harness/             scanners, differ, gates, mapper, receipts (built in M2)
  receipts/            one folder per accepted/rejected fix
  dashboard/           express + ws live view
  runs/                per-round artifacts: screenshots, axe json, diffs
```

## Conventions

- All state lives in files and git. Every round ends with a commit, accepted or not.
  Commit format: `round N: <accept|revert> <rule-id> <selector-ish> [gates: a/p/b/e/c]`.
- JOURNAL.md entry per round: what was attempted, gate results, decision, next intent.
- Receipts are the product. Schema in docs/RUBRIC.md section 6. Never skip one.
- Small diffs. One violation class per patch when possible. Max 3 attempts per
  violation, then mark BLOCKED in TASKS.md with the reason and move on.
- Max 6 rounds per page. Convergence beats completeness.
- Screenshots at 1280x800, deviceScaleFactor 1, animations disabled, fonts awaited,
  masked regions listed in harness/mask.json.
- Alt text: the fixer LOOKS at the image (multimodal) before writing alt. The critic
  independently looks at the image and judges the description. Axe checks existence;
  only the critic checks truth.

## Commands (exist after M2; keep these names stable)

- `npm run scan` — axe against the served target, writes runs/<round>/axe.json
- `npm run baseline` — capture pixel baselines for all routes
- `npm run diff` — screenshot + pixelmatch vs baseline, writes diff pngs + summary
- `npm run gate:patterns` — banned-pattern check on the working diff
- `npm run gate:engine2` — IBM Equal Access scan
- `npm run verify` — full gate sequence, exits nonzero on any failure, prints which
- `npm run dashboard` — serves the live view on :4000
- `npm run demo` — demo mode: single small page, fast loop for the live 90 seconds

## When something conflicts

PLATFORM_NOTES.md beats CLAUDE.md on platform mechanics. RUBRIC.md beats everything
on what counts as a pass. TASKS.md beats ambition on what to do next. When truly
stuck, write the situation to JOURNAL.md, mark the task BLOCKED, pick the next task.
Never invent a workaround that violates a prime directive to get unstuck.
