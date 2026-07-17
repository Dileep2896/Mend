// Mend — shared harness library: deterministic serving + rendering.
// Determinism pass (RUBRIC gate 2 / RISKS R4): fixed viewport, locale, timezone;
// animations & transitions frozen; fonts awaited; network idle; dynamic regions
// masked (mask.json, each with a logged reason). Baselines and diffs render
// through the SAME path so a no-change run produces zero moved pixels.

import express from "express";
import { chromium } from "playwright";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const HARNESS_DIR = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HARNESS_DIR, "..");
export const VIEWPORT = { width: 1280, height: 800 };

export function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const next = process.argv[i + 1];
  // a valueless flag must not swallow the following flag (--a --b => a has no value)
  if (next === undefined || /^--[a-zA-Z]/.test(next)) return fallback;
  return next;
}

// Kills all motion so screenshots are frame-stable.
export const FREEZE_CSS = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
  caret-color: transparent !important;
}
html { scroll-behavior: auto !important; }
`;

export function startServer(dir) {
  const app = express();
  app.use(express.static(resolve(dir)));
  return new Promise((res) => {
    const s = app.listen(0, "127.0.0.1", () => res(s));
  });
}

export function serverBase(server) {
  return `http://127.0.0.1:${server.address().port}`;
}

export function listRoutes(dir, routesArg) {
  if (routesArg) return routesArg.split(",").map((r) => r.trim());
  return readdirSync(resolve(dir)).filter((f) => f.endsWith(".html")).sort();
}

export function loadMasks() {
  const p = resolve(ROOT, "harness/mask.json");
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, "utf8")).routes ?? {};
}

export async function newContext(browser) {
  return browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    reducedMotion: "reduce",
  });
}

export { chromium };

// Render a route deterministically and screenshot it (full page). Dynamic regions
// from mask.json for this route are painted a flat colour in BOTH baseline and
// diff passes, so they never register as changed pixels.
export async function shoot(context, base, route, outPath, masks) {
  const page = await context.newPage();
  const url = `${base}/${route.replace(/^\//, "")}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(150); // settle after freeze
  // Normalize the route key so masks match regardless of "/index.html" vs
  // "index.html" vs "index" (a mismatch would silently unmask the Chart.js
  // canvases and false-fail gate 2).
  const norm = route.replace(/^\//, "");
  const maskEntry = masks[route] ?? masks[norm] ?? masks[norm.replace(/\.html$/, "")] ?? masks[norm + ".html"];
  const maskSelectors = (maskEntry?.selectors ?? []).map((s) => page.locator(s));
  await page.screenshot({
    path: outPath,
    fullPage: true,
    animations: "disabled",
    mask: maskSelectors,
    maskColor: "#FF00FF",
    timeout: 30000,
  });
  await page.close();
}
