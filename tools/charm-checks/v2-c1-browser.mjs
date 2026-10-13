#!/usr/bin/env node
// Browser smoke for C1 undo-window ability (aero.lounge).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { mkdirSync, readFileSync } from 'node:fs';

const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const base = process.env.VOYAGE_TEST_URL || 'http://[::1]:8150';
mkdirSync('/tmp/c1-browser', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setBypassServiceWorker(true);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.stack || String(e)));

await page.setRequestInterception(true);
page.on('request', (request) => {
  if (request.isNavigationRequest() && request.url().replace(/\/$/, '') === base.replace(/\/$/, '')) {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    request.respond({ status: 200, contentType: 'text/html', body: html });
  } else request.continue();
});

const settle = async () => {
  await page.waitForFunction(() => window.FreeCell && !FreeCell.busy, { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 300));
};

try {
  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.FreeCell);
  await page.evaluate(async () => {
    const { createRun, startBoard, saveRun } = await import('/js/voyage/run.js');
    const { nextChoices } = await import('/js/voyage/map.js');
    const { baseRules } = await import('/js/voyage/charms.js');
    const { Game } = await import('/js/rules.js');
    const r = createRun({ seed: 'c1-browser' });
    r.boons = ['aero.lounge'];
    const cur = startBoard(r, nextChoices(r.map)[0].id, { deal: 1, par: 60 });
    cur.theme = 'aero';
    cur.rules = baseRules();
    cur.active = [{ id: 'aero.lounge', kind: 'boon', strength: 1, level: 1 }];
    const g = new Game(1, { rules: JSON.parse(JSON.stringify(cur.rules)) });
    const mv = g.applyDescriptor({ t: 'C', card: g.tableau[0].at(-1), src: { kind: 'col', i: 0 }, to: { kind: 'free', i: 0 } });
    if (!mv) throw new Error('fixture move failed');
    cur.history = g.history;
    cur.initial = g.initial;
    saveRun(r);
    const { voyageUI } = await import('/js/voyage/ui.js');
    await voyageUI.handlers.continueVoyage();
  });
  await settle();

  const beforeUndo = await page.evaluate(() => FreeCell.voyage.run().current.history.length);
  await page.evaluate(async () => {
    const { voyageUI } = await import('/js/voyage/ui.js');
    await voyageUI.handlers.useAbility('aero.lounge');
  });
  await settle();
  await page.click('#btn-undo');
  await settle();
  const after = await page.evaluate(() => ({
    len: FreeCell.voyage.run().current.history.length,
    window: !!FreeCell.voyage.run().current.memo._undoWindow,
  }));
  assert(after.len < beforeUndo, 'lounge free undo rewinds history');
  assert(after.window, 'undo window remains armed');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('OK: c1 browser (aero.lounge)');
} finally {
  await browser.close();
}

export async function check() {}
