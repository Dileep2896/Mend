# JOURNAL — append-only, newest last. Format: date | task | commands | gates | decision | next intent

2026-07-17 ~19:30 | M0 platform truth | git init + first commit ec826f2; npm view x6;
aws bedrock list-*/converse probes; claude -p tests (Bedrock + subscription); 3 doc-research
agents (Bedrock env vars, Pomerium, Zero) | gates n/a | M0 DONE, all facts in
docs/PLATFORM_NOTES.md. Key findings: (1) Bedrock streaming blocked account-wide until the
Anthropic use-case form is submitted in console — non-streaming works, Sonnet 4.6 + Haiku 4.5
are the reachable models; Sonnet 5/Opus-class are AWS-sales gated. Loop unblocked via
subscription auth (verified working); loop.sh now defaults to it, Bedrock opt-in.
(2) Pomerium service accounts need Zero free tier, not Core — Plan A/B/C written down.
(3) Zero (zero.xyz) verified by live CLI: free static host → https://sites.withzero.ai/<slug>,
14-day TTL, $5 credit. | next: M1 — choose + vendor target site, seed axe scan, build mapper.

2026-07-17 ~20:30 | M1 target + source mapper (THE RISKIEST PART) | scanned 3 candidates
(sb-admin-2, agency, freelancer) with harness/scan.mjs; vendored winner; built harness/mapper.mjs
+ harness/mapper-acceptance.mjs; iterated mapper twice on real failures |
mapper acceptance: 7/10 → 9/10 (n=10), 24/25=96% (n=25) | DECISIONS: (1) TARGET = StartBootstrap
SB Admin 2, MIT, commit f0309881. Chose it for R1 mappability: plain static HTML (served file IS
source, no build, no class mangling) yet 561 axe violation nodes across 13 rule classes covering
ALL 6 in-scope classes (image-alt 11, button-name 22, link-name 18, label-title-only 2,
aria-progressbar-name 9, heading-order 9, landmark 15, color-contrast 304). Backup = agency
(31 nodes/4 classes). (2) Mapper needed two fixes found by the acceptance test itself: document-
level tags (<html> landmark rules) via structural-tag strategy, and multi-line opening tags
(<a\n href=...>) via end-of-line-aware tag regex + expand-up-to-tag. (3) SATURDAY-NOON MAPPER
HARD GATE: PASSED early (Fri night), 96% >> 80% threshold — no target swap / annotation-primary
needed. Lone miss is an honestly-ambiguous repeated `<td>Tokyo</td>` that the mapper BLOCKS rather
than guessing (correct behavior per prime directive: verify, don't trust). | next: M2 — determinism
pass + baselines, then gates 2/3/4 and the receipts writer.

2026-07-17 ~22:00 | M2 scorers + gates | built harness/{lib,baseline,diff,gate-patterns,
gate-engine2,verify,receipt}.mjs + achecker.js + mask.json; npm scripts scan/baseline/diff/
gate:patterns/gate:engine2/verify wired | determinism 3x = 0px PASS; gate:patterns self-test
fires all 4 detectors; verify 4/4 on login.html; engine2 seed = 508 | DECISIONS: (1) Determinism
via injected FREEZE_CSS + Playwright screenshot mask option (flat magenta over Chart.js canvases
in BOTH baseline and diff → 0 phantom px). R4 mitigated with the required 3-consecutive-run
acceptance. (2) Gate 3 operates on `git diff` of target/ with added-line + removed-line detectors
and a forbidden-path check (editing harness/mask/rubric = auto-fail = anti-laundering). Exposed
scanDiff() + --self-test so the "one fix gets CAUGHT" demo beat is provable. (3) Gate 4 counts IBM
Equal Access `violation` level; independent of axe (508 vs 561). (4) verify.mjs shells the four
gate scripts, fail-fast but records every gate to runs/<round>/verify.json. (5) Receipts pull
gates from verify.json, screenshots from baseline/shot/diff, axe filtered per-rule, patch from
git — accept and revert both first-class. | next: M3 — loop.sh/LOOP_PROMPT already drafted;
add contrast gate 2b, wire critic subagent, then run real fix rounds on 2 pages.

2026-07-17 ~23:30 | AMENDMENT 1 applied (mid-build, additive) | edited critic.md (model:),
receipt.mjs (+models/tokens/estCostUsd), RUBRIC s6, PLATFORM_NOTES (+critic model, +Zero email),
TASKS (M0/M4/M5), PITCH (Pomerium/Nexla/critic objection); researched Zero email; vision smoke
test | no gates changed; gate3 self-test still green | DECISIONS: (§1) critic model =
us.anthropic.claude-haiku-4-5-20251001-v1:0 (fixer = sonnet-4-6) — different weights + vision-
capable. Vision CAPABILITY confirmed (isolated critic read runs/baseline/login.png and described
it accurately). Bedrock-specific vision test BLOCKED by the same account use-case-form gate as all
Bedrock streaming; exact re-test command in PLATFORM_NOTES. (§2) Receipts now carry models/tokens/
estCostUsd, additive — the 4 existing receipts (001-004) stay valid without them, untouched.
(§3) Zero email = YES via registry (StableEmail $0.02 w/ zip attachment / AgentMail $0.01 attach-
by-URL), pay-per-call, honest "hand-off not delivery" framing; M5 gains the email-receipt-bundle
final act with mandatory backup video. Not live-send-tested. (§4) M4 Akash wording fixed: Akash is
compute-to-RUN, not an access layer, does NOT replace Pomerium. (§5) Pomerium reframed to the
production story (agent safely touching a CUSTOMER's live site, audit log → receipts); 80/20 slice
= traffic through Pomerium + one authorize-check line in one receipt; sequencing guard = Gate 2
determinism (DONE) precedes Pomerium, no sponsor on Act 2's critical path. (§6) Nexla = one
surgical slide (normalizes axe + Equal Access schemas into one queryable data product), build
nothing. (§7) wall rule reaffirmed: sponsor order after live convergence = 3, 1, 5-slice, stop.
| next: resume TASKS order — finish M3 (2nd page + note overnight), then M5 dashboard.

2026-07-17 ~23:55 | M3 second page + M5 dashboard | rounds 5-6 on forgot-password.html
(label-title-only aria-label, landmark role=main); built dashboard/{server.mjs,index.html} |
r5 4/4 (fixed a placeholder-baseline gate4 slip by capturing true engine2 before via git stash),
r6 4/4; dashboard verified rendering (screenshot) | DECISIONS: M3 loop proven on 2 pages —
login 8->4, forgot-password 7->4, 6 receipts (5 accept + 1 caught revert #003). Overnight run
DEFERRED (time-based; runner ready). Dashboard reads runs/+receipts/, ws-pushes on fs change,
big-number counters + gate lights + critic verdicts + click-through receipt browser (before/after
+ patch + notes). Pushed to github.com/Dileep2896/Mend. | next: M5 Act-1 naive A/B baseline +
demo mode; M4 Pomerium + Zero live-deploy are external-dependency sponsor tracks (wall rule).

2026-07-17 late | Akash critic (replaces Bedrock for the "brain") | built harness/critic-akash.mjs
(AkashML OpenAI-compatible, DeepSeek V4 text + Qwen3.6-35B vision); verified key, text verdict,
vision description; corrected 6 receipts' model attribution + re-ran 001/005 critics on Akash;
updated critic.md/PLATFORM_NOTES/PITCH/CLAUDE.md | n/a | DECISIONS: critic now runs on Akash — a
DIFFERENT model family (open DeepSeek/Qwen) on a DIFFERENT provider (decentralized) than the Claude
fixer. Stronger independence than the Bedrock-Claude critic: two axes now (ENGINE via gate 4, MODEL
via critic). No Bedrock spend; Akash cost is fractions of a cent per verdict (<$0.05 all weekend).
Fixed a real overclaim: receipts had hardcoded Bedrock model IDs that never ran — now truthful
(Claude fixer subscription + Akash critic). Key stored in .env.akash (gitignored, 600); NEVER
committed. | next: audit everything, loop-fix, keep spend ~$0.

2026-07-17 late | AUDIT + fix loop (subagent audit of 13 harness files) | fixed false-PASS bugs
H1-H7, false-REJECT/robustness M1/M5-M10, and LOW items; deferred M2/M3/M4 (documented in
RISKS R9); added demo mode + rebaseline; re-ran full suite | mapper 24/25, determinism 3x=0,
gate3 self-test PASS, demo 4/4, Akash critic PASS | KEY FIXES: (false-PASS, worst class) H1 scan
flake now hard-fails gate1; H2 gate2b counts DELETED boxes; H3 gate2b fails without a geometry
baseline; H4 gate3 catches bare `alt`/entity-whitespace alt; H5 interactive-deleted no longer
neutralized when the element lacks a stable attr (requires same-tag+text); H6 gate3 diffs HEAD
(sees staged); H7 gate1 fails on per-rule node REGRESSIONS not just new rule classes. (false-
REJECT) M1 link-name text-rewrite allowed (same element re-added); M7 lastJson is now a real
brace-balance parser (was greedy single-match); M8 gate4 guards non-numeric baseline (was NaN →
revert-every-round); M9 contrast skips semi-transparent backgrounds; M10 --contrast validates
selector+route. (robustness) critic timeout (M5), image size cap (M6), pathToFileURL guard,
last-verdict parse, quote-tolerant key load; dashboard 2s poll fallback (Linux recursive-watch).
MONEY: only paid call is the Akash critic (bounded max_tokens + 90s timeout + 3MB image cap);
no Zero/email/wallet code wired anywhere. Session Akash spend ~$0.001. Deferred M2/M4 (gate3
element-context) need rendered-element inspection — out of weekend scope, our fixes don't trigger
them. | next: commit, keep spend ~$0.

2026-07-17 late | Zero closing act — agent self-deploys healed site (FREE) | built
harness/deploy-zero.mjs (npm run deploy): inline CSS → self-contained <500KB healed page +
"Healed by Mend" badge → `zero fetch host.withzero.ai/run --max-pay 0`; registered anonymous
agent wallet; wired deploy URL into dashboard | verified LIVE via Playwright | DECISIONS:
Zero deploy is $0 — the free host-site x402 challenge is amount 0, and --max-pay 0 is a HARD cap
so accidental spend is impossible. Healed login LIVE at sites.withzero.ai/mend-healed-login-demo
(14-day TTL) with the real verified fixes (aria-labels + role=main). Free host takes ONE HTML
≤500KB, so we deploy a self-contained healed PAGE (not the 23MB multi-page site) — honest framing:
"the agent ships the cured patient to a shareable link, itself, no keys, $0." Money: no wallet
funding, no email (email would be $0.02 — NOT done, left as an opt-in per user's no-spend rule).
| next: 2nd-audit findings, then keep spend $0.
