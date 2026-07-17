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
