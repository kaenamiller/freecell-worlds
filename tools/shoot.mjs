// Dev helper: drives the game in headless Chrome and saves screenshots + console errors.
// usage: node tools/shoot.mjs <scenario> [theme]   (uses puppeteer-core from a sibling project)
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');

const scenario = process.argv[2] || 'title';
const theme = process.argv[3] || 'roman';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--window-size=1600,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: Number(process.env.W || 1600), height: Number(process.env.H || 900) });
const errors = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
const Q = process.env.Q || 'high';
await page.evaluateOnNewDocument((th, q, hc, fc) => localStorage.setItem('freecellworlds.settings', JSON.stringify({ theme: th, quality: q, highContrast: !!hc, fourColor: !!fc })), theme, Q, process.env.HC === '1', process.env.FC === '1');
await page.goto('http://localhost:8123/' + (process.env.QS || ''), { waitUntil: 'load' });
await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 90000 }).catch(() => errors.push('loader never finished'));
const shot = (n) => page.screenshot({ path: `/tmp/shots/${theme}-${process.env.Q || 'high'}${process.env.HC === '1' ? '-hc' : ''}${process.env.FC === '1' ? '-fc' : ''}-${n}.png` });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (scenario === 'title') {
  await sleep(1200);
  await shot('title');
} else if (scenario === 'game' || scenario === 'theme') {
  if (scenario === 'theme') {
    await sleep(1200);
    await shot('title');
  }
  await sleep(800);
  await page.click('#btn-play');
  await sleep(600);
  await shot('deal-mid');
  await page.waitForFunction(() => !window.FreeCell.busy, { timeout: 120000 });
  await sleep(1500);
  await shot('game');
  const fps = await page.evaluate(() => window.FreeCell.perf);
  console.log('perf', JSON.stringify(fps));
} else if (scenario === 'win') {
  await page.click('#btn-play');
  await sleep(3500);
  // Fast-forward: solve then watch.
  await page.evaluate(() => document.getElementById('btn-solve').click());
  await sleep(9000);
  await shot('solve');
  await sleep(14000);
  await shot('win');
}
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
