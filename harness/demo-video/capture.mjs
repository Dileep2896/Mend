// Mend demo — capture one 1920x1080 scene image per narration segment from the
// REAL system: the live dashboard, the presentation slides (title / architecture /
// close), the naive Act-1 baseline, an accepted + a reverted receipt, and the live
// Zero-deployed page. Output: runs/demo-video/scenes/<id>.png
//
// Usage: node harness/demo-video/capture.mjs

import { chromium } from "playwright";
import express from "express";
import { WebSocketServer } from "ws";
import { mkdirSync, existsSync, copyFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const SCENES = resolve(ROOT, "runs/demo-video/scenes");
mkdirSync(SCENES, { recursive: true });
const W = 1920, H = 1080;

// start the dashboard server in-process
const { default: dashApp } = await (async () => {
  // reuse the dashboard by importing its buildState via a fresh express app
  return { default: null };
})();

// minimal dashboard host (same static + api as dashboard/server.mjs)
const app = express();
app.use("/receipts", express.static(resolve(ROOT, "receipts")));
app.use("/runs", express.static(resolve(ROOT, "runs")));
app.use(express.static(resolve(ROOT, "dashboard")));
// inline state endpoint (mirror of dashboard/server.mjs buildState, trimmed)
import { readdirSync } from "node:fs";
function readJSON(p, f = null) { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return f; } }
function buildState() {
  const rd = resolve(ROOT, "receipts"); const receipts = [];
  if (existsSync(rd)) for (const name of readdirSync(rd).sort()) {
    const r = readJSON(resolve(rd, name, "receipt.json")); if (!r) continue;
    const ab = readJSON(resolve(rd, name, "axe-before.json")); const aa = readJSON(resolve(rd, name, "axe-after.json"));
    receipts.push({ dir: name, seq: r.seq, round: r.round, ruleId: r.ruleId, impact: r.impact, selector: r.selector,
      source: r.source, decision: r.decision, gates: r.gates ?? [], critic: r.critic ?? null, commit: r.commit, models: r.models ?? null,
      beforeCount: ab?.count ?? null, afterCount: aa?.count ?? null,
      hasBefore: existsSync(resolve(rd, name, "before.png")), hasAfter: existsSync(resolve(rd, name, "after.png")), hasDiff: existsSync(resolve(rd, name, "diff.png")) });
  }
  const seed = readJSON(resolve(ROOT, "runs/000-before/axe.json"));
  const accepts = receipts.filter((r) => r.decision === "accept");
  const fixed = accepts.reduce((n, r) => n + Math.max(0, (r.beforeCount ?? 0) - (r.afterCount ?? 0)), 0);
  const deploy = readJSON(resolve(ROOT, "runs/deploy.json"));
  return { seedTotal: seed?.totals?.violations ?? null, fixed, accepts: accepts.length, reverts: receipts.filter((r) => r.decision === "revert").length,
    engines: { primary: "axe-core", second: "IBM Equal Access" }, deploy: deploy ? { url: deploy.url, paidUsdc: deploy.paidUsdc } : null, receipts };
}
app.get("/api/state", (_q, r) => r.json(buildState()));
const server = await new Promise((res) => { const s = app.listen(0, "127.0.0.1", () => res(s)); });
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => ws.send(JSON.stringify({ type: "state", state: buildState() })));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 });

async function shotDashboard(name, clickSelector) {
  const p = await ctx.newPage();
  await p.goto(base, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  if (clickSelector) { const el = p.locator(clickSelector).first(); if (await el.count()) { await el.click(); await p.waitForTimeout(900); } }
  await p.screenshot({ path: resolve(SCENES, `${name}.png`) });
  await p.close();
}
async function shotSlide(name, slideIdx) {
  const p = await ctx.newPage();
  await p.goto(`file://${resolve(ROOT, "mend-presentation.html")}`, { waitUntil: "networkidle" });
  await p.evaluate((n) => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Home" })), null);
  await p.waitForTimeout(200);
  // navigate to slide via repeated ArrowRight
  for (let i = 0; i < slideIdx; i++) { await p.keyboard.press("ArrowRight"); await p.waitForTimeout(120); }
  await p.waitForTimeout(1200);
  await p.screenshot({ path: resolve(SCENES, `${name}.png`) });
  await p.close();
}
async function shotUrl(name, url) {
  const p = await ctx.newPage();
  try { await p.goto(url, { waitUntil: "networkidle", timeout: 30000 }); await p.waitForTimeout(1200); await p.screenshot({ path: resolve(SCENES, `${name}.png`) }); }
  catch (e) { console.error(`  ${name}: url capture failed (${String(e).slice(0, 60)})`); }
  await p.close();
}

// scene captures
await shotSlide("title", 0);
await shotSlide("diagram", 6);   // architecture slide
await shotSlide("close", 10);
await shotDashboard("dashboard");
await shotDashboard("gates");
await shotDashboard("critic", ".entry:has-text('label-title-only')");
await shotDashboard("revert", ".entry.rev");
await shotDashboard("receipt", ".entry:has-text('color-contrast')");
await shotDashboard("deploy");
await shotUrl("deploy_live", (readJSON(resolve(ROOT, "runs/deploy.json"))?.url) || "https://sites.withzero.ai/mend-healed-login-demo");

// reuse existing assets
const naive = resolve(ROOT, "receipts/naive-baseline/naive-after.png");
if (existsSync(naive)) copyFileSync(naive, resolve(SCENES, "naive.png"));

await browser.close();
server.close();
console.log(`scenes captured → runs/demo-video/scenes/`);
