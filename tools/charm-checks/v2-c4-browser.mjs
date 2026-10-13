#!/usr/bin/env node
// Browser smoke test for c4 theme abilities (port 8153).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { readFileSync } from 'node:fs';

const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const base = process.env.VOYAGE_TEST_URL || 'http://[::1]:8153';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = async (page) => {
  await page.waitForFunction(() => !FreeCell.busy, { timeout: 90000 });
  await pause(250);
};

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.setRequestInterception(true);
page.on('request', (request) => {
  if (request.isNavigationRequest() && request.url().replace(/\/$/, '') === base.replace(/\/$/, '')) {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    request.respond({ status: 200, contentType: 'text/html', body: html });
  } else request.continue();
});

await page.goto(base, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => !!window.FreeCell && !document.getElementById('loader'));

await page.evaluate(async () => {
  const { createRun, startBoard, saveRun } = await import('/js/voyage/run.js');
  const { nextChoices } = await import('/js/voyage/map.js');
  const { baseRules } = await import('/js/voyage/charms.js');
  const { Game, generateMoves } = await import('/js/rules.js');
  const { voyageUI } = await import('/js/voyage/ui.js');
  const r = createRun({ seed: 'c4-browser' });
  r.boons = ['cove.keg', 'cove.parrot', 'deepsea.sonar'];
  r.levels = { 'cove.keg': 1, 'cove.parrot': 1, 'deepsea.sonar': 1 };
  const cur = startBoard(r, nextChoices(r.map)[0].id, { deal: 1, par: 60 });
  cur.theme = 'cove';
  cur.rules = baseRules();
  cur.active = [
    { id: 'cove.keg', kind: 'boon', strength: 1, level: 1 },
    { id: 'cove.parrot', kind: 'boon', strength: 1, level: 1 },
    { id: 'deepsea.sonar', kind: 'boon', strength: 1, level: 1 },
  ];
  const g = new Game(1, { rules: JSON.parse(JSON.stringify(cur.rules)) });
  const mv = generateMoves(g.state, { rules: g.rules }).find((m) => !m.auto) || generateMoves(g.state, { rules: g.rules })[0];
  if (mv) g.applyDescriptor(mv);
  cur.history = g.history;
  cur.initial = g.initial;
  saveRun(r);
  await voyageUI.handlers.continueVoyage();
});

await settle(page);
const before = await page.evaluate(() => FreeCell.voyage.run().current.history.length);
await page.evaluate(async () => {
  const { voyageUI } = await import('/js/voyage/ui.js');
  await voyageUI.handlers.useAbility('cove.keg');
});
await settle(page);
const after = await page.evaluate(() => FreeCell.voyage.run().current.history.length);
assert.ok(after <= before, 'Lucky Doubloon should rewind or hold history');

await page.evaluate(async () => {
  const { voyageUI } = await import('/js/voyage/ui.js');
  await voyageUI.handlers.useAbility('deepsea.sonar');
});
await settle(page);

assert.equal(errors.length, 0, errors.join('\n'));
await browser.close();
console.log('v2-c4-browser OK');
