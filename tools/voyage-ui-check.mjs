// Headless snapshots for the standalone Voyage preview.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';
const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const cases = [
  ['tree-start-desktop', 1440, 900, 'map1', 'roman'],
  ['tree-start-phone', 390, 844, 'map1', 'roman'],
  ['tree-one-pick-desktop', 1440, 900, 'map2', 'roman'],
  ['tree-one-pick-phone', 390, 844, 'map2', 'roman'],
  ['tree-board6-desktop', 1440, 900, 'map6', 'roman'],
  ['tree-board6-phone', 390, 844, 'map6', 'roman'],
  ['title-classic-desktop', 1440, 900, 'title-classic', 'roman'],
  ['title-classic-phone', 390, 844, 'title-classic', 'roman'],
  ['title-voyage-desktop', 1440, 900, 'title-voyage', 'roman'],
  ['title-voyage-phone', 390, 844, 'title-voyage', 'roman'],
  ['title-classic-run-desktop', 1440, 900, 'title-classic-run', 'roman'],
  ['title-classic-run-phone', 390, 844, 'title-classic-run', 'roman'],
  ['title-voyage-run-desktop', 1440, 900, 'title-voyage-run', 'roman'],
  ['title-voyage-run-phone', 390, 844, 'title-voyage-run', 'roman'],
  ['desktop-map', 1440, 900, 'map4', 'roman'],
  ['phone-map', 390, 844, 'map4', 'roman'],
  ['desktop-map-light', 1440, 900, 'map1', 'azulejo'],
  ['phone-map-light', 390, 844, 'map1', 'jetset'],
  ['desktop-boss', 1440, 900, 'map-final', 'space'],
  ['desktop-hud', 1920, 1080, 'hud3', 'azulejo'],
  ['laptop-hud', 1440, 900, 'hud3', 'azulejo'],
  ['phone-hud', 390, 844, 'hud3', 'zen'],
  ['desktop-reward', 1440, 900, 'result3', 'forest'],
  ['phone-reward', 390, 844, 'result3', 'muertos'],
  ['phone-end', 390, 844, 'end-win', 'aero'],
  ['desktop-title', 1440, 900, 'title-classic', 'roman'],
  ['phone-title', 390, 844, 'title-classic', 'roman'],
  ['phone-intro', 390, 844, 'intro7', 'jetset'],
  ['desktop-final-result', 1440, 900, 'result7', 'roman'],
  ['phone-stats', 390, 844, 'stats', 'roman'],
  ['phone-confirm', 390, 844, 'confirm', 'zen'],
  ['phone-tutorial-map', 390, 844, 'tutorial-map', 'roman'],
  ['phone-tutorial-board', 390, 844, 'tutorial-board', 'roman'],
  ['phone-tutorial-reward', 390, 844, 'tutorial-reward', 'roman'],
  ['phone-loss', 390, 844, 'end-loss', 'riverboat'],
];
const requested = new Set(process.argv.slice(2));
mkdirSync('/tmp/voyage-ui-shots', { recursive: true });
for (const [name, width, height, screen, theme] of cases) {
  if (requested.size && !requested.has(name)) continue;
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() === 404) errors.push(`404 ${r.url()}`); });
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:8080/tools/voyage-ui-preview.html?screen=${screen}&theme=${theme}&clean=1`, { waitUntil: 'networkidle0' });
  await page.waitForTimeout?.(1100);
  await new Promise((r) => setTimeout(r, 1100));
  const path = `/tmp/voyage-ui-shots/${name}.png`;
  await page.screenshot({ path });
  const metrics = await page.evaluate(() => ({
    screen: document.getElementById('preview-screen').value,
    hScroll: document.documentElement.scrollWidth > innerWidth,
    chartScroll: document.getElementById('voyage-map-scroll').scrollWidth > document.getElementById('voyage-map-scroll').clientWidth,
    visible: [...document.querySelectorAll('.voyage-screen,.voyage-overlay')].filter((e) => !e.hidden).map((e) => e.id),
  }));
  console.log(name, JSON.stringify({ path, metrics, errors }));
  await page.close();
}
await browser.close();
