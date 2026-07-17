// Mend demo — TTS layer (swappable). Generates one audio clip per narration
// segment and measures its duration, producing a timeline the recorder + captions
// key off. Voice source is pluggable:
//   MEND_TTS=say        (default) macOS `say` — free, offline, works today
//   MEND_TTS=butterbase  Butterbase gpt-audio via the AI gateway (needs an
//                        ai:gateway API key in BUTTERBASE_API_KEY + BUTTERBASE_APP_ID)
//
// Output: runs/demo-video/audio/<id>.wav + runs/demo-video/timeline.json
// Usage: node harness/demo-video/tts.mjs

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const OUT = resolve(ROOT, "runs/demo-video/audio");
mkdirSync(OUT, { recursive: true });

const VOICE = process.env.MEND_TTS || "say";
const script = JSON.parse(readFileSync(resolve(HERE, "narration.json"), "utf8"));

function durationSec(wav) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", wav]).toString().trim();
  return Number(out);
}

// macOS say → aiff → wav (24kHz mono), a calm narration voice + rate.
function synthSay(text, wav) {
  const aiff = wav.replace(/\.wav$/, ".aiff");
  execFileSync("say", ["-v", process.env.SAY_VOICE || "Samantha", "-r", process.env.SAY_RATE || "172", "-o", aiff, text]);
  execFileSync("ffmpeg", ["-y", "-i", aiff, "-ar", "24000", "-ac", "1", wav], { stdio: "ignore" });
  execFileSync("rm", ["-f", aiff]);
}

// Butterbase gpt-audio via the OpenAI-compatible gateway (audio modality).
async function synthButterbase(text, wav) {
  const key = process.env.BUTTERBASE_API_KEY;
  const app = process.env.BUTTERBASE_APP_ID;
  if (!key || !app) throw new Error("set BUTTERBASE_API_KEY + BUTTERBASE_APP_ID for MEND_TTS=butterbase");
  const res = await fetch(`https://api.butterbase.ai/v1/${app}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-audio",
      modalities: ["text", "audio"],
      audio: { voice: process.env.BB_VOICE || "alloy", format: "wav" },
      messages: [
        { role: "system", content: "You are a narrator. Read the user's text aloud verbatim, calm and clear. Do not add words." },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Butterbase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const b64 = data.choices?.[0]?.message?.audio?.data;
  if (!b64) throw new Error("no audio in Butterbase response (gateway may not support the audio modality)");
  writeFileSync(wav, Buffer.from(b64, "base64"));
}

const timeline = [];
let t = 0;
for (const seg of script.segments) {
  const wav = resolve(OUT, `${seg.id}.wav`);
  if (VOICE === "butterbase") await synthButterbase(seg.text, wav);
  else synthSay(seg.text, wav);
  const dur = durationSec(wav);
  timeline.push({ ...seg, wav: `runs/demo-video/audio/${seg.id}.wav`, start: Number(t.toFixed(3)), duration: Number(dur.toFixed(3)) });
  t += dur + 0.35; // small breath between segments
  console.error(`  ${seg.id.padEnd(9)} ${dur.toFixed(1)}s  (voice=${VOICE})`);
}
const total = Number(t.toFixed(3));
writeFileSync(resolve(ROOT, "runs/demo-video/timeline.json"), JSON.stringify({ voice: VOICE, totalSeconds: total, segments: timeline }, null, 2));
console.log(`\ntotal narration: ${total.toFixed(1)}s (budget ${script.maxSeconds}s) — ${total <= script.maxSeconds ? "UNDER ✓" : "OVER — trim script"}`);
