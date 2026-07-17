// Mend — the INDEPENDENT critic, running on Akash. This is the semantic-truth
// judge (RUBRIC s5), and it deliberately runs on a DIFFERENT model family and a
// DIFFERENT provider than the Claude fixer. That is the point: the judge cannot
// share the worker's weights, exactly as gate 4's second engine (IBM Equal
// Access) cannot share axe's rules. Two axes of independence — engine and model.
//
// Provider: AkashML (api.akashml.com, OpenAI-compatible), decentralized compute.
//   text fixes (label / link-name / button-name / heading) -> DeepSeek V4 Flash
//   image-alt fixes                                          -> Qwen3.6-35B (vision)
// Key: process.env.AKASH_API_KEY or .env.akash (gitignored). Never commit it.
//
// export critique({rule, context, imagePath}) -> {verdict, reason, model, provider, tokens}
// CLI: node harness/critic-akash.mjs --rule label-title-only --context "..." [--image path]

import { readFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { arg, ROOT } from "./lib.mjs";

const BASE = process.env.AKASH_BASE_URL || "https://api.akashml.com/v1";
const TEXT_MODEL = "deepseek-ai/DeepSeek-V4-Flash";
const VISION_MODEL = "Qwen/Qwen3.6-35B-A3B";

function loadKey() {
  if (process.env.AKASH_API_KEY) return process.env.AKASH_API_KEY;
  const f = resolve(ROOT, ".env.akash");
  if (existsSync(f)) {
    const m = readFileSync(f, "utf8").match(/AKASH_API_KEY\s*=\s*(\S+)/);
    if (m) return m[1].replace(/^["']|["']$/g, ""); // tolerate quoted values
  }
  throw new Error("no AKASH_API_KEY (env or .env.akash)");
}

const SYSTEM = `You are the Mend critic — an INDEPENDENT judge running on a different model than the fixer. You decide whether an accessibility fix is semantically TRUE, not merely present. Axe already confirmed the attribute exists; you confirm it means the right thing.

Think briefly, then end your reply with EXACTLY these two lines and nothing after:
VERDICT: PASS
REASON: <one sentence>
(or VERDICT: FAIL with a reason).

Rules:
- Alt text: PASS iff it states the image's meaning in context, <=125 chars, no "image of/picture of", no detail the image doesn't show. Logos/product shots/charts are never decorative; alt="" on them = FAIL.
- Labels / accessible names: PASS iff a screen-reader user hearing ONLY the name knows what the control does. "Email address" on an email field = PASS. "click here"/"link"/empty/filename = FAIL. A name contradicting visible text = FAIL.
- Headings: PASS iff the outline reads as a sensible table of contents.
Never say "compliant"/"ADA"/"lawsuit-proof". When uncertain, FAIL.`;

function parseVerdict(text) {
  if (!text) return null;
  // Take the LAST verdict the model emits (it may discuss PASS/FAIL before its
  // final line), and pair the REASON from that same block (the first REASON at or
  // after the final verdict), not a stray earlier one.
  const all = [...text.matchAll(/VERDICT:\s*(PASS|FAIL)/gi)];
  if (!all.length) return null;
  const last = all[all.length - 1];
  const v = last[1].toUpperCase();
  const after = text.slice(last.index).match(/REASON:\s*(.+?)(?:\n|$)/i);
  const reason = after ? after[1].trim() : ([...text.matchAll(/REASON:\s*(.+?)(?:\n|$)/gi)].pop()?.[1]?.trim() ?? "");
  return { verdict: v, reason };
}

export async function critique({ rule, context, imagePath }) {
  const key = loadKey();
  // Fail LOUD, not open: if an image was supplied but is missing, an image-alt
  // fix would otherwise be judged blind on a text model (2nd-audit finding 2).
  if (imagePath && !existsSync(imagePath)) {
    throw new Error(`critic image not found: ${imagePath} — an image-alt fix must be judged WITH the image`);
  }
  const useVision = Boolean(imagePath);
  const model = useVision ? VISION_MODEL : TEXT_MODEL;

  const userContent = [{ type: "text", text: `Rule: ${rule}\n\n${context}` }];
  if (useVision) {
    const bytes = readFileSync(imagePath);
    // M6: bound vision-token spend. Full-page screenshots can be several MB; the
    // loop should pass an element-cropped image (RUBRIC s6). Refuse oversized
    // images with a clear message rather than silently paying for a huge input.
    const MAX = 3 * 1024 * 1024;
    if (bytes.length > MAX) {
      throw new Error(`critic image too large (${(bytes.length / 1e6).toFixed(1)}MB > 3MB) — pass an element-cropped image to bound vision cost`);
    }
    const ext = extname(imagePath).slice(1).toLowerCase() || "png";
    const mime = ext === "jpg" ? "jpeg" : ext;
    userContent.push({ type: "image_url", image_url: { url: `data:image/${mime};base64,${bytes.toString("base64")}` } });
  }

  // Bounded network call: abort after 90s so a hung Akash request can never stall
  // the loop. Cost is bounded by max_tokens (fractions of a cent per verdict).
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 90_000);
  let res;
  try {
    res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      signal: ac.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, temperature: 0, max_tokens: useVision ? 900 : 500,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userContent }],
      }),
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Akash ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const msg = data.choices?.[0]?.message ?? {};
  const parsed = parseVerdict(msg.content) || parseVerdict(msg.reasoning_content);
  if (!parsed) throw new Error(`no verdict parsed from Akash response (finish: ${data.choices?.[0]?.finish_reason})`);
  return {
    verdict: parsed.verdict,
    reason: parsed.reason,
    model,
    provider: "akash",
    tokens: { in: data.usage?.prompt_tokens ?? null, out: data.usage?.completion_tokens ?? null },
  };
}

// CLI (pathToFileURL handles paths needing percent-encoding — spaces/unicode)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rule = arg("rule", "label-title-only");
  const context = arg("context", "");
  const imagePath = arg("image") ? resolve(arg("image")) : null;
  try {
    const r = await critique({ rule, context, imagePath });
    console.log(JSON.stringify(r, null, 2));
    console.log(`\nCRITIC ${r.verdict} — ${r.reason}\n(${r.provider}:${r.model}, ${r.tokens.in}+${r.tokens.out} tok)`);
    process.exit(r.verdict === "PASS" ? 0 : 1);
  } catch (e) {
    console.error("critic error:", e.message);
    process.exit(2);
  }
}
