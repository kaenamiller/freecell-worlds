// Cycles every theme live in one session; checks assets, audio buffers and console errors.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 450 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.evaluateOnNewDocument(() => localStorage.setItem('freecell3d.settings', JSON.stringify({ theme: 'roman', quality: 'low' })));
await page.goto('http://localhost:8123/');
await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 90000 });
await page.click('#btn-play');
await page.waitForFunction(() => !window.FreeCell.busy, { timeout: 150000 });
for (const t of ['zen', 'forest', 'deco', 'muertos', 'space', 'cyber', 'aero', 'roman']) {
  await page.evaluate((id) => FreeCell.setTheme(id), t);
  await page.waitForFunction((id) => document.body.dataset.theme === id, {}, t);
  await new Promise((r) => setTimeout(r, 1800));
  const r = await page.evaluate(async (id) => {
    const a = FreeCell.audio;
    const names = [`${id}_ui`, `${id}_chime`, `${id}_win`];
    await Promise.all([...names.map((n) => a.load(n)), a.load(`${id}_ambience`), a.load(id, './assets/music/')]);
    const miss = [...names, `${id}_ambience`, id].filter((n) => !a.buffers.get(n));
    return { theme: document.body.dataset.theme, audioTheme: a.theme, missing: miss, ambience: !!a.ambience, music: !!a.music, font: getComputedStyle(document.body).fontFamily.split(',')[0] };
  }, t);
  console.log(JSON.stringify(r));
}
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
await browser.close();
