// Mend demo — compose the final video from timeline.json + scene images + per-
// segment narration audio. Each segment becomes a clip: its scene image with a
// gentle Ken-Burns zoom, the caption burned into a bar, a fade at the cut, and the
// segment's audio. The architecture diagram pops up as an inset during the loop +
// gates segments. Clips are concatenated into runs/demo-video/mend-demo.mp4 (≤3min).
//
// Usage: node harness/demo-video/compose.mjs

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const VDIR = resolve(ROOT, "runs/demo-video");
const CLIPS = resolve(VDIR, "clips");
mkdirSync(CLIPS, { recursive: true });
const FONT = "/System/Library/Fonts/Supplemental/Arial.ttf";
const DIAGRAM = resolve(VDIR, "scenes/diagram.png");
const INSET_SEGMENTS = new Set(["loop", "gates"]); // diagram pops up here

const tl = JSON.parse(readFileSync(resolve(VDIR, "timeline.json"), "utf8"));
const sceneFor = { hook: "title", villain: "naive", thesis: "diagram", loop: "dashboard", gates: "gates", critic: "critic", revert: "revert", receipt: "receipt", deploy: "deploy_live", close: "close" };

function ff(args) { execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { cwd: ROOT }); }

const clipPaths = [];
for (const seg of tl.segments) {
  const scene = resolve(VDIR, "scenes", `${sceneFor[seg.id] ?? "dashboard"}.png`);
  if (!existsSync(scene)) { console.error(`missing scene for ${seg.id}`); continue; }
  const D = Number((seg.duration + 0.6).toFixed(2)); // hold + a breath
  const frames = Math.round(D * 30);
  const capFile = resolve(CLIPS, `${seg.id}.txt`);
  writeFileSync(capFile, seg.caption);
  const clip = resolve(CLIPS, `${seg.id}.mp4`);

  // base video chain: cover-fit, gentle zoom, caption bar, fade in/out
  const base =
    `[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,` +
    `zoompan=z='min(zoom+0.0004,1.05)':d=${frames}:s=1920x1080:fps=30,` +
    `drawtext=textfile='${capFile}':fontfile='${FONT}':fontsize=40:fontcolor=white:` +
    `box=1:boxcolor=0x0b1119@0.85:boxborderw=24:x=(w-tw)/2:y=h-150:shadowcolor=black:shadowx=2:shadowy=2,` +
    `fade=t=in:st=0:d=0.35,fade=t=out:st=${(D - 0.35).toFixed(2)}:d=0.35`;

  const inputs = ["-loop", "1", "-t", String(D), "-i", scene, "-i", resolve(ROOT, seg.wav)];
  let filter, vlabel;
  if (INSET_SEGMENTS.has(seg.id) && existsSync(DIAGRAM)) {
    inputs.push("-loop", "1", "-t", String(D), "-i", DIAGRAM);
    filter =
      `${base}[bg];` +
      `[2:v]scale=620:-1,setsar=1,format=rgba,colorchannelmixer=aa=0.96[ins];` +
      `[bg][ins]overlay=W-w-46:52:enable='between(t,0.6,${(D - 0.4).toFixed(2)})'[v]`;
    vlabel = "[v]";
  } else {
    filter = `${base}[v]`;
    vlabel = "[v]";
  }
  ff([...inputs, "-filter_complex", filter, "-map", vlabel, "-map", "1:a",
    "-af", "apad", "-t", String(D), "-r", "30", "-c:v", "libx264", "-preset", "medium",
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", clip]);
  clipPaths.push(clip);
  console.error(`  clip ${seg.id.padEnd(9)} ${D}s`);
}

// concat (re-encode for safe joins across identical params)
const listFile = resolve(CLIPS, "list.txt");
writeFileSync(listFile, clipPaths.map((c) => `file '${c}'`).join("\n"));
const out = resolve(VDIR, "mend-demo.mp4");
ff(["-f", "concat", "-safe", "0", "-i", listFile, "-c:v", "libx264", "-preset", "medium",
  "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", out]);

const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
  "-of", "default=noprint_wrappers=1:nokey=1", out]).toString().trim();
console.log(`\n  ✓ ${out}`);
console.log(`  duration ${Number(dur).toFixed(1)}s (budget ${tl.maxSeconds ?? 180}s) — ${Number(dur) <= (tl.maxSeconds ?? 180) ? "UNDER ✓" : "OVER"}`);
