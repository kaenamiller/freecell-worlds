// Frame-cost profile: times every visible requestAnimationFrame callback (JS +
// GL driver work such as shader compiles and texture uploads) and the gaps
// between frames, through the deal intro, a few re-deals (random theme), a theme
// switch and an idle stretch. Hitches show up as frames far above the median.
// Usage: node serve.mjs 8123 & node tools/perfcheck.mjs [quality] [port]
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');

const [quality = 'high', port = 8123] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  // Hardware GL through ANGLE/Vulkan; pass --swiftshader for a software renderer.
  args: process.argv.includes('--swiftshader')
    ? ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
    : ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=vulkan', '--enable-features=Vulkan', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
const errors = [];
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.evaluateOnNewDocument((quality) => {
  localStorage.setItem('freecellworlds.settings', JSON.stringify({ theme: 'roman', quality }));
  const raf = window.requestAnimationFrame.bind(window);
  window.__frames = [];
  window.__gaps = [];
  window.__long = [];
  window.__t0 = 0;
  let last = 0;
  // Frames drawn while the black theme fade covers the screen are not seen, so
  // heavy work there is deliberate. Only visible frames are counted.
  // Opacity, not the class, so the fade's CSS transition still counts as covered.
  const covered = () => {
    const f = document.getElementById('fade');
    return !!f && Number(getComputedStyle(f).opacity) > 0.5;
  };
  let lastHidden = true;
  window.requestAnimationFrame = (cb) => raf((ts) => {
    const hidden = covered();
    const t0 = performance.now();
    cb(ts);
    const cost = performance.now() - t0;
    if (!hidden) window.__frames.push(cost);
    // Long visible frames, with when they happened (seconds into the phase).
    if (!hidden && cost > 40) window.__long.push(`${cost.toFixed(0)}ms@${((t0 - window.__t0) / 1000).toFixed(2)}s`);
    if (last && ts !== last && !hidden && !lastHidden) window.__gaps.push(ts - last);
    last = ts;
    lastHidden = hidden;
  });
}, quality);
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 120000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function phase(name, fn) {
  await page.evaluate(() => { window.__frames = []; window.__gaps = []; window.__long = []; window.__t0 = performance.now(); });
  const t0 = Date.now();
  const sync = await fn();
  await page.waitForFunction(() => !window.FreeCell.busy, { timeout: 120000, polling: 100 });
  await sleep(300);
  const [f, gaps, long] = await page.evaluate(() => [window.__frames, window.__gaps, window.__long]);
  const s = [...f].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
  const row = {
    phase: name,
    frames: f.length,
    median: q(0.5).toFixed(1),
    p95: q(0.95).toFixed(1),
    max: (s.at(-1) ?? 0).toFixed(1),
    over50: f.filter((x) => x > 50).length,
    // Frame-to-frame interval: catches GPU-side stalls the callback cost misses.
    gapMax: Math.max(0, ...gaps).toFixed(1),
    gapsOver25: gaps.filter((x) => x > 25).length,
    syncMs: sync != null ? sync.toFixed(1) : '',
    wallMs: Date.now() - t0,
    long: long.join(' '),
  };
  console.log(JSON.stringify(row));
  return row;
}

await page.click('#btn-play');
await phase('first deal', async () => null);
for (let i = 0; i < 3; i++) {
  await phase(`re-deal ${i + 1}`, () => page.evaluate(async () => {
    const t0 = performance.now();
    const p = window.FreeCell.newGame(1000 + Math.floor(Math.random() * 30000));
    const dt = performance.now() - t0;
    await p;
    return dt;
  }));
}
await phase('theme switch', () => page.evaluate(async () => { await window.FreeCell.setTheme('cyber'); return null; }));
await phase('deal after theme', () => page.evaluate(async () => {
  const t0 = performance.now();
  const p = window.FreeCell.newGame(4242);
  const dt = performance.now() - t0;
  await p;
  return dt;
}));
await phase('idle 3s', async () => { await sleep(3000); return null; });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
