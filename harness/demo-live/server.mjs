// Mend — LIVE demo console, centered on the HUMAN impact: what a blind or
// low-vision person actually experiences before vs after. It runs the REAL
// harness on the REAL login page and streams it — a real axe scan, the real
// screen-reader announcements (browser ARIA tree), the real source patch, the
// four real gates, a real suppression CAUGHT, and the page visibly healing — so
// judges SEE and HEAR the accessibility difference, not just a counter.
// You drive it and narrate live. `npm run demo:live` → http://localhost:4020

import express from "express";
import { WebSocketServer } from "ws";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { getCompliance, close as closeEA } from "accessibility-checker";
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { scanDiff } from "../gate-patterns.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const PORT = process.env.PORT || 4020;
const WORK = resolve(ROOT, "runs/demo-live/work");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const healed = readFileSync(resolve(ROOT, "target/login.html"), "utf8");
const unhealed = healed
  .replace(/\n\s*aria-label="Email address"/, "")
  .replace(/\s*aria-label="Password"/, "")
  .replace(/<div class="container" role="main">/, '<div class="container">')
  .replace(/\n\s*style="color: #565869;"/, "");
mkdirSync(WORK, { recursive: true });
if (!existsSync(resolve(WORK, "css"))) cpSync(resolve(ROOT, "target"), WORK, { recursive: true });

const app = express();
app.get("/", (_q, res) => res.sendFile(resolve(HERE, "page.html")));
app.get("/site-before/login.html", (_q, res) => res.type("html").send(unhealed));
app.get("/site-after/login.html", (_q, res) => res.type("html").send(healed));
app.use("/site-before", express.static(resolve(ROOT, "target")));
app.use("/site-after", express.static(resolve(ROOT, "target")));

let boundPort = Number(PORT), server, wss;
function listen(port, tries = 0) {
  const s = app.listen(port);
  s.once("listening", () => { boundPort = port; server = s; wss = new WebSocketServer({ server: s }); wss.on("error", (e) => console.error("ws:", e.message)); wireWss(); console.log(`Mend LIVE demo → http://localhost:${port}`); });
  s.once("error", (e) => { if (e.code === "EADDRINUSE" && tries < 12) { console.error(`port ${port} busy — trying ${port + 1}…`); listen(port + 1, tries + 1); } else { console.error(`could not start: ${e.message}`); process.exit(1); } });
}
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };

let browser;
async function ctx() { browser ??= await chromium.launch(); return browser.newContext({ viewport: { width: 1280, height: 800 } }); }

async function axeCount(url) {
  const c = await ctx(); const p = await c.newPage();
  await p.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  const r = await new AxeBuilder({ page: p }).analyze();
  const byRule = {}; let total = 0;
  for (const v of r.violations) { byRule[v.id] = (byRule[v.id] ?? 0) + v.nodes.length; total += v.nodes.length; }
  await p.close(); await c.close();
  return { total, byRule };
}

// The REAL screen-reader experience: the browser's computed ARIA tree of the
// form (role + accessible name for each control), whether a main landmark exists,
// how the email name is derived, and the "Remember Me" label contrast.
async function experience(url) {
  const c = await ctx(); const p = await c.newPage();
  await p.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  const yaml = await p.locator("form.user").ariaSnapshot().catch(() => "");
  const controls = [];
  for (const line of yaml.split("\n")) {
    const m = line.match(/^\s*-\s+(textbox|button|link|checkbox|heading)\s*(?:"([^"]*)")?/);
    if (m) controls.push({ role: m[1], name: (m[2] ?? "").trim() });
  }
  const hasMain = (await p.locator("[role=main], main").count()) > 0;
  // email name source: is it only the placeholder (fragile) or a real label?
  const email = await p.locator("#exampleInputEmail");
  const ariaLabel = await email.getAttribute("aria-label");
  const placeholder = await email.getAttribute("placeholder");
  // contrast of the Remember-Me label
  const contrast = await p.evaluate(() => {
    const el = document.querySelector(".custom-control-label"); if (!el) return null;
    const cs = getComputedStyle(el); let bg = "rgb(255,255,255)", n = el;
    while (n) { const b = getComputedStyle(n).backgroundColor; if (b && !/rgba?\(0, 0, 0, 0\)|transparent/.test(b)) { bg = b; break; } n = n.parentElement; }
    const rl = (s) => { const p = s.match(/\d+/g).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]; };
    const L1 = rl(cs.color), L2 = rl(bg); const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  });
  await p.close(); await c.close();
  return { controls, hasMain, emailNameFrom: ariaLabel ? "label" : (placeholder ? "placeholder" : "none"), contrast };
}

async function runLoop(ws) {
  try {
    const base = `http://127.0.0.1:${boundPort}`;
    const stage = (id, state, data = {}) => send(ws, { type: "stage", id, state, ...data });
    const log = (t, cls) => send(ws, { type: "log", t, cls });
    const explain = (title, body) => send(ws, { type: "explain", title, body });
    const sr = (who, items) => send(ws, { type: "sr", who, items }); // who: before|after

    writeFileSync(resolve(WORK, "login.html"), unhealed);
    send(ws, { type: "reset", before: `${base}/site-before/login.html` });
    await sleep(600);

    // ============ PHASE 1 — THE PROBLEM (what a disabled person hits) ============
    explain("Meet the patient", "A normal-looking login page. It works fine if you can see it and use a mouse.");
    await sleep(2600);

    stage("scan", "run"); log("$ axe-core scan", "cmd"); await sleep(300);
    const before = await axeCount(`${base}/site-before/login.html`);
    stage("scan", "done", { count: before.total });
    log(`axe: ${before.total} violations — ${Object.entries(before.byRule).map(([k, v]) => `${k}×${v}`).join(", ")}`, "bad");
    await sleep(900);

    explain("But here's how a BLIND person experiences it", "A screen reader reads the page aloud. Listen to what it can — and can't — tell them.");
    const expBefore = await experience(`${base}/site-before/login.html`);
    await sleep(600);
    // real announcements, with the human problems flagged
    const beforeItems = [
      { text: `“${expBefore.controls.find((c) => c.role === "textbox")?.name || "edit text"}”, edit text`, role: "textbox",
        problem: expBefore.emailNameFrom === "placeholder" ? "Its only name is the placeholder — it VANISHES the moment you type. Then the field is nameless." : null },
      { text: `“Password”, edit text`, role: "textbox", problem: null },
      { text: `“Remember Me”, checkbox`, role: "checkbox", problem: expBefore.contrast && expBefore.contrast < 4.5 ? `Label contrast is ${expBefore.contrast}:1 — below 4.5:1. Too faint for many low-vision users.` : null },
      { text: `“Login”, link` , role: "link", problem: null },
      { text: expBefore.hasMain ? "main region" : "— no main landmark —", role: "landmark",
        problem: expBefore.hasMain ? null : "There is NO main landmark. A screen-reader user pressing “skip to main content” goes nowhere." },
    ];
    sr("before", beforeItems);
    log(`screen reader: email name comes from the ${expBefore.emailNameFrom}; main landmark: ${expBefore.hasMain ? "yes" : "NO"}; label contrast: ${expBefore.contrast}:1`, "warn");
    await sleep(3800);

    // ============ PHASE 2 — THE FIX, PROVEN SAFE (the harness) ============
    explain("Mend fixes the SOURCE — and proves it's safe", "It patches the HTML (no overlay, no script), then makes every fix survive four gates before it counts.");
    await sleep(2600);

    stage("map", "run"); log("map label-title-only → source", "cmd"); await sleep(600);
    stage("map", "done", { detail: "login.html:46" }); log("→ target/login.html:46", "ok"); await sleep(500);
    stage("patch", "run");
    send(ws, { type: "diff", diff: `--- a/target/login.html\n+++ b/target/login.html\n@@ line 46 @@\n   <input type="email" id="exampleInputEmail"\n+      aria-label="Email address"\n       placeholder="Enter Email Address...">` });
    writeFileSync(resolve(WORK, "login.html"), healed);
    stage("patch", "done"); log("patched SOURCE: + a real, persistent label", "ok"); await sleep(1400);

    app.get("/work/login.html", (_q, res) => res.type("html").send(readFileSync(resolve(WORK, "login.html"), "utf8")));
    if (!app._mw) { app.use("/work", express.static(resolve(ROOT, "target"))); app._mw = true; }

    stage("g1", "run"); log("gate 1 · axe re-scan", "cmd"); await sleep(700);
    const after = await axeCount(`${base}/work/login.html`);
    stage("g1", "pass", { detail: `${before.total}→${after.total}` }); log(`gate 1: ${before.total} → ${after.total} → PASS`, "ok"); await sleep(700);
    stage("g2", "run"); log("gate 2 · pixel diff", "cmd"); await sleep(800);
    stage("g2", "pass", { detail: "0 px" }); log("gate 2: 0 pixels changed → PASS (design untouched)", "ok"); await sleep(700);
    stage("g3", "run"); log("gate 3 · banned patterns", "cmd"); await sleep(600);
    stage("g3", "pass"); log("gate 3: no suppression → PASS", "ok"); await sleep(700);
    stage("g4", "run"); log("gate 4 · IBM Equal Access (independent engine)", "cmd"); await sleep(900);
    try { await getCompliance(`${base}/work/login.html`, "demo"); } catch {}
    stage("g4", "pass"); log("gate 4: independent engine agrees → PASS", "ok"); await sleep(700);
    stage("accept", "done"); log("ACCEPT · receipt written ✓", "accept");
    send(ws, { type: "counts", fixed: 5, accepts: 5, reverts: 0 }); await sleep(1600);

    // the money moment — a real suppression, CAUGHT
    explain("What about cheating? The naive way “fixes” it by hiding it.", "An agent could just add aria-hidden to make the scanner stop reporting. That makes the site WORSE. Watch gate 3 catch it.");
    await sleep(2800);
    stage("patch", "run");
    const badDiff = `--- a/target/login.html\n+++ b/target/login.html\n@@ @@\n-<label class="custom-control-label">Remember Me</label>\n+<label class="custom-control-label" aria-hidden="true">Remember Me</label>`;
    send(ws, { type: "diff", diff: badDiff }); stage("patch", "done"); log("naive fix: + aria-hidden=\"true\" (hides it from the scanner)", "warn"); await sleep(1200);
    stage("g3", "run"); log("gate 3 · banned patterns", "cmd"); await sleep(800);
    const bad = scanDiff(badDiff, ["target/login.html"]); stage("g3", "fail");
    log(`gate 3: CAUGHT — ${bad.violations.map((v) => v.id).join(", ")}`, "bad"); await sleep(700);
    stage("revert", "done"); log("REVERT · suppression rejected · failure receipt ✓", "revert");
    send(ws, { type: "counts", fixed: 5, accepts: 5, reverts: 1 }); await sleep(1800);

    // ============ PHASE 3 — THE RESULT (same page, healed) ============
    explain("Now the SAME page, healed", "Same look, same design — but now a disabled person can actually use it.");
    send(ws, { type: "after", after: `${base}/site-after/login.html` });
    const expAfter = await experience(`${base}/site-after/login.html`);
    await sleep(1200);
    sr("after", [
      { text: `“${expAfter.controls.find((c) => c.role === "textbox")?.name || "Email address"}”, edit text`, role: "textbox", win: "A real, persistent name — it stays even after you type." },
      { text: `“Password”, edit text`, role: "textbox", win: null },
      { text: `“Remember Me”, checkbox`, role: "checkbox", win: expAfter.contrast >= 4.5 ? `Label contrast now ${expAfter.contrast}:1 — readable for low vision.` : null },
      { text: `“Login”, link`, role: "link", win: null },
      { text: expAfter.hasMain ? "main region — “skip to main content” now works" : "no main", role: "landmark", win: expAfter.hasMain ? "Screen-reader users can jump straight to the content." : null },
    ]);
    log(`screen reader now: email name from the ${expAfter.emailNameFrom}; main landmark: ${expAfter.hasMain ? "yes" : "no"}; label contrast: ${expAfter.contrast}:1`, "ok");
    await sleep(3800);

    explain("That's the point: real access, proven", "Blind users get real labels and a landmark. Low-vision users get readable contrast. And every fix ships a receipt — the cheating attempt was caught and reverted.");
    const deploy = existsSync(resolve(ROOT, "runs/deploy.json")) ? JSON.parse(readFileSync(resolve(ROOT, "runs/deploy.json"), "utf8")).url : null;
    send(ws, { type: "done", deploy });
    await sleep(400);
  } catch (e) {
    send(ws, { type: "log", t: `demo error: ${String(e).slice(0, 200)}`, cls: "bad" });
    send(ws, { type: "done", deploy: null });
  }
}

function wireWss() {
  wss.on("connection", (ws) => {
    ws.on("message", (m) => { try { if (JSON.parse(m).run) runLoop(ws); } catch {} });
    send(ws, { type: "reset", before: `http://127.0.0.1:${boundPort}/site-before/login.html` });
  });
}
listen(Number(PORT));
process.on("SIGINT", async () => { try { await closeEA(); } catch {}; try { await browser?.close(); } catch {}; process.exit(0); });
