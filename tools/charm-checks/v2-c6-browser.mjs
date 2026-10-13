#!/usr/bin/env node
// Browser smoke for C6 ability charms (port 8155).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { mkdirSync, readFileSync } from 'node:fs';
import { clickTarget } from './_browser-pick.mjs';

const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const base = process.env.VOYAGE_TEST_URL || 'http://[::1]:8155/';
const shots = process.env.VOYAGE_SHOTS || '/tmp/v2-c6-shots';
mkdirSync(shots, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setBypassServiceWorker(true);
await page.setRequestInterception(true);
page.on('request', (request) => {
  if (request.isNavigationRequest() && request.url().replace(/\/$/, '') === base.replace(/\/$/, '')) {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    request.respond({ status: 200, contentType: 'text/html', body: html });
  } else request.continue();
});
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.stack || String(e)));

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = async () => {
  await page.waitForFunction(() => window.FreeCell && !FreeCell.busy, { timeout: 90000 });
  await pause(250);
};

async function resumeFixture() {
  await page.evaluate(async () => {
    const { voyageUI } = await import('/js/voyage/ui.js');
    await voyageUI.handlers.continueVoyage();
  });
  await settle();
}

async function v2Fixture({ boons, levels = {} }) {
  await page.evaluate(async (options) => {
    const { createRun, startBoard, saveRun } = await import('/js/voyage/run.js');
    const { nextChoices } = await import('/js/voyage/map.js');
    const { baseRules } = await import('/js/voyage/charms.js');
    const r = createRun({ seed: 'v2-c6-browser' });
    Object.assign(r, { boss: 'boss.lockstep', boons: options.boons, levels: options.levels, undos: 5 });
    const cur = startBoard(r, nextChoices(r.map)[0].id, { deal: 1, par: 60 });
    cur.theme = 'runes';
    cur.rules = baseRules();
    cur.active = options.boons.map((id) => ({ id, kind: 'boon', strength: 1, level: options.levels[id] || 1 }));
    saveRun(r);
  }, { boons, levels });
  await page.reload({ waitUntil: 'networkidle0' });
  await resumeFixture();
}

await page.setViewport({ width: 1024, height: 768 });
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('freecellworlds.settings', JSON.stringify({
    theme: 'runes', autoRandomTheme: false, autoFoundation: false, reducedMotion: true, muted: true, quality: 'low',
  }));
  localStorage.setItem('freecellworlds.voyageTutorial', JSON.stringify({ map: true, board: true, reward: true }));
});

try {
  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.FreeCell && !document.getElementById('loader'));
  await v2Fixture({ boons: ['runes.amber'], levels: { 'runes.amber': 1 } });

  const before = await page.evaluate(() => FreeCell.voyage.run().current.memo['runes.amber']._runtime.abilityUses);
  assert.equal(before, 1);

  await page.click('[data-ability="runes.amber"]');
  await clickTarget(page);
  await settle();

  const after = await page.evaluate(() => ({
    uses: FreeCell.voyage.run().current.memo['runes.amber']._runtime.abilityUses,
    stickers: { ...FreeCell.voyage.run().stickers },
  }));
  assert.equal(after.uses, 0, 'amber ability consumes its use');
  assert(Object.values(after.stickers).includes('gold'), 'amber grants a gold sticker on the run');

  await page.screenshot({ path: `${shots}/runes-amber.png` });
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('OK: v2-c6 browser (runes.amber)');
} finally {
  await browser.close();
}
