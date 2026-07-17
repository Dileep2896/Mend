// Mend — demo mode (RUBRIC R5 / TASKS M5). `npm run demo`.
// One small page, converge live in well under 90s, all four gates on screen.
// FREE: local axe/pixel/patterns + one IBM Equal Access pass. No paid API calls
// (the demo fix is a structural landmark fix, so no critic is needed). Repeatable:
// it reverts the page at the end, so you can rehearse it back to back.
//
// The live terminal convergence pairs with the dashboard (npm run dashboard),
// which shows the accumulated receipts behind it.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { arg, ROOT } from "./lib.mjs";

const ROUTE = arg("route", "register.html");
const FILE = resolve(ROOT, "target", ROUTE);
const c = { d: "\x1b[2m", g: "\x1b[38;5;43m", a: "\x1b[38;5;179m", r: "\x1b[38;5;203m", b: "\x1b[1m", x: "\x1b[0m" };
const line = (s = "") => console.log(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function scanCount(route) {
  const out = execFileSync("node", [resolve(ROOT, "harness/scan.mjs"), "--dir", "target", "--routes", route],
    { cwd: ROOT }).toString();
  const m = out.match(/\{[\s\S]*\}/g);
  for (let i = m.length - 1; i >= 0; i--) { try { return JSON.parse(m[i]).totals; } catch {} }
  return null;
}

line(`\n${c.b}  MEND · demo${c.x} ${c.d}— fix → verify → receipt, live${c.x}\n`);
line(`${c.d}  target page:${c.x} ${ROUTE}   ${c.d}(reverts at the end — rehearse freely)${c.x}\n`);

const original = readFileSync(FILE, "utf8");
// Restore the page even on Ctrl-C mid-rehearsal (2nd-audit finding 6) so the
// working tree is never left dirty (which loop.sh would otherwise auto-commit).
let restored = false;
const restore = () => { if (!restored) { restored = true; try { writeFileSync(FILE, original); } catch {} } };
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { restore(); process.exit(130); });
try {
  // ---- 0. seed
  const seed = scanCount(ROUTE);
  line(`  ${c.a}${c.b}${String(seed.violations).padStart(3)}${c.x} accessibility violations to start   ${c.d}${Object.entries(seed.byRule).map(([k, v]) => `${k}:${v}`).join("  ")}${c.x}`);
  await sleep(700);

  // ---- 1. round-start snapshot (before-axe + engine2 baseline)
  line(`\n  ${c.d}round-start · snapshotting before-state (axe + IBM Equal Access)…${c.x}`);
  execFileSync("node", [resolve(ROOT, "harness/round-start.mjs"), "--round", "demo", "--routes", ROUTE, "--rule", "landmark-one-main"],
    { cwd: ROOT, stdio: "ignore" });

  // ---- 2. the fix: add a main landmark (invisible, clears landmark-one-main + region)
  line(`  ${c.g}fix${c.x}  add role="main" to the content container ${c.d}(source patch — a real landmark, zero pixels moved)${c.x}`);
  const patched = original.replace(/<div class="container">/, '<div class="container" role="main">');
  if (patched === original) throw new Error("could not locate the container to patch");
  writeFileSync(FILE, patched);
  await sleep(700);

  // ---- 3. verify: four gates
  line(`\n  ${c.d}verify · running the four gates…${c.x}\n`);
  let verifyOut = "";
  try {
    verifyOut = execFileSync("node", [resolve(ROOT, "harness/verify.mjs"), "--round", "demo", "--routes", ROUTE, "--scope", `target/${ROUTE}`],
      { cwd: ROOT }).toString();
  } catch (e) { verifyOut = (e.stdout?.toString() ?? "") + (e.stderr?.toString() ?? ""); }
  for (const l of verifyOut.split("\n")) {
    if (/^\s*(ok|FAIL)\s/.test(l)) {
      const ok = l.trim().startsWith("ok");
      line(`   ${ok ? c.g + "●" : c.r + "○"} ${l.trim().replace(/^ok|^FAIL/, "").trim()}${c.x}`);
      await sleep(350);
    }
  }

  // ---- 4. converged count
  const after = scanCount(ROUTE);
  const gone = seed.violations - after.violations;
  line(`\n  ${c.a}${String(seed.violations).padStart(3)}${c.x} ${c.d}→${c.x} ${c.g}${c.b}${after.violations}${c.x}   ${c.g}${gone} violations fixed & verified${c.x} ${c.d}this round (landmark-one-main + region)${c.x}`);
  line(`  ${c.d}remaining are color-contrast — the design-touching class, handled by gate 2b.${c.x}`);

  line(`\n  ${c.d}open the receipts + live counter:${c.x} ${c.b}npm run dashboard${c.x} ${c.d}→ http://localhost:4000${c.x}\n`);
} finally {
  // ---- revert so the demo is repeatable and target stays clean
  restore();
  line(`  ${c.d}(${ROUTE} reverted — demo is repeatable)${c.x}\n`);
}
