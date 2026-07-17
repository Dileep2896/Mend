// Mend — banned-pattern gate (gate 3, RUBRIC section 4). Runs on the round's
// working diff BEFORE the critic. Any hit = reject. This gate is what separates
// Mend from an overlay: every banned pattern improves the axe counter while
// making the site worse for real users.
//
// Usage:
//   node harness/gate-patterns.mjs                 # scans `git diff` of target/
//   node harness/gate-patterns.mjs --self-test     # proves the detectors bite
//   node harness/gate-patterns.mjs --diff-file f   # scan a saved unified diff
//
// exports scanDiff(diffText, changedPaths) -> { violations: [...] }

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { arg, ROOT } from "./lib.mjs";

// Files a fix round may never touch (selector/gate laundering, scope creep).
const FORBIDDEN_PATHS = [
  /^harness\//,
  /^harness\/mask\.json$/,
  /^docs\/RUBRIC\.md$/,
];

// Detectors run over ADDED lines (patterns introduced by the fix).
const ADDED_RULES = [
  { id: "aria-hidden-added", re: /aria-hidden\s*=\s*["']true["']/i,
    why: "aria-hidden=\"true\" hides content from assistive tech — suppression, not a fix" },
  { id: "empty-alt-added", re: /\balt\s*=\s*["']\s*["']/i,
    why: "alt=\"\" on an image the critic has not certified decorative = silencing image-alt" },
  { id: "display-none-added", re: /(display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?!\.)|left\s*:\s*-9999)/i,
    why: "hiding/off-screening an element to remove it from the scanner's view" },
  { id: "negative-tabindex-added", re: /tabindex\s*=\s*["']-1["']/i,
    why: "tabindex=\"-1\" pulls a natively focusable control out of the tab order" },
  { id: "role-presentation-added", re: /role\s*=\s*["'](presentation|none)["']/i,
    why: "role=presentation/none strips semantics from a meaningful element" },
];

// Detectors over REMOVED lines (deleting content/interactive elements to silence).
const REMOVED_RULES = [
  { id: "interactive-deleted", re: /<\s*(a|button|input|select|textarea|label)\b/i,
    why: "deletion of an interactive element to make its violation disappear" },
  { id: "text-element-deleted", re: />[^<>]*[A-Za-z0-9]{3,}[^<>]*</,
    why: "deletion of an element containing user-visible text" },
];

export function scanDiff(diffText, changedPaths = []) {
  const violations = [];

  for (const p of changedPaths) {
    const rel = p.replace(/^b\//, "").replace(/^a\//, "");
    if (FORBIDDEN_PATHS.some((re) => re.test(rel))) {
      violations.push({ id: "forbidden-path", file: rel, line: 0,
        why: "a fix round edited harness/mask/rubric — gate/selector laundering (RUBRIC s4)" });
    }
  }

  let file = null;
  let newLine = 0;
  for (const raw of diffText.split("\n")) {
    if (raw.startsWith("+++ ")) { file = raw.slice(4).replace(/^b\//, ""); continue; }
    if (raw.startsWith("--- ")) continue;
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { newLine = Number(hunk[1]); continue; }
    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      const content = raw.slice(1);
      for (const r of ADDED_RULES) {
        if (r.re.test(content)) violations.push({ id: r.id, file, line: newLine, why: r.why, snippet: content.trim().slice(0, 100) });
      }
      newLine++;
    } else if (raw.startsWith("-") && !raw.startsWith("---")) {
      const content = raw.slice(1);
      for (const r of REMOVED_RULES) {
        if (r.re.test(content)) violations.push({ id: r.id, file, line: newLine, why: r.why, snippet: content.trim().slice(0, 100) });
      }
      // removed lines don't advance the new-file counter
    } else {
      newLine++;
    }
  }
  // De-dupe identical (id,file,line).
  const seen = new Set();
  const deduped = violations.filter((v) => {
    const k = `${v.id}|${v.file}|${v.line}`;
    if (seen.has(k)) return false; seen.add(k); return true;
  });
  return { violations: deduped };
}

function selfTest() {
  const badDiff = `--- a/target/index.html
+++ b/target/index.html
@@ -10,3 +10,3 @@
 <div class="card">
-  <img src="logo.png">
+  <img src="logo.png" alt="">
@@ -40,4 +40,4 @@
-  <button type="button">Menu</button>
+  <span aria-hidden="true">Menu</span>
`;
  const { violations } = scanDiff(badDiff, ["target/index.html"]);
  const ids = violations.map((v) => v.id).sort();
  const expected = ["aria-hidden-added", "empty-alt-added", "interactive-deleted", "text-element-deleted"];
  const ok = expected.every((e) => ids.includes(e));
  console.log("self-test detectors fired:", ids.join(", "));
  console.log(ok ? "SELF-TEST PASS (gate bites)" : "SELF-TEST FAIL");
  process.exit(ok ? 0 : 1);
}

if (arg("self-test", null) !== null || process.argv.includes("--self-test")) {
  selfTest();
} else {
  const diffFile = arg("diff-file");
  let diffText, changedPaths;
  if (diffFile) {
    diffText = readFileSync(diffFile, "utf8");
    changedPaths = [...diffText.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => m[1]);
  } else {
    diffText = execSync("git diff --no-color -- target/", { cwd: ROOT, maxBuffer: 50 * 1024 * 1024 }).toString();
    changedPaths = execSync("git diff --name-only", { cwd: ROOT }).toString().split("\n").filter(Boolean);
  }
  const { violations } = scanDiff(diffText, changedPaths);
  const pass = violations.length === 0;
  console.log(JSON.stringify({ gate: "patterns", pass, count: violations.length, violations }, null, 2));
  console.log(pass ? "GATE 3 PASS: no banned patterns" : `GATE 3 FAIL: ${violations.length} banned pattern(s)`);
  process.exit(pass ? 0 : 1);
}
