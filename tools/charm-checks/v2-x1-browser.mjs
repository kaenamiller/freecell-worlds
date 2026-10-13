import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { clickTarget, clickChoice } from './_browser-pick.mjs';

// The content harness imports every extension; browser work runs only explicitly.
export async function check() {}

async function browserCheck() {
  const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
  const puppeteer = require('puppeteer-core');
  const base = process.env.VOYAGE_TEST_URL || 'http://[::1]:8160';
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = [];
  page.setDefaultTimeout(30000);
  await page.setBypassServiceWorker(true);
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 0.25 });
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    // Renamed charm art is outside x1's module assignment. Supply existing art
    // only in this harness so missing wave assets do not hide runtime errors.
    if (/^\/assets\/art\/charms\/.+\.webp$/.test(pathname) && !existsSync(new URL(`../..${pathname}`, import.meta.url))) {
      request.respond({ status: 200, contentType: 'image/webp', body: readFileSync(new URL('../../assets/art/charms/aero.dolphin.webp', import.meta.url)) });
    } else request.continue();
  });
  page.on('console', (message) => { if (message.type() === 'error') { errors.push(message.text()); console.error(message.text()); } });
  page.on('pageerror', (error) => { errors.push(error.stack); console.error(error.stack); });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('freecellworlds.settings', JSON.stringify({ theme: 'roman', autoRandomTheme: false, autoFoundation: false, reducedMotion: true, muted: true, quality: 'low' }));
    localStorage.setItem('freecellworlds.voyageTutorial', JSON.stringify({ map: true, board: true, reward: true }));
  });
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const settle = async () => {
    try { await page.waitForFunction(() => !FreeCell.busy, { timeout: 45000 }); }
    catch (error) { console.error(await page.evaluate(() => ({ busy: FreeCell.busy, perf: FreeCell.perf, history: FreeCell.historyInfo(), hud: document.getElementById('voyage-hud').innerText }))); throw error; }
    await pause(200);
  };
  const snapshot = () => page.evaluate(() => {
    const cur = FreeCell.voyage.run().current;
    const marks = {}, mods = {};
    FreeCell.scene.traverse((g) => {
      if (!g.isGroup || !g.userData.cardId) return;
      if (g.userData.mark) marks[g.userData.cardId] = g.userData.mark;
      if (g.userData.mods?.length) mods[g.userData.cardId] = g.userData.mods;
    });
    return { state: FreeCell.getState(), rules: cur.liveRules || cur.rules, history: cur.history, memo: cur.memo, marks, mods };
  });
  async function fixture(id, level) {
    await page.evaluate(async ({ id, level }) => {
      const { createRun, startBoard, saveRun } = await import('/js/voyage/run.js');
      const { nextChoices } = await import('/js/voyage/map.js');
      const { baseRules } = await import('/js/voyage/charms.js');
      const r = createRun({ seed: 'x1-browser' });
      Object.assign(r, { boss: 'boss.lockstep', boons: [id], levels: { [id]: level }, undos: 9 });
      const cur = startBoard(r, nextChoices(r.map)[0].id, { deal: id === 'cyber.zeroday' ? 3 : 1, par: 60 });
      cur.theme = 'roman'; cur.challenge = null; cur.rules = baseRules();
      if (id === 'cyber.zeroday') cur.rules.barrenCards = Array.from({ length: 52 }, (_, i) => i + 1);
      cur.active = [{ id, kind: 'boon', strength: 1, level }]; cur.memo = {}; cur.history = [];
      saveRun(r);
    }, { id, level });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.evaluate(async () => {
      FreeCell.scene.traverse((object) => { if (object.isLight) object.castShadow = false; });
      const { voyageUI } = await import('/js/voyage/ui.js');
      await voyageUI.handlers.continueVoyage();
      FreeCell.scene.traverse((object) => { if (object.isLight) object.castShadow = false; });
    });
    await settle();
  }
  const pickCard = (card) => clickTarget(page, card);
  async function drop(target) {
    const points = await page.evaluate((target) => ({
      source: FreeCell.projectCard(target.card, true),
      dest: FreeCell.projectCard(FreeCell.getState().tableau[target.to].at(-1), true),
    }), target);
    await page.mouse.click(points.source.x, points.source.y);
    await page.mouse.click(points.dest.x, points.dest.y);
    await settle();
  }
  try {
    await page.goto(base, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => !!window.FreeCell && !document.getElementById('loader'));
    for (const id of ['cyber.zeroday', 'aero.dolphin', 'azulejo.glaze', 'winterglass.icicle', 'deepstorage.redaction', 'concrete.spraytag']) for (const level of [1, 2]) {
      console.log(`Checking browser ${id} L${level}`);
      await fixture(id, level);
      const before = await snapshot();
      let target;
      if (['cyber.zeroday', 'winterglass.icicle', 'concrete.spraytag'].includes(id)) {
        target = await page.evaluate(async (id) => {
          const { overrideTargets } = await import('/js/voyage/content/special/concrete.spraytag.js');
          const { canPlaceTableau } = await import('/js/rules.js');
          const flags = id === 'cyber.zeroday' ? { ignoreRestrictions: true } : id === 'winterglass.icicle' ? { rankGap: 2 } : { ignoreColour: true, ignoreCap: true };
          const st = FreeCell.getState(), rules = FreeCell.voyage.run().current.rules;
          return overrideTargets({ api: { state: st, rules, concealed: [] } }, flags).find((m) => !canPlaceTableau(st, m.to, m.card, m.count, rules));
        }, id);
        assert(target, `${id}: additional drop capability`);
      }
      const pending = page.evaluate(async (id) => {
        const { voyageUI } = await import('/js/voyage/ui.js');
        await voyageUI.handlers.useAbility(id);
      }, id);
      if (id === 'aero.dolphin') await pickCard(1);
      else if (id === 'azulejo.glaze') {
        // Glaze: the card, then its menu: ▼ (index 0) at L1, ▲ (index 1) at L2.
        await pickCard(24); await clickChoice(page, level === 1 ? 0 : 1);
      } else if (id === 'deepstorage.redaction') await pickCard(before.state.tableau[0].at(-1));
      else {
        await settle(); await drop(target);
      }
      await pending;
      await page.waitForFunction(() => FreeCell.voyage.run().current.history.length === 1, { timeout: 20000 });
      await settle();
      const after = await snapshot();
      assert.equal(after.memo[id]._runtime.abilityUses, level - 1);
      if (id === 'aero.dolphin') { assert.equal(after.state.found[0], 1); assert.equal(after.history[0].t, 'X'); }
      if (id === 'azulejo.glaze') { assert.equal(after.rules.rankShift[24], level === 1 ? -1 : 1); assert.deepEqual(after.mods[24], [level === 1 ? 'mod-rank-down-10' : 'mod-rank-up-12']); }
      if (id === 'deepstorage.redaction') { assert(after.rules.anchorCards.includes(before.state.tableau[0].at(-1))); assert.deepEqual(after.mods[before.state.tableau[0].at(-1)], ['mod-anchor']); }
      // Save/reload restores mutated rules, custom descriptors and ability uses.
      await page.reload({ waitUntil: 'networkidle0' });
      await page.evaluate(async () => { const { voyageUI } = await import('/js/voyage/ui.js'); await voyageUI.handlers.continueVoyage(); });
      await settle();
      const resumed = await snapshot();
      assert.deepEqual(resumed.state, after.state); assert.deepEqual(resumed.rules, after.rules);
      await page.click('#btn-undo'); await settle();
      const undone = await snapshot();
      assert.deepEqual(undone.state, before.state); assert.deepEqual(undone.rules, before.rules);
      assert.equal(undone.history.length, 0); assert.equal(undone.memo[id]._runtime.abilityUses, level);
      if (id === 'azulejo.glaze') assert(!undone.mods[24]);
      if (id === 'deepstorage.redaction') assert(!undone.mods[before.state.tableau[0].at(-1)]);
      console.log(`OK: browser ${id} L${level} use, resume and undo`);
    }
    assert.deepEqual(errors, [], 'no browser console/page errors');
    console.log('OK: x1 browser checks on port 8160');
  } finally { await browser.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await browserCheck();
