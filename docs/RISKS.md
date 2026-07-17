# Mend risk register

Ordered by kill probability. Each risk has a mitigation (do now) and a tripwire
(the observable signal that says execute the fallback, no debate).

## R1 — Source mapping fails (HIGH)

Axe reports on the rendered DOM; the pitch requires fixing source. Generated class
names and component indirection can make DOM→source mapping unreliable, and without
it we are patching output, i.e. we become the overlay we mock.
Mitigation: choose the target FOR mappability (TASKS M1 criteria); build the mapper
before anything else; strategy 3 (build-time data-mend-src annotations) ready as
primary, not just fallback.
Tripwire: mapper acceptance < 8/10 at Saturday 12:00 → swap target or flip to
annotation-primary within 30 minutes. Written into TASKS.md as a hard gate.

## R2 — Goodhart: the agent games the counter (HIGH)

aria-hidden, alt="", display:none, element deletion all make axe numbers drop while
making the site worse. A sharp judge will probe exactly this.
Mitigation: gate 3 banned patterns runs on the diff BEFORE the critic; critic
certifies decorative claims; receipts expose every diff. Prime directive 3.
Tripwire: any accepted receipt containing a s4 pattern = stop the loop, fix gate 3,
invalidate and re-run affected rounds. Zero tolerance because one gamed receipt on
screen kills the whole thesis.

## R3 — Fake independence of scorers (MEDIUM, embarrassing)

Lighthouse's accessibility score runs axe-core underneath. Citing it as a second
opinion is one engine counted twice, and the Cursor engineer on the panel may know.
Mitigation: IBM Equal Access (different rule engine) is gate 4 and the on-stage
second opinion. Lighthouse may appear once as "the score you already know," clearly
labeled as axe-based.
Tripwire: any pitch or dashboard copy implying Lighthouse is independent → edit
before demo.

## R4 — Pixel-diff flakiness thrashes the loop (MEDIUM)

Font timing, animations, carousels, dates produce phantom diffs → good fixes get
reverted → loop oscillates.
Mitigation: determinism pass in M2 with an explicit acceptance test (3 consecutive
zero-diff runs with no code changes) BEFORE first baseline; masks require a logged
reason; animations frozen by injected test stylesheet.
Tripwire: 2 reverts in a row where diff.png shows changes unrelated to the patch →
halt fix rounds, return to determinism task. Do not widen thresholds to cope.

## R5 — Demo time math (MEDIUM)

A real round is rebuild + rescan + screenshots; a full-page run can be 30 minutes.
Stage slot is ~3.
Mitigation: `npm run demo` mode: one small page tuned to converge in ~90 seconds;
overnight full run replayed on the dashboard behind it; recorded backup video.
Tripwire: demo mode not converging live in under 2 minutes by Sunday 15:00 → demo
runs from the recording, live loop shown only if time remains.

## R6 — Bedrock/Pomerium/Zero integration snags (MEDIUM)

Unverified assumptions about platform mechanics burned SceneShop until docs were
read. Same class of risk here (env vars, policy format, deploy invocation).
Mitigation: M0 writes PLATFORM_NOTES.md from real docs before any code; loop treats
it as higher authority than CLAUDE.md.
Tripwire: Pomerium not passing traffic at +3h (M4 timebox) → cut to Akash fallback,
Pomerium becomes a roadmap slide. No sunk cost.

## R7 — Pitch landmines (LOW effort, HIGH damage)

a) "Nobody fixes source code" is false: TestParty exists and did a Show HN; Level
   Access ships "AI accessibility agents"; Meta showed AI fixes at scale at Axe-con
   2026. Claiming novelty of the category invites correction from the stage.
   Say instead: the category is proven; our contribution is adversarial
   verification and receipts, live.
b) "Makes you compliant / lawsuit-proof" is the exact overclaim the FTC fined
   accessiBe $1M for. Banned phrasing everywhere (RUBRIC s6 language rule).
c) Automated detection ceiling: axe-class tools catch roughly 30–40% of issues
   (Deque, GDS). Volunteer it before judges do; the critic layer is our answer to
   climbing past it, and the honesty buys credibility.

## R8 — Solo-builder fatigue (LOW, real)

Mitigation: invisible-first fix ordering (RUBRIC s1) gives early wins; overnight
loop does the grinding; TASKS.md is written so any iteration can pick up cold.
Tripwire: two consecutive iterations produce no accepted receipt and no unblocked
task → stop looping, review JOURNAL.md manually, re-scope.
