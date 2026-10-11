// Checks live art/audio loading, card index bounds, responsive layout, and
// captures every new world for visual review. Start serve.mjs on port 8123.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { EXPANSION_THEME_ORDER } from '../js/theme-expansion.js';
import { THEMES, THEME_ORDER } from '../js/themes.js';
import { manifest } from './art-manifest.mjs';
import { sfxList, musicList } from './sfx-manifest.mjs';

const requested = process.argv.slice(2);
const ids = EXPANSION_THEME_ORDER.filter((id) => !requested.length || requested.includes(id));
assert(ids.length, 'No requested expansion theme found');
for (const id of ids) {
  assert(THEME_ORDER.includes(id), `${id}: missing from random/picker order`);
  assert.equal(manifest().filter((m) => m.theme === id).length, 7, `${id}: art prompt count`);
  const audio = [...sfxList().filter((s) => s.id.startsWith(`${id}_`)), ...musicList().filter((s) => s.id === id)];
  assert.equal(audio.length, 5, `${id}: audio count`);
  for (const file of [...Object.values(THEMES[id].art), ...audio.map((a) => a.file)]) assert(existsSync(file), `Missing ${file}`);
}
const out = process.env.EXPANSION_QA_DIR || '/tmp/freecell-expansion-qa';
mkdirSync(out, { recursive: true });
const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.evaluateOnNewDocument(() => localStorage.setItem('freecellworlds.settings', JSON.stringify({
    theme: 'roman', titleMode: 'classic', autoRandomTheme: false, quality: 'low', reducedMotion: true, autoFoundation: false,
  })));
  await page.goto(process.env.FREECELL_QA_URL || 'http://localhost:8123/');
  await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 90000 });
  const picker = await page.$$eval('#theme-grid [data-theme]', (els) => els.map((e) => e.dataset.theme));
  for (const id of ids) assert(picker.includes(id), `${id}: missing picker button`);
  assert.equal(picker.length, THEME_ORDER.length);
  const results = [];
  for (const id of ids) {
    await page.evaluate((id) => FreeCell.setTheme(id), id);
    const check = await page.evaluate(async (id) => {
      const { THEMES, loadThemeAssets } = await import('./js/themes.js');
      const { setCardTheme, cardFaceTexture, cardBackTexture } = await import('./js/textures.js');
      const t = THEMES[id];
      const art = await loadThemeAssets(t);
      const missingArt = Object.entries(art).filter(([, img]) => !img).map(([key]) => key);
      const a = FreeCell.audio;
      const sounds = ['ui', 'chime', 'win', 'ambience'].map((key) => `${id}_${key}`);
      await Promise.all([...sounds.map((key) => a.load(key)), a.load(id, './assets/music/')]);
      const missingAudio = [...sounds, id].filter((key) => !a.buffers.get(key));
      let indexChecks = 0;
      const clipped = [];
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (label, x, y, ...args) {
        if (this.canvas.width === 512 && this.canvas.height === 716) {
          const m = this.measureText(label);
          const top = y - m.actualBoundingBoxAscent;
          const bottom = y + m.actualBoundingBoxDescent;
          indexChecks++;
          if (top < 19 || bottom > 105) clipped.push({ label, top, bottom });
        }
        return original.call(this, label, x, y, ...args);
      };
      try {
        for (const highContrast of [false, true]) for (const fourColor of [false, true]) {
          setCardTheme(t, art, { highContrast, fourColor });
          for (let c = 1; c <= 52; c++) cardFaceTexture(c);
        }
      } finally {
        CanvasRenderingContext2D.prototype.fillText = original;
        setCardTheme(t, art, {});
      }
      const canvas = document.createElement('canvas');
      canvas.width = 1024; canvas.height = 358;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(cardBackTexture().image, 0, 0, 256, 358);
      [11, 12, 13].forEach((c, i) => ctx.drawImage(cardFaceTexture(c).image, (i + 1) * 256, 0, 256, 358));
      return { id, theme: document.body.dataset.theme, audioTheme: a.theme, missingArt, missingAudio,
        indexChecks, clipped, fontLoaded: document.fonts.check(`700 40px '${t.fontFamily}'`), cards: canvas.toDataURL() };
    }, id);
    writeFileSync(`${out}/${id}-cards.png`, Buffer.from(check.cards.split(',')[1], 'base64'));
    delete check.cards;
    assert.equal(check.theme, id);
    assert.equal(check.audioTheme, id);
    assert.deepEqual(check.missingArt, []);
    assert.deepEqual(check.missingAudio, []);
    assert.deepEqual(check.clipped, [], `${id}: clipped rank`);
    assert(check.indexChecks > 400);
    assert(check.fontLoaded);
    await page.waitForFunction(() => [...document.querySelectorAll('.hero-layer img.show')].some((img) => img.complete && img.naturalWidth));
    await page.screenshot({ path: `${out}/${id}-title.png` });
    results.push(check);
    console.log('PASS assets + cards + title', id, check.indexChecks);
  }
  await page.click('#btn-play');
  await page.waitForFunction(() => !FreeCell.busy, { timeout: 150000 });
  for (const id of ids) {
    await page.evaluate((id) => FreeCell.setTheme(id), id);
    await page.screenshot({ path: `${out}/${id}-game.png` });
    for (const width of [1280, 800, 420]) {
      await page.setViewport({ width, height: 800 });
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        toolsOutside: [...document.querySelectorAll('#hud .tool')].filter((e) => e.offsetParent).some((e) => e.getBoundingClientRect().right > innerWidth + 1),
      }));
      assert.equal(layout.overflow, false, `${id}/${width}: horizontal overflow`);
      assert.equal(layout.toolsOutside, false, `${id}/${width}: controls outside viewport`);
    }
    await page.setViewport({ width: 1280, height: 800 });
    console.log('PASS dealt board + responsive HUD', id);
  }
  assert.deepEqual([...new Set(errors)], [], 'Browser errors');
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(`PASS ${ids.length} themes; no browser errors. Review captures in ${out}`);
} finally {
  await browser.close();
}
