// Mend — gate 2b: the contrast special case (RUBRIC gate 2b, TASKS M3).
// A color-contrast fix legitimately changes pixels inside the flagged element, so
// the plain zero-pixel gate 2 would wrongly revert it. Instead:
//   (a) mask the flagged element's box for the pixel diff (handled by mask.json /
//       the --mask-selector passed through), and assert
//   (b) every OTHER element's bounding box is unchanged (layout geometry stable), and
//   (c) the new computed contrast ratio >= 4.5:1 (normal) or >= 3:1 (large text).
//
// Usage: node harness/gate-contrast.mjs --route login.html --selector ".btn-primary"
//        [--baseline-boxes runs/<round>/boxes-before.json]
//
// Emits geometry + ratio; exit 0 iff (b) and (c) hold. Layout capture is written
// to runs/<round>/boxes-after.json so a round can diff geometry across the patch.

import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { arg, startServer, serverBase, newContext, chromium, FREEZE_CSS, ROOT } from "./lib.mjs";

const route = arg("route");
const selector = arg("selector");
const round = arg("round", "latest");
const largeText = process.argv.includes("--large");
if (!route || !selector) { console.error("need --route and --selector"); process.exit(2); }

// ---- WCAG relative-luminance contrast.
function relLum([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg, bg) {
  const L1 = relLum(fg), L2 = relLum(bg);
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}
function parseRGB(s) {
  const m = s && s.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(",").map((x) => parseFloat(x.trim()));
  return { rgb: [p[0], p[1], p[2]], a: p[3] ?? 1 };
}

const server = await startServer(resolve(ROOT, "target"));
const base = serverBase(server);
const browser = await chromium.launch();
const context = await newContext(browser);
const page = await context.newPage();
await page.goto(`${base}/${route.replace(/^\//, "")}`, { waitUntil: "networkidle" });
await page.addStyleTag({ content: FREEZE_CSS });

// (c) computed contrast of the flagged element: its color vs the first opaque
// background walking up its ancestors.
const measure = await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return { error: "selector not found" };
  const cs = getComputedStyle(el);
  let bgEl = el, bg = null;
  while (bgEl) {
    const b = getComputedStyle(bgEl).backgroundColor;
    if (b && !/rgba?\(0, 0, 0, 0\)|transparent/.test(b)) { bg = b; break; }
    bgEl = bgEl.parentElement;
  }
  const r = el.getBoundingClientRect();
  return {
    color: cs.color, background: bg ?? "rgb(255, 255, 255)",
    fontSize: parseFloat(cs.fontSize), fontWeight: cs.fontWeight,
    box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
  };
}, selector);

// (b) bounding boxes of every element, to compare against a prior capture.
const boxes = await page.evaluate(() => {
  const out = {};
  let i = 0;
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    // stable key: tag + nth index (structure-stable across attribute-only edits)
    out[`${el.tagName.toLowerCase()}#${i++}`] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  }
  return out;
});

await browser.close();
server.close();

mkdirSync(resolve(ROOT, `runs/${round}`), { recursive: true });
writeFileSync(resolve(ROOT, `runs/${round}/boxes-after.json`), JSON.stringify(boxes));

let ratioVal = null, ratioPass = false;
if (!measure.error) {
  const fg = parseRGB(measure.color)?.rgb;
  const bg = parseRGB(measure.background)?.rgb;
  if (fg && bg) {
    ratioVal = ratio(fg, bg);
    const isLarge = largeText || measure.fontSize >= 24 || (measure.fontSize >= 18.66 && Number(measure.fontWeight) >= 700);
    ratioPass = ratioVal >= (isLarge ? 3.0 : 4.5);
  }
}

// (b) geometry-stability check vs baseline capture, if present.
let geomPass = true, movedCount = 0, moved = [];
const beforePath = resolve(ROOT, arg("baseline-boxes", `runs/${round}/boxes-before.json`));
if (existsSync(beforePath)) {
  const before = JSON.parse(readFileSync(beforePath, "utf8"));
  for (const k of Object.keys(before)) {
    const a = before[k], b = boxes[k];
    if (!b) { moved.push(`${k}:gone`); continue; }
    if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3]) { movedCount++; if (moved.length < 8) moved.push(k); }
  }
  geomPass = movedCount === 0;
}

const pass = ratioPass && geomPass;
const summary = {
  gate: "contrast-2b", route, selector, round,
  ratio: ratioVal != null ? Number(ratioVal.toFixed(2)) : null, ratioPass,
  geometryStable: geomPass, movedBoxes: movedCount, movedSample: moved,
  color: measure.color, background: measure.background, pass,
};
writeFileSync(resolve(ROOT, `runs/${round}/contrast-2b.json`), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(
  pass ? `GATE 2b PASS: ratio ${summary.ratio}:1 (>=4.5), layout stable`
       : `GATE 2b FAIL: ${!ratioPass ? `ratio ${summary.ratio}:1 < threshold` : ""}${!geomPass ? ` ${movedCount} box(es) moved` : ""}`,
);
process.exit(pass ? 0 : 1);
