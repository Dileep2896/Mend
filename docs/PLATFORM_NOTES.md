# PLATFORM_NOTES — verified platform facts (M0 output)

STATUS: VERIFIED July 17, 2026 (Friday evening). Facts below were checked against
live docs and, where marked EMPIRICAL, actually executed on this machine.
When this file conflicts with CLAUDE.md on platform mechanics, THIS FILE WINS.

## Local toolchain (EMPIRICAL, this machine)

- node v22.12.0, npm 11.5.2 (CLAUDE.md says Node 20; Node 22 present and fine)
- Claude Code CLI 2.1.212
- Docker 29.1.3, Docker Compose v5.0.0-desktop.1 (Docker Desktop, macOS)
- aws-cli 2.17.44 — OLD: lacks `converse-stream` / `invoke-model-with-response-stream`
  subcommands. Use the AWS SDK for any streaming test; CLI `converse` works.
- AWS profiles: `default` (LIVE, IAM user AmazonNova, account 058264358831),
  `dileep2896`, `sandbox` (both have invalid/expired tokens — do not use).

## Claude Code on AWS Bedrock

Docs verified: code.claude.com/docs/en/amazon-bedrock.md, model-config.md,
env-vars.md, cli-reference.md.

Working env (once the blocker below is cleared):

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION=us-east-1          # resolution order: AWS_REGION → AWS_DEFAULT_REGION → ~/.aws/config → us-east-1
export AWS_PROFILE=default
export ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-6
export ANTHROPIC_SMALL_FAST_MODEL=us.anthropic.claude-haiku-4-5-20251001-v1:0
```

- Model IDs are cross-region inference profile IDs (`us.` prefix). Full list pulled
  via `aws bedrock list-inference-profiles` (EMPIRICAL).
- Credentials: standard AWS SDK chain (env keys → AWS_PROFILE → config files).
- CLI flags in loop.sh are current: `-p`, `--dangerously-skip-permissions`,
  `--output-format text` all verified against cli-reference.
- Bedrock caveats: WebSearch tool unavailable on Bedrock; `/logout` unavailable;
  prompt caching on by default (5-min TTL).

### Model access on account 058264358831, us-east-1 (EMPIRICAL, Jul 17 ~19:00)

| Model (inference profile) | Non-streaming Converse | ConverseStream |
|---|---|---|
| us.anthropic.claude-haiku-4-5-20251001-v1:0 | OK ("OK" returned) | BLOCKED: use-case form |
| us.anthropic.claude-sonnet-4-6 | OK ("OK" returned) | BLOCKED: use-case form |
| us.anthropic.claude-sonnet-4-5 / sonnet-4 / opus-4-5 / opus-4-6 | ResourceNotFound: use-case form | — |
| us.anthropic.claude-sonnet-5, opus-4-8, opus-4-7, fable-5 | AccessDenied: "not available for this account" (AWS-sales gated) | — |

### >>> THE ONE BLOCKER <<<

Streaming invocation (which Claude Code requires) returns for EVERY model:
"Model use case details have not been submitted for this account."
FIX (human, ~2 min): AWS console → Bedrock (us-east-1) → Model access / Model
catalog → any Anthropic model → submit the Anthropic use case details form.
Applies once per account; active ~15 minutes after submission. Then re-run:

```bash
CLAUDE_CODE_USE_BEDROCK=1 AWS_REGION=us-east-1 AWS_PROFILE=default \
  claude -p "Reply with exactly: OK" --model us.anthropic.claude-sonnet-4-6 --output-format text
```

Loop model plan: fixer + critic = `us.anthropic.claude-sonnet-4-6`; small/fast =
`us.anthropic.claude-haiku-4-5-20251001-v1:0`. Sonnet 5 / Opus 4.8 are NOT
reachable on this account — do not reference them in loop.sh.

### VERIFIED ALTERNATIVE (works right now): subscription auth

`claude -p "..." --output-format text` with the normal Claude Code login (no
Bedrock env vars) returns correctly — EMPIRICAL, Jul 17. So the loop is NOT
blocked: run loop.sh with subscription auth today; flip CLAUDE_CODE_USE_BEDROCK=1
after the use-case form is accepted (Bedrock is the sponsor story for the pitch —
"Bedrock is the brain" — so flip it before demo day if at all possible).
loop.sh defaults to subscription auth; set CLAUDE_CODE_USE_BEDROCK=1 to opt in.

## Critic model separation (Amendment 1 §1)

- Fixer model = `us.anthropic.claude-sonnet-4-6`. Critic model =
  `us.anthropic.claude-haiku-4-5-20251001-v1:0` (set in .claude/agents/critic.md
  frontmatter `model:`). Different weights than the fixer (mirrors gate 4's
  independent engine), and vision-capable (required for alt-text judging).
- Vision smoke test — capability CONFIRMED (Jul 17): an isolated critic agent read
  runs/baseline/login.png and accurately described it ("Welcome Back!" heading,
  email/password/remember-me controls, Login/Google/Facebook buttons, Forgot-
  Password/Create-Account links) via the loop's current subscription-auth path.
- Bedrock-specific vision test = BLOCKED by the same account use-case-form gate as
  all Bedrock streaming (see the ONE BLOCKER above). Both non-streaming CLI
  `converse` and the SDK now return "use case details have not been submitted."
  Once the form is accepted, confirm Haiku-4.5 vision on Bedrock with:
  ```bash
  aws bedrock-runtime converse --profile default --region us-east-1 \
    --model-id us.anthropic.claude-haiku-4-5-20251001-v1:0 \
    --messages file://<msg-with-image>.json --inference-config '{"maxTokens":120}'
  ```

## Zero — sending email (Amendment 1 §3): YES (via registry, pay-per-call)

- An agent CAN send email "through Zero": Zero is the search+payment layer; actual
  sending is a third-party capability discovered via `zero search "send email"`
  (25 results) and invoked+paid via `zero fetch` (auto-resolves x402/mpp USDC). No
  API keys, no account. Honest framing: "email through a pay-per-call service
  discovered and paid via Zero," NOT Zero running its own mail server.
- Best fit — StableEmail Send (`stableemail-send-e2635eee`), `POST
  https://stableemail.dev/api/send`, fixed shared sender `relay@stableemail.dev`
  (no domain verification). Inputs: to[] (req), subject (req), text/html,
  attachments[] base64 (≤5, ~3.7MB each) → receipts.zip attaches directly.
  Cost $0.02/call. Health ✓ 5.0★.
- Larger bundles — AgentMail (`agentmail-send-email-message-72a567bc`), $0.01,
  attachments support a URL (attach the zip by link, no base64 size cap).
- Deliverability is best-effort: API 2xx = "handed off," not "delivered"; silent
  bounces + shared-relay spam risk possible. NOT tested with a live paid send this
  session (inferred from registry health/rating/last-run, all 2026-07-17).
  → M5 gains the "deploy via Zero, then email receipt bundle" final act, with a
    recorded backup video (external dependency; never faked on stage).

## Pomerium

Docs verified: pomerium.com/docs — core/get-started, quickstart (Zero), internals/ppl,
capabilities/service-accounts, internals/programmatic-access, reference/authorize-log-fields.

- Image `pomerium/pomerium:latest`, all-in-one via docker compose, config.yaml mounted
  at /pomerium/config.yaml. `*.localhost.pomerium.io` resolves to 127.0.0.1 (public DNS)
  — no /etc/hosts edits. Self-signed TLS → Playwright `ignoreHTTPSErrors: true`, `curl -k`.
- Route to a host-run server: `to: http://host.docker.internal:8080`; the target server
  MUST bind 0.0.0.0, not 127.0.0.1, or containers get connection refused.
  Cleaner: run the target as a second compose service (`to: http://target:8080`).
- **Service accounts are NOT in Pomerium Core** — Enterprise/Zero only.
- Plan A (chosen): Pomerium Zero free tier. Same local container + `POMERIUM_ZERO_TOKEN`;
  routes/policies in the hosted console; create a service account (JWT shown ONCE — save it);
  agent sends `Authorization: Bearer Pomerium-${JWT}`. Fully non-interactive.
- Plan B (no external account): Core programmatic-access — one human browser login mints
  a `pomerium_jwt`, agent reuses it in the same header. Honest framing: "human-authorized
  session, agent operates under it."
- Plan C: Core downstream mTLS (`downstream_mtls.ca_file` + `client_certificate` PPL
  criterion) — only if A/B stall inside the 3h timebox.
- Evidence log: container stdout (JSON/zerolog). The stream that matters is
  `"message": "authorize check"` — fields include user, email, service-account-id,
  route-id, path, method, ip, and `allow: true/false` with reason arrays.
  Capture: `docker compose logs -f pomerium | grep 'authorize check' > runs/pomerium-access.log`.

## Zero (zero.xyz)

Verified against zero.xyz live site + install.md + LIVE CLI runs (`npx -y @zeroxyz/cli`).

- What it is: search engine + payment layer for AI agents (x402/MPP micropayments,
  USDC). Agent: search capability → get schema → fetch (call+pay) → review.
  Confirmed hackathon sponsor ("unblocks your AI for free" on luma.com/loophack).
- Install (Claude Code plugin — skill + hooks + MCP connector):
  `claude plugin marketplace add officialzeroxyz/zero-plugins && claude plugin install zero@zero-plugins`
  Canonical agent runbook: https://zero.xyz/install.md
- Auth: `zero auth login --start/--finish` (human device flow) or
  `zero auth agent register` (autonomous, empty wallet).
- Static-site deploy (verified in live registry):
  - FREE: capability `zeroclick-x402-service-registry-host-site-3bbee1e7`,
    `POST https://host.withzero.ai/run`, input `{content ≤500KB, slug?, ttlHours? ≤336}`,
    returns URL `https://sites.withzero.ai/<slug>`. TTL max 14 days — fine for demo.
  - PAID (~$0.005–0.02/call): `POST https://site.withzero.ai/run`, longer TTL, 1MB.
  - Registry churns: ALWAYS re-run `zero search`/`zero get` before calling; use `--max-pay`.
- Cost: $5 welcome credit advertised; a demo deploy is $0 (free tier). No hackathon
  credit amount verifiable beyond the Luma blurb.

## npm packages (EMPIRICAL: `npm view` Jul 17, 2026)

- @axe-core/playwright 4.12.1
- accessibility-checker 4.0.29  (IBM Equal Access)
- pixelmatch 7.2.0  ← v7 is ESM-only; harness scripts use ESM or dynamic import
- pngjs 7.0.0
- express 5.2.1    ← v5 (breaking vs v4: no need for our tiny dashboard, but note it)
- ws 8.21.1

## Contradictions found vs CLAUDE.md

1. CLAUDE.md: "Claude Code runs with CLAUDE_CODE_USE_BEDROCK=1" — correct, but
   insufficient alone on this account until the Anthropic use-case form is submitted
   (streaming blocked account-wide). See blocker above.
2. CLAUDE.md implies picking any Claude model on Bedrock; this account cannot reach
   Sonnet 5 / Opus-class models (AWS-sales gated). Sonnet 4.6 is the ceiling today.
3. CLAUDE.md says "Node 20"; machine runs Node 22 — no action needed.
4. loop.sh comments say "set ANTHROPIC_MODEL per PLATFORM_NOTES" — now set per above.
5. Pomerium plan in CLAUDE.md ("agent reaches the patient through an identity-aware
   policy, never raw credentials") maps to Plan A (Zero service account). Core alone
   cannot do non-human identity — that nuance is new information from M0.
