// Mend — capture pixel baselines for every route. `npm run baseline`.
// Screenshots go to runs/baseline/<route>.png through the deterministic renderer.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { arg, startServer, serverBase, listRoutes, loadMasks, newContext, chromium, shoot, ROOT } from "./lib.mjs";

const dir = arg("dir", "target");
const outDir = resolve(ROOT, arg("out", "runs/baseline"));
mkdirSync(outDir, { recursive: true });

const server = await startServer(dir);
const base = serverBase(server);
const routes = listRoutes(dir, arg("routes"));
const masks = loadMasks();

const browser = await chromium.launch();
const context = await newContext(browser);
for (const route of routes) {
  const out = resolve(outDir, route.replace(/^\//, "").replace(/\.html$/, "").replace(/\//g, "__") + ".png");
  await shoot(context, base, route, out, masks);
  console.error(`baseline ${route}`);
}
await browser.close();
server.close();
console.log(`baselines written to ${outDir} (${routes.length} routes)`);
