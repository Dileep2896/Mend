// Mend — live dashboard (M5). express + ws. Renders state from runs/ + receipts/;
// it never owns state. Watches receipts/ and runs/ and pushes over WebSocket so
// the counter, gate lights, and receipt browser update as the loop writes.
// `npm run dashboard` → http://localhost:4000

import express from "express";
import { WebSocketServer } from "ws";
import { readFileSync, existsSync, readdirSync, watch, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const PORT = process.env.PORT || 4000;

function readJSON(p, fallback = null) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; }
}

// Aggregate everything the UI needs from files on disk.
function buildState() {
  const receiptsDir = resolve(ROOT, "receipts");
  const receipts = [];
  if (existsSync(receiptsDir)) {
    for (const name of readdirSync(receiptsDir).sort()) {
      const rj = resolve(receiptsDir, name, "receipt.json");
      if (!existsSync(rj)) continue;
      const r = readJSON(rj);
      if (!r) continue;
      const axeBefore = readJSON(resolve(receiptsDir, name, "axe-before.json"));
      const axeAfter = readJSON(resolve(receiptsDir, name, "axe-after.json"));
      receipts.push({
        dir: name,
        seq: r.seq, round: r.round, ruleId: r.ruleId, impact: r.impact,
        selector: r.selector, source: r.source, decision: r.decision,
        gates: r.gates ?? [], critic: r.critic ?? null, commit: r.commit,
        models: r.models ?? null, estCostUsd: r.estCostUsd ?? null,
        beforeCount: axeBefore?.count ?? null, afterCount: axeAfter?.count ?? null,
        hasBefore: existsSync(resolve(receiptsDir, name, "before.png")),
        hasAfter: existsSync(resolve(receiptsDir, name, "after.png")),
        hasDiff: existsSync(resolve(receiptsDir, name, "diff.png")),
      });
    }
  }

  const seed = readJSON(resolve(ROOT, "runs/000-before/axe.json"));
  const seedTotal = seed?.totals?.violations ?? null;

  const accepts = receipts.filter((r) => r.decision === "accept");
  const reverts = receipts.filter((r) => r.decision === "revert");
  // violation nodes fixed & verified = sum(before-after) over accepted receipts
  const fixed = accepts.reduce((n, r) => n + Math.max(0, (r.beforeCount ?? 0) - (r.afterCount ?? 0)), 0);

  return {
    seedTotal,
    fixed,
    accepts: accepts.length,
    reverts: reverts.length,
    engines: { primary: "axe-core", second: "IBM Equal Access" },
    receipts,
    updatedAt: new Date().toISOString(),
  };
}

const app = express();
app.use("/receipts", express.static(resolve(ROOT, "receipts")));
app.use("/runs", express.static(resolve(ROOT, "runs")));
app.get("/api/state", (_req, res) => res.json(buildState()));
app.use(express.static(HERE));

const server = app.listen(PORT, () => console.log(`Mend dashboard on http://localhost:${PORT}`));
const wss = new WebSocketServer({ server });
function broadcast() {
  const msg = JSON.stringify({ type: "state", state: buildState() });
  for (const c of wss.clients) if (c.readyState === 1) c.send(msg);
}
wss.on("connection", (ws) => ws.send(JSON.stringify({ type: "state", state: buildState() })));

// Debounced watch on receipts/ and runs/.
let t = null;
const nudge = () => { clearTimeout(t); t = setTimeout(broadcast, 250); };
for (const d of ["receipts", "runs"]) {
  const p = resolve(ROOT, d);
  if (existsSync(p)) { try { watch(p, { recursive: true }, nudge); } catch { watch(p, nudge); } }
}
