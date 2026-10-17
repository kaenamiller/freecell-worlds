// Analytics check (docs/analytics-plan.md §10, phase 3): lints the event schema, then plays the
// game in headless Chrome against a local stand-in for the /events endpoint and checks what
// arrives. Covers full mode (US), anonymous mode (EU before a choice), accepting consent, the
// Settings off switch, and that nothing at all is collected without ?analytics=debug.
//   node tools/analytics-check.mjs
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { EVENTS, PARAMS, GA_LIMITS, lintSchema } from '../js/analytics-schema.js';

const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');

const GAME_PORT = 8124, API_PORT = 8790;
const GAME = `http://localhost:${GAME_PORT}`, API = `http://localhost:${API_PORT}`;
const failures = [];
const check = (ok, what) => { console.log(`${ok ? '  ok ' : 'FAIL '} ${what}`); if (!ok) failures.push(what); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Schema.
console.log('schema');
const problems = lintSchema();
check(!problems.length, `schema lint${problems.length ? ': ' + problems.join('; ') : ''}`);

// 2. Stand-in /events endpoint.
const batches = [];
const api = createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': req.headers.origin || '*', 'Access-Control-Allow-Credentials': 'true' };
  if (req.method === 'OPTIONS') { res.writeHead(204, { ...cors, 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }
  if (req.url === '/config') { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ country: 'US', consentRequired: false, analytics: { enabled: true } })); }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    try { batches.push({ contentType: req.headers['content-type'], ...JSON.parse(body) }); } catch { batches.push({ bad: body }); }
    res.writeHead(204, cors);
    res.end();
  });
});
await new Promise((r) => api.listen(API_PORT, r));
const game = spawn(process.execPath, ['serve.mjs', String(GAME_PORT)], { stdio: 'ignore' });
await sleep(600);

const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 300000, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });

async function open(region, { debug = true, settings = {}, timezone = null } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  if (timezone) await page.emulateTimezone(timezone);
  await page.setViewport({ width: 960, height: 540 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
  await page.evaluateOnNewDocument((s) => {
    if (!localStorage.getItem('freecellworlds.settings')) localStorage.setItem('freecellworlds.settings', JSON.stringify({ theme: 'roman', quality: 'low', autoRandomTheme: false, ...s }));
  }, settings);
  const q = debug ? `?analytics=debug&analytics_api=${encodeURIComponent(API)}&analytics_region=${region}` : '';
  await page.goto(`${GAME}/${q}`);
  await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 120000 });
  await sleep(400);
  return { page, ctx, errors, url: `${GAME}/${q}` };
}

const idle = (page) => page.waitForFunction(() => !window.FreeCell.busy, { timeout: 150000 });
const hide = (page) => page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
const flushAndWait = async (page) => { await hide(page); await sleep(800); };
const banner = (page) => page.$eval('#consent-banner', (e) => !e.hidden);
const log = (page) => page.evaluate(() => window.__fcwAnalytics ? { errors: window.__fcwAnalytics.errors, ga: window.__fcwAnalytics.events.flatMap((e) => e.ga), modes: window.__fcwAnalytics.modes } : null);

async function dragFirstSolverMove(page) {
  const m = await page.evaluate(async () => (await FreeCell.solve({ timeLimitMs: 4000 })).solution[0]);
  const from = await page.evaluate((c) => FreeCell.projectCard(c), m.card);
  const to = await page.evaluate((m) => m.t === 'T' ? FreeCell.projectSlot('col', m.to) : m.t === 'C' ? FreeCell.projectSlot('free', m.fi) : FreeCell.projectSlot('found', m.card ? (((m.card - 1) / 13) | 0) : 0), m);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await sleep(300);
  await page.mouse.up();
  await idle(page);
}

const eventsOf = (filter) => batches.filter(filter).flatMap((b) => b.events.map((e) => ({ ...e, mode: b.mode, pid: b.pid })));
const named = (evs, n) => evs.filter((e) => e.n === n);

function validateBatches(label, list) {
  const bad = [];
  for (const b of list) {
    if (b.bad) { bad.push('unparseable body'); continue; }
    if (b.contentType !== 'text/plain') bad.push(`content-type ${b.contentType}`);
    for (const e of b.events) {
      if (!EVENTS[e.n]) bad.push(`unknown event ${e.n}`);
      for (const k of Object.keys(e.p || {})) if (!EVENTS[e.n]?.params.includes(k)) bad.push(`${e.n}.${k}`);
      if (!e.id || !e.sid || !Number.isInteger(e.s) || !e.t) bad.push(`${e.n}: envelope`);
    }
  }
  check(!bad.length, `${label}: every event matches the schema${bad.length ? ' (' + [...new Set(bad)].slice(0, 6).join(', ') + ')' : ''}`);
}

function validateGa(label, ga) {
  const bad = [];
  for (const e of ga) {
    if (e.name.length > GA_LIMITS.name) bad.push(`${e.name}: name`);
    if (Object.keys(e.params).length > GA_LIMITS.params) bad.push(`${e.name}: ${Object.keys(e.params).length} params`);
    for (const [k, v] of Object.entries(e.params)) {
      if (typeof v === 'string' && v.length > GA_LIMITS.value) bad.push(`${e.name}.${k}: length`);
      if (PARAMS[k]?.ga === false) bad.push(`${e.name}.${k}: first-party only`);
    }
  }
  check(ga.length > 0 && !bad.length, `${label}: ${ga.length} GA4 payloads within limits${bad.length ? ' (' + bad.slice(0, 6).join(', ') + ')' : ''}`);
}

try {
  // 3. Full mode: game 1 (drag, hint, abandon), game 2 (drag, reload, resume, auto-solve to a win).
  console.log('full mode (US)');
  let a = await open('us');
  check(!(await banner(a.page)), 'no consent banner outside consent regions');
  await a.page.click('#btn-play');
  await idle(a.page);
  await dragFirstSolverMove(a.page);
  await a.page.click('#btn-hint');
  await a.page.waitForFunction(() => document.getElementById('status-text').textContent === 'Hint played.', { timeout: 30000 });
  await a.page.click('#btn-new');
  await idle(a.page);
  await dragFirstSolverMove(a.page);
  await sleep(300);
  const before = await log(a.page);
  await a.page.goto(a.url); // a real unload: game_exit and session_end go out by beacon
  await a.page.waitForFunction(() => !document.getElementById('loader'), { timeout: 120000 });
  await sleep(400);
  await a.page.click('#btn-play');
  await idle(a.page);
  await sleep(500);
  await a.page.click('#btn-solve');
  await a.page.waitForFunction(() => document.getElementById('win-overlay').classList.contains('show'), { timeout: 120000 });
  await sleep(300);
  const after = await log(a.page);
  await flushAndWait(a.page);

  const full = eventsOf((b) => b.mode === 'full');
  validateBatches('full', batches.filter((b) => b.mode === 'full'));
  validateGa('full', [...before.ga, ...after.ga]);
  check(!before.errors.length && !after.errors.length, `no schema warnings in the page${[...before.errors, ...after.errors].length ? ': ' + [...before.errors, ...after.errors].join('; ') : ''}`);
  const pids = new Set(full.map((e) => e.pid));
  check(pids.size === 1 && [...pids][0], 'one device id across the reload');
  check(new Set(full.map((e) => e.sid)).size === 1, 'one session across the reload');
  for (const n of ['session_start', 'app_ready', 'page_view', 'theme_load', 'game_start', 'hint_used', 'game_exit', 'game_resume', 'solve_used', 'session_end']) check(named(full, n).length > 0, `sent ${n}`);
  const starts = named(full, 'game_start'), ends = named(full, 'game_end');
  const first = starts[0]?.p.game_id;
  const second = starts[1]?.p.game_id;
  check(starts[0]?.p.source === 'play', `first game source is play (${starts[0]?.p.source})`);
  check(starts[1]?.p.source === 'new_button', 'second game source is new_button');
  const abandoned = ends.find((e) => e.p.outcome === 'abandoned');
  check(abandoned?.p.game_id === first && abandoned.p.reason === 'new_button' && abandoned.p.resumed === false, 'abandon ends the first game (reason new_button)');
  check(abandoned?.p.drags === 1 && abandoned.p.moves >= 2 && abandoned.p.hints === 1 && abandoned.p.first_move_ms > 0, `abandon carries counters (drags ${abandoned?.p.drags}, moves ${abandoned?.p.moves}, hints ${abandoned?.p.hints}, first_move_ms ${abandoned?.p.first_move_ms})`);
  check(named(full, 'hint_used')[0]?.p.game_id === first, 'hint_used names the first game');
  check(named(full, 'game_exit')[0]?.p.game_id === second, 'unload sends game_exit for the second game');
  check(named(full, 'game_resume')[0]?.p.game_id === second, 'resume keeps the game id');
  const solved = ends.find((e) => e.p.outcome === 'solved');
  check(solved && solved.p.game_id === second && solved.p.cards_home === 52 && solved.p.resumed === true, 'auto-solve ends the resumed second game as solved');
  check(full.every((e) => e.n.startsWith('session_') || (e.c && e.c.app_version === 'dev' && e.c.theme_id)), 'events carry context');
  const ids = full.map((e) => e.id);
  check(new Set(ids).size === ids.length, 'event ids are unique');
  check(await a.page.evaluate(() => typeof window.gtag === 'undefined'), 'GA4 inert while the measurement id is empty');
  check(!a.errors.length, `no page errors${a.errors.length ? ': ' + a.errors.join('; ') : ''}`);
  await a.ctx.close();

  // 3b. Voyage: two cleared boards with charm picks, the market, an undo, a reload mid-board,
  // then an abandoned third board.
  console.log('voyage (US)');
  const vMark = batches.length;
  const v = await open('us', { settings: { reducedMotion: true, titleMode: 'voyage' } });
  const P = v.page;
  const handler = (name, ...args) => P.evaluate(async (name, args) => {
    const { voyageUI } = await import('/js/voyage/ui.js');
    const out = voyageUI.handlers[name](...args);
    return out && typeof out.then === 'function' ? out.then(() => true) : out;
  }, name, args);
  const status = () => P.evaluate(() => FreeCell.voyage.run()?.status);
  const until = (fn, arg, timeout = 150000) => P.waitForFunction(fn, { timeout, polling: 200 }, arg);
  const dismissTutorial = async () => { if (await P.$eval('#voyage-tutorial', (e) => !e.hidden)) await P.click('#voyage-tutorial-done'); };
  const sail = async () => {
    await dismissTutorial();
    const id = await P.evaluate(() => FreeCell.voyage.view().map.flat().find((n) => n.state === 'available').id);
    // Not awaited: the table intro waits for a click.
    await P.evaluate((id) => { import('/js/voyage/ui.js').then(({ voyageUI }) => voyageUI.handlers.pickNode(id)); }, id);
    await P.waitForSelector('#voyage-intro:not([hidden])', { timeout: 120000 });
    await sleep(300);
    await P.click('#voyage-intro');
    await until(() => FreeCell.voyage.run()?.status === 'board' && !FreeCell.busy);
    await sleep(600);
    await dismissTutorial();
  };
  const clearBoard = async () => {
    await P.evaluate(() => FreeCell.voyage.finish());
    await until(() => ['reward', 'map', 'port', 'won'].includes(FreeCell.voyage.run()?.status));
    if ((await status()) === 'reward') {
      await P.waitForSelector('#voyage-result:not([hidden]) button[data-pick-charm]', { timeout: 30000 });
      await dismissTutorial();
      const id = await P.$eval('#voyage-result button[data-pick-charm]', (b) => b.dataset.pickCharm);
      await handler('pickCharm', id);
    }
  };
  await P.click('#btn-voyage');
  await until(() => FreeCell.voyage.run()?.status === 'map');
  await sail();
  await P.evaluate(() => FreeCell.voyage.advance(1));
  await sleep(300);
  await P.click('#btn-undo');
  await sleep(300);
  const vBefore = await log(P);
  await P.goto(v.url); // reload mid-board: the board must not start twice
  await P.waitForFunction(() => !document.getElementById('loader'), { timeout: 120000 });
  await handler('continueVoyage');
  await until(() => FreeCell.voyage.run()?.status === 'board' && !FreeCell.busy);
  await sleep(500);
  await clearBoard();
  await sail();
  await clearBoard();
  let sawPort = false;
  if ((await status()) === 'port') {
    sawPort = true;
    await handler('enterPort');
    await sleep(300);
    await handler('portBuyUndo');
    await handler('portLeave');
  }
  await until(() => FreeCell.voyage.run()?.status === 'map');
  await sail();
  await P.evaluate(() => { import('/js/voyage/ui.js').then(({ voyageUI }) => voyageUI.handlers.abandonBoard()); });
  await P.waitForSelector('#voyage-confirm:not([hidden]) #voyage-confirm-ok');
  await P.click('#voyage-confirm-ok');
  await until(() => FreeCell.voyage.run()?.status === 'lost');
  await sleep(300);
  const vAfter = await log(P);
  await flushAndWait(P);

  const vb = batches.slice(vMark).filter((b) => b.mode === 'full');
  const ve = vb.flatMap((b) => b.events);
  validateBatches('voyage', vb);
  validateGa('voyage', [...vBefore.ga, ...vAfter.ga]);
  check(![...vBefore.errors, ...vAfter.errors].length, `no schema warnings${[...vBefore.errors, ...vAfter.errors].length ? ': ' + [...new Set([...vBefore.errors, ...vAfter.errors])].join('; ') : ''}`);
  const runIds = new Set(ve.filter((e) => e.p.run_id).map((e) => e.p.run_id));
  check(runIds.size === 1, `one run id across the run (${runIds.size})`);
  check(named(ve, 'voyage_run_start').length === 1, 'voyage_run_start once');
  check(named(ve, 'voyage_run_resume').length >= 1, 'voyage_run_resume after the reload');
  const bStarts = named(ve, 'voyage_board_start'), bEnds = named(ve, 'voyage_board_end');
  check(bStarts.map((e) => e.p.board_idx).join() === '0,1,2', `board starts 0,1,2 with no repeat after reload (${bStarts.map((e) => e.p.board_idx).join()})`);
  check(bEnds.map((e) => e.p.outcome).join() === 'cleared,cleared,abandoned', `board outcomes (${bEnds.map((e) => e.p.outcome).join()})`);
  const cleared = bEnds.find((e) => e.p.outcome === 'cleared');
  check(cleared && cleared.p.stars >= 1 && cleared.p.par > 0 && Number.isInteger(cleared.p.score_cards) && Array.isArray(cleared.p.held) && cleared.p.score_lines?.lines?.length, 'cleared board carries stars, par, score breakdown, held charms');
  check(bEnds[2]?.p.held?.length >= 2, `abandoned board lists the charms held (${bEnds[2]?.p.held})`);
  check(named(ve, 'voyage_node_pick').length === 3 && named(ve, 'voyage_node_pick').every((e) => e.p.offered_themes.length >= 1 && e.p.decide_ms >= 0), 'voyage_node_pick for each table, with the options offered');
  const picks = named(ve, 'voyage_charm_pick').filter((e) => e.p.source === 'reward');
  check(picks.length === 2 && picks.every((e) => e.p.pick_slot >= 1 && e.p.charm_theme), `two reward charm picks with slot and theme (${picks.length})`);
  check(named(ve, 'voyage_charm_offer').filter((e) => e.p.source === 'reward').every((e) => e.p.picked.length === 1) && named(ve, 'voyage_charm_offer').length >= 2, 'reward offers summarised with the pick');
  check(named(ve, 'voyage_undo').length >= 1, 'voyage_undo');
  check(named(ve, 'earn_virtual_currency').filter((e) => e.p.source === 'board').length === 2, 'coins earned on both cleared boards');
  if (sawPort) {
    check(named(ve, 'voyage_port_enter').length === 1 && named(ve, 'voyage_port_leave').length === 1, 'port enter and leave');
    check(named(ve, 'spend_virtual_currency').some((e) => e.p.item_name === 'undo'), 'undo purchase recorded as coin spend');
  } else check(false, 'expected the market after board 2');
  const runEnd = named(ve, 'voyage_run_end');
  check(runEnd.length === 1 && runEnd[0].p.outcome === 'abandoned' && runEnd[0].p.boards_cleared === 2, `voyage_run_end abandoned after 2 boards (${runEnd.map((e) => e.p.outcome + '/' + e.p.boards_cleared)})`);
  for (const n of ['voyage_map', 'voyage_board', 'voyage_reward']) check(named(ve, 'page_view').some((e) => e.p.screen_name === n), `screen ${n}`);
  check(named(ve, 'tutorial_begin').some((e) => e.p.step === 'map') && named(ve, 'tutorial_complete').length >= 1, 'tutorial begin and complete');
  console.log(`  ..  charm scores ${named(ve, 'voyage_charm_score').length}, triggers ${named(ve, 'voyage_challenge_trigger').length}, ability uses ${named(ve, 'voyage_ability_use').length}`);
  check(!v.errors.length, `no page errors${v.errors.length ? ': ' + v.errors.join('; ') : ''}`);
  await v.ctx.close();

  // 4. Anonymous mode: EU before a choice, then Accept.
  console.log('anonymous mode (EU)');
  const mark = batches.length;
  let b = await open('eu');
  check(await banner(b.page), 'consent banner shown in a consent region');
  await b.page.click('#btn-play');
  await idle(b.page);
  await b.page.click('#btn-new');
  await idle(b.page);
  await flushAndWait(b.page);
  const anonBatches = batches.slice(mark).filter((x) => x.mode === 'anonymous');
  const anon = anonBatches.flatMap((x) => x.events);
  validateBatches('anonymous', anonBatches);
  check(anon.length > 0 && anonBatches.every((x) => !x.pid), 'anonymous batches carry no device id');
  check(anon.every((e) => EVENTS[e.n].summary), `only summary events (${[...new Set(anon.map((e) => e.n))].join(', ')})`);
  check(named(anon, 'game_end').some((e) => e.p.outcome === 'skipped'), 'untouched deal reported as skipped');
  check(await b.page.evaluate(() => !localStorage.getItem('freecellworlds.pid') && !sessionStorage.getItem('freecellworlds.sid')), 'nothing stored on the device');
  check(await b.page.evaluate(() => typeof window.gtag === 'undefined' && !document.querySelector('script[src*="googletagmanager"]')), 'GA4 not loaded in anonymous mode');
  await b.page.click('#consent-accept');
  await sleep(300);
  check(!(await banner(b.page)), 'banner closes after Accept');
  check(await b.page.evaluate(() => !!localStorage.getItem('freecellworlds.pid')), 'Accept creates the device id');
  check((await log(b.page)).modes.at(-1) === 'full', 'Accept switches to full mode');
  check(await b.page.evaluate(() => JSON.parse(localStorage.getItem('freecellworlds.consent')).choice === 'granted'), 'choice saved');
  await b.ctx.close();

  // 5. Settings → Share play statistics off.
  console.log('off');
  const mark2 = batches.length;
  const c = await open('us', { settings: { shareData: false } });
  await c.page.click('#btn-play');
  await idle(c.page);
  await flushAndWait(c.page);
  check(batches.length === mark2, 'nothing sent when Share play statistics is off');
  check(await c.page.$eval('#set-share-data', (e) => !e.checked), 'settings checkbox reflects the setting');
  await c.ctx.close();

  // 6. No debug flag under automation: nothing collected, no banner even in a consent time zone.
  console.log('automation default');
  const mark3 = batches.length;
  const d = await open('eu', { debug: false, timezone: 'Europe/Berlin' });
  check(!(await banner(d.page)), 'no banner under automation');
  check(await d.page.evaluate(() => window.__fcwAnalytics === undefined && !localStorage.getItem('freecellworlds.pid')), 'no analytics state without ?analytics=debug');
  check(batches.length === mark3, 'nothing sent');
  await d.ctx.close();
} finally {
  await browser.close();
  game.kill();
  api.close();
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nall analytics checks passed');
process.exit(failures.length ? 1 : 0);
