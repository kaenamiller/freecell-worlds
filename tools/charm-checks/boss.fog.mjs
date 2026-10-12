// Information-only boss: legal moves/solver rules stay neutral; discoveries persist.
import { pathToFileURL } from 'node:url';
export async function check({ assert, Rules, CHARMS, BoardEffects, baseRules, stubAPI, clone }) {
  const fog = CHARMS['boss.fog'];
  assert(fog && !fog.placeholder);
  assert.deepEqual(fog.tags, ['VIS']);
  assert.equal(fog.dealShift, -0.5);
  assert.equal(fog.ease, 0);
  assert.equal(fog.boonRelation('deepstorage.clearance'), '!');
  assert.equal(fog.boonRelation('roman.legion'), '~');
  const { composeBoard } = await import('../../js/voyage/boardrules.js');
  const composed = composeBoard({ boss: fog.id, strength: 7, seed: 'fog-check', idx: 6 });
  assert.deepEqual(composed.rules, baseRules(), 'Fog never changes legality or solver rules');
  assert.equal(composed.dealShift, -0.5);

  for (const deal of [1, 617, 11982]) {
    const game = new Rules.Game(deal, { rules: baseRules() });
    const initial = Rules.cloneState(game.state), memo = {};
    const api = stubAPI(game);
    const active = [{ id: fog.id, kind: 'boss', strength: 7 }];
    const fx = new BoardEffects(active, { seed: 'fog-check', boardIndex: 6, api, memo });
    fx.setup({ state: initial, initial, deal }); fx.emit('start', {});
    const concealed = () => fx.ctxs[0].api.concealed.slice().sort((a, b) => a - b);
    const expected = initial.tableau.flatMap((col) => col.slice(0, -3)).sort((a, b) => a - b);
    assert.deepEqual(concealed(), expected, 'All columns start at depth three');
    assert.equal(expected.length, 28);
    const ctx = fx.ctxs[0];
    const { spendFogPeek, refundFogPeek } = await import('../../js/voyage/content/special/boss.fog.js');
    assert.equal(ctx.memo.peeks, 3);
    const beforePeek = clone(ctx.memo._runtime);
    for (let i = 0; i < 3; i++) assert(spendFogPeek(ctx));
    refundFogPeek(ctx);
    assert.equal(ctx.memo.peeks, 1, 'A gesture that becomes a drag refunds its peek');
    assert(spendFogPeek(ctx));
    assert.equal(ctx.memo.peeks, 0);
    assert.equal(ctx.memo._runtime.badge, '0');
    assert(!spendFogPeek(ctx), 'Exhausted budget refuses another peek');
    assert.deepEqual(ctx.memo._runtime.concealed, beforePeek.concealed, 'Peek never changes saved information');
    assert.equal(game.history.length, 0, 'Peek never counts as a move');
    const col = game.tableau[0], newlySeen = col.at(-4), buried = col[0];
    const moved = game.moveToFreeCell({ kind: 'col', i: 0, cardIndex: col.length - 1 }, 0);
    assert(moved); fx.emit('move', { move: moved, manual: true });
    assert(!concealed().includes(newlySeen), 'Shrinking reveals the new third card');
    assert(concealed().includes(buried), 'Unseen buried cards stay hidden');
    const afterMove = concealed();
    assert(game.undo()); fx.emit('undo', { move: moved, moves: [moved] });
    assert.deepEqual(game.state, initial);
    assert.deepEqual(concealed(), afterMove, 'Undo never erases a permanent discovery');

    const savedMemo = clone(memo), restoredAPI = stubAPI(game);
    const restored = new BoardEffects(active, { seed: 'fog-check', boardIndex: 6, api: restoredAPI, memo: savedMemo });
    restored.setup({ state: clone(initial), initial, deal, restored: true });
    assert.deepEqual(restored.ctxs[0].api.concealed.slice().sort((a, b) => a - b), afterMove, 'Resume preserves exact concealed set');
    assert.deepEqual(restoredAPI.concealed.sort((a, b) => a - b), afterMove);
    assert.equal(restored.ctxs[0].memo.peeks, 0, 'Spent peeks survive resume');
    assert.equal(restored.ctxs[0].memo._runtime.badge, '0');
    // Restoring a live shrunken board still enforces depth three, even if the
    // last saved visibility update predates a move (e.g. a legacy save).
    assert(game.moveToFreeCell({ kind: 'col', i: 0, cardIndex: game.tableau[0].length - 1 }, 0));
    assert(game.moveToFreeCell({ kind: 'col', i: 0, cardIndex: game.tableau[0].length - 1 }, 1));
    const liveThird = game.tableau[0].at(-3);
    const resumed = new BoardEffects(active, { seed: 'fog-check', boardIndex: 6, api: stubAPI(game), memo: clone(savedMemo) });
    resumed.setup({ state: clone(initial), initial, deal, restored: true });
    assert(!resumed.ctxs[0].api.concealed.includes(liveThird));
    assert(game.undo()); resumed.emit('undo', {});
    assert(!resumed.ctxs[0].api.concealed.includes(liveThird));
  }
  {
    const { spendFogPeek, refundFogPeek } = await import('../../js/voyage/content/special/boss.fog.js');
    const game = new Rules.Game(1), memo = {};
    const aces = [1, 14, 27, 40];
    game.state.tableau = [...aces.map((id) => [id]), Array.from({ length: 52 }, (_, i) => i + 1).filter((id) => !aces.includes(id)), [], [], []];
    const initial = Rules.cloneState(game.state);
    const active = [{ id: fog.id, kind: 'boss', strength: 7 }];
    let fx = new BoardEffects(active, { seed: 'fog-grants', boardIndex: 6, api: stubAPI(game), memo });
    fx.setup({ state: initial, initial, deal: 1 });
    // Four real column-empty moves give grants distinct history boundaries.
    for (let i = 0; i < 4; i++) {
      const m = game.moveToFoundation({ kind: 'col', i });
      assert(m); assert.equal(game.tableau[i].length, 0); fx.emit('move', { move: m });
      fx.emit('columnEmpty', { col: i });
    }
    assert.equal(fx.ctxs[0].memo.peeks, 6, 'Held budget caps at six');
    refundFogPeek(fx.ctxs[0]); assert.equal(fx.ctxs[0].memo.peeks, 6, 'Drag refund respects the cap');
    assert.equal(fx.ctxs[0].memo.peekGrants.at(-1).delta, 0);
    assert(spendFogPeek(fx.ctxs[0]));
    fx = new BoardEffects(active, { seed: 'fog-grants', boardIndex: 6, api: stubAPI(game), memo: clone(memo) });
    fx.setup({ state: initial, initial, deal: 1, restored: true });
    assert.equal(fx.ctxs[0].memo.peeks, 5);
    game.undo(); fx.emit('undo', {});
    assert.equal(fx.ctxs[0].memo.peeks, 5, 'Undo at cap does not confiscate an unearned peek');
    game.undo(); fx.emit('undo', {});
    assert.equal(fx.ctxs[0].memo.peeks, 4, 'Undo removes a granted peek even after spending and resume');
    game.undo(); game.undo(); fx.emit('undo', {});
    assert.equal(fx.ctxs[0].memo.peeks, 2, 'Batch undo removes every grant');
    assert.deepEqual(fx.ctxs[0].memo.peekGrants, []);
    assert.equal(fx.ctxs[0].memo._runtime.badge, '2');
  }
  const game = new Rules.Game(1), initial = Rules.cloneState(game.state), memo = {};
  const active = [{ id: 'deepstorage.clearance', kind: 'boon', strength: 1 }, { id: fog.id, kind: 'boss', strength: 7 }];
  const fx = new BoardEffects(active, { seed: 'clearance-fog', boardIndex: 6, api: stubAPI(game), memo });
  fx.setup({ state: initial, initial, deal: 1 }); fx.emit('start', {});
  assert.deepEqual(fx.ctxs[0].api.concealed, [], 'Clearance nullifies fog even when active order is boon first');
  const m = game.moveToFreeCell({ kind: 'col', i: 0, cardIndex: game.tableau[0].length - 1 }, 0);
  fx.emit('move', { move: m }); game.undo(); fx.emit('undo', { move: m });
  assert.deepEqual(fx.ctxs[0].api.concealed, []);
  const restored = new BoardEffects(active, { seed: 'clearance-fog', boardIndex: 6, api: stubAPI(game), memo: clone(memo) });
  restored.setup({ state: initial, initial, deal: 1, restored: true });
  assert.deepEqual(restored.ctxs[0].api.concealed, [], 'Clearance stays effective after resume');
}
// Run with --browser against serve.mjs on port 8162 (or VOYAGE_TEST_URL).
export async function checkBrowser() {
const { default: assert } = await import('node:assert/strict');
const { createRequire } = await import('node:module');
const { homedir } = await import('node:os');
const { mkdirSync, writeFileSync, readFileSync } = await import('node:fs');
const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
const puppeteer = require('puppeteer-core');
const base = process.env.VOYAGE_TEST_URL || 'http://localhost:8162';
const shots = '/tmp/b3-shots'; mkdirSync(shots,{recursive:true});
const browser = await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page = await browser.newPage(); await page.setBypassServiceWorker(true);
// Software WebGL: keep production input/materials/animation, omit shadow maps
// and draw every sixth frame. Animation/input updates still run every frame.
await page.setRequestInterception(true);
page.on('request', request => {
 if (new URL(request.url()).pathname === '/js/main.js') {
  const source = readFileSync(new URL('../../js/main.js', import.meta.url), 'utf8')
   .replace('renderer.shadowMap.enabled = true;', 'renderer.shadowMap.enabled = false;')
   .replace('  historyInfo() {', '  b3ApplyDescriptor(m) { game.applyDescriptor(m); afterMove(); },\n  historyInfo() {')
   .replace('function loop() {', 'let b3RenderFrame = 0;\nfunction loop() {')
   .replace("  if (perf.tier === 'low') renderer.render(scene, camera);", "  if (++b3RenderFrame % 6) return;\n  if (perf.tier === 'low') renderer.render(scene, camera);");
  request.respond({status:200,contentType:'text/javascript',body:source});
 } else request.continue();
});
await page.setViewport({width:1100,height:820,deviceScaleFactor:1});
const errors=[], report=[]; page.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack)});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const note=(s,data)=>{report.push({check:s,...data});console.log('OK:',s)};
async function startWork(fn,...args){await page.evaluate((fn,args)=>{window.b3Work=null; (async()=>{try{await (0,eval)(`(${fn})`)(...args);window.b3Work='done'}catch(e){window.b3Work=e.stack}})()},fn.toString(),args);await page.waitForFunction(()=>window.b3Work!==null,{timeout:90000});assert.equal(await page.evaluate(()=>window.b3Work),'done')}
async function settle(){await page.waitForFunction(()=>window.FreeCell&&!FreeCell.busy,{timeout:90000});await pause(200)}
async function boot(){await page.goto(base,{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.FreeCell&&!document.getElementById('loader'),{timeout:90000});await page.evaluate(()=>FreeCell.scene.traverse(o=>{if(o.isLight)o.castShadow=false}));}
async function fixture(clearance=false,theme='roman'){
 await startWork(async(clearance,theme)=>{
  const {createRun,startBoard,saveRun}=await import('/js/voyage/run.js');
  const {nextChoices,chooseNode}=await import('/js/voyage/map.js');
  const {baseRules}=await import('/js/voyage/charms.js');
  const {voyageUI}=await import('/js/voyage/ui.js');
  const r=createRun({seed:'b3-browser'});r.boss='boss.fog';r.undos=20;
  for(let i=0;i<6;i++){const n=nextChoices(r.map)[0];chooseNode(r.map,n.id);r.results.push({idx:i,theme:n.theme,deal:i+2,tier:1,par:60,moves:60,time:120,undosUsed:0,total:1000,stars:2,charm:null,score:{lines:[],mults:[],total:1000}})}
  const n=nextChoices(r.map)[0];n.theme=theme;
  const active=[{id:'boss.fog',kind:'boss',strength:7}];
  if(clearance){r.boons=['deepstorage.clearance'];active.push({id:'deepstorage.clearance',kind:'boon',strength:1})}
  const cur=startBoard(r,n.id,{deal:1,par:60,rules:baseRules(),strength:7,active,ease:0,dealShift:-.5});cur.challenge=null;
  saveRun(r);await voyageUI.handlers.continueVoyage();
 },clearance,theme);await settle();
}
const metrics=()=>page.evaluate(()=>{
 const r=FreeCell.voyage.run();const cards=[],mist=[];
 FreeCell.scene.traverse(g=>{if(g.isGroup&&g.userData.cardId)cards.push({id:g.userData.cardId,hidden:!!g.userData.concealed});if(g.userData.fogColumn!==undefined)mist.push({col:g.userData.fogColumn,visible:g.visible})});
 return {state:FreeCell.getState(),history:r?.current?.history||[],memo:r?.current?.memo?.['boss.fog']?._runtime,cards,mist,idx:r?.current?.idx,peeks:r?.current?.memo?.['boss.fog']?.peeks,mode:FreeCell.voyage.mode};
});
const visibleHidden=m=>m.cards.filter(g=>g.hidden).map(g=>g.id).sort((a,b)=>a-b);
const savedHidden=m=>(m.memo?.concealed||[]).slice().sort((a,b)=>a-b);
async function point(id,strip=true){return await page.evaluate((id,strip)=>FreeCell.projectCard(id,strip),id,strip)}
async function dragCard(id,kind,index){const p=await point(id,false),t=await page.evaluate((kind,index)=>FreeCell.projectSlot(kind,index),kind,index);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(t.x,t.y,{steps:8});await page.mouse.up();await settle()}
async function screenshot(name){await page.screenshot({path:`${shots}/${name}.png`})}
try{
 await page.evaluateOnNewDocument(()=>{if(!localStorage.getItem('freecellworlds.settings'))localStorage.setItem('freecellworlds.settings',JSON.stringify({theme:'roman',autoRandomTheme:false,autoFoundation:false,reducedMotion:true,muted:true,quality:'low'}));localStorage.setItem('freecellworlds.voyageTutorial',JSON.stringify({map:true,board:true,reward:true}))});
 async function reset(clearance=false,theme='roman'){await boot();await fixture(clearance,theme);return await metrics()}
 async function setTap(on){await page.click('#btn-settings');if(await page.$eval('#set-tap-peek',e=>e.checked)!==on)await page.click('#set-tap-peek');await screenshot('06-tap-setting');await page.keyboard.press('Escape');await page.evaluate(()=>document.activeElement.blur())}
 const count=m=>m.peeks;
 const badge=()=>page.evaluate(()=>document.querySelector('#voyage-hud .voyage-charm-badge')?.textContent);
 async function hold(id,ms=320){const p=await point(id);await page.mouse.move(p.x,p.y);await page.mouse.down();await pause(ms)}
 let m=await reset();const initial=m,buried=m.state.tableau[0][0];
 assert.equal(m.idx,6);assert.equal(savedHidden(m).length,28);assert.equal(count(m),3);assert.equal(await badge(),'3');assert.deepEqual(visibleHidden(m),savedHidden(m));assert.equal(m.mist.filter(g=>g.visible).length,8);await screenshot('01-deal-fog');note('board 7: depth-three fog, eight mist quads, three peeks on boss chip');
 const p=await point(buried);await page.mouse.move(p.x,p.y);await page.mouse.down();await pause(100);m=await metrics();assert.deepEqual(visibleHidden(m),savedHidden(initial));assert.equal(count(m),3);await pause(220);m=await metrics();assert.equal(visibleHidden(m).length,24);assert.equal(count(m),2);assert.deepEqual(savedHidden(m),savedHidden(initial));assert.equal(m.history.length,0);await screenshot('02-hold-peek');await page.mouse.up();await pause(100);m=await metrics();assert.deepEqual(visibleHidden(m),savedHidden(initial));assert.equal(count(m),2);assert.equal(m.history.length,0);note('250ms hold spends one at reveal; release restores exact set without a move');
 await hold(buried,70);await page.mouse.up();await pause(100);assert.equal(count(await metrics()),2);note('short cancelled press is free');
 await hold(buried);assert.equal(count(await metrics()),1);await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true})));await pause(100);assert.deepEqual(visibleHidden(await metrics()),savedHidden(initial));await page.mouse.up();note('pointer cancellation closes an already-spent peek');
 const newlySeen=initial.state.tableau[0].at(-4),top=initial.state.tableau[0].at(-1);await dragCard(top,'free',0);m=await metrics();assert.equal(m.history.length,1);assert.equal(count(m),1);assert(!savedHidden(m).includes(newlySeen));assert.equal(savedHidden(m).length,27);await screenshot('03-dynamic-reveal');note('drag before reveal is free; shrinking column reveals its new third card');
 const discovered=savedHidden(m);await page.click('#btn-undo');await settle();m=await metrics();assert.deepEqual(m.state,initial.state);assert.deepEqual(savedHidden(m),discovered);assert.deepEqual(visibleHidden(m),discovered);assert.equal(count(m),1);await screenshot('04-undo-seen-stays-seen');note('HUD undo restores board, preserves discoveries and does not refund spent peeks');
 const topPoint=await point(top,false),freePoint=await page.evaluate(()=>FreeCell.projectSlot('free',0));await page.mouse.move(topPoint.x,topPoint.y);await page.mouse.down();await pause(320);assert.equal(visibleHidden(await metrics()).length,24);assert.equal(count(await metrics()),0);await page.mouse.move(freePoint.x,freePoint.y,{steps:8});await page.mouse.up();await settle();m=await metrics();assert.equal(m.history.length,1);assert.deepEqual(visibleHidden(m),savedHidden(m));assert.equal(count(m),1);note('hold then drag refunds its peek and completes the drag');await page.click('#btn-undo');await settle();
 await hold(buried);assert.equal(count(await metrics()),0);await page.mouse.up();await pause(100);
 await hold(buried);m=await metrics();assert.equal(count(m),0);assert.deepEqual(visibleHidden(m),discovered);await page.mouse.up();await screenshot('12-exhausted');note('exhausted budget blocks further reveals');
 // Exercise a real column-empty event using a verified solver prefix. The
 // final move of this prefix empties a column, so actual HUD Undo removes it.
 await startWork(async()=>{
  const solved=await FreeCell.solve({timeLimitMs:20000});
  if(!solved.solution)throw Error('No solution for grant fixture');
  let steps=0;
  for(const move of solved.solution){
    FreeCell.b3ApplyDescriptor(move);steps++;
    if(FreeCell.getState().tableau.some(c=>!c.length))break;
  }
  window.b3GrantPrefix=steps;
 });await settle();m=await metrics();assert(m.state.tableau.some(c=>!c.length));assert.equal(count(m),1);assert.equal(await badge(),'1');await screenshot('13-earned-peek');note('actual emptied column grants one peek and updates HUD');
 await boot();await startWork(async()=>{const{voyageUI}=await import('/js/voyage/ui.js');await voyageUI.handlers.continueVoyage()});await settle();assert.equal(count(await metrics()),1);await page.click('#btn-undo');await settle();m=await metrics();assert.equal(count(m),0);assert(m.state.tableau.every(c=>c.length));note('earned peek survives reload; resumed HUD Undo takes back its grant');
 // Fresh limited budget for keyboard and accessibility interactions.
 m=await reset();const hidden=savedHidden(m);assert.equal(count(m),3);
 await page.keyboard.down('p');await page.keyboard.down('2');await pause(100);m=await metrics();assert.equal(visibleHidden(m).length,24);assert.equal(count(m),2);await screenshot('05-keyboard-hold');await page.keyboard.up('2');await pause(100);assert.deepEqual(visibleHidden(await metrics()),hidden);await page.keyboard.up('p');
 await page.keyboard.press('p');await page.keyboard.press('3');await pause(100);assert.equal(visibleHidden(await metrics()).length,24);assert.equal(count(await metrics()),1);await page.keyboard.press('Escape');await pause(100);assert.deepEqual(visibleHidden(await metrics()),hidden);note('P + digit hold and P then digit toggle each spend one; release/Escape hide');
 await setTap(true);assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('freecellworlds.settings')).tapToPeek));const cp=await point(m.state.tableau[1][0]);await page.mouse.click(cp.x,cp.y);await pause(100);m=await metrics();assert.equal(visibleHidden(m).length,24);assert.equal(count(m),0);assert.deepEqual(savedHidden(m),hidden);await screenshot('07-tap-peek');
 // Reload DURING toggled peek: memo stores concealment and budget, not visuals.
 await boot();await startWork(async()=>{const{voyageUI}=await import('/js/voyage/ui.js');await voyageUI.handlers.continueVoyage()});await settle();m=await metrics();assert.deepEqual(savedHidden(m),hidden);assert.deepEqual(visibleHidden(m),hidden);assert.equal(count(m),0);assert.equal(await badge(),'0');assert(await page.evaluate(()=>document.getElementById('set-tap-peek').checked));await screenshot('08-resume');note('reload during peek restores exact concealment, spent count and tap preference');
 await setTap(false);await hold(m.state.tableau[0].at(-1));assert.equal(count(await metrics()),0);await page.mouse.up();await pause(100);assert.equal((await metrics()).history.length,0);assert.deepEqual(visibleHidden(await metrics()),hidden);await setTap(true);note('exhausted hold on a movable card creates no move');
 await dragCard(m.state.tableau[0].at(-1),'free',0);m=await metrics();assert.equal(m.history.length,1);assert.equal(count(m),0);await page.click('#btn-undo');await settle();note('tap mode preserves drag and Undo after exhausted-budget resume');
 m=await reset();const toggleHidden=savedHidden(m),tp=await point(m.state.tableau[1][0]);await page.mouse.click(tp.x,tp.y);await pause(100);assert.equal(count(await metrics()),2);await page.mouse.click(tp.x,tp.y);await pause(100);assert.deepEqual(visibleHidden(await metrics()),toggleHidden);assert.equal(count(await metrics()),2);assert.equal((await metrics()).history.length,0);note('tap-to-toggle on spends one, off is free, neither creates a move');
 await page.keyboard.press('p');await page.keyboard.press('2');await pause(100);assert.equal(count(await metrics()),1);await page.keyboard.press('p');await page.keyboard.press('2');await pause(100);assert.equal(count(await metrics()),1);assert.deepEqual(visibleHidden(await metrics()),toggleHidden);note('keyboard toggle follows Tap to peek and off is free');
 await page.mouse.click(tp.x,tp.y);await pause(100);assert.equal(count(await metrics()),0);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await pause(100);assert.deepEqual(visibleHidden(await metrics()),toggleHidden);note('window blur closes temporary peek');
 m=await reset(false,'azulejo');await screenshot('09-light-theme');assert.equal(m.mist.filter(g=>g.visible).length,8);note('theme-neutral mist works on a light theme');
 m=await reset(true,'roman');assert.deepEqual(savedHidden(m),[]);assert.deepEqual(visibleHidden(m),[]);assert.equal(m.mist.filter(g=>g.visible).length,0);assert.equal(count(m),3);await screenshot('10-clearance');note('Clearance permanently nullifies Fog and removes mist');
 await startWork(async()=>{const{ui}=await import('/js/ui.js');ui.handlers.dealNumber(1)});await settle();m=await metrics();assert.equal(m.mode,'classic');assert.deepEqual(visibleHidden(m),[]);assert.equal(m.mist.filter(g=>g.visible).length,0);const classic=m.state;await dragCard(classic.tableau[0].at(-1),'free',0);assert.equal((await metrics()).state.free[0],classic.tableau[0].at(-1));await page.click('#btn-undo');await settle();assert.deepEqual((await metrics()).state,classic);await screenshot('11-classic');note('classic has no fog and drag/undo remain unchanged');
 assert.deepEqual(errors,[]);writeFileSync(`${shots}/report.json`,JSON.stringify({report,errors},null,2));
}catch(e){console.error('FAIL',e);await screenshot('failure').catch(()=>{});writeFileSync(`${shots}/failure.json`,JSON.stringify({error:e.stack,metrics:await metrics().catch(()=>null),errors,report},null,2));process.exitCode=1}finally{await browser.close()}

}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const helpers = await import('../charm-content-check.mjs');
  await check(helpers);
  console.log('OK: boss.fog depth, peek budget/grants, undo, resume, Clearance and neutral rules');
  if (process.argv.includes('--browser')) await checkBrowser();
}
