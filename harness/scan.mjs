// Mend — axe-core scanner (gate 1 + seed scans + candidate evaluation).
// Usage:
//   node harness/scan.mjs --dir <static-root> [--routes a.html,b.html] [--out out.json] [--base http://host]
// With --dir, an ephemeral express static server is started for the scan.
// Routes default to every *.html at the top of --dir (or "/" for --base).
// Output: { scannedAt, base, routes: [{route, violationCount, violations:[...]}],
//           totals: { violations, byRule, byImpact, ruleClasses } }

import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import express from "express";
import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const dir = arg("dir");
const baseArg = arg("base");
const out = arg("out");
if (!dir && !baseArg) {
  console.error("need --dir <static-root> or --base <url>");
  process.exit(2);
}

let server = null;
let base = baseArg;
if (dir) {
  const app = express();
  app.use(express.static(resolve(dir)));
  server = await new Promise((res) => {
    const s = app.listen(0, "127.0.0.1", () => res(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
}

const routes = arg("routes")
  ? arg("routes").split(",").map((r) => r.trim())
  : dir
    ? readdirSync(resolve(dir)).filter((f) => f.endsWith(".html")).sort()
    : ["/"];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  locale: "en-US",
  timezoneId: "America/Los_Angeles",
});

const results = [];
for (const route of routes) {
  const url = `${base}/${route.replace(/^\//, "")}`;
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    const axe = await new AxeBuilder({ page }).analyze();
    results.push({
      route,
      violationCount: axe.violations.reduce((n, v) => n + v.nodes.length, 0),
      violations: axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          html: n.html,
          failureSummary: n.failureSummary,
        })),
      })),
    });
    console.error(`scanned ${route}: ${results.at(-1).violationCount} violation nodes`);
  } catch (e) {
    results.push({ route, error: String(e) });
    console.error(`ERROR ${route}: ${e}`);
  } finally {
    await page.close();
  }
}

await browser.close();
if (server) server.close();

const byRule = {};
const byImpact = {};
for (const r of results) {
  for (const v of r.violations ?? []) {
    byRule[v.id] = (byRule[v.id] ?? 0) + v.nodes.length;
    byImpact[v.impact] = (byImpact[v.impact] ?? 0) + v.nodes.length;
  }
}
const summary = {
  scannedAt: new Date().toISOString(),
  base,
  routes: results,
  totals: {
    violations: Object.values(byRule).reduce((a, b) => a + b, 0),
    ruleClasses: Object.keys(byRule).length,
    byRule,
    byImpact,
  },
};

const json = JSON.stringify(summary, null, 2);
if (out) {
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(resolve(out), json);
  console.error(`wrote ${out}`);
}
console.log(
  JSON.stringify({ totals: summary.totals, perRoute: results.map((r) => ({ route: r.route, count: r.violationCount ?? "ERR" })) }, null, 2),
);
