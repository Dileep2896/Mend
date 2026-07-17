# M4 — Pomerium (identity-aware access to the patient)

**Goal (80/20 slice, TASKS M4 / Amendment 1 §5):** the agent's Playwright traffic
reaches the target site *through* Pomerium's policy — no raw credentials — and one
Pomerium `authorize check` log line lands in one receipt. Everything beyond that is
polish. **Sequencing guard:** the gate-2 determinism test (done, M2) is already
green, so Pomerium never sits on Act 2's critical path.

## Prereqs
- Docker Desktop **fully running** (`docker info` must respond).
- Pomerium Zero account + cluster (done — tokens in `../.env.pomerium`).
- Route + service account configured in the hosted Zero console (see below).

## Bring up
```bash
cd docker
docker compose --env-file ../.env.pomerium up -d
docker logs -f mend            # watch it connect to the Zero console
```
If the console's setup instructions use the bootstrap-import form instead of the
env token:
```bash
set -a; . ../.env.pomerium; set +a
docker exec -it mend /bin/pomerium zero import --token "$POMERIUM_ZERO_TOKEN_1"
```

## Configure in the Zero console (hosted UI — human step)
1. **Route:** `from: https://target.<cluster>.pomerium.app` → `to: http://target:80`
   (the compose service name; same docker network).
2. **Policy:** allow your identity (email) and/or a **service account**.
3. **Service account:** create one; copy its JWT ONCE (shown only at creation).
   The agent sends it as `Authorization: Bearer Pomerium-<jwt>` so it accesses
   with a non-human identity and no interactive login.

## Point the agent through Pomerium
The scanners take `--base <url>`; run them against the Pomerium route instead of the
local static server, adding the service-account header. Pomerium serves a
self-signed/edge cert — Playwright uses `ignoreHTTPSErrors: true` (already set in
`newContext`), curl uses `-k`.

## Capture the access log into a receipt
```bash
docker logs mend 2>&1 | grep '"message":"authorize check"' | tail -1 > ../runs/pomerium-access.log
```
The authorize log carries `user/email/service-account-id, route, method, path, ip,
allow:true/false`. Copy that one line into a receipt's evidence — "every page the
agent touched, policy-checked".

## Timebox
Hard 3h (TASKS M4). If Pomerium isn't passing traffic by +3h: cut it to a roadmap
slide, write the decision to JOURNAL.md, move on. Akash is compute-to-run, NOT an
access layer — it does not replace Pomerium.
