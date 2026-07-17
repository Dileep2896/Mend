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

// Deploy a SET of healed pages as a cross-linked mini-site. Links between deployed
// pages are rewritten to their live URLs; links to pages we don't deploy (the app
// dashboard, auth submits) are neutralized to "#" so nothing 404s.
const SITE_BASE = "https://sites.withzero.ai";
const PAGES = [
  { route: "login.html", slug: "mend-healed-login-demo" },
  { route: "forgot-password.html", slug: "mend-healed-forgot-demo" },
];
const slugFor = Object.fromEntries(PAGES.map((p) => [p.route, p.slug]));

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
const cssPath = resolve(ROOT, "target/css/sb-admin-2.min.css");
const cssInline = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : "";

// accessible provenance badge (real text, high contrast — must not itself add a
// violation). Honest wording: "fixed and verified", never "compliant".
const badge = `<div role="contentinfo" style="position:fixed;left:12px;bottom:12px;z-index:9999;` +
  `font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.4;` +
  `background:#0d131a;color:#eafff9;border:1px solid #33c9b0;border-radius:8px;padding:8px 12px;` +
  `box-shadow:0 6px 18px rgba(0,0,0,.4)">` +
  `<span style="color:#74f0d8">✓ Healed by Mend</span> — ${fixed} accessibility ${fixed === 1 ? "fix" : "fixes"} verified through four gates` +
  `</div>`;

// Build a self-contained (<500KB) page: inline CSS, drop external font/vendor/js,
// and rewrite internal links — deployed siblings → their live URL, everything else
// (app dashboard, auth submits) → "#" so nothing 404s.
function buildPage(route) {
  let html = readFileSync(resolve(ROOT, "target", route), "utf8");
  if (cssInline) html = html.replace(/<link href="css\/sb-admin-2\.min\.css" rel="stylesheet">/, `<style>${cssInline}</style>`);
  html = html
    .replace(/<link href="vendor\/fontawesome-free[^>]*>/g, "")
    .replace(/<link[^>]*fonts\.googleapis[^>]*>/g, "")
    .replace(/<script src="vendor[^"]*"><\/script>/g, "")
    .replace(/<script src="js[^"]*"><\/script>/g, "");
  // rewrite href="X.html" (and ./X.html)
  html = html.replace(/href="\.?\/?([\w-]+\.html)"/g, (m, target) =>
    slugFor[target] ? `href="${SITE_BASE}/${slugFor[target]}"` : `href="#" data-demo-nolink="${target}" title="Not part of this demo deploy"`);
  html = html.replace("</body>", `${badge}\n<!-- Healed by Mend: fixed & verified accessibility violations through four gates + an independent critic. -->\n</body>`);
  return html;
}

function deploy(content, slug) {
  const payloadPath = resolve(ROOT, "runs/zero-payload.json");
  writeFileSync(payloadPath, JSON.stringify({ content, slug, ttlHours: 336 }));
  const out = execFileSync("npx", ["-y", "@zeroxyz/cli@latest", "fetch", "https://host.withzero.ai/run",
    "-X", "POST", "-d", `@${payloadPath}`, "--max-pay", "0", "--json"],
    { cwd: ROOT, maxBuffer: 20 * 1024 * 1024, timeout: 180000 }).toString();
  const m = out.match(/\{[\s\S]*\}/g);
  for (let i = (m?.length ?? 0) - 1; i >= 0; i--) { try { const j = JSON.parse(m[i]); if (j.body?.url) return j; } catch {} }
  throw new Error(`no URL from Zero: ${out.slice(0, 300)}`);
}

mkdirSync(resolve(ROOT, "runs"), { recursive: true });
const deployed = [];
for (const { route, slug } of PAGES) {
  const html = buildPage(route);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  if (Buffer.byteLength(html) > 500 * 1024) { console.error(`${route}: ${kb}KB > 500KB limit — skipping`); continue; }
  console.error(`deploying healed ${route} (${kb}KB) via Zero, --max-pay 0…`);
  try {
    const j = deploy(html, slug);
    deployed.push({ route, slug, url: j.body.url, paidUsdc: j.payment?.amount ?? "?", expiresAt: j.body.expiresAt });
    console.error(`  ✓ ${j.body.url} (paid ${j.payment?.amount} USDC)`);
  } catch (e) {
    console.error(`  deploy failed for ${route} (no spend — --max-pay 0): ${e.message.slice(0, 200)}`);
  }
}
if (!deployed.length) { console.error("nothing deployed"); process.exit(1); }

const primary = deployed.find((d) => d.route === "login.html") ?? deployed[0];
const result = { url: primary.url, fixed, paidUsdc: primary.paidUsdc, deployedVia: "zero:host-site (free)", pages: deployed };
writeFileSync(resolve(ROOT, "runs/deploy.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
console.log(`\n  ✓ healed site is LIVE (paid 0 USDC), ${deployed.length} cross-linked pages: ${primary.url}\n`);
