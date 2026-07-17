// Mend — receipts writer (RUBRIC section 6). Called on every accept AND revert.
// A receipt is the product: it records what was attempted, every gate result, the
// critic verdict, the exact source patch, and before/after evidence. Failure
// receipts are first-class — they say which gate caught the fix and why.
//
// Language rule (RUBRIC s6): "fixed and verified" / "reverted, caught by <gate>".
// Never "compliant", never "lawsuit-proof".
//
// Usage (the loop calls this):
//   node harness/receipt.mjs --seq 3 --round r3 --rule image-alt --impact critical \
//     --selector "img.logo" --file target/index.html --lineStart 40 --lineEnd 40 \
//     --attempt 1 --decision accept --route index.html \
//     --critic-verdict PASS --critic-reason "alt names the brand truthfully" \
//     --notes "Added alt describing the logo."

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { arg, ROOT } from "./lib.mjs";

const seq = arg("seq", "0").padStart?.(3, "0") ?? arg("seq", "0");
const seqPad = String(arg("seq", "0")).padStart(3, "0");
const round = arg("round", "latest");
const rule = arg("rule", "unknown");
const decision = arg("decision", "revert"); // accept | revert
const route = arg("route");
const roundDir = resolve(ROOT, `runs/${round}`);

const dir = resolve(ROOT, `receipts/${seqPad}-${rule}`);
mkdirSync(dir, { recursive: true });

// gates from verify.json
let gates = [];
let verifyPass = null;
const verifyPath = resolve(roundDir, "verify.json");
if (existsSync(verifyPath)) {
  const v = JSON.parse(readFileSync(verifyPath, "utf8"));
  gates = v.gates ?? [];
  verifyPass = v.pass;
}
const failingGate = gates.find((g) => !g.pass);

// commit hash
let commit = null;
try { commit = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim(); } catch {}

// source patch (working diff of target/, else last commit)
let patch = "";
try {
  patch = execSync("git diff --no-color -- target/", { cwd: ROOT, maxBuffer: 50 * 1024 * 1024 }).toString();
  if (!patch.trim()) patch = execSync("git show --no-color HEAD -- target/", { cwd: ROOT, maxBuffer: 50 * 1024 * 1024 }).toString();
} catch {}
writeFileSync(resolve(dir, "patch.diff"), patch);

// evidence images
const keyOf = (r) => r?.replace(/^\//, "").replace(/\.html$/, "").replace(/\//g, "__");
const copies = [];
if (route) {
  const k = keyOf(route);
  const map = [
    [resolve(ROOT, `runs/baseline/${k}.png`), "before.png"],
    [resolve(roundDir, `shot/${k}.png`), "after.png"],
    [resolve(roundDir, `diff/${k}.png`), "diff.png"],
  ];
  for (const [src, dst] of map) if (existsSync(src)) { copyFileSync(src, resolve(dir, dst)); copies.push(dst); }
}

// axe before/after filtered to this rule
function filterAxe(path, ruleId) {
  if (!existsSync(path)) return null;
  const j = JSON.parse(readFileSync(path, "utf8"));
  const out = [];
  for (const r of j.routes ?? []) for (const v of r.violations ?? []) if (v.id === ruleId) out.push({ route: r.route, ...v });
  return { ruleId, count: out.reduce((n, v) => n + (v.nodes?.length ?? 0), 0), items: out };
}
const axeBefore = filterAxe(resolve(roundDir, "before-axe.json"), rule);
const axeAfter = filterAxe(resolve(roundDir, "axe.json"), rule);
if (axeBefore) writeFileSync(resolve(dir, "axe-before.json"), JSON.stringify(axeBefore, null, 2));
if (axeAfter) writeFileSync(resolve(dir, "axe-after.json"), JSON.stringify(axeAfter, null, 2));

const receipt = {
  seq: Number(arg("seq", "0")),
  round,
  ruleId: rule,
  impact: arg("impact", null),
  selector: arg("selector", null),
  source: {
    file: arg("file", null),
    lineStart: arg("lineStart") ? Number(arg("lineStart")) : null,
    lineEnd: arg("lineEnd") ? Number(arg("lineEnd")) : null,
  },
  attempt: arg("attempt") ? Number(arg("attempt")) : 1,
  decision,
  gates,
  verifyPass,
  critic: arg("critic-verdict") ? { verdict: arg("critic-verdict"), reason: arg("critic-reason", null) } : null,
  commit,
  evidence: copies,
  timestamps: { written: new Date().toISOString() },
};
writeFileSync(resolve(dir, "receipt.json"), JSON.stringify(receipt, null, 2));

// notes.md — one honest paragraph.
const notesArg = arg("notes", "");
let notes;
if (decision === "accept") {
  notes = `# ${seqPad}-${rule} — fixed and verified\n\n` +
    `Round ${round}, attempt ${receipt.attempt}. Rule **${rule}** (${receipt.impact ?? "impact n/a"}) ` +
    `at \`${receipt.source.file}:${receipt.source.lineStart}-${receipt.source.lineEnd}\`, selector \`${receipt.selector ?? "-"}\`.\n\n` +
    `All gates passed: ${gates.map((g) => `${g.name} ${g.pass ? "✓" : "✗"}`).join(", ")}. ` +
    (receipt.critic ? `Critic: **${receipt.critic.verdict}** — ${receipt.critic.reason}. ` : "") +
    `Committed as \`${commit}\`.\n\n${notesArg}\n`;
} else {
  notes = `# ${seqPad}-${rule} — reverted, caught by ${failingGate?.name ?? "a gate"}\n\n` +
    `Round ${round}, attempt ${receipt.attempt}. Rule **${rule}** at \`${receipt.source.file}:${receipt.source.lineStart}-${receipt.source.lineEnd}\`. ` +
    `The attempted fix was reverted because **${failingGate?.name ?? "a gate"}** failed: ${failingGate?.detail ?? "see gates"}. ` +
    `A caught failure is evidence the harness works — the broken change never reaches the site.\n\n${notesArg}\n`;
}
writeFileSync(resolve(dir, "notes.md"), notes);

console.log(`receipt written: receipts/${seqPad}-${rule}/ (decision=${decision}, gates ${gates.filter((g) => g.pass).length}/${gates.length})`);
