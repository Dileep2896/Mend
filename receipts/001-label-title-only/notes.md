# 001-label-title-only — fixed and verified

Round r1, attempt 1. Rule **label-title-only** (serious) at `target/login.html:46-52`, selector `#exampleInputEmail`.

All gates passed: gate1-axe ✓, gate2-pixel ✓, gate3-patterns ✓, gate4-engine2 ✓. Critic: **PASS** — Both names ('Email address','Password') convey purpose and align with the visible placeholders.. Committed as `95c11f7`.

Fixed via aria-label on the email and password inputs — a real accessible name with zero visual change. No suppression: screen readers now announce 'Email address, edit text'.
