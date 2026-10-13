#!/usr/bin/env node
// Real-board x2 targeting, saved X replay, charge refund and console checks on 8161.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ids } from './v2-x2.mjs';
import { clickTarget } from './_browser-pick.mjs';

// Pure content discovery imports this file; browser work runs only when invoked directly.
export function check() {}

async function main() {
  const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
  const puppeteer = require('puppeteer-core');
  const base = process.env.VOYAGE_TEST_URL || 'http://[::1]:8161';
  const shots = `/tmp/x2-shots-${new URL(base).port}`;
  mkdirSync(shots,{recursive:true});
  const browser = await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page = await browser.newPage();
  await page.setViewport({width:800,height:600,deviceScaleFactor:.5}); await page.setBypassServiceWorker(true);
  const errors = [], missingArt = new Set();
  // The new Quick Draw icon has no production art yet; use existing saloon art in
  // this fixture and record that asset gap separately from runtime console errors.
  await page.setRequestInterception(true);
  page.on('request',(request)=> {
    if (request.url().endsWith('/js/main.js')) {
      // Software WebGL under concurrent browser checks: draw every 60th frame;
      // keep the production animation updates, rules, target UI and handlers.
      const source = readFileSync(new URL('../../js/main.js',import.meta.url),'utf8')
        .replace('renderer.shadowMap.enabled = true;', 'renderer.shadowMap.enabled = false;')
        .replace("if (perf.tier === 'low') renderer.render(scene, camera);", "if (perf.tier === 'low') { if ((window.__x2Frames = (window.__x2Frames || 0) + 1) % 60 === 0) renderer.render(scene, camera); }");
      request.respond({status:200,contentType:'text/javascript',body:source});
    } else if (request.url().endsWith('/assets/art/charms/saloon.quickdraw.webp') && !existsSync(new URL('../../assets/art/charms/saloon.quickdraw.webp',import.meta.url))) {
      missingArt.add('assets/art/charms/saloon.quickdraw.webp');
      request.continue({url:request.url().replace('saloon.quickdraw.webp','saloon.seven.webp')});
    } else request.continue();
  });
  page.on('console',(m)=>{if(m.type()==='error') {errors.push(m.text());console.error(m.text());}});
  page.on('pageerror',(e)=>{errors.push(e.stack || String(e));console.error(e);});
  await page.evaluateOnNewDocument(()=>{
    localStorage.setItem('freecellworlds.settings',JSON.stringify({theme:'roman',autoRandomTheme:false,autoFoundation:false,reducedMotion:true,muted:true,quality:'low'}));
    localStorage.setItem('freecellworlds.voyageTutorial',JSON.stringify({map:true,board:true,reward:true}));
  });
  const pause = (ms)=>new Promise((r)=>setTimeout(r,ms));
  const settle = async()=>{try {await page.waitForFunction(()=>window.FreeCell && !FreeCell.busy,{timeout:60000});} catch(e) {console.error(await page.evaluate(()=>({busy:FreeCell.busy, perf:FreeCell.perf, status:FreeCell.voyage.run()?.status})));await page.screenshot({path:`${shots}/failure.png`});throw e;} await pause(150);};
  const state = ()=>page.evaluate(()=>FreeCell.getState());
  const uses = (id)=>page.evaluate((id)=>FreeCell.voyage.run().current.memo[id]._runtime.abilityUses,id);
  async function resume() {
    await page.evaluate(async()=>{
      FreeCell.scene.traverse((o)=>{if(o.isLight)o.castShadow=false;});
      const {voyageUI}=await import('/js/voyage/ui.js'); await voyageUI.handlers.continueVoyage();
      FreeCell.scene.traverse((o)=>{if(o.isLight)o.castShadow=false;});
    }); await settle();
  }
  async function fixture(id,level) {
    await page.evaluate(async({id,level})=>{
      const {createRun,startBoard,saveRun}=await import('/js/voyage/run.js');
      const {nextChoices}=await import('/js/voyage/map.js');
      const {baseRules}=await import('/js/voyage/charms.js');
      const {Game}=await import('/js/rules.js');
      const {overrideTargets}=await import('/js/voyage/content/special/concrete.spraytag.js');
      const r=createRun({seed:'x2-browser'}); r.boons=[id]; r.levels={[id]:level}; r.undos=8;
      const cur=startBoard(r,nextChoices(r.map)[0].id,{deal:1,par:60});
      cur.theme='roman'; cur.challenge=null; cur.rules=baseRules();
      cur.active=[{id,kind:'boon',strength:1,level}];
      if(id==='saffron.loom')cur.rules.dealSkew=[2,8,7,7,7,7,7,7];
      let g=new Game(1,{rules:JSON.parse(JSON.stringify(cur.rules))});
      if(id==='deepsea.current') {
        for(let deal=1;deal<=100;deal++) {
          g=new Game(deal,{rules:JSON.parse(JSON.stringify(cur.rules))});
          if(overrideTargets({api:{state:g.state,rules:g.rules,concealed:[]}},{ignoreCap:true},false,true).length){cur.deal=deal;break;}
        }
      }
      if(['saloon.quickdraw','lowtide.tidepool','theater.understudy'].includes(id))g.applyDescriptor({t:'C',src:{kind:'col',i:0},fi:0});
      if(id==='saffron.loom')for(const fi of [0,1])g.applyDescriptor({t:'C',src:{kind:'col',i:0},fi});
      cur.history=g.history; cur.initial=g.initial; saveRun(r);
    },{id,level});
    await page.reload({waitUntil:'networkidle0'}); await resume();
  }
  async function activate(id,pickCount) {
    const pending = page.evaluate(async(id)=>{const {voyageUI}=await import('/js/voyage/ui.js'); await voyageUI.handlers.useAbility(id);},id);
    for(let i=0;i<pickCount;i++) {
      await clickTarget(page);
    }
    await pending; await settle();
  }
  const pickCounts={'carvings.totem':1,'saffron.loom':2,'saloon.quickdraw':2,'cutpaper.octavo':2,
    'cyber.ghost':1,'signal.pull':2,'carvings.raven':2,'lowtide.tidepool':2,'theater.understudy':2,
    'deepsea.current':2,'toybox.jackinbox':2,'museum.digsite':1};
  try {
    await page.goto(base,{waitUntil:'networkidle0'});
    await page.waitForFunction(()=>!!window.FreeCell && !document.getElementById('loader'));
    for(const id of ids)for(const level of [1,2]) {
      console.log(`START browser: ${id} L${level}`);
      await fixture(id,level);
      const before=await state(); assert.equal(await uses(id),level);
      // Cancellation exercises the actual target overlay and Escape path.
      if(id!=='library.bookmark') {
        const cancel=page.evaluate(async(id)=>{const {voyageUI}=await import('/js/voyage/ui.js');await voyageUI.handlers.useAbility(id);},id);
        await page.waitForSelector('.voyage-target-prompt'); await page.keyboard.press('Escape'); await cancel; await settle();
        assert.equal(await uses(id),level); assert.deepEqual(await state(),before);
      }
      if(id==='library.bookmark') {
        await activate(id,0); assert.equal(await uses(id),level);
        const card=before.tableau[0].at(-1);
        // Rendering is throttled here; refresh world matrices so the click's raycast sees the card.
        const point=await page.evaluate((id)=>{FreeCell.scene.updateMatrixWorld();return FreeCell.projectCard(id);},card);
        await page.mouse.click(point.x,point.y); await page.mouse.click(point.x,point.y); await settle();
        assert.notDeepEqual(await state(),before);
        await activate(id,0); assert.deepEqual(await state(),before);
        assert.equal(await uses(id),level-1);
        await page.click('#btn-undo'); await settle(); assert.equal(await uses(id),level);
        assert.equal(await page.evaluate(()=>FreeCell.voyage.run().current.memo['library.bookmark'].anchor),null);
      } else {
        await activate(id,pickCounts[id]);
        assert.equal(await uses(id),level-1,`${id}: consumed use`);
        const changed=await state(); assert.notDeepEqual(changed,before);
        if(level===2) {
          await page.reload({waitUntil:'networkidle0'});await resume();
          assert.deepEqual(await state(),changed,`${id}: saved custom move`); assert.equal(await uses(id),1);
        }
        await page.click('#btn-undo'); await settle();
        assert.deepEqual(await state(),before,`${id}: board undo`); assert.equal(await uses(id),level,`${id}: refunded use`);
      }
      console.log(`OK browser: ${id} L${level} — use, undo and refund`);
      if(level===2)await page.screenshot({path:`${shots}/${id}.png`});
    }
    assert.deepEqual(errors,[]);
    console.log(`PASS: x2 real boards, 26 ability/level cases, no console/page errors; screenshots ${shots}`);
    if(missingArt.size)console.log(`ASSET GAP (fixture supplied existing art): ${[...missingArt].join(', ')}`);
  } finally {await browser.close();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)await main();
