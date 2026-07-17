// Mend — the loop's closing act: the agent deploys the HEALED page to a
// shareable link, itself, via Zero (no human, no API keys). RUBRIC/pitch: "the
// cured patient ships itself."
//
// MONEY SAFETY: this ALWAYS passes --max-pay 0 to `zero fetch`, a hard $0 cap.
// Zero's free host-site capability settles at amount 0, so the deploy is free;
// if it ever tried to charge, the call fails instead of spending. No wallet
// funding is used. (One-time: `zero auth agent register` creates an empty
// anonymous wallet.)
//
// Usage: node harness/deploy-zero.mjs [--route login.html] [--slug mend-healed-...]
//        [--fixed N]   (violation count for the provenance badge)

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { arg, ROOT } from "./lib.mjs";

const route = arg("route", "login.html");
const slug = arg("slug", "mend-healed-login-demo");
const src = resolve(ROOT, "target", route);
if (!existsSync(src)) { console.error(`no such route: ${route}`); process.exit(2); }

// count accepted fixes for the badge (or take --fixed)
function acceptedFixes() {
  const rd = resolve(ROOT, "receipts");
  if (!existsSync(rd)) return 0;
  let n = 0;
  for (const d of readdirSync(rd)) {
    const p = resolve(rd, d, "receipt.json");
    if (existsSync(p)) { try { if (JSON.parse(readFileSync(p, "utf8")).decision === "accept") n++; } catch {} }
  }
  return n;
}
const fixed = arg("fixed") ? Number(arg("fixed")) : acceptedFixes();

// ---- make the healed page self-contained (< 500KB): inline the theme CSS, drop
// external font/vendor/js references (they don't exist at the deploy host).
let html = readFileSync(src, "utf8");
const cssPath = resolve(ROOT, "target/css/sb-admin-2.min.css");
if (existsSync(cssPath)) {
  html = html.replace(/<link href="css\/sb-admin-2\.min\.css" rel="stylesheet">/, `<style>${readFileSync(cssPath, "utf8")}</style>`);
}
html = html
  .replace(/<link href="vendor\/fontawesome-free[^>]*>/g, "")
  .replace(/<link[^>]*fonts\.googleapis[^>]*>/g, "")
  .replace(/<script src="vendor[^"]*"><\/script>/g, "")
  .replace(/<script src="js[^"]*"><\/script>/g, "");

// ---- accessible provenance badge (real text, high contrast — must not itself
// introduce a violation). Honest wording: "fixed and verified", never "compliant".
const badge = `<div role="contentinfo" style="position:fixed;left:12px;bottom:12px;z-index:9999;` +
  `font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.4;` +
  `background:#0d131a;color:#eafff9;border:1px solid #33c9b0;border-radius:8px;padding:8px 12px;` +
  `box-shadow:0 6px 18px rgba(0,0,0,.4)">` +
  `<span style="color:#74f0d8">✓ Healed by Mend</span> — ${fixed} accessibility ${fixed === 1 ? "fix" : "fixes"} verified through four gates` +
  `</div>`;
html = html.replace("</body>", `${badge}\n<!-- Healed by Mend: fixed & verified accessibility violations through four gates + an independent critic. -->\n</body>`);

const bytes = Buffer.byteLength(html);
if (bytes > 500 * 1024) { console.error(`healed page ${(bytes / 1024).toFixed(0)}KB exceeds Zero's 500KB free-host limit`); process.exit(2); }

// ---- deploy via Zero, hard-capped at $0.
mkdirSync(resolve(ROOT, "runs"), { recursive: true });
const payloadPath = resolve(ROOT, "runs/zero-payload.json");
writeFileSync(payloadPath, JSON.stringify({ content: html, slug, ttlHours: 336 }));

console.error(`deploying healed ${route} (${(bytes / 1024).toFixed(0)}KB) via Zero, --max-pay 0…`);
let out;
try {
  out = execFileSync("npx", ["-y", "@zeroxyz/cli@latest", "fetch", "https://host.withzero.ai/run",
    "-X", "POST", "-d", `@${payloadPath}`, "--max-pay", "0", "--json"],
    { cwd: ROOT, maxBuffer: 20 * 1024 * 1024, timeout: 180000 }).toString();
} catch (e) {
  console.error("deploy failed (no spend — --max-pay 0):", (e.stdout?.toString() ?? e.message).slice(0, 400));
  process.exit(1);
}
const j = (() => { const m = out.match(/\{[\s\S]*\}/g); for (let i = (m?.length ?? 0) - 1; i >= 0; i--) { try { return JSON.parse(m[i]); } catch {} } return null; })();
const url = j?.body?.url;
const paid = j?.payment?.amount ?? "?";
if (!url) { console.error("no URL returned:", out.slice(0, 300)); process.exit(1); }

const result = { url, slug, route, fixed, paidUsdc: paid, expiresAt: j.body.expiresAt, deployedVia: "zero:host-site (free)", runId: j.runId };
writeFileSync(resolve(ROOT, "runs/deploy.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
console.log(`\n  ✓ healed site is LIVE (paid ${paid} USDC): ${url}\n`);
