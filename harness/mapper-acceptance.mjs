// Mend — mapper acceptance test (TASKS.md M1 hard gate).
// Samples N violation nodes from a seed axe scan, runs the mapper, and verifies
// the returned source line actually contains the failing element. A map is
// "correct" iff the located line's opening tag shares the snippet's tag AND at
// least one stable attribute value (or unique literal text). Deterministic
// sampling (fixed stride) so the run is reproducible.
//
// Usage: node harness/mapper-acceptance.mjs --scan runs/000-before/axe.json --targetDir target [--n 10]

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mapViolationNode } from "./mapper.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const scan = JSON.parse(readFileSync(resolve(arg("scan", "runs/000-before/axe.json")), "utf8"));
const targetDir = resolve(arg("targetDir", "target"));
const N = Number(arg("n", 10));

// Flatten every violation node into (route, ruleId, html) records.
const nodes = [];
for (const r of scan.routes ?? []) {
  for (const v of r.violations ?? []) {
    for (const n of v.nodes ?? []) {
      if (n.html) nodes.push({ route: r.route, ruleId: v.id, html: n.html, target: n.target });
    }
  }
}

// Deterministic even-stride sample across the whole set.
const stride = Math.max(1, Math.floor(nodes.length / N));
const sample = [];
for (let i = 0; i < nodes.length && sample.length < N; i += stride) sample.push(nodes[i]);

function openTagOf(html) {
  const m = html.match(/<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>/);
  return m ? { tag: m[1].toLowerCase(), attrs: m[2] } : null;
}
function attrPairs(attrsRaw) {
  const out = {};
  const re = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(attrsRaw))) out[m[1].toLowerCase()] = m[3] ?? m[4];
  return out;
}

let correct = 0;
const rows = [];
for (const s of sample) {
  const routeFile = resolve(targetDir, s.route.replace(/^\//, "") || "index.html");
  let res;
  try {
    res = mapViolationNode({ routeFile, nodeHtml: s.html, target: s.target });
  } catch (e) {
    res = { blocked: true, reason: String(e) };
  }

  let ok = false;
  let detail = "";
  if (!res.blocked) {
    // Independent check: read a small context window (multi-line opening tags and
    // child text legitimately extend past lineStart..lineEnd) and confirm the
    // failing element truly lives here — same tag AND a shared discriminating
    // feature (stable attr value, full class list, or child text).
    const lines = readFileSync(routeFile, "utf8").split("\n");
    const lo = Math.max(0, res.lineStart - 2);
    const hi = Math.min(lines.length, res.lineEnd + 2);
    const region = lines.slice(lo, hi).join(" ");
    const snip = openTagOf(s.html);
    const want = snip ? attrPairs(snip.attrs) : {};
    const tagOk = snip && new RegExp(`<${snip.tag}(?=[\\s>/]|$)`, "i").test(region);
    const stable = ["id", "name", "href", "for", "aria-label", "alt", "title", "value", "type"];
    const attrOk = stable.some((k) => want[k] && region.includes(want[k]));
    const classStr = (want.class || "").trim();
    const classOk = classStr && region.includes(classStr);
    // truncation-aware child text (axe clips long snippets, dropping the closing "<")
    const textM = s.html.match(/>([^<>]{3,80})</) || s.html.match(/>([^<>]{3,80})\s*$/);
    const textOk = textM && region.includes(textM[1].trim());
    ok = Boolean(tagOk && (attrOk || classOk || textOk));
    detail = `${res.strategy} L${res.lineStart}-${res.lineEnd} conf=${res.confidence} on[${(res.matchedOn || "").toString().slice(0, 40)}]`;
  } else {
    detail = `BLOCKED: ${res.reason}`;
  }
  if (ok) correct++;
  rows.push({ route: s.route, rule: s.ruleId, ok, detail, html: s.html.slice(0, 70).replace(/\n/g, " ") });
}

console.log(`\nMapper acceptance — ${correct}/${sample.length} correct (gate needs >=8/10)\n`);
for (const r of rows) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.route} · ${r.rule}`);
  console.log(`        ${r.detail}`);
  console.log(`        ${r.html}`);
}
const pass = correct >= Math.ceil(sample.length * 0.8);
console.log(`\nRESULT: ${pass ? "GATE PASS" : "GATE FAIL"} (${correct}/${sample.length})`);
process.exit(pass ? 0 : 1);
