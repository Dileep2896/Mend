// Build the whole demo video: narration (TTS) → scene capture → compose.
// Usage: node harness/demo-video/build.mjs   (MEND_TTS=say by default)
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
for (const step of ["tts.mjs", "capture.mjs", "compose.mjs"]) {
  console.error(`\n=== ${step} ===`);
  execFileSync("node", [resolve(HERE, step)], { stdio: "inherit" });
}
