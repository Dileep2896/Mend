// Mend — Act 1 evidence (TASKS M5): the naive "just give it to Claude" loop with
// gates OFF. It games the axe counter with exactly the banned patterns Mend
// rejects — aria-hidden, alt="", display:none, element deletion — and we capture
// the counter DROPPING while the page gets worse for real users. This is the
// villain baseline the harness exists to beat. Output: receipts/naive-baseline/.
//
// Honest: we run this ON A COPY, we never ship it, and we label every move as the
// suppression it is. `node harness/naive-baseline.mjs`

import { mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, cpSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { startServer, serverBase, newContext, chromium, loadMasks, shoot, ROOT } from "./lib.mjs";
import { scanDiff } from "./gate-patterns.mjs";

const outDir = resolve(ROOT, "receipts/naive-baseline");
mkdirSync(outDir, { recursive: true });
const copyDir = resolve(ROOT, "runs/naive-copy");
mkdirSync(copyDir, { recursive: true });

// Work on a copy of login.html so we never touch the real target.
const srcPage = resolve(ROOT, "target/login.html");
const workPage = resolve(copyDir, "login.html");
cpSync(resolve(ROOT, "target"), copyDir, { recursive: true });

function axeCount(dir) {
  const out = execFileSync("node", [resolve(ROOT, "harness/scan.mjs"), "--dir", dir, "--routes", "login.html"],
    { cwd: ROOT }).toString();
  const m = out.match(/\{[\s\S]*\}/g);
  for (let i = m.length - 1; i >= 0; i--) { try { return JSON.parse(m[i]).totals.violations; } catch {} }
  return null;
}

const before = axeCount(copyDir);

// screenshot before
const server1 = await startServer(copyDir);
const b1 = serverBase(server1);
const browser1 = await chromium.launch();
const ctx1 = await newContext(browser1);
await shoot(ctx1, b1, "login.html", resolve(outDir, "naive-before.png"), loadMasks());
await browser1.close(); server1.close();

// ---- the naive "fixes": pure suppression, each one a RUBRIC s4 banned pattern.
let html = readFileSync(workPage, "utf8");
const original = html;
const moves = [];
// 1. hide the low-contrast label from the scanner
html = html.replace(/<label class="custom-control-label" for="customCheck">/,
  '<label class="custom-control-label" for="customCheck" aria-hidden="true" style="display:none">');
moves.push("aria-hidden + display:none on the 'Remember Me' label (hides a real control)");
// 2. delete the low-contrast social buttons entirely to kill their contrast + name flags
html = html.replace(/<a href="index.html" class="btn btn-google[\s\S]*?<\/a>/, "<!-- deleted by naive loop -->");
html = html.replace(/<a href="index.html" class="btn btn-facebook[\s\S]*?<\/a>/, "<!-- deleted by naive loop -->");
moves.push("deleted the Google + Facebook login buttons (interactive elements) to remove their violations");
// 3. off-screen the forgot/create links
html = html.replace(/<div class="text-center">\s*<a class="small" href="forgot-password.html">/,
  '<div class="text-center" style="position:absolute;left:-9999px"><a class="small" href="forgot-password.html">');
moves.push("pushed the Forgot-Password link off-screen (left:-9999px)");
writeFileSync(workPage, html);

const after = axeCount(copyDir);

// screenshot after
const server2 = await startServer(copyDir);
const b2 = serverBase(server2);
const browser2 = await chromium.launch();
const ctx2 = await newContext(browser2);
await shoot(ctx2, b2, "login.html", resolve(outDir, "naive-after.png"), loadMasks());
await browser2.close(); server2.close();

// what MEND's gate 3 says about this exact diff. git diff --no-index exits 1 when
// files differ, so the diff text arrives via the thrown error's stdout.
let gate3;
try {
  const d = execFileSync("git", ["diff", "--no-index", "--no-color", srcPage, workPage], { cwd: ROOT }).toString();
  gate3 = scanDiff(d, ["target/login.html"]);
} catch (e) {
  gate3 = scanDiff(e.stdout?.toString() ?? "", ["target/login.html"]);
}

const summary = {
  what: "Naive gates-off loop — Act 1 baseline. Counter drops while the page gets worse.",
  axe: { before, after, delta: before - after, note: "axe REWARDS the suppression: fewer violations reported." },
  humanReality: [
    "'Remember Me' is gone for everyone (display:none).",
    "The Google and Facebook sign-in buttons are deleted — real functionality removed.",
    "The Forgot-Password link is off-screen — still in the tab order, invisible on screen.",
  ],
  naiveMoves: moves,
  mendVerdict: {
    gate3Pass: gate3.violations.length === 0,
    gate3Would: "REJECT",
    banned: gate3.violations.map((v) => v.id),
    line: `Mend's banned-pattern gate flags ${gate3.violations.length} suppression(s); every one of these rounds would be reverted with a failure receipt.`,
  },
  generatedAt: new Date().toISOString(),
};
writeFileSync(resolve(outDir, "summary.json"), JSON.stringify(summary, null, 2));
writeFileSync(resolve(outDir, "notes.md"),
  `# Act 1 — the naive loop (gates off)\n\n` +
  `axe violations on login.html: **${before} → ${after}** (down ${before - after}). The counter says success.\n\n` +
  `What actually happened to real users:\n` +
  summary.humanReality.map((h) => `- ${h}`).join("\n") + `\n\n` +
  `Every move here is a RUBRIC section-4 banned pattern. Mend's gate 3 flags: ` +
  `**${summary.mendVerdict.banned.join(", ") || "none"}** — so in Mend, all of these rounds REVERT. ` +
  `"This is what 'just give it to Claude' produces. The counter lies."\n`);

console.log(`Act 1 baseline written to receipts/naive-baseline/`);
console.log(`  axe ${before} → ${after} (counter dropped ${before - after})`);
console.log(`  Mend gate 3 would REJECT: ${summary.mendVerdict.banned.join(", ")}`);
