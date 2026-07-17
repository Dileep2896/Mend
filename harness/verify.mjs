// Mend — verify: the full gate sequence. `npm run verify`.
// Order: gate 1 axe re-scan → gate 2 pixel diff → gate 3 banned patterns →
// gate 4 IBM Equal Access. Fail-fast, but ALWAYS records which gate and why.
// Writes runs/<round>/verify.json + one human line per gate. Exits nonzero on
// any failure (LOOP_PROMPT: never argue with a gate).
//
// Round context (written by the loop at round start, optional in standalone):
//   runs/<round>/before-axe.json      — axe totals at round start (gate 1 ref)
//   runs/<round>/before-engine2.json  — {total} at round start (gate 4 ref)
//   runs/<round>/target-rule.txt      — the rule id this round is fixing (gate 1)
//
// Usage: node harness/verify.mjs [--round latest] [--routes a.html,b.html]
//        [--contrast] (route gate 2 through the contrast path 2b — M3)

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { arg, ROOT } from "./lib.mjs";

const round = arg("round", "latest");
const routesArg = arg("routes");
const roundDir = resolve(ROOT, `runs/${round}`);
mkdirSync(roundDir, { recursive: true });

const gates = [];
let failed = false;

function runNode(file, args, { allowFail = false } = {}) {
  try {
    const out = execFileSync("node", [resolve(ROOT, "harness", file), ...args], {
      cwd: ROOT, maxBuffer: 100 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
    }).toString();
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout?.toString() ?? "") + (e.stderr?.toString() ?? "") };
  }
}

function lastJson(text) {
  // scan.mjs / diff.mjs / gates print a JSON blob then a human line; grab the JSON.
  const m = text.match(/\{[\s\S]*\}/g);
  if (!m) return null;
  for (let i = m.length - 1; i >= 0; i--) { try { return JSON.parse(m[i]); } catch {} }
  return null;
}

function record(name, pass, detail) {
  gates.push({ name, pass, detail });
  console.log(`${pass ? "  ok " : "FAIL"} ${name} — ${detail}`);
  if (!pass) failed = true;
  return pass;
}

// ---- Gate 1: axe re-scan.
{
  const scanArgs = ["--dir", "target", "--out", `runs/${round}/axe.json`];
  if (routesArg) scanArgs.push("--routes", routesArg);
  const r = runNode("scan.mjs", scanArgs);
  const j = lastJson(r.out);
  const total = j?.totals?.violations ?? null;
  const beforePath = resolve(roundDir, "before-axe.json");
  let detail = `axe total = ${total}`;
  let pass = total != null;
  if (existsSync(beforePath)) {
    const before = JSON.parse(readFileSync(beforePath, "utf8"));
    const beforeTotal = before.totals?.violations ?? before.total ?? null;
    const beforeRules = new Set(Object.keys(before.totals?.byRule ?? {}));
    const nowRules = Object.keys(j?.totals?.byRule ?? {});
    const newRules = nowRules.filter((id) => !beforeRules.has(id));
    const targetRulePath = resolve(roundDir, "target-rule.txt");
    const targetRule = existsSync(targetRulePath) ? readFileSync(targetRulePath, "utf8").trim() : null;
    const targetGone = targetRule ? !(j?.totals?.byRule ?? {})[targetRule] : true;
    pass = total < beforeTotal && newRules.length === 0 && targetGone;
    detail = `axe ${beforeTotal} → ${total}; newRules=[${newRules.join(",")}]; target '${targetRule ?? "-"}' ${targetGone ? "gone" : "STILL PRESENT"}`;
  } else {
    detail += " (no round-start ref — report only)";
  }
  record("gate1-axe", pass, detail);
}

// ---- Gate 2: pixel diff (fail-fast stops here if a prior gate failed).
if (!failed) {
  const diffArgs = ["--dir", "target", "--round", round];
  if (routesArg) diffArgs.push("--routes", routesArg);
  const r = runNode("diff.mjs", diffArgs, { allowFail: true });
  const j = lastJson(r.out);
  const pass = r.code === 0 && j?.pass === true;
  record("gate2-pixel", pass, `changed px = ${j?.totalChanged ?? "?"}${j?.routes?.some((x) => x.dimsChanged) ? " (DIMENSIONS CHANGED)" : ""}`);
} else record("gate2-pixel", false, "skipped (prior gate failed)");

// ---- Gate 3: banned patterns.
if (!failed) {
  const r = runNode("gate-patterns.mjs", [], { allowFail: true });
  const j = lastJson(r.out);
  const pass = r.code === 0 && j?.pass === true;
  record("gate3-patterns", pass, pass ? "no banned patterns" : `${j?.count ?? "?"} banned: ${(j?.violations ?? []).map((v) => v.id).join(",")}`);
} else record("gate3-patterns", false, "skipped (prior gate failed)");

// ---- Gate 4: IBM Equal Access.
if (!failed) {
  const e2Args = ["--dir", "target", "--round", round];
  if (routesArg) e2Args.push("--routes", routesArg);
  const beforeE2 = resolve(roundDir, "before-engine2.json");
  if (existsSync(beforeE2)) {
    const b = JSON.parse(readFileSync(beforeE2, "utf8"));
    e2Args.push("--baseline", String(b.total ?? b));
  }
  const r = runNode("gate-engine2.mjs", e2Args, { allowFail: true });
  const j = lastJson(r.out);
  const pass = r.code === 0 && (j?.pass ?? false);
  record("gate4-engine2", pass, `engine2 total = ${j?.total ?? "?"}${j?.baseline != null ? ` (baseline ${j.baseline})` : " (no baseline)"}`);
} else record("gate4-engine2", false, "skipped (prior gate failed)");

const summary = { round, pass: !failed, gates, verifiedAt: new Date().toISOString() };
writeFileSync(resolve(roundDir, "verify.json"), JSON.stringify(summary, null, 2));
console.log(`\nVERIFY ${!failed ? "PASS" : "FAIL"} (round ${round}) — ${gates.filter((g) => g.pass).length}/${gates.length} gates`);
process.exit(failed ? 1 : 0);
