import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const file = process.argv[2] || '/Users/dileepkumarsharma/Desktop/Hackathons/Mend/mend-presentation.html';
const outDir = process.argv[3] || '/private/tmp/claude-501/-Users-dileepkumarsharma-Desktop-Hackathons-Mend/23e6591c-2722-412b-8363-d65c9a7c9c70/scratchpad/shots';
const tag = process.argv[4] || 'v0';
const N = parseInt(process.argv[5] || '11', 10);

import fs from 'fs';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto('file://' + file);
await page.waitForTimeout(600);

for (let i = 0; i < N; i++) {
  // go to slide i
  await page.evaluate((n) => {
    // trigger the deck's go() via keyboard from slide 0
  }, i);
  await page.waitForTimeout(50);
  // Use Home then ArrowRight i times for determinism
  await page.keyboard.press('Home');
  await page.waitForTimeout(250);
  for (let k = 0; k < i; k++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(120); }
  await page.waitForTimeout(1200); // let animations settle
  const num = String(i + 1).padStart(2, '0');
  await page.screenshot({ path: path.join(outDir, `${tag}-slide-${num}.png`) });
  console.log('shot', num);
}

await browser.close();
console.log('done ->', outDir);
