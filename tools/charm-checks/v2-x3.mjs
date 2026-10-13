// X3: Suit Spur, passive cell gains, obstacle reversal and both new bosses.
import { pathToFileURL } from 'node:url';
import { composeBoard, boonRelation } from '../../js/voyage/boardrules.js';
import { createRun, boardPlan, runView, startBoard } from '../../js/voyage/run.js';
import { nextChoices } from '../../js/voyage/map.js';
import { mirrorFamily } from '../../js/voyage/content/special/boss.mirror.js';

export async function check(h) {
  const { assert, Rules, CHARMS, BoardEffects, baseRules, clone, stubAPI, kit, scoreBoard, fakeBoard, stream } = h;
  const ids = ['arctic.aurora', 'arctic.heatlamp', 'bloodmoon.seal', 'boss.house', 'boss.mirror'];
  h.checkV2Definitions(ids.map((id) => CHARMS[id]));
  for (const id of ids) for (const level of [1, 2]) for (const strength of [1, 7]) await h.checkCharm(CHARMS[id], strength, level);

  function fixture(id, level = 1, extra = {}, picks = [], state = null, held = [id]) {
    const rules = { ...baseRules(), ...extra }, game = new Rules.Game(1, { rules: clone(rules) });
    if (state) game.state = clone(state);
    const initial = clone(game.state), memo = {};
    const run = { seed: 'x3', status: 'board', results: [], boons: held, undos: 8, coins: 40, charmMemo: {} };
    const api = stubAPI(game, { picks, run, memo });
    api.addUndos = (n) => { run.undos += n; };
    api.spendUndos = (n) => { const paid = Math.min(run.undos, n); run.undos -= paid; return paid; };
    let effects, ability;
    api.beginAbility = (id, uses) => { ability = { id, uses }; };
    api.endAbility = () => { ability = null; };
    api.charmMove = (op, data) => {
      const move = game.applyCharmMove({ ...data, t: 'X', op, ...(ability ? { voyageAbility: ability } : {}) });
      effects.emit('move', { move, manual: true }); return move;
    };
    const active = [{ id, kind: CHARMS[id].kind, strength: 7, level }];
    effects = new BoardEffects(active, { seed: run.seed, boardIndex: 6, api, memo, run });
    const board = { state: clone(initial), initial, deal: 1, restored: false };
    effects.setup(board);
    const undo = (ev = {}) => {
      const move = game.undo(); assert(move);
      if (move.voyageAbility) effects.refundAbility(move.voyageAbility);
      effects.emit('undo', { moves: [move], ...ev }); return move;
    };
    const resume = () => {
      const resumed = new Rules.Game(1, { rules: clone(rules) }); resumed.state = clone(initial);
      for (const move of clone(game.history)) resumed.applyDescriptor(move);
      assert.deepEqual(resumed.state, game.state); assert.deepEqual(resumed.rules, game.rules);
      const restored = new BoardEffects(active, {seed:run.seed, boardIndex:6, api:stubAPI(resumed), memo:clone(memo), run:clone(run)});
      restored.setup({...board, restored:true});
      assert.deepEqual(restored.abilityState(id), effects.abilityState(id));
    };
    return { game, initial, rules, run, api, effects, memo, undo, resume };
  }

  for (const level of [1, 2]) {
    const seedBoard = fakeBoard().initial;
    const eligible = seedBoard.tableau.map((col) => col.at(-1)).find((card) => Rules.canPlantSpur(seedBoard, card, baseRules()));
    const f = fixture('arctic.aurora', level, {}, [null, eligible]);
    assert.equal(f.effects.abilityState('arctic.aurora').uses, level);
    assert.equal(await f.effects.useAbility('arctic.aurora'), false);
    assert(await f.effects.useAbility('arctic.aurora'));
    assert.equal(f.game.state.spur.base, Rules.rankOf(eligible));
    assert.equal(Rules.cardsHome(f.game.state), 1);
    assert.equal(scoreBoard(f.game.history,60,f.effects,{initial:f.initial}).stat.cards,1,'Aurora X counts as a card home');
    assert.equal(f.effects.abilityState('arctic.aurora').available, false, 'only one spur may exist');
    f.resume(); f.undo(); assert.deepEqual(f.game.state, f.initial);
    assert.equal(f.effects.abilityState('arctic.aurora').uses, level);
    const parked = fixture('arctic.aurora',level,{},[eligible]);
    const col=parked.game.tableau.findIndex((c)=>c.at(-1)===eligible);
    assert(parked.game.moveToFreeCell({kind:'col',i:col},0));
    const beforePlant=clone(parked.game.state);
    assert(await parked.effects.useAbility('arctic.aurora'));
    assert.deepEqual(parked.game.history.at(-1).src,{kind:'free',i:0});
    parked.undo(); assert.deepEqual(parked.game.state,beforePlant);
    const blocked = fixture('arctic.aurora', level, { pinned: {cards: seedBoard.tableau.map((col) => col.at(-1)), until: 20} });
    assert.equal(blocked.effects.abilityState('arctic.aurora').available, false);
    assert.equal(scoreBoard([], 60, f.effects, {initial:f.initial}).coinTotal, 0);

    const st = {tableau:[[Rules.cardId(0,3)], [], [], [], [], [], [], []], free:[0,0,0,0], found:[2,2,2,1]};
    const lamp = fixture('arctic.heatlamp', level, {}, [], st);
    lamp.effects.emit('columnEmpty', {col:0}); assert.equal(lamp.game.free.length, 4, 'nonempty column is not a trigger');
    const sent = lamp.game.moveToFoundation({kind:'col',i:0}); assert(sent);
    lamp.effects.emit('move', {move:sent,manual:true});
    lamp.effects.emit('columnEmpty', {col:0});
    assert.equal(lamp.game.free.length, level === 2 ? 6 : 5);
    lamp.effects.emit('columnEmpty', {col:0}); assert.equal(lamp.game.free.length, level === 2 ? 6 : 5);
    lamp.resume();
    assert.deepEqual(kit.replay({initial:lamp.initial, initialRules:lamp.rules, history:lamp.game.history}, () => {}), lamp.game.state);
    while (lamp.game.history.length) lamp.undo({free:true});
    assert.deepEqual(lamp.game.state, lamp.initial); assert.deepEqual(lamp.game.rules, lamp.rules);
    const full = fixture('arctic.heatlamp', level, {freeCells:6});
    full.game.tableau[0] = []; full.effects.emit('columnEmpty',{col:0}); assert.equal(full.game.free.length,6);

    for (const action of ['unseal','thaw','reopen','unpin','uncover','undo']) {
      const rules = action === 'unseal' ? {sealedCols:[0,3]} : action === 'thaw' ? {cellThaw:{frozen:2,at:[8,20]}} :
        action === 'reopen' ? {startHome:2,cellClose:{at:[4,8,24]}} : action === 'unpin' ? {pinned:{cards:[seedBoard.tableau[0][0]],until:20}} : {};
      // Unpin aims at the pinned card itself; the others pick a column or cell index.
      const target = action === 'thaw' ? 2 : action === 'reopen' ? 2 : action === 'unpin' ? seedBoard.tableau[0][0] : 0;
      const siege = fixture('bloodmoon.seal', level, rules, action === 'undo' ? [] : [null,target]);
      if (action === 'uncover') siege.effects.ctxs[0].api.conceal(siege.game.tableau[0].slice(0,-1));
      if (action !== 'undo') assert.equal(await siege.effects.useAbility('bloodmoon.seal'),false);
      assert(await siege.effects.useAbility('bloodmoon.seal'));
      assert.equal(siege.game.history.at(-1).action,action);
      if (action === 'reopen') { assert(Rules.cellIsOpen(siege.game.state,2,siege.game.rules)); assert.deepEqual(siege.game.rules.cellClose.at,[4,24]); }
      if (action === 'unpin') assert.equal(Rules.isPinned(siege.game.state,seedBoard.tableau[0][0],siege.game.rules),false);
      if (action === 'undo') assert.equal(siege.run.undos,9);
      siege.resume(); siege.undo({reset:true});
      assert.deepEqual(siege.game.state,siege.initial); assert.deepEqual(siege.game.rules,siege.rules);
      assert.equal(siege.effects.abilityState('bloodmoon.seal').uses,level);
      if (action === 'undo') assert.equal(siege.run.undos,8);
    }
    const capped = fixture('bloodmoon.seal', level); capped.memo._undoGrants = 3;
    assert(await capped.effects.useAbility('bloodmoon.seal')); assert.equal(capped.game.history.at(-1).granted,0);
    capped.undo({free:true}); assert.equal(capped.run.undos,8,'saturated grants do not remove a real undo');
    const occupied = fixture('bloodmoon.seal',level,{startHome:2,cellClose:{at:[4,8,24]}},[3]);
    assert(occupied.game.moveToFreeCell({kind:'col',i:0},0));
    occupied.game.free[2]=occupied.game.free[0]; occupied.game.free[0]=0;
    assert(await occupied.effects.useAbility('bloodmoon.seal'));
    assert(Rules.cellIsOpen(occupied.game.state,3,occupied.game.rules));
    assert.deepEqual(occupied.game.rules.cellClose.at,[24],'reopen skips occupied closing cells and retains future tide');
  }

  const house = CHARMS['boss.house'];
  assert.deepEqual(house.thresholds([0,100,200]),[0,120,240]);
  const taxed = scoreBoard([{t:'C'},{t:'R',to:{kind:'free',i:0}},{t:'X',op:'signal.pull'},{t:'X',op:'cyber.ghost',action:'open'}],60,null,{undosUsed:2});
  house.score(taxed); assert.equal(taxed.coinTotal,-8);
  const payout = fixture(house.id), result = {coins:30,coinLines:[]};
  payout.effects.emit('win',{result}); assert.equal(result.coins,90); assert.equal(payout.run.coins,100);
  assert.equal(result.coinLines[0].coins,60); payout.effects.emit('win',{result}); assert.equal(payout.run.coins,100,'payout is idempotent');
  const untaxed = scoreBoard([{t:'F',card:1}],60,null,{undosUsed:0}); house.score(untaxed); assert.equal(untaxed.coinTotal,0);
  assert.deepEqual(composeBoard({boss:house.id}).rules,baseRules(),'House is pressure only');

  const mirror = CHARMS['boss.mirror'];
  for (const family of ['cells','columns','wild','suit','foundation','ability','undo','coin','fortune','sticker','vision']) {
    const held = Object.values(CHARMS).filter((c) => c.kind === 'boon' && c.family === family && !c.hidden).slice(0,2).map((c) => c.id);
    assert.equal(held.length,2,`two real ${family} boons available`);
    const ctx = {seed:'x3',boons:held,family:(name)=>name===family?2:0,rng:stream('x3','mirror')};
    assert.equal(mirrorFamily(ctx),family);
    const r = baseRules(); mirror.rules(r,ctx);
    if (family === 'cells') assert.equal(r.freeCells,2);
    else if (family === 'columns') assert.equal(r.emptyMinRank,13);
    else if (family === 'suit') assert.deepEqual(r.barrenCards,[39,52]);
    else if (family === 'foundation') assert.equal(r.foundationSpread,2);
    else if (!['ability','wild'].includes(family)) assert.equal(r.freeCells,3);
    assert.equal(mirror.confiscate(held,ctx),['wild','suit'].includes(family)?held[0]:null);
    const composed = composeBoard({boons:held,boss:mirror.id,seed:'x3',idx:6,runMemo:{}});
    assert.equal(composed.confiscated,['wild','suit'].includes(family)?held[0]:null);
    assert.equal(composed.active.some((a)=>a.id===held[0]),!['wild','suit'].includes(family));
    const f = fixture(mirror.id,1,{},[],null,held);
    assert.equal(f.memo[mirror.id].family,family);
    if (['undo','coin','fortune','sticker','vision'].includes(family)) assert.equal(f.effects.ctxs[0].api.concealed.length,44);
    if (family === 'ability') {
      f.effects.emit('ability',{id:held[0]}); assert.equal(f.run.undos,7);
      f.effects.emit('ability',{id:held[1]}); assert.equal(f.run.undos,7);
      f.effects.emit('undo',{free:true,moves:[]}); f.effects.emit('ability',{id:held[0]}); assert.equal(f.run.undos,7);
    }
    assert.equal(scoreBoard([],60,f.effects,{initial:f.initial}).coinTotal,0);
  }
  const mixWild = Object.values(CHARMS).find((c) => c.kind === 'boon' && c.family === 'wild' && !c.hidden).id;
  const mixCells = Object.values(CHARMS).find((c) => c.kind === 'boon' && c.family === 'cells' && !c.hidden).id;
  const mixCtx = {seed:'mix',idx:6,boons:[mixWild,mixCells],family:(name)=>name==='wild'||name==='cells'?1:0};
  assert.equal(mirrorFamily(mixCtx),'wild');
  const mixed = composeBoard({boons:[mixWild,mixCells],boss:mirror.id,seed:'mix',idx:6,runMemo:{}});
  const remaining = composeBoard({boons:[mixCells],seed:'mix',idx:6,runMemo:{}});
  assert.equal(mixed.confiscated,mixWild);
  assert.equal(mixed.rules.freeCells,remaining.rules.freeCells,'wild branch must not also apply the cells penalty');
  assert.equal(mixed.rules.emptyMinRank,0);

  const tie = {seed:'mirror-tie',family:()=>1};
  assert.equal(mirrorFamily(tie),mirrorFamily(tie));
  assert(new Set(Array.from({length:30},(_,seed)=>mirrorFamily({...tie,seed}))).size > 1);
  for (const boss of [house.id,mirror.id]) {
    for (let seed=0;seed<50;seed++) {
      const run = createRun({seed:`x3-${seed}`}); run.boss=boss;
      for (let idx=0;idx<5;idx++) {
        startBoard(run,nextChoices(run.map)[0].id,{deal:1,par:60});
        run.results.push({idx,stars:2,total:0}); run.status='map'; run.current=null;
      }
      const bossTags=CHARMS[boss].tags;
      const finale = runView(run).map.at(-1);
      for (const node of finale) assert(!CHARMS[node.challenge.id].tags?.some((tag)=>bossTags.includes(tag)),`${boss}: no finale tag clashes`);
      assert(boardPlan(run,finale[0].theme,{idx:6}).active.some((a)=>a.id===boss));
    }
    for (const id of ids.filter((id)=>CHARMS[id].kind==='boon')) assert(['+','~','!'].includes(boonRelation(boss,id)));
  }
  console.log('OK: x3 levels, cancellation, X replay/undo, caps, House tolls and all Mirror branches');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const helpers = await import('../charm-content-check.mjs');
  await check(helpers);
}
