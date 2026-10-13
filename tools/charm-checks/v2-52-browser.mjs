#!/usr/bin/env node
// Real production-board checks. Serve the checkout with `node serve.mjs 8173`.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { clickTarget } from './_browser-pick.mjs';
export async function check() {} // Safe if imported by another content runner.

async function main() {
  const require=createRequire(homedir()+'/Documents/mahjpods/film/package.json');
  const puppeteer=require('puppeteer-core');
  const base=process.env.VOYAGE_TEST_URL || 'http://127.0.0.1:8173';
  const shots='/tmp/n52-browser'; mkdirSync(shots,{recursive:true});
  const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  const page=await browser.newPage(), errors=[];
  page.on('console',(m)=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});
  page.on('pageerror',(e)=>{errors.push(e.stack||String(e));console.error(e);});
  const suppliedArt=new Set();
  await page.setRequestInterception(true);
  page.on('request',(request)=>{
    const path=new URL(request.url()).pathname;
    if(/^\/assets\/art\/charms\/.+\.webp$/.test(path)&&!existsSync(new URL(`../..${path}`,import.meta.url))) {
      suppliedArt.add(path);
      request.respond({status:200,contentType:'image/webp',body:readFileSync(new URL('../../assets/art/charms/aero.dolphin.webp',import.meta.url))});
    } else request.continue();
  });
  await page.setBypassServiceWorker(true); await page.setViewport({width:640,height:480,deviceScaleFactor:.5});
  await page.evaluateOnNewDocument(()=>{
    localStorage.setItem('freecellworlds.settings',JSON.stringify({theme:'roman',autoRandomTheme:false,autoFoundation:false,reducedMotion:true,muted:true,quality:'low'}));
    localStorage.setItem('freecellworlds.voyageTutorial',JSON.stringify({map:true,board:true,reward:true}));
  });
  const pause=(ms)=>new Promise((r)=>setTimeout(r,ms));
  const settle=async()=>{await page.waitForFunction(()=>window.FreeCell&&!FreeCell.busy,{timeout:60000,polling:200});await pause(200);};
  const snapshot=()=>page.evaluate(()=>({state:FreeCell.getState(),run:JSON.parse(JSON.stringify(FreeCell.voyage.run()))}));
  async function fixture({boons,level=1,rules={},coins=20,undos=4,dead=false,final=false}) {
    await page.evaluate(async(options)=>{
      const {createRun,startBoard,saveRun}=await import('/js/voyage/run.js');
      const {nextChoices}=await import('/js/voyage/map.js');
      const {baseRules}=await import('/js/voyage/charms.js');
      const {Game,generateMoves}=await import('/js/rules.js');
      const r=createRun({seed:'n52-browser'}); Object.assign(r,{boss:'boss.house',boons:options.boons,coins:options.coins,undos:options.undos,levels:Object.fromEntries(options.boons.map((id)=>[id,options.level]))});
      const node=nextChoices(r.map)[0]; node.port=true;
      const rules={...baseRules(),...options.rules}; let deal=1;
      if(options.dead) {
        rules.noCellRanks=16382; rules.barrenCards=Array.from({length:52},(_,i)=>i+1);
        while(generateMoves(new Game(deal,{rules}).state,{rules}).length) deal++;
      }
      const cur=startBoard(r,node.id,{deal,par:60,rules});
      cur.theme='roman'; cur.challenge=null; cur.extraChallenges=[]; cur.boss=null; cur.storm=false;
      cur.active=options.boons.map((id)=>({id,kind:'boon',strength:1,level:options.level}));
      cur.initial=new Game(deal,{rules}).initial;
      cur.offers=['plaster.armature','vaporwave.checkerboard','backrooms.hum'];
      if(options.final) {cur.idx=6;r.results=Array.from({length:6},(_,idx)=>({idx,theme:'roman',total:0,stars:1,coins:0,score:{lines:[],mults:[]}}));}
      saveRun(r);
    },{boons,level,rules,coins,undos,dead,final});
    await page.reload({waitUntil:'networkidle0'});
    await page.evaluate(async()=>{FreeCell.scene.traverse((o)=>{if(o.isLight)o.castShadow=false;});const {voyageUI}=await import('/js/voyage/ui.js');await voyageUI.handlers.continueVoyage();});
    await settle();
  }
  async function usePick(id,{cancel=false}={}) {
    await page.click(`[data-ability="${id}"]`);
    await page.waitForSelector('.voyage-target-prompt');
    if(cancel) {await page.keyboard.press('Escape'); await settle(); return;}
    await clickTarget(page);
    if(id==='backrooms.noclip') {await page.waitForFunction(()=>FreeCell.voyage.targeting()?.kind==='column');await clickTarget(page);}
    await page.waitForFunction(()=>!document.querySelector('.voyage-target-prompt')); await settle();
  }
  try {
    await page.goto(base,{waitUntil:'networkidle0'}); await page.waitForFunction(()=>window.FreeCell&&!document.getElementById('loader'));
    for(const level of [1,2]) for(const id of ['plaster.mould','backrooms.noclip','cinema.exposure']) {
      await fixture({boons:[id],level}); const before=await snapshot();
      const uses=before.run.current.memo[id]._runtime.abilityUses;
      await usePick(id,{cancel:true}); assert.equal((await snapshot()).run.current.memo[id]._runtime.abilityUses,uses);
      await usePick(id); const after=await snapshot();
      assert.equal(after.run.current.history.at(-1).op,id);
      assert.equal(after.run.current.memo[id]._runtime.abilityUses,uses-1);
      if(id==='plaster.mould')assert(after.run.current.liveRules.wildRanks);
      if(id==='cinema.exposure')assert.equal(after.run.current.liveRules.wildCards.length,1);
      await page.click('#btn-undo'); await settle(); const undone=await snapshot();
      assert.deepEqual(undone.state,before.state); assert.deepEqual(undone.run.current.liveRules,before.run.current.liveRules);
      assert.equal(undone.run.current.memo[id]._runtime.abilityUses,uses); assert.equal(undone.run.current.undosUsed,1);
      await page.screenshot({path:`${shots}/${id}-L${level}-undone.png`}); console.log(`✓ ${id} L${level}: picker/cancel/X/undo/use refund`);
    }
    for(const level of [1,2]) {
      await fixture({boons:['vaporwave.fountain'],level,coins:5});const before=await snapshot();
      await page.click('[data-ability="vaporwave.fountain"]'); await settle();const after=await snapshot();
      assert.equal(after.run.coins,0); assert.equal(after.run.economy.coinsSpent,5);
      const ranks=after.run.current.liveRules.wildRanks; assert.equal(ranks.toString(2).replace(/0/g,'').length,level);
      await page.click('#btn-undo');await settle();const undone=await snapshot();
      assert.deepEqual(undone.state,before.state);assert.equal(undone.run.coins,0);assert.equal(undone.run.current.liveRules.wildRanks,0);
      assert.equal(undone.run.current.memo['vaporwave.fountain']._runtime.abilityUses,1);
      assert.equal(await page.$eval('[data-ability="vaporwave.fountain"]',(e)=>e.getAttribute('aria-disabled')),'true');
      console.log(`✓ Wishing Fountain L${level}: paid seeded ranks, rule undo, no coin refund`);
    }
    // A foundation event at the upgraded threshold recharges a real exhausted ability once.
    await fixture({boons:['cinema.exposure','cinema.projectionist'],level:2,rules:{startHome:5}});
    await usePick('cinema.exposure');await usePick('cinema.exposure');
    const homeCard=await page.evaluate(async()=>{const {legalFoundationMoves}=await import('/js/rules.js');return legalFoundationMoves(FreeCell.getState(),FreeCell.voyage.run().current.liveRules)[0]?.card;});
    assert(homeCard,'threshold fixture needs an exposed Six');
    const point=await page.evaluate((id)=>FreeCell.projectCard(id,true),homeCard); await page.mouse.click(point.x,point.y,{clickCount:2});await settle();
    assert.equal((await snapshot()).run.current.memo['cinema.exposure']._runtime.abilityUses,1);
    await page.click('#btn-undo');await settle();assert.equal((await snapshot()).run.current.memo['cinema.exposure']._runtime.abilityUses,1);
    console.log('✓ Projectionist: real foundation recharge and undo protection');

    await fixture({boons:['backrooms.exitsign']});await page.click('[data-ability="backrooms.exitsign"]');
    await page.waitForFunction(()=>FreeCell.voyage.run().status==='reward');await page.waitForSelector('#voyage-result:not([hidden])');
    let escaped=await snapshot();assert(escaped.run.results[0].conceded);assert.equal(escaped.run.results[0].stars,1);assert.equal(escaped.run.results[0].coins,0);assert.equal(escaped.run.reward.offers.length,1);
    assert.equal(await page.$eval('#voyage-result-title',(e)=>e.textContent),'Stepped out');await page.screenshot({path:`${shots}/exit-sign.png`});
    await page.click('[data-pick-charm]');await pause(300);assert.equal((await snapshot()).run.status,'port');console.log('✓ Exit Sign → one-offer reward → port');
    await fixture({boons:['cinema.cliffhanger'],undos:0,dead:true});
    await page.evaluate(async()=>{const {voyageUI}=await import('/js/voyage/ui.js');await voyageUI.handlers.useAbility('missing');});
    await page.waitForFunction(()=>FreeCell.voyage.run().status==='reward');await page.waitForSelector('#voyage-result:not([hidden])');
    escaped=await snapshot();assert(escaped.run.results[0].conceded);assert.equal(escaped.run.results[0].stars,1);assert.equal(escaped.run.results[0].coins,0);assert.equal(escaped.run.reward.offers.length,1);
    assert.equal(escaped.run.charmMemo['cinema.cliffhanger'].exits,1);await page.screenshot({path:`${shots}/cliffhanger.png`});console.log('✓ Cliffhanger: real no-moves/no-undos stuck dispatch → reward');
    await fixture({boons:['cinema.cliffhanger','backrooms.exitsign'],undos:0,dead:true,final:true});
    assert.equal(await page.$eval('[data-ability="backrooms.exitsign"]',(e)=>e.getAttribute('aria-disabled')),'true');
    await page.evaluate(async()=>{const {voyageUI}=await import('/js/voyage/ui.js');await voyageUI.handlers.useAbility('missing');});
    await page.waitForFunction(()=>FreeCell.voyage.run().status==='lost');assert.equal((await snapshot()).run.results.length,6);console.log('✓ finale: Exit Sign disabled, Cliffhanger cannot concede, stuck ends run');
    assert.deepEqual(errors,[],'production console/page errors');console.log(`N52 browser passed; screenshots ${shots}; pending charm artwork supplied by fixture: ${suppliedArt.size}`);
  } catch(error) {await page.screenshot({path:`${shots}/failure.png`});throw error;}
  finally {await browser.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
