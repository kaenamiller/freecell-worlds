#!/usr/bin/env node
// Real Voyage HUD/picker/undo checks for X3, on its assigned browser port.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { clickTarget } from './_browser-pick.mjs';

export async function check() {} // The content harness imports this without launching Chrome.

async function main() {
  const require = createRequire(homedir() + '/Documents/mahjpods/film/package.json');
  const puppeteer = require('puppeteer-core');
  const base = process.env.VOYAGE_TEST_URL || 'http://[::1]:8162';
  const shots = '/tmp/x3-voyage-browser'; mkdirSync(shots, {recursive:true});
  const browser = await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:[
    '--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding',
    '--disable-features=CalculateNativeWinOcclusion',
  ]});
  const page = await browser.newPage(), errors = [];
  page.on('console',(m)=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});
  page.on('pageerror',(e)=>{const t=e.stack||String(e);errors.push(t);console.error(t);});
  page.on('response',(r)=>{if(r.status()>=400)console.error('HTTP',r.status(),r.url());});
  await page.setBypassServiceWorker(true);
  await page.bringToFront();
  await page.setViewport({width:640,height:480,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(()=>{
    try {
      localStorage.setItem('freecellworlds.settings',JSON.stringify({theme:'roman',autoRandomTheme:false,autoFoundation:false,reducedMotion:true,muted:true,quality:'low'}));
      localStorage.setItem('freecellworlds.voyageTutorial',JSON.stringify({map:true,board:true,reward:true}));
    } catch {}
  });
  const settle = async()=>{
    try { await page.waitForFunction(()=>window.FreeCell&&!FreeCell.busy,{timeout:90000,polling:250}); }
    catch(error) {
      console.error(await page.evaluate(()=>{
        const moving=[];
        FreeCell.scene.traverse((g)=>{const t=g.userData?.target;if(g.isGroup&&g.userData.cardId&&t){
          const d=Math.hypot(t.x-g.position.x,t.y-g.position.y,t.z-g.position.z);
          if(d>.002)moving.push({card:g.userData.cardId,d});
        }});
        return {busy:FreeCell.busy,mode:FreeCell.voyage.mode,perf:FreeCell.perf,title:document.getElementById('title-screen').className,
          visibility:document.visibilityState,moving:moving.sort((a,b)=>b.d-a.d).slice(0,5)};
      }));
      await page.screenshot({path:`${shots}/failure.png`}); throw error;
    }
    await new Promise((resolve)=>setTimeout(resolve,200));
  };
  const metrics = ()=>page.evaluate(()=>{
    const run=FreeCell.voyage.run(), meshes=[];
    FreeCell.scene.traverse((g)=>{if(g.isGroup&&g.userData.cardId)meshes.push({card:g.userData.cardId,concealed:!!g.userData.concealed,mark:g.userData.mark});});
    return {state:FreeCell.getState(),run:JSON.parse(JSON.stringify(run)),meshes};
  });
  async function fixture({id,level=1,rules={},moves=[],boss=null,boons=[],prepare=null}) {
    const prepared = await page.evaluate(async(options)=>{
      const {createRun,startBoard,saveRun}=await import('/js/voyage/run.js');
      const {nextChoices}=await import('/js/voyage/map.js');
      const {baseRules}=await import('/js/voyage/charms.js');
      const {Game,solve,applyMove,cloneState}=await import('/js/rules.js');
      const r=createRun({seed:'x3-browser'}); r.boss=options.boss||'boss.house';
      r.boons=options.boons.length?options.boons:options.id?[options.id]:[];
      r.levels=Object.fromEntries(r.boons.map((id)=>[id,options.level]));
      const cur=startBoard(r,nextChoices(r.map)[0].id,{deal:1,par:60});
      cur.theme='roman'; cur.challenge=null; cur.extraChallenges=[]; cur.boss=options.boss;
      cur.rules={...baseRules(),...options.rules};
      cur.active=r.boons.map((id)=>({id,kind:'boon',strength:1,level:options.level}));
      if(options.boss)cur.active.push({id:options.boss,kind:'boss',strength:7});
      const g=new Game(1,{rules:JSON.parse(JSON.stringify(cur.rules))});
      let next=null;
      if(options.prepare){
        const solved=solve(g.state,{rules:g.rules,timeLimitMs:10000,fullOnly:false,maxDepth:320});
        if(!solved.solution)throw new Error('No solution for real-board Heat Lamp fixture');
        const st=cloneState(g.state);
        for(const move of solved.solution){
          const before=cloneState(st); applyMove(st,JSON.parse(JSON.stringify(move)),g.rules);
          const empties=st.tableau.findIndex((col,i)=>!col.length&&before.tableau[i].length);
          const home=st.found.reduce((n,k)=>n+k,0);
          if((options.prepare==='column'&&empties>=0)||(options.prepare==='home'&&home>=8)){
            next=move; break;
          }
          g.applyDescriptor(move);
        }
        if(!next)throw new Error('Real deal did not reach Heat Lamp trigger');
      }else for(const move of options.moves)g.applyDescriptor(move);
      cur.history=g.history; cur.initial=g.initial; cur.memo={}; saveRun(r);
      return next;
    },{id,level,rules,moves,boss,boons,prepare});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.FreeCell && !document.getElementById('loader'),{timeout:60000});
    await page.evaluate(async()=>{
      FreeCell.scene.traverse((o)=>{if(o.isLight)o.castShadow=false;});
      const {voyageUI}=await import('/js/voyage/ui.js'); await voyageUI.handlers.continueVoyage();
    });
    await settle(); return prepared;
  }
  async function use(id,target=null){
    await page.click(`[data-ability="${id}"]`);
    if(target!==null){
      await clickTarget(page,target);
    }
    await settle();
  }
  async function undo(){await page.click('#btn-undo');await settle();}
  async function play(move){
    const st=(await metrics()).state;
    const card=move.src.kind==='free'?st.free[move.src.i]:st.tableau[move.src.i][st.tableau[move.src.i].length-(move.count||1)];
    const points=await page.evaluate(({card,move})=>({
      from:FreeCell.projectCard(card,true),
      to:FreeCell.projectSlot(move.t==='F'?'found':move.t==='C'?'free':'col',move.t==='F'?Math.floor((card-1)/13):move.t==='C'?move.fi:move.to),
    }),{card,move});
    assert(points.from&&points.to,'real UI source and destination exist');
    await page.mouse.move(points.from.x,points.from.y);await page.mouse.down();
    await page.mouse.move(points.to.x,points.to.y,{steps:8});await page.mouse.up();await settle();
  }
  try{
    await page.goto(base,{waitUntil:'networkidle0'});
    await page.waitForFunction(()=>!!window.FreeCell && !document.getElementById('loader'),{timeout:60000});
    for(const level of [1,2]){
      console.log(`Checking x3 browser level ${level}`);
      await fixture({id:'arctic.aurora',level});
      const before=await metrics();await use('arctic.aurora','first');
      const planted=await metrics();assert(planted.state.spur);assert.equal(planted.run.current.memo['arctic.aurora']._runtime.abilityUses,level-1);
      assert(await page.evaluate(()=>!!FreeCell.projectSlot('found',4)),'fifth foundation rendered');
      await page.screenshot({path:`${shots}/aurora-l${level}.png`});
      await undo();const reversed=await metrics();assert.deepEqual(reversed.state,before.state);assert.equal(reversed.run.current.memo['arctic.aurora']._runtime.abilityUses,level);

      const next=await fixture({id:'arctic.heatlamp',level,prepare:level===2?'home':'column'});
      const cold=await metrics();await play(next);const warm=await metrics();
      assert(warm.state.free.length>cold.state.free.length,'real move switches on Heat Lamp');
      assert.equal(warm.run.current.history.at(-1).op,'arctic.heatlamp');
      const prefix=cold.run.current.history.length;
      while((await metrics()).run.current.history.length>prefix)await undo();
      assert.deepEqual((await metrics()).state,cold.state,'Heat Lamp and trigger move undo');

      for(const action of ['unseal','thaw','reopen','unpin','uncover','undo']){
        console.log(`Checking Siege Engine ${action} level ${level}`);
        const rules=action==='unseal'?{sealedCols:[0]}:action==='thaw'?{cellThaw:{frozen:1,at:[20]}}:action==='reopen'?{startHome:2,cellClose:{at:[4]}}:action==='unpin'?{pinned:{cards:[9],until:20}}:{};
        await fixture({id:'bloodmoon.seal',level,rules,boss:action==='uncover'?'boss.mirror':null,boons:action==='uncover'?['bloodmoon.seal','mint.treasury','arctic.sled']:[]});
        const before=await metrics();await use('bloodmoon.seal',action==='undo'?null:'first');const after=await metrics();
        assert.equal(after.run.current.history.at(-1).action,action);
        if(action==='reopen')assert.equal(after.run.current.liveRules.cellClose.at.length,0);
        if(action==='unpin')assert.equal(after.run.current.liveRules.pinned.cards.length,0);
        if(action==='uncover')assert(after.meshes.filter((m)=>m.concealed).length<before.meshes.filter((m)=>m.concealed).length);
        await undo();const restored=await metrics();assert.deepEqual(restored.state,before.state);assert.deepEqual(restored.run.current.liveRules,before.run.current.liveRules);
        assert.equal(restored.run.current.memo['bloodmoon.seal']._runtime.abilityUses,level);
      }
    }
    for(const boss of ['boss.house','boss.mirror']){
      await fixture({boss,boons:boss==='boss.mirror'?['aero.pocket','arctic.heatlamp']:[]});
      await page.evaluate(async()=>{const {voyageUI}=await import('/js/voyage/ui.js');voyageUI.showBossIntro(FreeCell.voyage.view());});
      await page.waitForSelector('[data-intro-continue]');
      const intro=await page.$eval('#voyage-intro-card',(el)=>el.innerText);
      assert(intro.includes(boss==='boss.house'?'The House':'The Mirror'));assert(intro.includes('Watch for:'));
      await page.screenshot({path:`${shots}/${boss}.png`});await page.click('[data-intro-continue]');
    }
    assert.deepEqual(errors,[],'no browser console or page errors');
    console.log('OK: x3 browser L1/L2 Aurora, Heat Lamp, all Siege obstacles and undo; both boss intros; no console errors');
  }finally{await browser.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
