# 004-color-contrast — fixed and verified

Round r4, attempt 1. Rule **color-contrast** (serious) at `target/login.html:59-61`, selector `.custom-control-label`.

All gates passed: gate1-axe ✓, gate2b-contrast ✓, gate3-patterns ✓, gate4-engine2 ✓. Committed as `2a7c9fb`.

Fixed for real via a color change (not suppression): darkened the 'Remember Me' label text to #565869. Gate 2b measured contrast 3.56:1 -> 7.01:1 (>=4.5) with every other bounding box unchanged (layout geometry stable). Contrast is objectively measured, so no critic needed.
