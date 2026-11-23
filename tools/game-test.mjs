import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const executablePath = join(homedir(), '.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');
const base = process.env.SHOT_BASE ?? 'http://localhost:8080/';
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const state = () =>
  page.evaluate(() => {
    const w = window.__neonBay.world;
    const s = w.state;
    return {
      screen: window.__neonBay.screen(),
      player: { x: s.player.x, y: s.player.y, health: s.player.health, inCar: s.player.inCar ? s.player.inCar.type : null },
      cash: s.cash,
      wanted: s.wanted,
      mission: s.mission ? { id: s.mission.id, stage: s.mission.stage, collected: s.mission.collected, timeLeft: s.mission.timeLeft } : null,
      police: s.cars.filter((c) => c.role === 'police').length,
      pickups: s.pickups.map((p) => ({ x: p.x, y: p.y, active: p.active })),
      save: localStorage.getItem('neon-bay.save.v1'),
      muted: window.__neonBay.audio.isMuted(),
    };
  });
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(`${base}?debug=1&seed=7`, { waitUntil: 'load' });
await page.evaluate(() => localStorage.removeItem('neon-bay.save.v1'));
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__neonBay !== undefined);
await wait(200);
let s = await state();
check('boots on title screen', s.screen === 'title', s.screen);
check('starts broke', s.cash === 0, `$${s.cash}`);

await page.keyboard.press('Space');
await wait(250);
s = await state();
check('space starts the game', s.screen === 'play', s.screen);

const before = s.player;
await page.keyboard.down('ArrowUp');
await wait(450);
await page.keyboard.up('ArrowUp');
s = await state();
check('walking moves Rico north', s.player.y < before.y - 20, `${before.y.toFixed(0)} -> ${s.player.y.toFixed(0)}`);

await page.evaluate(() => window.__neonBay.world.teleportPlayer(1040, 900));
await wait(80);
await page.keyboard.press('KeyE');
await wait(180);
s = await state();
check('E starts First Fare in the taxi', s.mission?.id === 'firstFare' && s.player.inCar === 'taxi', `${s.mission?.id}/${s.player.inCar}`);

await page.evaluate(() => window.__neonBay.world.teleportPlayer(3040, 1120));
await wait(250);
s = await state();
check('fare is picked up on Ocean Ave', s.mission?.stage === 'dropoff', s.mission?.stage);

await page.evaluate(() => window.__neonBay.world.teleportPlayer(3040, 1720));
await wait(250);
s = await state();
check('First Fare pays $150', s.mission === null && s.cash >= 150, `cash $${s.cash}`);
check('cash is saved', (s.save ?? '').includes('"cash"'), s.save ?? 'none');

await page.keyboard.press('KeyP');
await wait(120);
s = await state();
check('P pauses', s.screen === 'paused', s.screen);
await page.keyboard.press('Space');
await wait(120);
s = await state();
check('Space resumes', s.screen === 'play', s.screen);

await page.keyboard.press('KeyM');
await wait(80);
s = await state();
check('M mutes', s.muted === true, String(s.muted));
await page.keyboard.press('KeyM');
await wait(80);
s = await state();
check('M unmutes', s.muted === false, String(s.muted));

await page.evaluate(() => {
  const w = window.__neonBay.world;
  w.setWanted(3);
});
await wait(300);
s = await state();
check('3 stars spawn 3 police cruisers', s.police === 3, String(s.police));

await page.evaluate(() => {
  const w = window.__neonBay.world;
  w.state.wanted = 0;
  w.clearPolice();
  w.exitCar();
  const car = w.state.cars.find((c) => c.role === 'parked' && !c.missionCar && !c.wrecked);
  w.teleportPlayer(car.x, car.y + 30);
});
await wait(120);
const cashBeforeSteal = (await state()).cash;
await page.keyboard.press('KeyE');
await wait(160);
s = await state();
check('stealing a parked car raises heat', s.player.inCar !== null && s.wanted >= 1, `${s.player.inCar}, ${s.wanted} star(s)`);
check('stealing did not change cash', s.cash === cashBeforeSteal, `$${s.cash}`);

await page.evaluate(() => {
  const w = window.__neonBay.world;
  w.exitCar();
  w.state.wanted = 0;
  w.clearPolice();
  w.setWanted(1);
});
await wait(250);
await page.evaluate(() => {
  const w = window.__neonBay.world;
  const cop = w.state.cars.find((c) => c.role === 'police');
  if (cop) {
    w.teleportPlayer(cop.x + 8, cop.y);
    cop.speed = 0;
  }
});
await wait(1900);
s = await state();
check('standing next to police gets you busted', s.screen === 'busted', s.screen);
check('busted respawns at hospital', s.player.y > 750 && s.player.y < 850 && s.player.health === 100, `${s.player.x.toFixed(0)},${s.player.y.toFixed(0)} hp ${s.player.health}`);
check('busted costs cash', s.cash < cashBeforeSteal, `$${s.cash}`);

await page.keyboard.press('Space');
await wait(180);
s = await state();
check('Space returns from Busted', s.screen === 'play', s.screen);

await page.evaluate(() => {
  const w = window.__neonBay.world;
  w.setWanted(1);
  w.state.player.health = 5;
  // Clear the 1s post-respawn invulnerability (applyRespawn sets hurtCooldown = 1);
  // the previous busted respawn was <1s ago, so without this the ram is ignored
  // and the check only measures HP regen.
  w.state.player.hurtCooldown = 0;
});
await wait(220);
await page.evaluate(() => {
  const w = window.__neonBay.world;
  const cop = w.state.cars.find((c) => c.role === 'police');
  if (cop) {
    w.teleportPlayer(cop.x, cop.y);
    cop.speed = 420;
  }
});
await wait(450);
s = await state();
check('a police car can waste Rico', s.screen === 'wasted', `${s.screen} hp ${s.player.health}`);
await page.keyboard.press('Space');
await wait(180);
s = await state();
check('Space returns from Wasted', s.screen === 'play', s.screen);

await page.evaluate(() => {
  const w = window.__neonBay.world;
  w.state.wanted = 0;
  w.clearPolice();
  w.state.mission = null;
  w.teleportPlayer(1040, 900);
  w.startMission('hotWheels');
});
await wait(200);
s = await state();
check('Hot Wheels starts with 2 stars', s.mission?.id === 'hotWheels' && s.wanted === 2, `${s.mission?.id}, ${s.wanted}`);
await page.evaluate(() => {
  const w = window.__neonBay.world;
  const comet = w.state.cars.find((c) => c.missionCar === 'hotWheels');
  w.enterCar(comet, true);
});
await wait(250);
s = await state();
check('Comet stage advances to delivery', s.mission?.stage === 'deliver', s.mission?.stage);
await page.evaluate(() => window.__neonBay.world.teleportPlayer(440, 2068));
await wait(250);
s = await state();
check('Hot Wheels pays $300', s.mission === null && s.cash >= 400, `$${s.cash}`);

await page.evaluate(() => {
  const w = window.__neonBay.world;
  w.state.mission = null;
  w.state.wanted = 0;
  w.clearPolice();
  if (w.state.player.inCar) w.exitCar();
  w.startMission('courier');
});
await wait(150);
s = await state();
check('Courier starts with three packages', s.mission?.id === 'courier', `${s.mission?.id}`);
for (const point of [[1040, 1420], [2240, 520], [3360, 1120]]) {
  await page.evaluate(([x, y]) => window.__neonBay.world.teleportPlayer(x, y), point);
  await wait(180);
}
s = await state();
check('Courier collects all three', s.mission?.stage === 'deliver', `${s.mission?.stage}/${s.mission?.collected}`);
await page.evaluate(() => window.__neonBay.world.teleportPlayer(2440, 2068));
await wait(250);
s = await state();
check('Courier pays $250', s.mission === null && s.cash >= 650, `$${s.cash}`);

const pickupBefore = await state();
const active = pickupBefore.pickups.find((p) => p.active);
await page.evaluate(([x, y]) => window.__neonBay.world.teleportPlayer(x, y), [active.x, active.y]);
await wait(250);
s = await state();
check('cash pickup pays $25', s.cash >= pickupBefore.cash + 25, `$${pickupBefore.cash} -> $${s.cash}`);

await wait(200);
s = await state();
check('save holds best earnings and completions', (s.save ?? '').includes('bestEarnings') && (s.save ?? '').includes('completed'), s.save ?? 'none');

await browser.close();
const failed = checks.filter((c) => !c.ok);
if (errors.length) {
  console.log('--- browser errors ---');
  for (const line of errors) console.log(line);
}
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length || errors.length) process.exitCode = 1;
