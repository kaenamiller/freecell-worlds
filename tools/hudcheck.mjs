// Verifies the HUD stays on one row at several widths and saves a strip screenshot of each.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const theme = process.argv[2] || 'roman';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.evaluateOnNewDocument((t) => localStorage.setItem('freecellworlds.settings', JSON.stringify({ theme: t, autoRandomTheme: false, quality: 'low' })), theme);
await page.setViewport({ width: 1440, height: 800 });
await page.goto('http://localhost:8123/');
await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 90000 });
await page.evaluate(() => { document.getElementById('title-screen').classList.add('hidden'); document.getElementById('hud').classList.remove('hidden'); document.getElementById('scene').style.visibility = 'visible'; });
for (const w of [1600, 1280, 1100, 1024, 900, 800, 720, 640, 560, 420]) {
  await page.setViewport({ width: w, height: 800 });
  await new Promise((r) => setTimeout(r, 400));
  const r = await page.evaluate(() => {
    const tops = [...document.querySelectorAll('#hud .tool, #hud .chip:not([style*="none"])')].filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().top));
    const hud = document.getElementById('hud').getBoundingClientRect();
    const right = Math.max(...[...document.querySelectorAll('#hud .tool')].map((e) => e.getBoundingClientRect().right));
    return { rows: new Set(tops).size, hudH: Math.round(hud.height), overflowX: document.documentElement.scrollWidth > innerWidth, rightEdge: Math.round(right) };
  });
  console.log(w, JSON.stringify(r));
  await page.screenshot({ path: `/tmp/shots/hud-${theme}-${w}.png`, clip: { x: 0, y: 0, width: w, height: 90 } });
}
await browser.close();
