// Mend — snapshot round-start state so the gates have a "before" to compare
// against. Writes into runs/<round>/: before-axe.json, before-engine2.json,
// target-rule.txt, boxes-before.json (for gate 2b geometry stability).
//
// Usage: node harness/round-start.mjs --round r1 --routes login.html --rule label-title-only
//        [--skip-engine2]

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { arg, startServer, serverBase, newContext, chromium, FREEZE_CSS, ROOT } from "./lib.mjs";

const round = arg("round", "latest");
const routes = arg("routes");
const rule = arg("rule", "");
const roundDir = resolve(ROOT, `runs/${round}`);
mkdirSync(roundDir, { recursive: true });

// axe before
const scanArgs = ["--dir", "target", "--out", `runs/${round}/before-axe.json`];
if (routes) scanArgs.push("--routes", routes);
execFileSync("node", [resolve(ROOT, "harness/scan.mjs"), ...scanArgs], { cwd: ROOT, stdio: "ignore" });

// engine2 before
if (!process.argv.includes("--skip-engine2")) {
  const e2 = ["--dir", "target", "--round", `${round}-before`];
  if (routes) e2.push("--routes", routes);
  const out = execFileSync("node", [resolve(ROOT, "harness/gate-engine2.mjs"), ...e2], { cwd: ROOT }).toString();
  const m = out.match(/\{[\s\S]*\}/g);
  let total = null;
  if (m) for (let i = m.length - 1; i >= 0; i--) { try { total = JSON.parse(m[i]).total; break; } catch {} }
  writeFileSync(resolve(roundDir, "before-engine2.json"), JSON.stringify({ total }, null, 2));
}

writeFileSync(resolve(roundDir, "target-rule.txt"), rule);

// boxes-before for gate 2b, first route only (contrast rounds are single-element)
const firstRoute = (routes ? routes.split(",")[0] : "index.html").trim();
const server = await startServer(resolve(ROOT, "target"));
const base = serverBase(server);
const browser = await chromium.launch();
const context = await newContext(browser);
const page = await context.newPage();
await page.goto(`${base}/${firstRoute.replace(/^\//, "")}`, { waitUntil: "networkidle" });
await page.addStyleTag({ content: FREEZE_CSS });
const boxes = await page.evaluate(() => {
  const out = {}; let i = 0;
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    out[`${el.tagName.toLowerCase()}#${i++}`] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  }
  return out;
});
await browser.close();
server.close();
writeFileSync(resolve(roundDir, "boxes-before.json"), JSON.stringify(boxes));

console.log(`round-start ${round}: rule='${rule}', routes='${routes ?? "all"}', before-state captured`);
