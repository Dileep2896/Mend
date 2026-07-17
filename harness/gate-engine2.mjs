// Mend — gate 4: IBM Equal Access, an independent rule engine (NOT axe, NOT
// Lighthouse which is axe underneath). Counts `violation`-level results per
// route. In a fix round the loop passes --baseline <round-start count>; the gate
// passes iff the current total is non-increasing (RUBRIC gate 4).
//
// Usage: node harness/gate-engine2.mjs --dir target [--routes a.html,b.html]
//        [--baseline N] [--round latest]

import express from "express";
import { getCompliance, close } from "accessibility-checker";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { arg, listRoutes, ROOT } from "./lib.mjs";

const dir = arg("dir", "target");
const round = arg("round", "latest");
const baseline = arg("baseline") != null ? Number(arg("baseline")) : null;

const app = express();
app.use(express.static(resolve(ROOT, dir)));
const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const routes = listRoutes(resolve(ROOT, dir), arg("routes"));

const perRoute = [];
let total = 0;
for (const route of routes) {
  const label = route.replace(/[^\w.-]/g, "_");
  try {
    const res = await getCompliance(`${base}/${route.replace(/^\//, "")}`, label);
    const counts = res.report?.summary?.counts ?? {};
    const v = counts.violation ?? 0;
    total += v;
    perRoute.push({ route, violation: v, potentialviolation: counts.potentialviolation ?? 0 });
    console.error(`engine2 ${route}: ${v} violation(s)`);
  } catch (e) {
    perRoute.push({ route, error: String(e).slice(0, 160) });
    console.error(`engine2 ${route}: ERROR ${String(e).slice(0, 120)}`);
  }
}
try { await close(); } catch {}
server.close();

const pass = baseline == null ? true : total <= baseline;
const summary = {
  gate: "engine2", engine: "IBM Equal Access", round,
  total, baseline, pass, perRoute,
};
mkdirSync(resolve(ROOT, `runs/${round}`), { recursive: true });
writeFileSync(resolve(ROOT, `runs/${round}/engine2.json`), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ gate: "engine2", total, baseline, pass }, null, 2));
console.log(
  baseline == null
    ? `GATE 4 (engine2): ${total} violation(s) across ${routes.length} route(s) [no baseline — report only]`
    : pass
      ? `GATE 4 PASS: engine2 ${total} <= baseline ${baseline}`
      : `GATE 4 FAIL: engine2 ${total} > baseline ${baseline} (a fix increased independent-engine violations)`,
);
process.exit(pass ? 0 : 1);
