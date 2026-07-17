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

- [ ] Scaffold npm project + Playwright. Serve target locally.
- [ ] `npm run scan` (axe) writing runs/<round>/axe.json with violation objects:
      rule id, impact, selector, snippet, mapped source location.
- [ ] Determinism pass BEFORE baselines: freeze animations/transitions via injected
      test stylesheet, wait for fonts.ready and network idle, fixed viewport,
      fixed timezone/locale, mask dynamic regions (list in harness/mask.json).
      Acceptance: two consecutive `npm run diff` runs with zero code changes
      produce 0 changed pixels on every route, 3 times in a row.
- [ ] `npm run baseline` and `npm run diff` (pixelmatch), per-route threshold
      config; diff images saved to runs/<round>/diff/.
- [ ] `npm run gate:patterns`: reject diffs that add aria-hidden to previously
      visible content, alt="" on non-decorative imgs, display:none/visibility:hidden
      on interactive elements, tabindex="-1" on focusables, role="presentation" on
      semantic elements, or delete elements containing text. Full list: RUBRIC.md s4.
- [ ] `npm run gate:engine2`: IBM Equal Access scan, compare violation count vs
      round start; must be non-increasing.
- [ ] `npm run verify`: scan → diff → patterns → engine2, fail-fast, machine-readable
      summary json + human line per gate.
- [ ] Receipts writer: on every accept AND revert, write receipts/<n>-<rule>/
      per schema in RUBRIC.md s6 (before/after axe, screenshots, diff, source diff,
      gate results, critic verdict).

## M3 — The loop itself (Sat evening)

- [ ] Wire LOOP_PROMPT.md + loop.sh (already drafted; adjust paths/flags to reality).
- [ ] Contrast-fix special case: for color-contrast violations, pixel diff will
      legitimately change. Mask the flagged element's box for gate 2 and instead
      assert layout geometry stable (bounding boxes of all OTHER elements unchanged)
      + the new computed contrast ratio ≥ 4.5:1. Implement as gate 2b.
- [ ] Critic path: fixer never judges its own alt text / labels / heading logic.
      Route those to the critic subagent (.claude/agents/critic.md), which sees the
      image + context and returns PASS/FAIL + reason. Wire verdict into verify.
- [ ] Run the loop for real on 2 pages. Target: converging violation counts,
      at least one caught-and-reverted failure in receipts (if none occurs
      naturally, that is suspicious — check the gates actually run).
- [ ] Overnight run: full site, 6-round cap per page. Let it grind. Morning review.

## M4 — Pomerium (Sun morning) — TIMEBOX: 3 HOURS, THEN DECIDE

- [ ] docker compose: pomerium in front of the served target; one policy; agent
      accesses through it (service identity per PLATFORM_NOTES.md). Pomerium access
      log captured into the evidence trail (every page the agent touched, policy-
      checked).
- [ ] If not working by +3h: cut it. Fallback = deploy dashboard or healed site via
      Akash (contained task, wallet-native crowd, Greg Osuri judging) and demote
      Pomerium to one roadmap slide. Write the decision to JOURNAL.md. No sunk cost.

## M5 — Dashboard + Zero + demo (Sun afternoon)

- [ ] Dashboard: live violation counter, round log, gate lights, before/after
      screenshot pairs, receipt browser. ws push from the loop. Dark, readable from
      the back of a room, numbers huge.
- [ ] `npm run demo`: one small page, tuned to converge live in ~90 seconds.
      Rehearse 3 times. Record a full run as backup video.
- [ ] Naive-vs-Mend A/B evidence: run a bare "fix accessibility" loop with gates OFF
      on a copy of one page. Capture it suppressing/breaking things. Save screenshots
      to receipts/naive-baseline/. This is act one of the pitch.
- [ ] Zero: agent deploys the healed site to a shareable link as the loop's final
      act. Capture the link + the moment for the demo.
- [ ] Independent second opinion on stage: run IBM Equal Access on the healed site
      live. (Lighthouse may be shown only as "the score you know," never as an
      independent engine.)
- [ ] Final: README quickstart verified from a clean clone, pitch rehearsed against
      docs/PITCH.md, deck numbers cross-checked against PITCH.md sources.

## Icebox (do not touch during the hackathon)

- Keyboard-navigation testing agent (tab-order verification) — stretch talking point.
- GitHub Action packaging (PR comments with verified fix commits) — roadmap slide.
- Multi-site crawling, auth flows, CMS integrations.
