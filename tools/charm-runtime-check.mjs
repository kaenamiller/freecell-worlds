#!/usr/bin/env node
// Headless K2 integration check; examples are loaded ONLY by check scripts.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const base = process.env.VOYAGE_TEST_URL || 'http://[::1]:8132';
const shots = '/tmp/k2-shots'; mkdirSync(shots, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setBypassServiceWorker(true);
// Register dev custom ops before main.js reads a saved title view on reload.
await page.setRequestInterception(true);
page.on('request', (request) => {
  if (request.isNavigationRequest() && request.url().replace(/\/$/, '') === base.replace(/\/$/, '')) {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace('<script type="module" src="./js/main.js"></script>', '<script type="module">await import("./js/voyage/content/_examples.js"); await import("./js/main.js");</script>');
    request.respond({ status:200, contentType:'text/html', body:html });
  } else request.continue();
});
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.error('CONSOLEERROR', m.text()); } });
page.on('pageerror', (e) => { errors.push(e.stack); console.error('PAGEERROR', e.stack); });
await page.setViewport({ width: 1024, height: 768 });
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('freecellworlds.settings', JSON.stringify({ theme:'roman', autoRandomTheme:false, autoFoundation:false, reducedMotion:false, muted:true, quality:'low' }));
  localStorage.setItem('freecellworlds.voyageTutorial', JSON.stringify({ map:true, board:true, reward:true }));
});
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = async () => { try { await page.waitForFunction(() => !FreeCell.busy, { timeout: 90000 }); } catch (e) { console.error(await page.evaluate(() => ({ busy:FreeCell.busy, title:document.getElementById('title-screen').className,mode:FreeCell.voyage.mode, perf:FreeCell.perf }))); await page.screenshot({path: `${shots}/failure.png`}); throw e; } await pause(250); };
const metrics = () => page.evaluate(() => {
  const r = FreeCell.voyage.run();
  const meshes = [];
  FreeCell.scene.traverse((g) => { if (g.isGroup && g.userData.cardId) meshes.push({ id:g.userData.cardId, mark:g.userData.mark, concealed:!!g.userData.concealed, target:g.userData.target, position:g.position.toArray(), rx:g.rotation.x }); });
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
      const r = createRun({ seed: 'k2-browser' }); r.boons = ['dev.survey','dev.workshop'];
      const cur = startBoard(r, nextChoices(r.map)[0].id, { deal:1,par:60 });
      cur.theme = 'roman'; cur.rules = baseRules(); cur.challenge = 'dev.veil';
      cur.active = [{id:'dev.survey',kind:'boon',strength:2},{id:'dev.workshop',kind:'boon',strength:2},{id:'dev.veil',kind:'challenge',strength:2}];
      saveRun(r);
    }
    await voyageUI.handlers.continueVoyage();
  }, create);
  await settle();
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
  await page.waitForSelector('.voyage-targeting');
  await page.keyboard.press('Escape'); await pause(200);
  assert.equal((await metrics()).abilities.find((a)=>a.id==='dev.workshop').uses,'3');
  // Pick two columns and watch the custom move animate to their new layout.
  const beforeSwap = await metrics();
  await page.click('[data-ability="dev.workshop"]');
  await page.waitForSelector('.voyage-targeting');
  await page.click('[data-target="0"]'); await pause(100);
  await page.click('[data-target="0"]');
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
    const r=createRun({seed:'k2-stuck'}); r.boons=['dev.survey','dev.workshop']; r.undos=0;
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
    const r=createRun({seed:'k2-home'}); r.boons=['dev.workshop'];
    const cur=startBoard(r,nextChoices(r.map)[0].id,{deal:1,par:60}); cur.theme='roman'; cur.challenge=null;
    cur.rules={...baseRules(),startHome:12}; cur.active=[{id:'dev.workshop',kind:'boon',strength:1}]; cur.memo={'dev.workshop':{mode:'home'}}; saveRun(r);
  });
  await page.reload({waitUntil:'networkidle0'}); await resumeFixture();
  await page.click('[data-ability="dev.workshop"]');
  await page.waitForFunction(()=>FreeCell.voyage.run().results.length===1);
  const homeResult=await page.evaluate(()=>FreeCell.voyage.run().results[0]);
  assert.equal(homeResult.moves,4); assert.equal(homeResult.score.lines.find((line)=>line.key==='cards').pts,520);
  console.log('OK: autoHome/player moves, startHome points, win flow');
  assert.deepEqual(errors, []);
  writeFileSync(`${shots}/report.json`, JSON.stringify({ passed:true, screenshots:8, errors, state:undone.state, abilities:undone.abilities },null,2));
  console.log(`PASS: marks, conceal/uncover, hint ability, targeting/cancel, X animation/undo, persisted resume, dynamic cells, override, stuck protection/rescue, autoHome/win. Screenshots: ${shots}`);
} finally { await browser.close(); }
