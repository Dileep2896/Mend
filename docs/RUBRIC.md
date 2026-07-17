# Mend rubric — what counts as fixed

The gates below are the definition of done. Nothing else is. The fixer may not
modify this file, mask.json, or thresholds during a run.

## 1. Violation classes in scope (weekend)

Priority order. Invisible-first: classes 1–4 change no pixels, so they build streak
and trust before design-touching classes.

1. image-alt (informative images get true descriptions; decorative handled per s5)
2. label / label-title-only / form-field-multiple-labels (form controls named)
3. link-name / button-name (discernible text for interactive elements)
4. aria-* validity (valid roles, allowed attrs, required children/parents)
5. heading-order / page-has-heading-one / landmark-one-main (structure)
6. color-contrast (design-touching; gate 2b applies)
7. focus-visible / focus-order-semantics if time allows (stretch)

Out of scope this weekend: video captions, PDFs, complex widgets (comboboxes,
grids), motion preferences. List them honestly if asked; never claim coverage.

## 2. Gate definitions

- Gate 1 — axe re-scan. The targeted violation is absent. Total violation count is
  strictly lower than round start. Zero NEW rule failures introduced.
- Gate 2 — pixel diff. pixelmatch changed-pixel count = 0 outside masked regions,
  per route, against frozen baselines (animations off, fonts loaded, fixed viewport,
  fixed locale). Threshold 0.1 pixelmatch sensitivity; masks listed in
  harness/mask.json with a reason per mask. Adding a mask requires a JOURNAL entry.
- Gate 2b — contrast fixes only. Flagged element's box masked for gate 2; bounding
  boxes of every other element unchanged (layout geometry stable); new computed
  contrast ratio ≥ 4.5:1 (normal text) or ≥ 3:1 (large text ≥ 18.66px bold / 24px).
- Gate 3 — banned patterns (section 4) on the round's diff. Any hit = reject.
- Gate 4 — IBM Equal Access scan. Independent rule engine (NOT Lighthouse, which is
  axe underneath). Violation count non-increasing vs round start.
- Critic — semantic truth (section 5). Applies to image-alt, label, link/button
  name, heading logic. Fixer never self-certifies these.

## 3. Round accounting

- Max 3 attempts per violation, then BLOCKED with reason.
- Max 6 rounds per page. A page "converges" when axe violations in scope = 0 or
  only BLOCKED items remain.
- Every round ends in exactly one commit: accept or revert. No dirty state.

## 4. Banned patterns (gate 3) — automatic reject

In the diff, any of the following:

- aria-hidden="true" added to an element that was previously exposed content
- alt="" added to an image the critic has not certified decorative
- display:none, visibility:hidden, opacity:0, or off-screen positioning added to
  interactive or content elements
- tabindex="-1" added to a natively focusable element
- role="presentation" or role="none" on semantic elements (nav, main, button, a,
  headings, form controls)
- Deletion of any element containing user-visible text, or of any interactive
  element
- Removing or renaming the failing selector so the scanner can't find it (selector
  laundering)
- Edits to harness/, mask.json, RUBRIC.md, or gate thresholds inside a fix round

Rationale, stated once: every one of these improves the counter while making the
site worse for real users. This gate is what separates Mend from an overlay.

## 5. Critic scoring (semantic gates)

Critic runs in an isolated context (.claude/agents/critic.md), sees the artifact
(image bytes, surrounding markup, page purpose), returns PASS or FAIL + one reason.

- Alt text: PASS iff it describes the image's meaning IN THIS CONTEXT, ≤ ~125 chars,
  no "image of/picture of", no keyword stuffing, no hallucinated details absent from
  the image. Decorative certification: PASS for alt="" only if the image conveys no
  information (spacers, pure texture) — logos, product shots, charts are never
  decorative.
- Labels / accessible names: PASS iff a screen-reader user hearing only the name
  knows what the control does. "Submit" on the only form: fine. "Click here" x4: FAIL.
- Headings: PASS iff the outline reads as a sensible table of contents; no levels
  skipped purely for styling.

## 6. Receipt schema (written on accept AND revert)

receipts/<seq>-<rule-id>/
  receipt.json:
    { seq, round, ruleId, impact, selector, source: {file, lineStart, lineEnd},
      attempt, decision: "accept" | "revert",
      gates: [{name, pass, detail}], critic: {verdict, reason} | null,
      commit, timestamps }
  before.png / after.png       (element-cropped where feasible, else viewport)
  diff.png                     (gate 2 output)
  patch.diff                   (the exact source change)
  axe-before.json / axe-after.json (violation-filtered to this rule)
  notes.md                     (one honest paragraph; failure receipts say what the
                               agent tried and which gate caught it)

Language rule for every receipt and all dashboard copy: "fixed and verified" /
"reverted, caught by <gate>". Never "compliant", never "lawsuit-proof".
