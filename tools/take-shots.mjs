import { readFileSync, statSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const root = new URL('..', import.meta.url).pathname;
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
const base = process.env.SHOT_BASE ?? 'http://localhost:8080/';
const outDir = join(root, 'screenshots');
const executablePath = join(homedir(), '.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    errors.push(`console: ${msg.text()}`);
  }
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

for (const shot of shots) {
  const url = new URL(shot.query, base).href;
  await page.goto(url, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 20000 });
  } catch (err) {
    errors.push(`timeout waiting for ${shot.name}: ${err.message}`);
    continue;
  }
  const path = join(outDir, shot.name);
  await page.screenshot({ path, type: 'jpeg', quality: 82, fullPage: false });
  const size = statSync(path).size;
  const info = await page.evaluate(() => window.__shotInfo);
  console.log(`${shot.name}  ${size} bytes  ${url}`);
  console.log(`  ${JSON.stringify(info)}`);
}

if (errors.length) {
  console.log('--- browser errors ---');
  for (const line of errors) console.log(line);
} else {
  console.log('--- no browser errors ---');
}
await browser.close();
if (errors.length) process.exitCode = 1;
