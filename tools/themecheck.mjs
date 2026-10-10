// Cycles every theme live in one session; checks assets, audio buffers and console errors.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { THEME_ORDER } from '../js/themes.js';
const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 450 });
const errors = [];
const failures = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.evaluateOnNewDocument(() => localStorage.setItem('freecellworlds.settings', JSON.stringify({ theme: 'roman', quality: 'low' })));
await page.goto('http://localhost:8123/');
await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 90000 });
await page.click('#btn-play');
await page.waitForFunction(() => !window.FreeCell.busy, { timeout: 150000 });
const requested = process.argv.slice(2);
for (const t of THEME_ORDER.filter((id) => !requested.length || requested.includes(id))) {
  await page.evaluate((id) => FreeCell.setTheme(id), t);
  await page.waitForFunction((id) => document.body.dataset.theme === id, {}, t);
  await new Promise((r) => setTimeout(r, 1800));
  const r = await page.evaluate(async (id) => {
    const { THEMES, loadThemeAssets } = await import('./js/themes.js');
    const art = await loadThemeAssets(THEMES[id]);
    const a = FreeCell.audio;
    const names = [`${id}_ui`, `${id}_chime`, `${id}_win`];
    await Promise.all([...names.map((n) => a.load(n)), a.load(`${id}_ambience`), a.load(id, './assets/music/')]);
    const miss = [...names, `${id}_ambience`, id].filter((n) => !a.buffers.get(n));
    return { theme: document.body.dataset.theme, audioTheme: a.theme, missing: miss,
      missingArt: Object.entries(art).filter(([, image]) => !image).map(([key]) => key),
      ambience: !!a.ambience, music: !!a.music,
      fontLoaded: document.fonts.check(`700 40px '${THEMES[id].fontFamily}'`),
      font: getComputedStyle(document.body).fontFamily.split(',')[0] };
  }, t);
  console.log(JSON.stringify(r));
  if (r.theme !== t || r.audioTheme !== t || r.missing.length || r.missingArt.length || !r.fontLoaded || !r.ambience || !r.music) failures.push(t);
}
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
await browser.close();
if (errors.length || failures.length) {
  console.error('Theme validation failed:', failures.join(', '));
  process.exitCode = 1;
}
