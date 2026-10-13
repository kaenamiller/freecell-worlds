// The four new sets are checked by charm id, independently of THEME_ORDER rollout.
import { pathToFileURL } from 'node:url';
import { createRun, startBoard, concedeBoard, pickCharm, boardOffers } from '../../js/voyage/run.js';
import { nextChoices } from '../../js/voyage/map.js';
import { createPort, portService } from '../../js/voyage/port.js';
import { CHARM_FAMILIES } from '../../js/voyage/registry.js';
import { charmText } from '../../js/voyage/charms.js';
import { composeBoard } from '../../js/voyage/charms.js';

export async function check(h) {
  const { assert, CHARMS, Rules, BoardEffects, baseRules, clone, stubAPI, assertAvailablePure, kit, scoreBoard } = h;
  const themes = ['plaster','backrooms','vaporwave','cinema'];
  for (const theme of themes) {
    const charms = Object.values(CHARMS).filter((c) => c.theme === theme);
    assert.equal(charms.length,4);
    for (const charm of charms) for (const level of [1,2]) {
      assert(charm.id.startsWith(theme+'.') && charm.name && charm.icon);
      assert(charmText(charm.id,1,{level}).trim());
      if(charm.kind==='boon') {assert(CHARM_FAMILIES.includes(charm.family));assert(charm.upgrade);}
      else {assert(charm.tags.length);assert.equal(typeof charm.rules,'function');}
      const rules=baseRules(); charm.rules?.(rules,{id:charm.id,level,strength:1,rng:h.stream('N52',charm.id),seed:'N52',runMemo:{},idx:0});
      h.validateRules?.(rules);
    }
  }
  for (const level of [1,2]) {
    for (const [id,field,n] of [['plaster.armature','loneAccepts',level],['backrooms.hum','fullCellsBonus',level+1],['vaporwave.checkerboard','skipBuild',level]])
      assert.equal(composeBoard({boons:[id],levels:{[id]:level}}).rules[field],n);
    for (let s=1;s<=7;s++) {
      assert.equal(composeBoard({challenge:'plaster.challenge',strength:s}).rules.emptyCure,4+2*s);
      assert.equal(composeBoard({challenge:'vaporwave.challenge',strength:s}).rules.cellsNeedEmpty,s<=3?1:2);
      const noExit=composeBoard({challenge:'backrooms.challenge',strength:s,seed:'N52'}).rules.noExitCols;
      assert.equal(noExit.toString(2).replace(/0/g,'').length,s<=2?2:s<=4?4:8);
      assert.equal(composeBoard({challenge:'cinema.challenge',strength:s}).rules.sameColorRanks,kit.rankMask(s<=2?[12]:s<=4?[11,12]:s<=6?[10,11,12]:[9,10,11,12]));
    }
  }
  const fixture = (ids, {level=1,picks=[],coins=30,idx=0}={}) => {
    const run=createRun({seed:'N52'}); run.boons=ids; run.coins=coins; run.levels=Object.fromEntries(ids.map((id)=>[id,level]));
    const cur=startBoard(run,nextChoices(run.map)[0].id,{deal:1,par:60,rules:baseRules()}); cur.idx=idx;
    cur.active=ids.map((id)=>({id,kind:'boon',level,strength:1}));
    const game=new Rules.Game(1,{rules:clone(cur.rules)}), memo=cur.memo;
    const api=stubAPI(game,{run,memo,picks});
    const fx=new BoardEffects(cur.active,{seed:run.seed,boardIndex:idx,run,memo,api}); fx.setup({state:game.initial,initial:game.initial});
    for(const ctx of fx.ctxs) assertAvailablePure(CHARMS[ctx.id],ctx);
    return {run,cur,game,api,fx,memo};
  };
  for (const level of [1,2]) {
    // Picking and cancelling consume nothing; successful X moves restore exact rules/state.
    for (const id of ['plaster.mould','cinema.exposure']) {
      const f=fixture([id],{level,picks:[null]});
      const before=clone(f.game.rules), state=clone(f.game.state), uses=f.fx.abilityState(id).uses;
      assert.equal(uses,level===2?2:1); assert.equal(await f.fx.useAbility(id),false); assert.equal(f.fx.abilityState(id).uses,uses);
      const card=f.game.tableau[0].at(-1), picked=fixture([id],{level,picks:[card]});
      assert(await picked.fx.useAbility(id));
      if (id==='plaster.mould') { assert(picked.game.rules.wildRanks & kit.rankMask(Rules.rankOf(card))); assert.equal(Object.keys(picked.api.marks).length,4); }
      else { assert(picked.game.rules.wildCards.includes(card)); assert.equal(picked.api.marks[card],'mod-wild'); }
      assert.equal(picked.fx.abilityState(id).uses,uses-1);
      picked.game.undo(); picked.fx.emit('undo'); assert.deepEqual(picked.game.rules,before); assert.deepEqual(picked.game.state,state);
      assert.equal(Object.keys(picked.api.marks).length,0);
    }
    const nc=fixture(['backrooms.noclip'],{level});
    // Use the actual picker filters to select a legal buried card and destination.
    let cancelSecond=false;
    nc.api.pick=async ({kind,filter})=>{
      if (kind==='card') return nc.game.tableau.flat().find((id)=>filter(id,nc.game.state)) ?? null;
      if (cancelSecond) return null;
      return nc.game.tableau.findIndex((_col,i)=>filter(i,nc.game.state));
    };
    const initial=clone(nc.game.state), rules=clone(nc.game.rules);
    cancelSecond=true; assert.equal(await nc.fx.useAbility('backrooms.noclip'),false); assert.deepEqual(nc.game.state,initial);
    cancelSecond=false; assert(await nc.fx.useAbility('backrooms.noclip')); assert.equal(nc.fx.abilityState('backrooms.noclip').uses,level===2?1:0);
    nc.game.undo(); nc.fx.emit('undo'); assert.deepEqual(nc.game.state,initial); assert.deepEqual(nc.game.rules,rules);
    // A face-down card is never a valid target.
    const eligible=nc.game.tableau.flat().filter((id)=>nc.game.tableau.some((col)=>col.includes(id)&&col.at(-1)!==id));
    nc.fx.ctxs[0].api.conceal(eligible); assert.equal(nc.fx.abilityState('backrooms.noclip').available,false);

    const wish=fixture(['vaporwave.fountain'],{level,coins:5}), before=clone(wish.game.rules);
    assert(await wish.fx.useAbility('vaporwave.fountain')); assert.equal(wish.run.coins,0); assert.equal(wish.run.economy.coinsSpent,5);
    assert.equal(kit.ranksIn(wish.game.rules.wildRanks).length,level); assert.equal(Object.keys(wish.api.marks).length,4*level);
    assert(kit.ranksIn(wish.game.rules.wildRanks).every((n)=>n>=3&&n<=12));
    const duplicate=fixture(['vaporwave.fountain'],{level,coins:5}); assert(await duplicate.fx.useAbility('vaporwave.fountain')); assert.equal(duplicate.game.rules.wildRanks,wish.game.rules.wildRanks);
    wish.game.undo(); wish.fx.emit('undo'); assert.deepEqual(wish.game.rules,before); assert.equal(wish.run.coins,0); assert.equal(Object.keys(wish.api.marks).length,0);
    const poor=fixture(['vaporwave.fountain'],{level,coins:4}); assert.equal(await poor.fx.useAbility('vaporwave.fountain'),false); assert.equal(poor.run.coins,4); assert.equal(poor.game.history.length,0);

    // Recharge is one use per exhausted charm, only on/after the threshold.
    const projector=fixture(['cinema.projectionist','cinema.exposure','plaster.mould'],{level});
    const threshold=level===2?20:26;
    const foundAt=(n)=>Array.from({length:4},(_,i)=>Math.floor(n/4)+(i<n%4?1:0));
    for (const id of ['cinema.exposure','plaster.mould']) projector.memo[id]._runtime.abilityUses=0;
    projector.game.state.found=foundAt(threshold-1); projector.fx.emit('foundation'); assert.equal(projector.fx.abilityUses()['cinema.exposure'],0);
    projector.game.state.found=foundAt(threshold); projector.fx.emit('foundation'); assert.equal(projector.fx.abilityUses()['cinema.exposure'],1); assert.equal(projector.fx.abilityUses()['plaster.mould'],1);
    projector.memo['cinema.exposure']._runtime.abilityUses=0; projector.fx.emit('foundation'); assert.equal(projector.fx.abilityUses()['cinema.exposure'],0);

    // Commission is paid once per port, applies to the next board, and cannot pay late/other ranks.
    const run=createRun({seed:'commission'}); Object.assign(run,{status:'port',boons:['plaster.commission'],coins:50,levels:{'plaster.commission':level},results:[{idx:0,total:0,stars:1},{idx:1,total:0,stars:1}]}); createPort(run);
    assert(portService(run,'plaster.commission',2)); assert.equal(run.coins,40);
    const saved=clone(run); assert.equal(portService(run,'plaster.commission',15),false); assert.deepEqual(run,saved);
    for (const [home,boardIdx,expected] of [[4,2,level===2?6:4],[25,2,0],[4,3,0]]) {
      const initial={tableau:[[2],[],[],[],[],[],[],[]],free:[0,0,0,0],found:home===4?[1,1,1,1]:[1,8,8,8]};
      const f=fixture(['plaster.commission'],{level,idx:boardIdx}); f.run.charmMemo['plaster.commission']=clone(run.charmMemo['plaster.commission']); f.fx.ctxs[0].runMemo=f.run.charmMemo['plaster.commission'];
      const sb=scoreBoard([{t:'F',src:{kind:'col',i:0},card:2}],60,f.fx,{initial,rules:baseRules(),boardIdx}); assert.equal(sb.coinTotal,expected);
    }
    const empty=createRun({seed:'poor-commission'}); Object.assign(empty,{status:'port',boons:['plaster.commission'],coins:9,results:[{idx:1}]}); createPort(empty); const poorState=clone(empty);
    assert.equal(portService(empty,'plaster.commission',2),false); assert.deepEqual(empty,poorState);

    for (const id of ['backrooms.exitsign','cinema.cliffhanger']) {
      const f=fixture([id],{level}); f.run.undos=0;
      const node=f.run.map.nodes[f.cur.nodeId]; node.port=true;
      const handled=id==='backrooms.exitsign'?await f.fx.useAbility(id):f.fx.emit('stuck'); assert(handled);
      assert.equal(f.run.results[0].conceded,true); assert.equal(f.run.results[0].stars,1); assert.equal(f.run.results[0].coins,0);
      assert.equal(f.run.reward.offers.length,1); assert.equal(f.run.reward.picks,1); pickCharm(f.run,f.run.reward.offers[0]); assert.equal(f.run.status,'port');
      const blocked=fixture([id],{level,idx:6}); blocked.run.undos=0;
      assert.equal(id==='backrooms.exitsign'?await blocked.fx.useAbility(id):blocked.fx.emit('stuck'),false); assert.equal(blocked.run.status,'board');
      const used=fixture([id],{level}); used.run.undos=0; used.fx.ctxs[0].runMemo.exits=level===2?2:1;
      assert.equal(id==='backrooms.exitsign'?await used.fx.useAbility(id):used.fx.emit('stuck'),false);
      if(level===2) { const once=fixture([id],{level}); once.run.undos=0; once.fx.ctxs[0].runMemo.exits=1; assert(id==='backrooms.exitsign'?await once.fx.useAbility(id):once.fx.emit('stuck')); }
    }
    const shuffle=createRun({seed:'shuffle'}); shuffle.boons=['vaporwave.shuffle']; shuffle.levels['vaporwave.shuffle']=level;
    const offers=boardOffers(shuffle,'plaster'); assert.deepEqual(offers,boardOffers(clone(shuffle),'plaster'));
    assert.equal(offers.filter((id)=>CHARMS[id].theme!=='plaster').length,level);
    assert(offers.every((id)=>!shuffle.boons.includes(id)&&!CHARMS[id].hidden&&!CHARMS[id].placeholder));
  }
  // No Exit marks the bottom card of each affected column, and follows it home and back on undo.
  {
    const game=new Rules.Game(1,{rules:{...baseRules(),noExitCols:0b101}}), api=stubAPI(game), memo={};
    const fx=new BoardEffects([{id:'backrooms.challenge',kind:'challenge',strength:1}],{seed:'N52',boardIndex:0,run:null,memo,api});
    fx.setup({state:game.initial,initial:game.initial});
    const bottoms=()=>Object.keys(api.marks).filter((id)=>api.marks[id]==='noexit').map(Number).sort((a,b)=>a-b);
    assert.deepEqual(bottoms(),[game.tableau[0][0],game.tableau[2][0]].sort((a,b)=>a-b));
    const root=game.tableau[0][0]; game.state.tableau[0]=[]; fx.emit('move',{move:{t:'F',card:root}});
    assert.deepEqual(bottoms(),[game.tableau[2][0]]);
    game.state.tableau[0]=[root]; fx.emit('undo',{});
    assert.equal(api.marks[root],'noexit');
  }
  console.log('✓ N52: all 16 charms at both levels, rules, payment/negative cases, picks/X undo, recharges, seeded offers and concede flow');
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const helpers=await import('../charm-content-check.mjs'); await check(helpers);
}
