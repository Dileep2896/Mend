# PLATFORM_NOTES — verified platform facts (M0 output)

STATUS: TEMPLATE. Every section below is UNVERIFIED until filled from the real,
current docs during M0. Do not build against this file while any TODO remains.
When this file conflicts with CLAUDE.md on platform mechanics, THIS FILE WINS.

## Claude Code on AWS Bedrock
- TODO: exact env vars (CLAUDE_CODE_USE_BEDROCK? AWS_REGION? model id string?)
- TODO: model access enabled in which region; auth method used (SSO/keys)
- TODO: verified working command + date/time of verification

## Pomerium
- TODO: docker compose minimal config for one upstream (the served target)
- TODO: policy file syntax for a single route + service identity for the agent
- TODO: how the agent authenticates programmatically (no interactive login)
- TODO: where the access log lives + how we capture it into receipts/
- TODO: verified working curl-through-pomerium + timestamp

## Zero (zero.xyz)
- TODO: install method actually used (their one-prompt install into Claude Code)
- TODO: which deploy service the agent selected; observed cost; wallet balance note
- TODO: verified deployed URL from a hello-world test + timestamp

## npm packages (exact names + majors confirmed)
- TODO: @axe-core/playwright@?
- TODO: accessibility-checker@?  (IBM Equal Access)
- TODO: pixelmatch@?  pngjs@?  express@?  ws@?

## Contradictions found vs CLAUDE.md
- TODO: list each, with the correction. Empty is a valid answer only after M0.
