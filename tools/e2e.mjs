// End-to-end smoke test: drag a card, settings, live theme switch, auto-solve to the win screen.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.evaluateOnNewDocument(() => localStorage.setItem('freecell3d.settings', JSON.stringify({ theme: 'roman', quality: 'medium' })));
await page.goto('http://localhost:8123/');
await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 90000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const shot = (n) => page.screenshot({ path: `/tmp/shots/e2e-${n}.png` });

await page.click('#btn-play');
await page.waitForFunction(() => !window.FreeCell.busy, { timeout: 150000 });
log('dealt; deal', await page.evaluate(() => FreeCell.getDealNumber()));

// 1. Real drag-and-drop using the solver's first move.
const sol = await page.evaluate(async () => (await FreeCell.solve({ timeLimitMs: 4000 })).solution);
const m = sol[0];
log('first solver move', JSON.stringify(m));
const from = await page.evaluate((c) => FreeCell.projectCard(c), m.card);
const to = await page.evaluate((m) => m.t === 'T' ? FreeCell.projectSlot('col', m.to) : m.t === 'C' ? FreeCell.projectSlot('free', m.fi) : FreeCell.projectSlot('found', m.card ? (((m.card - 1) / 13) | 0) : 0), m);
await page.mouse.move(from.x, from.y); await page.mouse.down();
await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
await page.mouse.move(to.x, to.y, { steps: 6 });
await sleep(1500);
await shot('dragging');
await page.mouse.up();
await page.waitForFunction(() => !window.FreeCell.busy, { timeout: 90000 });
log('moves after drag:', await page.$eval('#moves', (e) => e.textContent));

// 2. Settings modal.
await page.click('#btn-settings');
await sleep(500);
log('settings open:', await page.$eval('#modal-settings', (e) => e.classList.contains('show')));
await shot('settings');
await page.keyboard.press('Escape');

// 3. Live theme switch.
await page.evaluate(() => FreeCell.setTheme('cyber'));
await sleep(6000);
log('theme after switch:', await page.evaluate(() => document.body.dataset.theme));

// 4. Auto-solve to the win.
await page.evaluate(() => document.getElementById('btn-solve').click());
await page.waitForFunction(() => window.FreeCell.isWon(), { timeout: 250000 }).catch(() => log('win not reached in time'));
await sleep(3500);
await shot('cascade');
await page.waitForFunction(() => document.getElementById('win-overlay').classList.contains('show'), { timeout: 60000 }).catch(() => log('win overlay did not show'));
await sleep(1500);
await shot('win');
log('stats', JSON.stringify(await page.evaluate(() => ({ won: FreeCell.stats.won, streak: FreeCell.stats.streak, ach: Object.keys(FreeCell.stats.achievements) }))));
log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
