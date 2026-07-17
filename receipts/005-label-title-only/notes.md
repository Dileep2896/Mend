# 005-label-title-only — fixed and verified

Round r5, attempt 1. Rule **label-title-only** (serious) at `target/forgot-password.html:48-51`, selector `#exampleInputEmail`.

All gates passed: gate1-axe ✓, gate2-pixel ✓, gate3-patterns ✓, gate4-engine2 ✓. Critic: **PASS** — 'Email address' tells a screen-reader user the field expects an email; consistent with the visible placeholder.. Committed as `58e4e50`.

Second page. Same invisible fix pattern as login: aria-label on the email input, zero visual change. Proves the loop generalizes across pages.
