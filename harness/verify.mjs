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

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { arg, ROOT } from "./lib.mjs";

const round = arg("round", "latest");
const routesArg = arg("routes");
// --scope <pathspec> restricts gate 3 to that path's diff (for demo/standalone
// runs where the working tree has unrelated dirty files). The loop omits it so
// gate 3 sees the whole round diff and can catch harness/mask/rubric laundering.
const scope = arg("scope");
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
  // Tools print one machine JSON object (possibly pretty-printed over many lines)
  // then brace-free human lines. Brace-balance scan for every top-level {...}
  // object and return the LAST one that parses (robust to multiple blobs and to
  // stray '}' in appended stderr — M7).
  const candidates = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}") { depth--; if (depth === 0 && start >= 0) { candidates.push(text.slice(start, i + 1)); start = -1; } }
  }
  for (let i = candidates.length - 1; i >= 0; i--) { try { return JSON.parse(candidates[i]); } catch {} }
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
  // H1: a route that failed to scan reports count "ERR" and contributes 0 to the
  // total — which could make gate 1 pass spuriously. Any scan error = hard fail.
  const scanErrored = (j?.perRoute ?? []).some((p) => p.count === "ERR");
  const beforePath = resolve(roundDir, "before-axe.json");
  let detail = `axe total = ${total}`;
  let pass = total != null && !scanErrored;
  if (scanErrored) detail += " — SCAN ERROR on a route (cannot verify)";
  if (existsSync(beforePath) && !scanErrored) {
    const before = JSON.parse(readFileSync(beforePath, "utf8"));
    const beforeTotal = before.totals?.violations ?? before.total ?? null;
    const beforeRules = new Set(Object.keys(before.totals?.byRule ?? {}));
    const beforeByRule = before.totals?.byRule ?? {};
    const nowByRule = j?.totals?.byRule ?? {};
    const nowRules = Object.keys(nowByRule);
    const newRules = nowRules.filter((id) => !beforeRules.has(id));
    // H7: "zero NEW rule failures" (RUBRIC gate 1) means no regressions, not just
    // no new rule CLASS. Fail if any pre-existing rule's node count went UP.
    const regressed = nowRules.filter((id) => beforeRules.has(id) && nowByRule[id] > (beforeByRule[id] ?? 0));
    const targetRulePath = resolve(roundDir, "target-rule.txt");
    const targetRule = existsSync(targetRulePath) ? readFileSync(targetRulePath, "utf8").trim() : null;
    // "targeted violation absent" (RUBRIC gate 1): for a rule with many nodes we
    // fix one node per round, so require the target rule's node count to strictly
    // decrease (fully gone when it hits 0). A suppression that games the count is
    // still blocked by "total strictly lower" + "no new rules" + "no regression"
    // and by gate 3.
    const beforeRuleCount = beforeByRule[targetRule] ?? 0;
    const nowRuleCount = nowByRule[targetRule] ?? 0;
    const targetProgress = targetRule ? nowRuleCount < beforeRuleCount : true;
    pass = total < beforeTotal && newRules.length === 0 && regressed.length === 0 && targetProgress;
    detail = `axe ${beforeTotal} → ${total}; newRules=[${newRules.join(",")}]; regressed=[${regressed.join(",")}]; target '${targetRule ?? "-"}' ${beforeRuleCount}→${nowRuleCount} ${targetProgress ? "(reduced)" : "(NOT reduced)"}`;
  } else if (!scanErrored) {
    detail += " (no round-start ref — report only)";
  }
  record("gate1-axe", pass, detail);
}

// ---- Gate 2: pixel diff — OR gate 2b for contrast fixes (--contrast --selector).
const contrast = process.argv.includes("--contrast");
const selector = arg("selector");
// M10: a contrast run MUST supply both --selector and --routes, else verify would
// silently fall through to the plain pixel gate (which a contrast fix always fails)
// or pass a blank route to gate-contrast. Fail loudly instead of silently wrong.
if (!failed && contrast && (!selector || !routesArg)) {
  record("gate2b-contrast", false, "misconfigured: --contrast requires --selector AND --routes");
} else if (!failed && contrast && selector) {
  const cArgs = ["--route", (routesArg || "").split(",")[0], "--selector", selector, "--round", round,
    "--baseline-boxes", `runs/${round}/boxes-before.json`];
  if (process.argv.includes("--large")) cArgs.push("--large");
  const r = runNode("gate-contrast.mjs", cArgs, { allowFail: true });
  const j = lastJson(r.out);
  const pass = r.code === 0 && j?.pass === true;
  record("gate2b-contrast", pass, `ratio ${j?.ratio ?? "?"}:1, ${j?.geometryStable ? "layout stable" : `${j?.movedBoxes} box(es) moved`}`);
} else if (!failed) {
  const diffArgs = ["--dir", "target", "--round", round];
  if (routesArg) diffArgs.push("--routes", routesArg);
  const r = runNode("diff.mjs", diffArgs, { allowFail: true });
  const j = lastJson(r.out);
  const pass = r.code === 0 && j?.pass === true;
  record("gate2-pixel", pass, `changed px = ${j?.totalChanged ?? "?"}${j?.routes?.some((x) => x.dimsChanged) ? " (DIMENSIONS CHANGED)" : ""}`);
} else record("gate2-pixel", false, "skipped (prior gate failed)");

// ---- Gate 3: banned patterns. With --scope, gate only that path's diff (so
// unrelated dirty files in the working tree can't false-trip forbidden-path).
if (!failed) {
  let gpArgs = [];
  if (scope) {
    const dpath = resolve(roundDir, "round.diff");
    writeFileSync(dpath, execSync(`git diff --no-color -- ${scope}`, { cwd: ROOT, maxBuffer: 50 * 1024 * 1024 }).toString());
    gpArgs = ["--diff-file", dpath];
  }
  const r = runNode("gate-patterns.mjs", gpArgs, { allowFail: true });
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
    // M8: only pass a baseline if it's a real number. A null/unparsed baseline
    // must NOT become "[object Object]" → NaN → gate 4 fails every round.
    const b = JSON.parse(readFileSync(beforeE2, "utf8"));
    const bt = Number(b.total);
    if (Number.isFinite(bt)) e2Args.push("--baseline", String(bt));
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
