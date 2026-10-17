// Browser regression: saved positions survive mode switches; live effects do not.
// Run with `node serve.mjs 8123`, then `node tools/mode-switch-check.mjs`.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('freecellworlds.settings', JSON.stringify({ theme: 'roman', autoRandomTheme: false, quality: 'low', reducedMotion: true, autoFoundation: false }));
  });
  await page.goto(process.env.VOYAGE_TEST_URL || 'http://localhost:8123');
  await page.waitForFunction(() => window.FreeCell && !document.getElementById('loader'), { timeout: 90000 });
  const settle = () => page.waitForFunction(() => !FreeCell.busy, { timeout: 90000 });
  const state = () => page.evaluate(() => FreeCell.getState());
  const home = () => page.evaluate(async () => (await import('/js/ui.js')).ui.handlers.home());
  const classic = () => page.evaluate(async () => (await import('/js/ui.js')).ui.handlers.play());
  const voyage = () => page.evaluate(async () => (await import('/js/voyage/ui.js')).voyageUI.handlers.continueVoyage());
  const cards = () => page.evaluate(() => FreeCell.scene.children.filter(g => g.userData.frontMat).map(g => ({
    visible: g.visible, mark: g.userData.mark, sticker: g.userData.sticker,
    mods: g.userData.mods, concealed: g.userData.concealed,
  })));
  const clean = list => list.every(c => !c.mark && !c.sticker && !c.mods?.length && !c.concealed);

  await page.evaluate(() => FreeCell.newGame(1));
  await settle();
  await page.evaluate(() => FreeCell.advance(2));
  await settle();
  const classicState = await state();
  await home();
  assert((await cards()).every(c => !c.visible) && clean(await cards()), 'menu unloads the active cards');
  const classicSave = await page.evaluate(() => localStorage.getItem('freecellworlds.game'));

  // Restore a Voyage with a different deal, challenge marks, and a key sticker.
  await page.evaluate(async () => {
    const { createRun, startBoard, saveRun } = await import('/js/voyage/run.js');
    const { nextChoices } = await import('/js/voyage/map.js');
    const { baseRules } = await import('/js/voyage/charms.js');
    const r = createRun({ seed: 'mode-switch' });
    r.stickers = { 48: 'key' };
    const cur = startBoard(r, nextChoices(r.map)[0].id, { deal: 2, par: 60 });
    cur.theme = 'roman';
    cur.rules = baseRules();
    cur.active = [{ id: 'prizelights.puzzle', kind: 'boon', strength: 1, level: 1 }, { id: 'voyage.stickers', kind: 'boon', strength: 1, level: 1 }];
    saveRun(r);
  });
  await voyage();
  await settle();
  await page.evaluate(() => FreeCell.advance(2));
  await settle();
  const voyageState = await state();
  assert((await cards()).some(c => c.sticker === 'sticker-key'), 'Voyage fixture applies its key sticker');
  assert((await cards()).some(c => c.mark), 'Voyage fixture applies challenge marks');
  assert.equal(await page.evaluate(() => localStorage.getItem('freecellworlds.game')), classicSave, 'Voyage deal preserves the Classic save');
  await home();
  assert.equal(await page.evaluate(() => FreeCell.voyage.run()), null, 'menu releases the live Voyage run');
  assert(clean(await cards()), 'menu clears every card overlay');
  await classic();
  await settle();
  assert.deepEqual(await state(), classicState, 'Classic resumes its exact position');
  assert(clean(await cards()), 'Classic contains no Voyage effects');
  assert(await page.evaluate(() => document.body.dataset.mode === 'classic' && !document.getElementById('status-bar').textContent.includes('Board ')), 'Classic replaces the Voyage welcome message');
  await home();
  await voyage();
  await settle();
  assert.deepEqual(await state(), voyageState, 'Voyage resumes its own position after Classic');
  assert((await cards()).some(c => c.sticker === 'sticker-key'), 'Voyage rebuilds its own sticker');
  await home();
  await page.reload();
  await page.waitForFunction(() => window.FreeCell && !document.getElementById('loader'), { timeout: 90000 });
  await classic();
  await settle();
  assert.deepEqual(await state(), classicState, 'Classic save also survives reload from the menu');
  assert(clean(await cards()));
  assert.deepEqual(errors, []);
  console.log('PASS: Classic ↔ Voyage saves, card resets, welcome message, and menu reload');
} finally {
  await browser.close();
}
