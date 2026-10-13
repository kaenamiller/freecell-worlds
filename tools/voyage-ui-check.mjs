// Headless snapshots for the standalone Voyage preview.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const cases = [
  ['tree-start-desktop', 1440, 900, 'map1', 'roman'],
  ['tree-start-phone', 390, 844, 'map1', 'roman'],
  ['tree-one-pick-desktop', 1440, 900, 'map2', 'roman'],
  ['tree-one-pick-phone', 390, 844, 'map2', 'roman'],
  ['tree-board6-desktop', 1440, 900, 'map6', 'roman'],
  ['tree-board6-phone', 390, 844, 'map6', 'roman'],
  ['title-classic-desktop', 1440, 900, 'title-classic', 'roman'],
  ['title-classic-phone', 390, 844, 'title-classic', 'roman'],
  ['title-voyage-desktop', 1440, 900, 'title-voyage', 'roman'],
  ['title-voyage-phone', 390, 844, 'title-voyage', 'roman'],
  ['title-classic-run-desktop', 1440, 900, 'title-classic-run', 'roman'],
  ['title-classic-run-phone', 390, 844, 'title-classic-run', 'roman'],
  ['title-voyage-run-desktop', 1440, 900, 'title-voyage-run', 'roman'],
  ['title-voyage-run-phone', 390, 844, 'title-voyage-run', 'roman'],
  ['desktop-map', 1440, 900, 'map4', 'roman'],
  ['phone-map', 390, 844, 'map4', 'roman'],
  ['desktop-map-light', 1440, 900, 'map1', 'azulejo'],
  ['phone-map-light', 390, 844, 'map1', 'jetset'],
  ['desktop-boss', 1440, 900, 'map-final', 'space'],
  ['desktop-hud', 1920, 1080, 'hud3', 'azulejo'],
  ['laptop-hud', 1440, 900, 'hud3', 'azulejo'],
  ['phone-hud', 390, 844, 'hud3', 'zen'],
  ['desktop-reward', 1440, 900, 'result3', 'forest'],
  ['phone-reward', 390, 844, 'result3', 'muertos'],
  ['phone-end', 390, 844, 'end-win', 'aero'],
  ['desktop-title', 1440, 900, 'title-classic', 'roman'],
  ['phone-title', 390, 844, 'title-classic', 'roman'],
  ['phone-intro', 390, 844, 'intro7', 'jetset'],
  ['desktop-final-result', 1440, 900, 'result7', 'roman'],
  ['phone-stats', 390, 844, 'stats', 'roman'],
  ['phone-confirm', 390, 844, 'confirm', 'zen'],
  ['phone-tutorial-map', 390, 844, 'tutorial-map', 'roman'],
  ['phone-tutorial-board', 390, 844, 'tutorial-board', 'roman'],
  ['phone-tutorial-reward', 390, 844, 'tutorial-reward', 'roman'],
  ['phone-loss', 390, 844, 'end-loss', 'riverboat'],
];
for (const screen of ['port', 'port-grand', 'port-poor', 'port-spent', 'sticker-picker', 'boss-intro', 'hud-finale', 'hud-curse', 'map-confiscation', 'result-coins', 'sticker-marks', 'end-win', 'reward-two', 'service-card', 'service-boon', 'map-storm', 'intro-storm', 'hud-storm', 'result-storm']) {
  for (const [size, width, height] of [['desktop', 1024, 768], ['mobile', 390, 844]]) cases.push([`k2b-${screen}-${size}`, width, height, screen, 'roman']);
}
for (const screen of ['chart-start', 'chart-mid', 'map-storm', 'map-confiscation', 'chart-lookahead-2', 'chart-lookahead-3', 'chart-lookahead-4', 'chart-readonly', 'chart-sail', 'chart-docking', 'chart-late', 'chart-board7-readonly', 'chart-boss-selected']) {
  for (const [size, width, height] of [['desktop', 1024, 768], ['mobile', 390, 844]]) cases.push([`${screen}-${size}`, width, height, screen, 'roman']);
}
for (const theme of ['azulejo', 'jetset', 'space', 'muertos']) cases.push([`k2b-port-${theme}`, 390, 844, 'port', theme]);
const base = process.env.VOYAGE_TEST_URL || 'http://localhost:8144';
const output = process.env.VOYAGE_SHOTS || '/tmp/k2b-shots';
const requested = new Set(process.argv.slice(2));
mkdirSync(output, { recursive: true });
const failures = [];
try {
for (const [name, width, height, screen, theme] of cases) {
  if (requested.size && !requested.has(name) && !(requested.has('chart') && (screen.startsWith('chart-') || ['map-storm', 'map-confiscation'].includes(screen)))) continue;
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() === 404 && !r.url().includes('/assets/art/charms/')) errors.push(`404 ${r.url()}`); });
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`${base}/tools/voyage-ui-preview.html?screen=${screen}&theme=${theme}&clean=1`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.preview).catch((e) => { throw new Error(`${name}: ${errors.join('; ') || e.message}`); });
  await new Promise((r) => setTimeout(r, 1800));
  const path = `${output}/${name}.png`;
  await page.screenshot({ path });
  const metrics = await page.evaluate(() => ({
    screen: document.getElementById('preview-screen').value,
    hScroll: document.documentElement.scrollWidth > innerWidth,
    chartScroll: document.getElementById('voyage-map-scroll').scrollWidth > document.getElementById('voyage-map-scroll').clientWidth,
    clippedControls: [...document.querySelectorAll('#voyage-hud button, #voyage-dock > .voyage-hud-buttons button')].filter((e) => { const r = e.getBoundingClientRect(); return e.getClientRects().length && (r.left < -1 || r.right > innerWidth + 1); }).map((e) => e.id),
    overflow: [...document.querySelectorAll('.voyage-screen,.voyage-overlay,.voyage-stall,.voyage-charm-card,.voyage-suit-row')].filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 2).map((e) => e.id || e.className),
    visible: [...document.querySelectorAll('.voyage-screen,.voyage-overlay')].filter((e) => !e.hidden).map((e) => e.id),
    smallIslands: [...document.querySelectorAll('.voyage-island')].filter((e) => { const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length,
  }));
  if (errors.length || metrics.hScroll || metrics.chartScroll || metrics.overflow.length || metrics.clippedControls.length || metrics.smallIslands || metrics.screen !== screen) failures.push({ name, metrics, errors });
  console.log(name, JSON.stringify({ path, metrics, errors }));
  if (screen.startsWith('chart-') || ['map-storm', 'map-confiscation'].includes(screen)) {
    const quality = await inspectChart(page);
    if (quality.overlaps.length || quality.clippedNames.length || !quality.bossVisible) failures.push({ name, quality });
    const layout = await page.evaluate(() => {
      const root = document.querySelector('.voyage-chart-world').getBoundingClientRect();
      return [...document.querySelectorAll('.voyage-island')].filter(e => { const r = e.getBoundingClientRect(); return r.left < root.left - 1 || r.right > root.right + 1 || r.top < root.top - 1 || r.bottom > root.bottom + 1; }).map(e => e.dataset.node);
    });
    if (layout.length) failures.push({ name, clippedIslands: layout });
    if (width === 390 || screen === 'chart-lookahead-4') {
      await page.$eval('#voyage-map-scroll', e => { e.scrollTop = 0; });
      await page.screenshot({ path: `${output}/${name}-horizon.png` });
    }
    // Inspect every past column, including those intentionally offscreen at entry.
    if (['chart-mid', 'chart-late', 'chart-board7-readonly', 'map-confiscation'].includes(screen)) {
      const stops = await page.evaluate(() => {
        const c = window.preview.voyageUI.chart, s = document.getElementById('voyage-map-scroll');
        const stride = Math.max(160, Math.floor((c.geo.viewW - 160) / 160) * 160);
        return c.portrait ? Array.from({ length: Math.ceil(s.scrollHeight / (s.clientHeight - 110)) }, (_, i) => i * (s.clientHeight - 110))
          : Array.from({ length: Math.ceil(c.geo.initialPan / stride) }, (_, i) => i * stride);
      });
      for (let i = 0; i < stops.length; i++) {
        await page.evaluate(stop => {
          const c = window.preview.voyageUI.chart;
          if (c.portrait) document.getElementById('voyage-map-scroll').scrollTop = stop;
          else c.setPan(stop);
        }, stops[i]);
        await page.screenshot({ path: `${output}/${name}-history-${i + 1}.png` });
      }
    }
  }
  if (screen === 'port' && name.startsWith('k2b-port-') && ['k2b-port-desktop', 'k2b-port-mobile'].includes(name)) {
    for (const title of ['Stickers', 'Provisions', 'Sell', 'Reroll', 'Special services']) {
      await page.evaluate((title) => {
        const stall = [...document.querySelectorAll('.voyage-stall')].find((e) => e.querySelector('h3').textContent === title);
        const scroll = document.getElementById('voyage-port-stalls'); scroll.scrollTop += stall.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
      }, title);
      await page.screenshot({ path: `${output}/${name}-${title.toLowerCase().replaceAll(' ', '-')}.png` });
    }
  }
  if (screen === 'sticker-marks' && width === 390) {
    await page.evaluate(() => { const e = document.getElementById('preview-marks'); e.scrollTop = e.scrollHeight; });
    await page.screenshot({ path: `${output}/${name}-lower.png` });
  }
  await page.close();
}
if (requested.has('chart') || requested.has('chart-interactions')) {
  for (const width of [1024, 390]) await checkChartInteractions(width);
}
if (requested.has('chart') || requested.has('chart-hover')) await checkHoverFrames();
if (requested.has('live')) await checkLive();
if (!requested.size || requested.has('interactions')) {
  for (const width of [1024, 390]) await checkInteractions(width);
}
} finally { await browser.close(); }
assert.deepEqual(failures, [], 'Preview errors or unintended overflow');

async function inspectChart(page) {
  return page.evaluate(() => {
    const islands = [...document.querySelectorAll('.voyage-island')];
    const overlaps = [];
    for (let i = 0; i < islands.length; i++) for (let j = i + 1; j < islands.length; j++) {
      const a = islands[i].getBoundingClientRect(), b = islands[j].getBoundingClientRect();
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) overlaps.push([islands[i].dataset.node, islands[j].dataset.node]);
    }
    const clippedNames = islands.filter(e => {
      const n = e.querySelector('.voyage-island-name'), style = getComputedStyle(n);
      return n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1 || style.textOverflow === 'ellipsis';
    }).map(e => e.title);
    const boss = document.querySelector('[data-node="__boss__"]').getBoundingClientRect();
    const viewport = document.getElementById('voyage-map-scroll').getBoundingClientRect();
    const bossVisible = boss.left >= viewport.left && boss.right <= viewport.right && boss.top >= viewport.top && boss.bottom <= viewport.bottom;
    return { overlaps, clippedNames, bossVisible };
  });
}

// Real DOM interactions verify intent dispatch and picker/card-slot invariants.
async function checkInteractions(width) {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.setViewport({ width, height: width === 390 ? 844 : 768, deviceScaleFactor: 1, isMobile: width === 390, hasTouch: width === 390 });
  const reset = async (screen = 'port') => {
    await page.goto(`${base}/tools/voyage-ui-preview.html?screen=${screen}&clean=1`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.preview);
  };
  const calls = () => page.evaluate(() => window.preview.calls);
  try {
    await reset();
    await page.click('[data-port-action="sticker"][data-offer="0"]');
    assert.equal(await page.$$eval('[data-sticker-card]', (e) => e.length), 52);
    assert.deepEqual(await page.$$eval('.voyage-suit-row', (e) => e.map((r) => r.getAttribute('aria-label'))), ['Clubs', 'Diamonds', 'Hearts', 'Spades']);
    assert.match(await page.$eval('[data-sticker-card="1"]', (e) => e.getAttribute('aria-label')), /A of clubs.*Wild sticker/);
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.stickerCard), '14');
    await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift'); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.getElementById('voyage-sticker-picker').contains(document.activeElement)), true);
    await page.keyboard.press('Escape');
    assert.equal((await calls()).length, 0);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.portAction), 'sticker');
    await page.click('[data-port-action="sticker"][data-offer="0"]');
    if (width === 390) await page.tap('[data-sticker-card="52"]');
    else await page.click('[data-sticker-card="52"]');
    assert.deepEqual((await calls()).at(-1), { name: 'portBuySticker', args: [0, 52] });
    await page.click('[data-port-action="sell"][data-id="preview.cell"]');
    assert.equal(await page.$eval('#voyage-confirm', (e) => e.hidden), false);
    await page.screenshot({ path: `${output}/k2b-sell-confirm-${width}.png` });
    await page.keyboard.press('Escape');
    assert.equal((await calls()).length, 1);
    await page.click('[data-port-action="sell"][data-id="preview.cell"]');
    await page.click('#voyage-confirm-ok');
    assert.deepEqual((await calls()).at(-1), { name: 'portSell', args: ['preview.cell'] });
    await reset();
    for (const [screen, action, id, handler] of [['port-charms', 'boon', 'preview.wild', 'portBuyBoon'], ['port-grand', 'upgrade', 'preview.coin', 'portUpgrade'], ['port', 'undo', null, 'portBuyUndo'], ['port', 'reroll', null, 'portReroll']]) {
      await reset(screen);
      await page.click(`[data-port-action="${action}"]${id ? `[data-id="${id}"]` : ''}`);
      assert.equal((await calls()).at(-1).name, handler);
      if (id) assert.equal((await calls()).at(-1).args[0], id);
    }
    await reset();
    await page.click('[data-port-action="service"][data-id="preview.copy"]');
    await page.click('[data-sticker-card="27"]');
    assert.deepEqual((await calls()).at(-1), { name: 'portService', args: ['preview.copy', 27] });
    await page.click('[data-port-action="service"][data-id="preview.boon"]');
    await page.click('[data-service-boon="preview.cell"]');
    assert.deepEqual((await calls()).at(-1), { name: 'portService', args: ['preview.boon', 'preview.cell'] });
    await page.click('[data-port-action="service"][data-id="preview.supplies"]');
    assert.equal((await calls()).at(-1).args[0], 'preview.supplies');
    await page.click('[data-port-action="leave"]');
    assert.equal((await calls()).at(-1).name, 'portLeave');
    await reset('port-grand');
    assert.equal(await page.$eval('#voyage-port-title', (e) => e.textContent), 'Upgrade market');
    assert.equal(await page.$$eval('[data-port-action="boon"], [data-port-action="sticker"]', (e) => e.length), 0);
    assert.equal(await page.$eval('[data-port-action="reroll"]', (e) => e.disabled), true);
    await reset('port-charms');
    assert.equal(await page.$eval('#voyage-port-title', (e) => e.textContent), 'Charm market');
    assert.equal(await page.$$eval('[data-port-action="boon"]', (e) => e.length), 3);
    await reset('port-poor');
    assert.equal(await page.$$eval('[data-port-action="boon"], [data-port-action="sticker"], [data-port-action="upgrade"], [data-port-action="undo"], [data-port-action="reroll"]', (buttons) => buttons.every((b) => b.disabled)), true);
    assert.match(await page.$eval('#voyage-port', (e) => e.textContent), /Need 37 more coins/);
    await reset('port-spent');
    assert.equal(await page.$eval('[data-port-action="reroll"]', (e) => e.disabled), true);
    assert.equal(await page.$eval('[data-port-action="undo"]', (e) => e.disabled), true);
    await reset('reward-two');
    assert.match(await page.$eval('.voyage-reward .voyage-kicker', (e) => e.textContent), /Choose 2/);
    await page.click('[data-pick-charm="preview.cell"]');
    assert.equal(await page.$$eval('[data-pick-charm]', (e) => e.length), 2);
    assert.match(await page.$eval('.voyage-reward .voyage-kicker', (e) => e.textContent), /Choose one/);
    await reset('hud-finale');
    assert.equal(await page.$$eval('.voyage-tray-item.confiscated', (e) => e.length), 1);
    assert.match(await page.$eval('#voyage-hud-challenge', (e) => e.textContent), /Challenge.*Confiscates: Travelling Cell/);
    assert.equal(await page.$eval('#voyage-undo-cap', (e) => e.textContent), 'charm undos 1/3');
    await reset('map-storm');
    assert.equal(await page.$$eval('.voyage-node-storm', (e) => e.length >= 1), true);
    assert.match(await page.$eval('#voyage-map-detail', (e) => e.textContent), /Rough Seas.*Double coins/);
    await reset('chart-start');
    assert.equal(await page.$$eval('.voyage-island.available', (items) => items.length), 3);
    assert.equal(await page.$eval('#voyage-chart', (e) => e.dataset.orientation), width === 390 ? 'portrait' : 'landscape');
    assert.match(await page.$eval('[data-node="__boss__"]', (e) => e.getAttribute('aria-label')), /boss/i);
    await page.keyboard.press(width === 390 ? 'ArrowUp' : 'ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('voyage-island')), true);
    assert.match(await page.$eval('.voyage-island.available', (e) => e.getAttribute('aria-label')), /Challenge/);
    await reset('chart-readonly');
    assert.equal(await page.$('[data-sail]'), null);
    const fog2 = await reset('chart-lookahead-2').then(() => page.$eval('.voyage-fog-mask rect', (e) => [e.getAttribute('x'), e.getAttribute('y'), e.getAttribute('width'), e.getAttribute('height')]));
    const fog3 = await reset('chart-lookahead-3').then(() => page.$eval('.voyage-fog-mask rect', (e) => [e.getAttribute('x'), e.getAttribute('y'), e.getAttribute('width'), e.getAttribute('height')]));
    assert.notDeepEqual(fog2, fog3);
    await reset('chart-sail');
    assert.equal(await page.$eval('#voyage-chart', (e) => e.classList.contains('is-sailing')), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('#voyage-chart', (e) => e.classList.contains('is-sailing')), false);
    await reset('chart-docking');
    assert.equal(await page.$$eval('.voyage-market.docking .voyage-harbour-mark', (e) => e.length), 1);
    await reset('chart-late');
    const late = await page.evaluate(() => {
      const view = window.preview.scenes.find((s) => s.id === 'chart-late').view;
      const nodes = view.map.flat();
      const counts = nodes.reduce((acc, n) => { acc[n.state] = (acc[n.state] || 0) + 1; return acc; }, {});
      const t0 = performance.now();
      const geo = window.preview.voyageUI.chart.layout(view);
      return {
        ms: performance.now() - t0,
        counts,
        nodes: nodes.length,
        points: geo.points.size,
        ports: nodes.filter((n) => n.port).length,
        finals: nodes.filter((n) => n.final).length,
      };
    });
    assert.ok((late.counts.visited || 0) + (late.counts.current || 0) >= 5, `chart-late history ${JSON.stringify(late)}`);
    assert.ok((late.counts.skipped || 0) >= 6, `chart-late skipped ${JSON.stringify(late)}`);
    assert.ok((late.counts.available || 0) >= 1 && late.finals >= 1, `chart-late port/finale ${JSON.stringify(late)}`);
    assert.ok(late.ms < 50, `chart-late layout ${late.ms}ms ${JSON.stringify(late)}`);
    console.log(`chart-late layout ${late.ms.toFixed(2)}ms`, late.counts);
    await reset('hud-storm');
    assert.match(await page.$eval('#voyage-hud-challenge', (e) => e.textContent), /Storm · Challenge/);
    assert.match(await page.$eval('.voyage-effect-chip.storm', (e) => e.getAttribute('aria-label')), /Rough Seas/);
    await reset('sticker-marks');
    const marks = await page.evaluate(async () => {
      const p = window.preview, g = p.markGroups[0], u = g.userData;
      p.setCardConcealed(g, true); const concealed = !u.markMesh.visible && !u.stickerMesh.visible;
      p.setCardConcealed(g, false); p.applyCardStyle(g, (await import('../js/themes.js')).THEMES.roman.card);
      const reskinned = u.mark === 'lock' && u.sticker === 'sticker-wild' && u.markMesh.visible && u.stickerMesh.visible;
      p.setCardMark(g, 'sticker-key'); const compatible = u.mark === 'lock' && u.sticker === 'sticker-key';
      p.setCardMark(g, null); const independent = !u.markMesh.visible && u.stickerMesh.visible;
      p.setCardSticker(g, null); const clear = !u.stickerMesh.visible;
      return { concealed, reskinned, compatible, independent, clear };
    });
    assert.equal(Object.values(marks).every(Boolean), true, JSON.stringify(marks));
    await reset('end-win');
    assert.match(await page.$eval('.voyage-end-stickers', (e) => e.textContent), /Wild.*Fool.*Key.*Gold.*Lucky/);
    assert.match(await page.$eval('.voyage-end-row em', (e) => e.textContent), /Travelling Cell.*Harbour Purse/);
    assert.deepEqual(errors, []);
    console.log(`interactions-${width}: all port handlers, cancel/confirm, services, reward picks, card ids and independent marks passed`);
  } finally { await page.close(); }
}


async function checkChartInteractions(width) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: width === 390 ? 844 : 768, isMobile: width === 390, hasTouch: width === 390 });
  const reset = async (screen = 'chart-start') => {
    await page.goto(`${base}/tools/voyage-ui-preview.html?screen=${screen}&clean=1`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.preview);
  };
  const count = () => page.evaluate(() => window.preview.calls.filter(c => c.name === 'pickNode').length);
  try {
    await reset();
    const ids = await page.$$eval('.voyage-island.available', els => els.map(e => e.dataset.node));
    const tap = async id => width === 390 ? page.tap(`[data-node="${id}"]`) : page.click(`[data-node="${id}"]`);
    await tap(ids[0]); assert.equal(await count(), 0, 'First tap inspects');
    await tap(ids[1]); assert.equal(await count(), 0, 'First tap on a different island inspects');
    await tap(ids[1]); assert.equal(await count(), 1, 'Second tap commits once');
    await reset(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    assert.equal(await count(), 1, 'Arrow / Enter commits');
    await reset('chart-readonly');
    assert.equal(await page.$('[data-sail]'), null);
    await page.keyboard.press('Enter'); assert.equal(await count(), 0);
    await page.keyboard.press('Escape'); assert.equal(await page.$eval('#voyage-map', e => e.hidden), true);
    await reset('chart-sail'); await page.keyboard.press('Escape');
    assert.equal(await page.$eval('#voyage-chart', e => e.classList.contains('is-sailing')), false);
    await reset('chart-sail'); await page.click('#voyage-chart');
    assert.equal(await page.$eval('#voyage-chart', e => e.classList.contains('is-sailing')), false);
    await reset('chart-docking'); await page.keyboard.press('Escape');
    assert.equal(await page.$eval('#voyage-chart', e => e.classList.contains('is-docking')), false);
    await reset();
    const motion = await page.evaluate(async () => {
      const u = window.preview.voyageUI, id = u.selectedNode;
      const settings = (await import('../js/store.js')).settings;
      settings.reducedMotion = true; await u.sailTo(id);
      const cut = !u.chart.motion;
      settings.reducedMotion = false;
      const t = performance.now(), p = u.sailTo(id); u.finishSailingSoon(180); await p;
      const fast = performance.now() - t;
      u.hideMap();
      const paused = u.chart.root.classList.contains('chart-paused') && !u.chart.motion;
      u.showMap(window.preview.scenes.find(s => s.id === 'chart-start').view);
      const resumed = !u.chart.root.classList.contains('chart-paused');
      return { cut, fast, paused, resumed };
    });
    assert.equal(motion.cut && motion.paused && motion.resumed, true);
    assert.ok(motion.fast < 300, `Prepared sailing adds ${motion.fast}ms`);
    // Simulate an unavailable image without introducing a network error.
    const fallback = await page.$eval('.voyage-island-art img', img => { img.dispatchEvent(new Event('error')); return img.hidden && getComputedStyle(img.nextElementSibling).display !== 'none'; });
    assert.equal(fallback, true);
    await reset('chart-lookahead-2');
    const fog2 = await page.evaluate(() => window.preview.voyageUI.chart.geo.edge);
    await reset('chart-lookahead-3');
    const fog3 = await page.evaluate(() => window.preview.voyageUI.chart.geo.edge);
    assert.ok(width === 390 ? fog3 < fog2 : fog3 > fog2, 'Lookout pushes fog in the direction of travel');
    await reset('chart-start');
    const beforeHover = await page.$eval('#voyage-map-detail h3', (e) => e.textContent);
    const other = await page.$$eval('.voyage-island.available', (els) => els[1]?.dataset.node);
    if (other) await page.hover(`[data-node="${other}"]`);
    assert.equal(await page.$eval('#voyage-map-detail h3', (e) => e.textContent), beforeHover, 'Hover does not change the sidebar');
    await tap(other);
    const chosenRoute = await page.evaluate(() => window.preview.voyageUI.mapRouteNode);
    const quality = await inspectChart(page);
    assert.equal(quality.bossVisible, true, 'Boss is fully visible without panning');
    await page.click('[data-node="__boss__"]');
    assert.match(await page.$eval('#voyage-map-detail', (e) => e.textContent), /Final boss|Waits on board/);
    assert.equal(await page.$('[data-sail]'), null);
    await page.click('[data-back-route]');
    assert.ok(await page.$('[data-sail]'), 'Back to route restores Set course');
    assert.equal(await page.evaluate(() => window.preview.voyageUI.selectedNode), chosenRoute, 'Boss inspection preserves the selected route');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.node), '__boss__', 'Boss is keyboard reachable');
    assert.equal(await count(), 0, 'Boss inspection never commits a course');
    if (width !== 390) {
      await reset();
      const island = await page.$eval('.voyage-island.available', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      const selected = await page.evaluate(() => window.preview.voyageUI.selectedNode);
      await page.mouse.move(island.x, island.y); await page.mouse.down();
      await page.mouse.move(island.x - 90, island.y, { steps: 8 }); await page.mouse.up();
      assert.equal(await count(), 0, 'Dragging an island never commits');
      assert.equal(await page.evaluate(() => window.preview.voyageUI.selectedNode), selected, 'Dragging an island never inspects');
      assert.ok(await page.evaluate(() => window.preview.voyageUI.chart.panX > 60), 'Dragging pans');
      const bossPoint = await page.$eval('[data-node="__boss__"]', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await page.mouse.move(bossPoint.x, bossPoint.y); await page.mouse.down();
      await page.mouse.move(bossPoint.x - 45, bossPoint.y, { steps: 6 }); await page.mouse.up();
      assert.equal(await page.evaluate(() => window.preview.voyageUI.selectedNode), selected, 'Dragging the boss never inspects');
      assert.equal(await count(), 0, 'Dragging the boss never commits');
      await page.keyboard.down('Shift'); await page.mouse.wheel({ deltaY: 60 }); await page.keyboard.up('Shift');
      await new Promise(r => setTimeout(r, 80));
      const shiftPan = await page.evaluate(() => window.preview.voyageUI.chart.panX);
      assert.ok(shiftPan > 100, 'Shift-wheel pans');
      await page.mouse.wheel({ deltaX: -50 }); await new Promise(r => setTimeout(r, 80));
      assert.ok(await page.evaluate(() => window.preview.voyageUI.chart.panX) < shiftPan, 'Trackpad pans');
      assert.equal((await inspectChart(page)).bossVisible, true, 'Boss remains pinned during pan');
      const pan = await page.evaluate(() => {
        const chart = window.preview.voyageUI.chart;
        chart.setPan(160);
        return { pan: chart.panX, max: chart.maxPan, ghost: !!document.querySelector('.voyage-sea-lane.ghost'), isles: document.querySelectorAll('.voyage-fog-isle').length };
      });
      assert.ok(pan.max > 40 && pan.pan > 0, `pan ${JSON.stringify(pan)}`);
      assert.ok(pan.ghost && pan.isles >= 3, `fog tease ${JSON.stringify(pan)}`);
      await reset('chart-late');
      const history = await page.evaluate(() => {
        const c = window.preview.voyageUI.chart, nodes = c.view.map.flat();
        const columns = [...new Set(nodes.map(n => n.row))].sort((a,b) => a - b).map(row => c.geo.points.get(nodes.find(n => n.row === row).id).x);
        return { gaps: columns.slice(1).map((x,i) => x - columns[i]), pan: c.panX };
      });
      assert.ok(history.gaps.every(gap => gap >= 150), 'Every past column retains readable spacing');
      assert.ok(history.pan > 400, 'Late entry camera leaves full history off to the left');
    }
    console.log(`chart-interactions-${width}: tap, keyboard, read-only, skip, reduced motion, pause/resume, fallback, fog, hover, boss passed; prepared sail ${motion.fast.toFixed(0)}ms`);
  } finally { await page.close(); }
}

// Record the actual hover transition as PNGs and sample each animation frame.
// A stable glow gradient/opacity/filter is the no-flash invariant; only scale moves.
async function checkHoverFrames() {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1024, height: 768 });
    await page.goto(`${base}/tools/voyage-ui-preview.html?screen=chart-start&clean=1`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.preview);
    await page.mouse.move(900, 40);
    await page.evaluate(() => document.getElementById('voyage-chart').classList.add('chart-paused'));
    const clip = await page.$eval('.voyage-island.available', e => {
      const r = e.getBoundingClientRect(); return { x: Math.floor(r.x - 22), y: Math.floor(r.y - 22), width: Math.ceil(r.width + 44), height: Math.ceil(r.height + 44) };
    });
    const sample = () => {
      const e = document.querySelector('.voyage-island.available'), g = e.querySelector('.voyage-island-glow');
      const s = getComputedStyle(e), glow = getComputedStyle(g), art = getComputedStyle(e.querySelector('img'));
      return { ms: performance.now() - window.hoverStart, scale: new DOMMatrix(s.transform).a, background: glow.backgroundImage, opacity: glow.opacity, filter: glow.filter, artFilter: art.filter };
    };
    await page.evaluate(() => { window.hoverStart = performance.now(); });
    const baseline = await page.evaluate(sample);
    await page.screenshot({ path: `${output}/hover-00.png`, clip, captureBeyondViewport: false });
    await page.evaluate(sampleSource => {
      const read = (0, eval)(`(${sampleSource})`);
      window.hoverStart = performance.now(); window.hoverSamples = [];
      const record = () => { const s = read(); window.hoverSamples.push(s); if (s.ms < 420) requestAnimationFrame(record); };
      requestAnimationFrame(record);
    }, sample.toString());
    const started = Date.now();
    await page.hover('.voyage-island.available');
    for (let i = 1; i <= 8; i++) {
      const remaining = started + i * 40 - Date.now();
      if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
      await page.screenshot({ path: `${output}/hover-${String(i).padStart(2, '0')}.png`, clip, captureBeyondViewport: false });
    }
    await page.waitForFunction(() => window.hoverSamples.at(-1)?.ms >= 420);
    const frames = await page.evaluate(() => window.hoverSamples);
    writeFileSync(`${output}/hover-measurements.json`, JSON.stringify({ baseline, frames }, null, 2));
    assert.ok(frames.length >= 10, 'Hover measured across animation frames');
    for (const frame of frames) {
      for (const key of ['background', 'opacity', 'filter', 'artFilter']) assert.equal(frame[key], baseline[key], `Hover glow ${key} remains steady at ${frame.ms.toFixed(0)}ms`);
      assert.ok(frame.scale >= .999 && frame.scale <= 1.051, 'Hover scale stays in bounds');
    }
    assert.ok(frames.at(-1).scale >= 1.049, 'Hover reaches its final scale');
    assert.ok(frames.every((frame, i) => i === 0 || frame.scale >= frames[i - 1].scale - .001), 'Hover scale grows monotonically');
    console.log(`chart-hover: ${frames.length} frames, scale ${frames[0].scale.toFixed(3)} → ${frames.at(-1).scale.toFixed(3)}, steady glow and image filter`);
  } finally { await page.close(); }
}

async function checkLive() {
  const times = {};
  for (const mode of ['baseline', 'animated', 'reduced']) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      await page.setViewport({ width: 1024, height: 768 });
      await page.goto(base, { waitUntil: 'networkidle0' });
      await page.evaluate(async () => {
        const { createRun, saveRun } = await import('/js/voyage/run.js');
        saveRun(createRun({ seed: 'chart-live-prepared' }));
        localStorage.setItem('freecellworlds.voyageTutorial', JSON.stringify({ map: true, board: true, reward: true }));
      });
      await page.reload({ waitUntil: 'networkidle0' });
      await page.click('#btn-voyage');
      await page.waitForFunction(() => !document.getElementById('voyage-map').hidden);
      await page.evaluate(async mode => {
        const { loadRun, upcomingPlans } = await import('/js/voyage/run.js');
        const { prepare: prepareDeals } = await import('/js/voyage/dealer.js');
        const r = loadRun(); await prepareDeals(upcomingPlans(r), { seed: r.seed, exclude: [] });
        const { voyageUI: u } = await import('/js/voyage/ui.js');
        const { settings } = await import('/js/store.js');
        settings.reducedMotion = mode === 'reduced';
        if (mode === 'baseline') u.sailTo = () => Promise.resolve();
        const sail = u.sailTo.bind(u);
        u.sailTo = (...args) => { window.liveSailStart = performance.now(); window.liveSailSeen = true; return sail(...args); };
        window.liveReduced = settings.reducedMotion;
      }, mode);
      await page.evaluate(() => {
        window.liveClick = performance.now();
        document.querySelector('[data-sail]').click();
        window.liveAnimating = document.getElementById('voyage-chart').classList.contains('is-sailing');
      });
      await page.waitForFunction(() => !document.getElementById('voyage-intro').hidden, { timeout: 60000, polling: 'raf' });
      const result = await page.evaluate(() => ({ ms: performance.now() - window.liveClick, sailStarted: window.liveSailSeen, animated: window.liveAnimating }));
      assert.equal(result.sailStarted, true);
      assert.equal(result.animated, mode === 'animated');
      times[mode] = result.ms;
      await page.screenshot({ path: `${output}/live-${mode}-intro.png` });
      assert.deepEqual(errors, []);
      console.log(`live-${mode}: ${JSON.stringify(result)}`);
    } finally { await page.close(); }
  }
  assert.ok(times.animated - times.baseline <= 300, `Prepared animation overhead ${times.animated - times.baseline}ms exceeds 300ms`);
  console.log('live-prepared-overhead', (times.animated - times.baseline).toFixed(0), 'ms');
}
