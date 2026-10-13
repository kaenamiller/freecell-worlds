#!/usr/bin/env node
// Headless runtime integration check; examples are loaded ONLY by check scripts.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { clickTarget } from './charm-checks/_browser-pick.mjs';
const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const base = process.env.VOYAGE_TEST_URL || 'http://[::1]:8143';
const shots = `/tmp/k3-shots-${new URL(base).port || 'default'}`; mkdirSync(shots, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setBypassServiceWorker(true);
// Register dev custom ops before main.js reads a saved title view on reload.
await page.setRequestInterception(true);
page.on('request', (request) => {
  if (request.isNavigationRequest() && request.url().replace(/\/$/, '') === base.replace(/\/$/, '')) {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace('<script type="module" src="./js/main.js"></script>', '<script type="module">await import("./js/voyage/content/_examples.js"); await import("./js/main.js");</script>');
    request.respond({ status:200, contentType:'text/html', body:html });
  } else if (/\/assets\/art\/charms\/dev\.[^/]+\.webp$/.test(request.url())) {
    // Dev fixtures deliberately ship no production artwork. Supply their test art.
    request.respond({status:200, contentType:'image/png', body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64')});
  } else request.continue();
});
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.error('CONSOLEERROR', m.text()); } });
page.on('pageerror', (e) => { errors.push(e.stack); console.error('PAGEERROR', e.stack); });
page.on('response', (r) => { if (r.status() >= 400) console.error('HTTPERROR', r.status(), r.url()); });
await page.setViewport({ width: 1024, height: 768 });
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('freecellworlds.settings', JSON.stringify({ theme:'roman', autoRandomTheme:false, autoFoundation:false, reducedMotion:true, muted:true, quality:'low' }));
  localStorage.setItem('freecellworlds.voyageTutorial', JSON.stringify({ map:true, board:true, reward:true }));
});
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = async () => { try { await page.waitForFunction(() => !FreeCell.busy, { timeout: 90000 }); } catch (e) { console.error(await page.evaluate(() => ({ busy:FreeCell.busy, title:document.getElementById('title-screen').className,mode:FreeCell.voyage.mode, perf:FreeCell.perf }))); await page.screenshot({path: `${shots}/failure.png`}); throw e; } await pause(250); };
const metrics = () => page.evaluate(() => {
  const r = FreeCell.voyage.run();
  const meshes = [];
  FreeCell.scene.traverse((g) => { if (g.isGroup && g.userData.cardId) meshes.push({ id:g.userData.cardId, mark:g.userData.mark, sticker:g.userData.sticker, concealed:!!g.userData.concealed, target:g.userData.target, position:g.position.toArray(), rx:g.rotation.x }); });
  return { state:FreeCell.getState(), run:JSON.parse(JSON.stringify(r)), meshes, hud:document.getElementById('voyage-hud').innerText + '\n' + document.getElementById('voyage-dock').innerText, abilities: [...document.querySelectorAll('[data-ability]')].map((e)=>({id:e.dataset.ability, disabled:e.getAttribute('aria-disabled'),uses:e.querySelector('.voyage-use-pip')?.textContent})) };
});
async function resumeFixture(create = false) {
  await page.evaluate(async (create) => {
    // Software WebGL: omit shadow maps, retaining card geometry/materials and animations.
    FreeCell.scene.traverse((object) => { if (object.isLight) object.castShadow = false; });
    await import('/js/voyage/content/_examples.js');
    const { createRun, startBoard, saveRun } = await import('/js/voyage/run.js');
    const { nextChoices } = await import('/js/voyage/map.js');
    const { baseRules } = await import('/js/voyage/charms.js');
    const { voyageUI } = await import('/js/voyage/ui.js');
    if (create) {
      const r = createRun({ seed: 'k2-browser' }); r.boss = 'boss.lockstep'; r.boons = ['dev.survey','dev.workshop'];
      const cur = startBoard(r, nextChoices(r.map)[0].id, { deal:1,par:60 });
      cur.theme = 'roman'; cur.rules = baseRules(); cur.challenge = 'dev.veil';
      cur.active = [{id:'dev.survey',kind:'boon',strength:2},{id:'dev.workshop',kind:'boon',strength:2},{id:'dev.veil',kind:'challenge',strength:2}];
      saveRun(r);
    }
    await voyageUI.handlers.continueVoyage();
  }, create);
  await settle();
}

async function v2Fixture({ boons, rules = {}, levels = {}, stickers = {}, moves = [], memo = {}, undos = 5, challenge = null }) {
  await page.evaluate(async (options) => {
    const {createRun,startBoard,saveRun} = await import('/js/voyage/run.js');
    const {nextChoices} = await import('/js/voyage/map.js');
    const {baseRules} = await import('/js/voyage/charms.js');
    const {Game} = await import('/js/rules.js');
    const r = createRun({seed:'k3-v2'}); Object.assign(r, {boss:'boss.lockstep', boons:options.boons, levels:options.levels, stickers:options.stickers, undos:options.undos});
    const cur = startBoard(r, nextChoices(r.map)[0].id, {deal:1,par:60});
    cur.theme = 'roman'; cur.challenge = options.challenge; cur.rules = {...baseRules(), ...options.rules};
    cur.active = options.boons.map((id) => ({id,kind:'boon',strength:1,level:options.levels[id] || 1}));
    if (Object.keys(options.stickers).length) cur.active.push({id:'voyage.stickers',kind:'boon',strength:1,level:1});
    if (options.challenge) cur.active.push({id:options.challenge,kind:'challenge',strength:7});
    const g = new Game(1, {rules:JSON.parse(JSON.stringify(cur.rules))});
    for (const move of options.moves) {
      const applied = g.applyDescriptor(move);
      if (move.auto) applied.auto = true;
      if (move.voyageAbility) applied.voyageAbility = {...move.voyageAbility};
    }
    cur.history = g.history; cur.memo = options.memo; cur.initial = g.initial; saveRun(r);
  }, {boons,rules,levels,stickers,moves,memo,undos,challenge});
  await page.reload({waitUntil:'networkidle0'}); await resumeFixture();
}
async function use(id) {
  await page.evaluate(async (id) => { const {voyageUI} = await import('/js/voyage/ui.js'); await voyageUI.handlers.useAbility(id); }, id);
  await settle();
}
const uses = (id) => page.evaluate((id) => FreeCell.voyage.run().current.memo[id]._runtime.abilityUses, id);
async function manualTop(col = 0) {
  const id = (await metrics()).state.tableau[col].at(-1);
  const point = await page.evaluate((id) => FreeCell.projectCard(id), id);
  await page.mouse.click(point.x, point.y); await page.mouse.click(point.x, point.y); await settle();
}
try {
  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.FreeCell && !document.getElementById('loader'));
  await resumeFixture(true);
  const initial = await metrics();
  assert(initial.meshes.some((m) => m.mark === 'wanted'));
  assert(initial.meshes.some((m) => m.concealed));
  assert(initial.hud.includes('♦'));
  assert.equal(initial.abilities.find((a)=>a.id==='dev.survey').uses,'2');
  await page.screenshot({ path:`${shots}/01-marks-conceal-badge.png` }); console.log('OK: initial visuals');
  // A top-card move uncovers/reveals the concealed card just beneath it.
  const column = initial.state.tableau[0];
  const top = column.at(-1), hidden = column.at(-2);
  assert(initial.meshes.find((m)=>m.id===hidden).concealed);
  const point = await page.evaluate((id)=>FreeCell.projectCard(id), top);
  await page.mouse.click(point.x, point.y); await page.mouse.click(point.x, point.y);
  await settle();
  const uncovered = await metrics();
  assert(!uncovered.meshes.find((m)=>m.id===hidden).concealed, 'Uncover must flip the card');
  assert.equal(uncovered.run.current.memo['dev.survey'].reveals, 1);
  await page.screenshot({ path:`${shots}/02-uncovered.png` });
  // The actual HUD ability button invokes the classic rules-aware hint path.
  const beforeHint = uncovered.run.current.history.length;
  await page.click('[data-ability="dev.survey"]');
  await page.waitForFunction((n) => FreeCell.voyage.run().current.history.length > n, {}, beforeHint);
  await settle();
  assert.equal((await metrics()).abilities.find((a)=>a.id==='dev.survey').uses,'1');
  await page.screenshot({ path:`${shots}/03-hint-ability.png` });
  // Target cancellation leaves a use intact.
  await page.click('[data-ability="dev.workshop"]');
  await page.waitForSelector('.voyage-target-prompt');
  await page.keyboard.press('Escape'); await pause(200);
  assert.equal((await metrics()).abilities.find((a)=>a.id==='dev.workshop').uses,'3');
  // Pick two columns and watch the custom move animate to their new layout.
  const beforeSwap = await metrics();
  await page.click('[data-ability="dev.workshop"]');
  // Click the lit targets on the table itself, as a player would.
  await clickTarget(page);
  await clickTarget(page);
  await settle();
  const swapped = await metrics();
  assert.equal(swapped.run.current.history.at(-1).t, 'X');
  assert.equal(swapped.abilities.find((a)=>a.id==='dev.workshop').uses,'2');
  assert.equal(swapped.state.tableau[0].at(-1), beforeSwap.state.tableau[1].at(-1));
  for (const mesh of swapped.meshes) {
    if (!mesh.target) continue;
    assert(Math.abs(mesh.position[0] - mesh.target.x) < .01 && Math.abs(mesh.position[2] - mesh.target.z) < .01, `Card ${mesh.id} did not relayout`);
  }
  await page.screenshot({ path:`${shots}/04-custom-swap.png` }); console.log('OK: uncover, hint, targeting, swap');
  // Resume with the X still in history, preserving marks, visibility, badge, and uses.
  await page.reload({ waitUntil: 'networkidle0' });
  await resumeFixture();
  const resumed = await metrics();
  assert.deepEqual(resumed.state, swapped.state);
  assert.deepEqual(resumed.run.current.memo, swapped.run.current.memo);
  assert.deepEqual(resumed.abilities, swapped.abilities);
  assert(resumed.hud.includes('♦'));
  assert(!resumed.meshes.find((m)=>m.id===hidden).concealed);
  await page.screenshot({ path:`${shots}/05-resumed.png` });
  await page.click('#btn-undo'); await settle();
  const undone = await metrics();
  assert.deepEqual(undone.state, beforeSwap.state);
  assert.equal(undone.abilities.find((a)=>a.id==='dev.workshop').uses,'3');
  await page.screenshot({ path:`${shots}/06-custom-undone.png` }); console.log('OK: resume and undo');
  // Mid-board cell gain is an X move; both rule count and layout undo together.
  await page.evaluate(() => { FreeCell.voyage.run().current.memo['dev.workshop'].mode = 'cells'; });
  const cellCount = undone.state.free.length;
  await page.click('[data-ability="dev.workshop"]'); await settle();
  assert.equal((await metrics()).state.free.length, cellCount + 1);
  assert.equal(await page.evaluate(() => FreeCell.voyage.view().current.freeCells), cellCount + 1);
  await page.screenshot({ path:`${shots}/07-extra-cell.png` });
  await page.click('#btn-undo'); await settle();
  assert.equal((await metrics()).state.free.length, cellCount); console.log('OK: dynamic cell gain/undo');
  // A pending override saves/resumes, consumes on a drop, and refunds on undo.
  await page.evaluate(() => { FreeCell.voyage.run().current.memo['dev.workshop'].mode = 'override'; });
  await page.click('[data-ability="dev.workshop"]'); await settle();
  assert(await page.$('.voyage-override-chip'));
  await page.reload({ waitUntil:'networkidle0' }); await resumeFixture();
  assert(await page.$('.voyage-override-chip'));
  const overrideState = (await metrics()).state;
  const freeCard = overrideState.free.find(Boolean);
  const from = await page.evaluate((id)=>FreeCell.projectCard(id), freeCard);
  const to = await page.evaluate(()=>FreeCell.projectSlot('col', 0));
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, {steps:10}); await page.mouse.up(); await settle();
  assert.equal(await page.$('.voyage-override-chip'), null);
  await page.click('#btn-undo'); await settle();
  assert.deepEqual((await metrics()).state, overrideState);
  assert.equal((await metrics()).abilities.find((a)=>a.id==='dev.workshop').uses,'3');
  assert.equal(await page.$('.voyage-override-chip'), null);
  await page.screenshot({ path:`${shots}/08-override-undone.png` }); console.log('OK: override/resume/drop/undo');
  // Synthetic immobile board exercises runtime loss protection without solver timing.
  await page.evaluate(async () => {
    const {createRun,startBoard,saveRun}=await import('/js/voyage/run.js');
    const {nextChoices}=await import('/js/voyage/map.js');
    const {baseRules}=await import('/js/voyage/charms.js');
    const r=createRun({seed:'k2-stuck'}); r.boss='boss.lockstep'; r.boons=['dev.survey','dev.workshop']; r.undos=0;
    const cur=startBoard(r,nextChoices(r.map)[0].id,{deal:1,par:60}); cur.theme='roman';
    cur.rules={...baseRules(),noCellRanks:16382,sealedCols:[0,1,2,3,4,5,6,7]}; cur.challenge='dev.veil';
    cur.active=[{id:'dev.survey',kind:'boon',strength:2},{id:'dev.workshop',kind:'boon',strength:2},{id:'dev.veil',kind:'challenge',strength:2}]; saveRun(r);
  });
  await page.reload({waitUntil:'networkidle0'}); await resumeFixture();
  await page.evaluate(async()=> {
    const {voyageUI}=await import('/js/voyage/ui.js');
    await voyageUI.handlers.useAbility('missing');
  });
  assert.equal((await metrics()).run.status,'board','available ability protects an immobile board');
  assert.equal((await metrics()).run.undos,0);
  await page.evaluate(async()=> {
    const r=FreeCell.voyage.run(); r.current.memo['dev.survey']._runtime.abilityUses=0; r.current.memo['dev.workshop']._runtime.abilityUses=0;
    const {voyageUI}=await import('/js/voyage/ui.js'); await voyageUI.handlers.useAbility('missing');
  });
  assert.equal((await metrics()).run.status,'board');
  assert.equal((await metrics()).run.undos,2,'stuck hook cancels loss and grants undos');
  await page.evaluate(async()=> {
    FreeCell.voyage.run().undos=0;
    const {voyageUI}=await import('/js/voyage/ui.js'); await voyageUI.handlers.useAbility('missing');
  });
  assert.equal((await metrics()).run.status,'lost','a consumed rescue does not prevent a later loss');
  // autoHome records player moves, retains startHome card points, and wins normally.
  await page.evaluate(async () => {
    const {createRun,startBoard,saveRun}=await import('/js/voyage/run.js'); const {nextChoices}=await import('/js/voyage/map.js'); const {baseRules}=await import('/js/voyage/charms.js');
    const r=createRun({seed:'k2-home'}); r.boss='boss.lockstep'; r.boons=['dev.workshop','dev.battery'];
    const cur=startBoard(r,nextChoices(r.map)[0].id,{deal:1,par:60}); cur.theme='roman'; cur.challenge=null;
    cur.rules={...baseRules(),startHome:12}; cur.active=[{id:'dev.workshop',kind:'boon',strength:1},{id:'dev.battery',kind:'boon',strength:1}]; cur.memo={'dev.workshop':{mode:'home'}}; saveRun(r);
  });
  await page.reload({waitUntil:'networkidle0'}); await resumeFixture();
  await page.click('[data-ability="dev.workshop"]');
  await page.waitForFunction(()=>FreeCell.voyage.run().results.length===1);
  const homeResult=await page.evaluate(()=>FreeCell.voyage.run().results[0]);
  assert.equal(homeResult.moves,4); assert.equal(homeResult.score.lines.find((line)=>line.key==='cards').pts,520);
  assert.equal(await page.evaluate(() => FreeCell.voyage.run().charmMemo['dev.battery'].winUses['dev.workshop']),1,'on.win receives remaining uses after the winning ability');
  console.log('OK: autoHome/player moves, startHome points, win flow');
  // Exercise all four historical hint shapes, using live definitions when retained.
  const hints = await page.evaluate(async () => {
    const {legacyHintIds} = await import('/js/voyage/content/_examples.js');
    return ['signal.lock','pinecone.compass','museum.docent','lapis.horus'].map((id) => legacyHintIds[id]);
  });
  await v2Fixture({boons:hints});
  const classicSave = await page.evaluate(() => localStorage.getItem('freecellworlds.game'));
  await page.keyboard.press('h'); await pause(100);
  assert.equal((await metrics()).run.current.history.length,0,'classic hint shortcut stays blocked in Voyage');
  for (const id of hints) {
    const before = (await metrics()).run.current.history.length, count = await uses(id);
    if (await page.$(`[data-ability="${id}"]`)) await page.click(`[data-ability="${id}"]`);
    else await use(id); // Retired production IDs remain hidden regression fixtures.
    await page.waitForFunction((n) => FreeCell.voyage.run().current.history.length > n, {}, before); await settle();
    assert.equal((await metrics()).run.current.history.length,before+1, `${id}: exactly one history entry`);
    assert.equal(await uses(id),count-1, `${id}: use consumed`);
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('freecellworlds.game')),classicSave,'Voyage hints leave classic save alone');
  await page.reload({waitUntil:'networkidle0'}); await resumeFixture();
  await page.click('#btn-undo'); await settle(); assert.equal(await uses(hints[3]),1,'played hint refunds after resume');
  await page.click('#btn-undo'); await settle(); assert.equal(await uses(hints[2]),1,'each hint has its own refund marker');
  console.log('OK: Holo-Scan, Pocket Compass, Docent, Eye of Horus');
  // A simple solvable tail makes preview deterministic, retaining the real worker.
  await v2Fixture({boons:['dev.preview','dev.battery','dev.workshop','dev.weather'],rules:{startHome:11},levels:{'dev.preview':2}});
  const beforePreview = await metrics();
  await use('dev.weather');
  assert.equal((await metrics()).run.current.memo['dev.weather'].answer,true);
  assert.deepEqual((await metrics()).state,beforePreview.state); assert.equal(await page.$('#voyage-preview'),null);
  await use('dev.preview');
  assert(await page.$('#voyage-preview')); assert.equal((await page.$$('[data-preview-card]')).length,2);
  assert.deepEqual((await metrics()).state,beforePreview.state); assert.deepEqual((await metrics()).run.current.history,[]);
  assert.equal(await uses('dev.preview'),1);
  assert.equal((await metrics()).run.current.memo['dev.battery'].events.at(-1),'dev.preview');
  await page.screenshot({path:`${shots}/09-preview.png`});
  await use('dev.battery'); assert.equal(await page.$('#voyage-preview'),null,'another ability clears preview');
  assert.equal(await uses('dev.preview'),2);
  await use('dev.battery'); await use('dev.battery'); assert.equal(await uses('dev.preview'),3,'extra uses capped at two');
  await use('dev.preview'); await manualTop(); assert.equal(await page.$('#voyage-preview'),null,'move clears preview');
  await use('dev.preview'); assert(await page.$('#voyage-preview'));
  await page.click('#btn-undo'); await settle(); assert.equal(await page.$('#voyage-preview'),null,'undo clears preview');
  console.log('OK: preview UI, unchanged state, clearing, levels, ability event, extra-use cap');
  // Reset walks a custom cell gain and a placement backwards, at zero undos.
  await v2Fixture({boons:['dev.reset','dev.workshop','dev.battery','library.bookmark','cyber.cache','canyon.echo','deepstorage.redundancy'],undos:0,challenge:'cyber.challenge',rules:{startHome:2},moves:[
    {t:'X',op:'library.bookmark',token:1},
    {t:'X',op:'voyage.cells',count:5,voyageAbility:{id:'dev.workshop',uses:2}},
    {t:'C',src:{kind:'col',i:0},fi:4},
  ],memo:{'library.bookmark':{anchor:1},'dev.workshop':{_runtime:{abilityUses:1}}}});
  const beforeReset = await metrics();
  await use('dev.reset'); const reset = await metrics();
  assert.deepEqual(reset.state,beforeReset.run.current.initial); assert.equal(reset.state.free.length,4);
  assert.equal(reset.run.current.history.length,0); assert.equal(reset.run.undos,0); assert.equal(reset.run.current.undosUsed,0);
  assert.equal(await uses('dev.reset'),0); assert.equal(await uses('dev.workshop'),2);
  assert.equal(reset.run.current.memo['library.bookmark'].anchor,null);
  assert(!reset.run.current.memo['cyber.cache'].refunded); assert(!reset.run.current.memo['cyber.challenge'].undoCount);
  assert.deepEqual(reset.run.current.memo['dev.battery'].undos,[{reset:true,free:false,moves:3}]);
  assert.equal(reset.run.current.liveRules.freeCells,4);
  await page.reload({waitUntil:'networkidle0'}); await resumeFixture(); assert.deepEqual((await metrics()).state,reset.state);
  await page.screenshot({path:`${shots}/10-reset.png`}); console.log('OK: zero-cost reset, X/rules restoration, refunds, Bookmark, resume');
  // Window steps include auto-plays, persist and close on the next player move.
  await v2Fixture({boons:['dev.window','dev.workshop','dev.battery','cyber.cache','canyon.echo','deepstorage.redundancy'],undos:0,challenge:'cyber.challenge',moves:[
    {t:'C',src:{kind:'col',i:0},fi:0}, {t:'C',src:{kind:'col',i:1},fi:1,auto:true},
    {t:'X',op:'voyage.cells',count:5,voyageAbility:{id:'dev.workshop',uses:2}},
  ],memo:{'dev.workshop':{_runtime:{abilityUses:1}}}});
  await use('dev.window'); assert.equal(await uses('dev.window'),0);
  await page.reload({waitUntil:'networkidle0'}); await resumeFixture(); assert((await metrics()).run.current.memo._undoWindow);
  await page.click('#btn-undo'); await settle();
  assert.equal((await metrics()).run.current.history.length,2); assert.equal(await uses('dev.workshop'),2);
  await page.click('#btn-undo'); await settle(); const free = await metrics();
  assert.equal(free.run.current.history.length,0); assert.equal(free.run.undos,0); assert.equal(free.run.current.undosUsed,0);
  assert(free.run.current.memo._undoWindow); assert(!free.run.current.memo['cyber.cache'].refunded);
  assert.deepEqual(free.run.current.memo['dev.battery'].undos,[{free:true,reset:false,moves:1},{free:true,reset:false,moves:2}]);
  await manualTop(); assert.equal((await metrics()).run.current.memo._undoWindow,false);
  const afterForward = (await metrics()).run.current.history.length;
  await page.click('#btn-undo'); await settle(); assert.equal((await metrics()).run.current.history.length,afterForward,'closed window cannot undo at zero');
  await page.evaluate(() => {FreeCell.voyage.run().undos=2;});
  await page.click('#btn-undo'); await settle(); assert.equal((await metrics()).run.current.undosUsed,1,'only paid undos counted');
  await page.screenshot({path:`${shots}/11-undo-window.png`}); console.log('OK: free steps/auto-plays, use refund, resume, closure, paid count');
  await v2Fixture({boons:['dev.faucet','dev.exempt','dev.battery','dev.wager'],undos:0});
  await use('dev.wager'); const sticker = await metrics();
  assert.equal(sticker.run.stickers[1],'wild'); assert.deepEqual(sticker.run.current.liveRules.wildCards,[]);
  await use('dev.faucet'); await use('dev.faucet'); await use('dev.faucet');
  let cap = await metrics(); assert.equal(cap.run.undos,3); assert.equal(cap.run.current.memo._undoGrants,3);
  await use('dev.exempt'); assert.equal((await metrics()).run.undos,4); assert.equal((await metrics()).run.current.memo._undoGrants,3);
  await page.reload({waitUntil:'networkidle0'}); await resumeFixture(); await use('dev.faucet');
  assert.equal((await metrics()).run.undos,4); assert.equal((await metrics()).run.current.memo._undoGrants,3);
  await manualTop();
  await page.evaluate(() => { FreeCell.voyage.run().current.memo['dev.wager']._runtime.abilityUses=1; });
  await use('dev.wager'); assert.equal(await uses('dev.wager'),1,'start-only use stays unavailable after playing');
  assert.deepEqual((await metrics()).run.current.liveRules.wildCards,[],'new sticker never changes this board, including after resume');
  console.log('OK: persisted undo cap, exemption, next-board sticker, start-only gate');
  await v2Fixture({boons:['dev.weather','dev.preview','dev.battery'],rules:{noCellRanks:16382,sealedCols:[0,1,2,3,4,5,6,7]}});
  const dead = await metrics(); await use('dev.weather');
  assert.equal((await metrics()).run.current.memo['dev.weather'].answer,false,'solver proves immobile board unreachable');
  await use('dev.preview'); assert.equal(await uses('dev.preview'),1,'no solution does not consume a preview use');
  assert.equal(await page.$('#voyage-preview'),null); assert.deepEqual((await metrics()).state,dead.state);
  assert.equal((await metrics()).run.current.history.length,0);
  console.log('OK: silent reachability verdict, no invented preview on an unsolvable board');
  const surveyCard = await page.evaluate(async () => {
    const { Game } = await import('/js/rules.js');
    const { baseRules } = await import('/js/voyage/charms.js');
    return new Game(1, { rules: baseRules() }).tableau[0].at(-1);
  });
  await v2Fixture({boons:['dev.survey'],stickers:{[surveyCard]:'wild'},rules:{wildCards:[surveyCard]}});
  const marked = (await metrics()).meshes.find((m) => m.id === surveyCard);
  assert.equal(marked.mark,'wanted'); assert.equal(marked.sticker,'sticker-wild');
  await page.reload({waitUntil:'networkidle0'}); await resumeFixture();
  const restoredMark = (await metrics()).meshes.find((m) => m.id === surveyCard);
  assert.equal(restoredMark.mark,'wanted'); assert.equal(restoredMark.sticker,'sticker-wild');
  await page.screenshot({path:`${shots}/12-sticker-resumed.png`});
  console.log('OK: normal/sticker mark coexistence and pseudo-boon resume rendering');
  assert.deepEqual(errors, []);
  writeFileSync(`${shots}/report.json`, JSON.stringify({ passed:true, base, screenshots:12, errors, state:undone.state, abilities:undone.abilities },null,2));
  console.log(`PASS: runtime v2 and existing runtime regressions; no console errors. Screenshots: ${shots}`);
} finally { await browser.close(); }
