# TASKS.md — Mend build plan

Rules: work top to bottom. Mark [x] when verified done, [B] blocked with a one-line
reason. The loop reads this file every iteration and does the FIRST unchecked task.
Hard gates are decisions, not aspirations. Times are local (SF).

## M0 — Platform truth (Friday night, ~1h) — DO THIS BEFORE ANY CODE

- [x] Read the real docs for Claude Code on AWS Bedrock (model access, region, env
      vars, auth). Write verified facts + exact setup commands to docs/PLATFORM_NOTES.md.
      NOTE: Bedrock streaming blocked until human submits Anthropic use-case form in
      console (us-east-1). Loop runs on subscription auth today; Bedrock is opt-in.
- [x] Read Pomerium docs: docker compose quickstart, policy file format, service
      account / programmatic access for a non-human client. Note the minimal viable
      setup for "one upstream app, one policy, one agent identity" in PLATFORM_NOTES.md.
      Plan A = Pomerium Zero free tier (service accounts are not in Core).
- [x] Read Zero docs (zero.xyz): install prompt, how an agent invokes a deploy-site
      service, cost expectations. Note in PLATFORM_NOTES.md. Free static-site host
      verified live in registry; $5 welcome credit.
- [x] (Amendment 1 §3) Verify from Zero's real docs whether an agent can SEND EMAIL
      through Zero. RESULT: YES via registry (StableEmail $0.02 w/ attachments, or
      AgentMail $0.01 attach-by-URL); pay-per-call, honest framing. In PLATFORM_NOTES.
- [x] Confirm npm packages exist and note exact names/majors: @axe-core/playwright,
      accessibility-checker (IBM Equal Access), pixelmatch, pngjs, express, ws.
      All exist; pixelmatch v7 is ESM-only; express is v5.
- [x] Note in PLATFORM_NOTES.md anything that contradicts CLAUDE.md. PLATFORM_NOTES
      wins on platform mechanics. 5 contradictions recorded.

## M1 — Target site + source mapper (Sat morning) — THE RISKIEST PART, FIRST

- [x] Choose and vendor the target into target/. StartBootstrap SB Admin 2 (MIT,
      commit f0309881, in target/.mend-source-commit). Static HTML, no build step,
      14 pages, readable source, no class mangling → chosen FOR mappability (R1).
      Seed axe: 561 violation nodes across 13 rule classes (>>30/5 required).
- [x] Seed check: runs/000-before/axe.json saved (561 nodes, 13 classes,
      33 critical / 362 serious / 166 moderate). Pitch evidence. Nothing fixed yet.
- [x] Build harness/mapper (harness/mapper.mjs): strategy 1 stable-attr,
      1b structural/document tag, 1c literal text, 2 structural scoring. Static
      HTML means served file = source file; strategy 3 annotation not needed.
- [x] Mapper acceptance test (harness/mapper-acceptance.mjs): 9/10 at n=10,
      24/25 (96%) at n=25. GATE PASS. Lone miss: `<td>Tokyo</td>` (repeated
      DataTables cell, genuinely ambiguous → correctly BLOCKED, not mis-mapped).

### HARD GATE — Saturday 12:00
If the mapper acceptance test is not passing by noon: STOP. Swap to the backup
target (pick a simpler static-HTML candidate during M1) or enable strategy (3)
annotations as the primary mechanism. Decide within 30 minutes, write the decision
to JOURNAL.md, move on. Do not spend the afternoon on the mapper.

## M2 — Scorers and gates (Sat afternoon)

- [x] Scaffold npm project + Playwright. Serve target locally (harness/lib.mjs
      startServer + express static). Node 22, ESM, deps installed.
- [x] `npm run scan` (axe) → runs/latest/axe.json with rule id, impact, selector,
      snippet, node html. harness/scan.mjs.
- [x] Determinism pass (harness/lib.mjs: FREEZE_CSS, fonts.ready, networkidle,
      fixed viewport/locale/timezone, reducedMotion, mask.json). Acceptance: 3
      consecutive `npm run diff` runs = 0 changed pixels on every route. PASSED.
      Masks: index.html + charts.html Chart.js <canvas> (reasons in mask.json).
- [x] `npm run baseline` + `npm run diff` (pixelmatch, threshold 0.1), diff pngs
      → runs/<round>/diff/. Dimension-change detection included.
- [x] `npm run gate:patterns` (harness/gate-patterns.mjs): aria-hidden, alt="",
      display:none/visibility:hidden/opacity:0/off-screen, tabindex="-1",
      role=presentation/none, interactive/text deletions, forbidden-path edits
      (harness/mask/rubric). `--self-test` proves all detectors bite.
- [x] `npm run gate:engine2` (harness/gate-engine2.mjs): IBM Equal Access,
      counts violation-level, --baseline for non-increasing check. Seed = 508
      violations across 14 routes (axe found 561 nodes — genuinely different engines).
- [x] `npm run verify` (harness/verify.mjs): gate1 axe → gate2 pixel → gate3
      patterns → gate4 engine2, fail-fast, runs/<round>/verify.json + human line
      per gate. Verified 4/4 on clean login.html.
- [x] Receipts writer (harness/receipt.mjs): accept AND revert, full RUBRIC s6
      schema (receipt.json, before/after/diff png, axe-before/after filtered to
      rule, patch.diff, notes.md). Honest language: "fixed and verified" /
      "reverted, caught by <gate>". Smoke-tested.

## M3 — The loop itself (Sat evening)

- [x] Wire LOOP_PROMPT.md + loop.sh (paths/flags adjusted in M0: subscription-auth
      default, Bedrock opt-in; models pinned to reachable Sonnet 4.6 / Haiku 4.5).
- [x] Contrast gate 2b (harness/gate-contrast.mjs): WCAG ratio + geometry-stability
      (all other bounding boxes unchanged). Wired into verify via --contrast
      --selector. Proven on round 4 (ratio 3.56→7.01, layout stable).
- [x] Critic path (.claude/agents/critic.md, separate vision-capable model per
      Amendment 1). Routed for label/alt/heading fixes; verdicts in receipts
      001/005. Runs in an isolated agent context.
- [x] Ran the loop for real on 2 pages — login.html (rounds 1–4) and
      forgot-password.html (rounds 5–6). Converging counts: login 8→4,
      forgot-password 7→4 (only color-contrast remains). One caught-and-reverted
      failure: receipt 003 (aria-hidden suppression, caught by gate 1 + gate 3).
- [~] Overnight run: DEFERRED (time-based). loop.sh + LOOP_PROMPT ready; round
      mechanics proven end-to-end. Run when a full unattended window is available.

## M4 — Pomerium (Sun morning) — TIMEBOX: 3 HOURS, THEN DECIDE

NOTE (Amendment 1 §5, sequencing guard): the Gate 2 determinism acceptance test
(3 consecutive zero-diff runs) must be DONE before the Pomerium slice begins — it
is (M2, PASSED). Gate 2 is not polish; it IS the caught-and-reverted moment of
Act 2. No sponsor integration ever sits on the critical path of Act 2.

- [ ] docker compose: pomerium in front of the served target; one policy; agent
      accesses through it (service identity = Pomerium Zero free-tier service
      account per PLATFORM_NOTES Plan A). The 80/20 slice that counts as DONE
      (Amendment 1 §5): the agent's Playwright traffic routes through Pomerium AND
      one access-log line ("authorize check") lands in ONE receipt. Everything
      beyond that is optional polish.
- [ ] If Pomerium is not passing traffic at +3h: cut it to a roadmap slide.
      Optional consolation ONLY if genuinely trivial: host the target or dashboard
      on Akash compute, or deploy via Zero ONTO Akash if Zero supports it (verify
      first). Akash is where things RUN; it is NOT an access layer and does NOT
      replace Pomerium's role. Write the decision to JOURNAL.md. No sunk cost.

## M5 — Dashboard + Zero + demo (Sun afternoon)

- [x] Dashboard (dashboard/server.mjs + index.html): live counter, round log, gate
      lights, before/after + patch receipt browser, ws push on fs change. Dark,
      huge numbers. Verified rendering. `npm run dashboard` :4000.
- [ ] `npm run demo`: one small page, tuned to converge live in ~90 seconds.
      Rehearse 3 times. Record a full run as backup video.
- [x] Naive-vs-Mend A/B (harness/naive-baseline.mjs, `npm run naive`): gates-off
      suppression on a copy drops axe 4->2 while deleting buttons + hiding controls;
      Mend gate 3 REJECTS (interactive-deleted, display-none-added). Evidence +
      before/after screenshots in receipts/naive-baseline/. Act 1.
- [x] Zero: agent deploys the healed site to a shareable link as the loop's final
      act (harness/deploy-zero.mjs / `npm run deploy`). VERIFIED LIVE + FREE:
      https://sites.withzero.ai/mend-healed-login-demo (paid 0 USDC, --max-pay 0
      hard cap). Self-contained healed page (<500KB) with a "Healed by Mend" badge;
      URL flows into runs/deploy.json and the dashboard header ("↗ healed site is
      live"). Anonymous agent wallet, no funding, no human sign-in.
- [ ] (Amendment 1 §3, verification-gated — Zero email = YES) Extended final act:
      after the Zero deploy, the agent emails the receipt bundle (zip of receipts/
      + dashboard link) to a stakeholder address via a Zero registry email service
      (StableEmail $0.02 w/ zip attachment, or AgentMail attach-by-URL). Record a
      backup video of this beat — external dependency, best-effort deliverability,
      never trusted live-only. Never fake it, never claim delivery (only hand-off).
- [ ] Independent second opinion on stage: run IBM Equal Access on the healed site
      live. (Lighthouse may be shown only as "the score you know," never as an
      independent engine.)
- [ ] Final: README quickstart verified from a clean clone, pitch rehearsed against
      docs/PITCH.md, deck numbers cross-checked against PITCH.md sources.

## Icebox (do not touch during the hackathon)

- Keyboard-navigation testing agent (tab-order verification) — stretch talking point.
- GitHub Action packaging (PR comments with verified fix commits) — roadmap slide.
- Multi-site crawling, auth flows, CMS integrations.
