# Mend pitch file

One line: Mend is an agent loop that repairs website accessibility in source code
and refuses to believe itself — every fix must survive four gates and an
independent critic before it counts, and every fix ships with a receipt.

Stage line (memorize): "Claude can write the fix. Only the harness can prove it.
We built the proof."

## The data (all gathered via BrightData scrape/search passes, July 17, 2026 —
## re-verify any number you put on a slide)

Demand / pain
- UsableNet's 2026 MIDYEAR report (released July 8, 2026 — nine days before the
  hackathon) projects ~6,176 digital accessibility lawsuits for 2026, on pace to
  pass 6,000 for the first time. Freshest number in the deck; say the date.
- 3,117 filed in US federal court in 2025, up 27% from 2024. (Seyfarth via
  adatitleiii.com, Mar 2026)
- ~1,427 of 2025's suits targeted companies that had ALREADY been sued before.
  (UsableNet 2025 year-end report) → one-time audits don't stick; a loop in CI does.
- WebAIM Million 2026 (Mar 30, 2026): 95.9% of the top 1M home pages have
  detectable WCAG 2 failures, UP from 94.8% in 2025 — the first regression after
  years of small improvements, averaging 56.1 errors per page. The AI-codegen era
  is making the web LESS accessible; a verification loop is the countermeasure.
- ~1.3 billion people live with disabilities. (WHO)
- Voice of customer, pulled with full comment data July 17: r/smallbusiness post
  1uvn0ix, POSTED JULY 13, 2026 (four days before the hackathon). 260 upvotes,
  202 comments. Real details for the exhibit slide: suit taped to the shop door,
  federal case in W.D.N.C., friend settling for $15k plus ongoing costs, OP quote
  "We're so distressed and torn up over this." Top-reply mood: "It is basically
  extortion." A remediation pro in-thread reports settlements from under $10k to
  ~$100k (one NY client: $82,500) and a Florida plaintiff who has sued 175+
  businesses; asked if a widget can fix a site: "No, not really."
- The kicker, use it on stage: a commenter in that same thread recommends
  accessiBe as the fix — the FTC-fined overlay. The market's default answer to
  this man's worst week is the villain.

The villain (overlays)
- FTC fined accessiBe $1M for false advertising and fake reviews. (FTC case
  2223156; covered by accessibility.works)
- The Overlay Fact Sheet open letter has crossed 1,000 signatures (started at
  ~400 in 2021). (overlayfactsheet.com; r/accessibility announcement)
- 456 lawsuits in H1 2025 (22.6% of all filings) targeted sites that HAD a
  widget/overlay installed. (UsableNet H1-2025 data via rev.com; see also
  accessibility.works, Jul 2025)
- Community sentiment on r/accessibility: "garbage", "snake oil" — unprompted.

Why now
- European Accessibility Act enforcement began June 28, 2025; applies to non-EU
  companies selling into the EU; existing services have until 2030. (EU Commission;
  gtlaw.com)
- Meta at Axe-con 2026: AI-assisted development shipped 2,500 accessibility fixes
  at a 90% solve rate, 5,000 more queued. The approach works at scale.
  (Axe-con 2026 coverage, ratedwithai.com)
- The ceiling: automated scanners detect only ~30–40% of accessibility issues
  (Deque; GDS audit). Volunteer this. The vision-capable critic is how we climb
  past the ceiling; the rest is roadmap, honestly labeled.

Why a harness and not a bare agent
- Cautionary tale: "I let an AI agent optimize our database queries for 48 hours,
  then our latency spiked 400%." (Towards AI, Mar 2026) The model wasn't missing.
  The measurement was.
- Category proof this framing wins: Cursor is models + harness, judged by outcomes.
  (A Cursor engineer is on this panel.)

## Act structure (3-minute demo)

Act 1 — the naive loop (30s). Recording: bare "fix accessibility" loop, gates off.
Counter drops while it hides content and breaks layout. "This is what 'just give it
to Claude' produces. The counter lies."
Act 2 — Mend live (90s). `npm run demo` on stage: counter converges to 0, gate
lights flick, one fix gets CAUGHT and auto-reverted on screen. Point at it: "That
revert is the product."
Act 3 — proof (45s). Open one receipt (before/after, patch, gate results, critic
verdict). Run IBM Equal Access live as the independent second opinion. Agent
deploys the healed site via Zero; shareable link on screen. Close with the stage
line.

## Sponsor mapping (one per loop stage — say it this way)

- Bedrock is the brain: fixer and critic both run Claude through it.
- Pomerium is how the agent reaches the patient: identity-aware policy, no raw
  credentials, access log joins the evidence trail. (If cut per M4 timebox: one
  roadmap slide, spoken credibly via the Arbiter zero-trust background.)
- Zero is how the cured patient ships: the agent deploys the healed site to a live
  link itself, no API keys.

## Objection handling

"Any Claude/GPT agent can do this." — Correct, and unverified. Show Act 1 vs
Act 2. The scorers, the banned-pattern gate, the isolated critic, the receipts:
that's built software, and it's the difference between a demo and evidence.
"TestParty / Level Access already do this." — Yes, the category is proven (cite
Meta's numbers as more proof). Our contribution is adversarial verification you
can watch: the caught failure, the receipts, the independent engine, live.
"Does this make a site ADA compliant?" — No, and we never claim it. Automated
rules cover ~30–40% of issues; we fix what we can verify and hand you receipts.
Overclaiming compliance is literally what the FTC fined accessiBe for.
"Why not Lighthouse as your second opinion?" — Because Lighthouse's a11y audit IS
axe. Our second engine is IBM Equal Access, a genuinely different ruleset.

## After the weekend (one slide, max)

GitHub Action: every PR gets a comment with verified fix commits and receipts.
Receipts formatted for the person who actually buys this: the owner with a demand
letter on his desk, and his lawyer.

## Judge notes

Cursor SWE (Lingxi Li): lead with harness architecture, revert semantics, critic
isolation. Nick Taylor (Pomerium): the access-log-as-evidence angle. Michael Ludden
(Zero): the agent self-deploying as the loop's final act. Nexla judges: if asked
about scale, fleet-mode is roadmap (their data layer is the honest fit there, not
a weekend bolt-on). Never bluff a judge whose product it is.
