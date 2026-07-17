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
