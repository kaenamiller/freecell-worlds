// E2E: plays a deal with real mouse drags (solver-guided) and checks the auto-play-to-foundations feature.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const AUTO = process.env.AUTO !== '0';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 450 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.evaluateOnNewDocument((auto) => localStorage.setItem('freecell3d.settings', JSON.stringify({ theme: 'roman', quality: 'low', autoFoundation: auto })), AUTO);
await page.goto('http://localhost:8123/');
await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 90000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const info = () => page.evaluate(() => FreeCell.historyInfo());
const state = () => page.evaluate(() => JSON.stringify(FreeCell.getState()));
const log = (...a) => console.log(...a);
let fails = 0;
const check = (label, ok, extra = '') => { if (!ok) fails++; log(ok ? 'PASS' : 'FAIL', label, extra); };

await page.click('#btn-play');
await page.waitForFunction(() => !window.FreeCell.busy, { timeout: 150000 });
// Wait for the post-deal auto-play (if any) to settle.
async function settle() {
  let last = JSON.stringify(await info()), stable = 0;
  for (let i = 0; i < 200 && stable < 4; i++) {
    await sleep(350);
    const now = JSON.stringify(await info());
    const busy = await page.evaluate(() => FreeCell.busy);
    stable = now === last && !busy ? stable + 1 : 0;
    last = now;
  }
}
await settle();
const hud = async () => Number(await page.$eval('#moves', (e) => e.textContent));

let stalls = 0;
let undoChecked = false;
let sawAuto = false;
for (let step = 0; step < (AUTO ? 16 : 40); step++) {
  if (await page.evaluate(() => FreeCell.isWon())) break;
  const sol = await page.evaluate(async () => (await FreeCell.solve({ timeLimitMs: 5000 })).solution);
  if (!sol || !sol.length) { log('no solution found at step', step); break; }
  const m = sol[0];
  const before = await state();
  const infoBefore = await info();
  const from = await page.evaluate((c) => FreeCell.projectCard(c, true), m.card);
  const to = await page.evaluate((m) => m.t === 'T' ? FreeCell.projectSlot('col', m.to) : m.t === 'C' ? FreeCell.projectSlot('free', m.fi) : FreeCell.projectSlot('found', ((m.card - 1) / 13) | 0), m);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(() => !window.FreeCell.busy, { timeout: 90000 });
  await settle();
  const after = await info();
  if ((await state()) === before) { log('step', step, 'made no progress for move', JSON.stringify(m)); stalls++; if (stalls >= 3) break; }
  const gotAuto = after.auto > infoBefore.auto;
  if (gotAuto) sawAuto = true;
  if (!undoChecked && gotAuto && !(await page.evaluate(() => FreeCell.isWon()))) {
    undoChecked = true;
    const mid = await state();
    await page.click('#btn-undo');
    await settle();
    const restored = await state();
    const ai = await info();
    check(`undo restores the exact pre-move state (took back ${after.auto - infoBefore.auto} auto-play(s) with the move)`, restored === before);
    check('undo leaves history consistent', ai.total === infoBefore.total && ai.auto === infoBefore.auto, JSON.stringify(ai));
    // Re-do the same move by hand to continue.
    const f2 = await page.evaluate((c) => FreeCell.projectCard(c, true), m.card);
    await page.mouse.move(f2.x, f2.y); await page.mouse.down();
    await page.mouse.move((f2.x + to.x) / 2, (f2.y + to.y) / 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction(() => !window.FreeCell.busy, { timeout: 90000 });
    await settle();
    check('replaying the move reproduces the same state', (await state()) === mid);
  }
}
// Phase 2: fast-forward with the solver, leaving the last 30 moves for auto-play to finish on its own.
const adv = await page.evaluate(() => FreeCell.advance(-30));
log('fast-forwarded', JSON.stringify(adv));
await settle();
for (let i = 0; i < 40 && !(await page.evaluate(() => FreeCell.isWon())); i++) await sleep(1500);
const won = await page.evaluate(() => FreeCell.isWon());
const fin = await info();
const shownMoves = await hud();
log('final history', JSON.stringify(fin), 'HUD moves', shownMoves, 'won', won);
if (AUTO) {
  check('auto-play moved cards on its own', sawAuto && fin.auto > 0);
  check('HUD Moves counts only the player moves', shownMoves === fin.manual, `${shownMoves} vs ${fin.manual}`);
  check('game finished (endgame auto-completed)', won);
  const tail = await page.evaluate(() => { const h = []; return FreeCell.historyInfo(); });
  check('the finish was driven by auto-play (many auto moves at the end)', fin.auto >= 10, JSON.stringify(fin));
} else {
  check('with the option OFF no auto-plays happen', fin.auto === 0, JSON.stringify(fin));
}
log(fails ? `${fails} FAILURES` : 'ALL PASS', errors.length ? '\nERRORS:\n' + errors.join('\n') : '(no console errors)');
await browser.close();
