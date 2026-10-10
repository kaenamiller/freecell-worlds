import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 360 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8123/');
await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 90000 });
await page.click('#btn-play');
await new Promise((r) => setTimeout(r, 4000));
const r = await page.evaluate(async () => {
  const a = window.FreeCell.audio;
  for (const t of ['roman', 'cyber', 'aero']) { await a.load(`${t}_ui`); await a.load(`${t}_chime`); await a.load(`${t}_win`); await a.load(`${t}_ambience`); await a.load(t, './assets/music/'); }
  const missing = [...a.buffers].filter(([, v]) => !v).map(([k]) => k);
  // Measure real signal: play a place sound through an analyser.
  const ctx = a.ctx; const an = ctx.createAnalyser(); a.master.connect(an);
  a.place(0, 4);
  await new Promise((r) => setTimeout(r, 150));
  const buf = new Float32Array(an.fftSize); an.getFloatTimeDomainData(buf);
  const peak = buf.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  return { state: ctx.state, loaded: a.buffers.size, missing, peak: +peak.toFixed(3), ambience: !!a.ambience, music: !!a.music, theme: a.theme };
});
console.log(JSON.stringify(r));
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
