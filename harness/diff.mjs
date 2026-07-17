// Mend — pixel diff vs baseline (gate 2). `npm run diff [-- --round N]`.
// Renders each route through the SAME deterministic path as baseline, runs
// pixelmatch, writes diff PNGs + a machine-readable summary. Changed pixels
// outside masked regions must be 0 (RUBRIC gate 2, threshold 0.1).

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { arg, startServer, serverBase, listRoutes, loadMasks, newContext, chromium, shoot, ROOT } from "./lib.mjs";

const dir = arg("dir", "target");
const round = arg("round", "latest");
const baselineDir = resolve(ROOT, arg("baseline", "runs/baseline"));
const outDir = resolve(ROOT, `runs/${round}/diff`);
const shotDir = resolve(ROOT, `runs/${round}/shot`);
mkdirSync(outDir, { recursive: true });
mkdirSync(shotDir, { recursive: true });

const THRESHOLD = 0.1; // pixelmatch per-pixel sensitivity

const server = await startServer(dir);
const base = serverBase(server);
const routes = listRoutes(dir, arg("routes"));
const masks = loadMasks();

const browser = await chromium.launch();
const context = await newContext(browser);

const results = [];
for (const route of routes) {
  const key = route.replace(/^\//, "").replace(/\.html$/, "").replace(/\//g, "__");
  const shotPath = resolve(shotDir, key + ".png");
  await shoot(context, base, route, shotPath, masks);

  const basePath = resolve(baselineDir, key + ".png");
  if (!existsSync(basePath)) {
    results.push({ route, error: "no baseline", changed: null });
    continue;
  }
  const a = PNG.sync.read(readFileSync(basePath));
  const b = PNG.sync.read(readFileSync(shotPath));
  if (a.width !== b.width || a.height !== b.height) {
    results.push({
      route, changed: -1, dimsChanged: true,
      baseDims: `${a.width}x${a.height}`, newDims: `${b.width}x${b.height}`,
    });
    console.error(`diff ${route}: DIMENSIONS CHANGED ${a.width}x${a.height} -> ${b.width}x${b.height}`);
    continue;
  }
  const { width, height } = a;
  const out = new PNG({ width, height });
  const changed = pixelmatch(a.data, b.data, out.data, width, height, {
    threshold: THRESHOLD, includeAA: false,
  });
  writeFileSync(resolve(outDir, key + ".png"), PNG.sync.write(out));
  results.push({ route, changed, total: width * height });
  console.error(`diff ${route}: ${changed} changed px`);
}

await browser.close();
server.close();

const totalChanged = results.reduce((n, r) => n + (r.changed > 0 ? r.changed : 0), 0);
const anyDims = results.some((r) => r.dimsChanged);
const pass = totalChanged === 0 && !anyDims && !results.some((r) => r.error);
const summary = { round, threshold: THRESHOLD, pass, totalChanged, routes: results };
mkdirSync(resolve(ROOT, `runs/${round}`), { recursive: true });
writeFileSync(resolve(ROOT, `runs/${round}/diff-summary.json`), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(pass ? 0 : 1);
