// x2 special charms: both levels, cancellation, retained-history scoring and X undo.
import { pathToFileURL } from 'node:url';

export const ids = ['carvings.totem', 'saffron.loom', 'saloon.quickdraw', 'cutpaper.octavo',
  'cyber.ghost', 'signal.pull', 'carvings.raven', 'library.bookmark', 'lowtide.tidepool',
  'theater.understudy', 'deepsea.current', 'toybox.jackinbox', 'museum.digsite'];

export async function check(h) {
  const { assert, Rules, CHARMS, BoardEffects, baseRules, clone, fakeBoard, stubAPI, scoreBoard, assertAvailablePure, checkV2Definitions } = h;
  checkV2Definitions(ids.map((id) => CHARMS[id]));
  function fixture(id, level, picks = []) {
    const rules = baseRules();
    const game = new Rules.Game(1, { rules: clone(rules) });
    const tableau = [[8, 20, 6], [22], [1, 13], [3, 4], [16], [], [], []];
    const free = [26, 0, 0, 0];
    const used = new Set([...tableau.flat(), ...free]);
    tableau[7] = Array.from({length:52}, (_, i) => i + 1).filter((card) => !used.has(card));
    // No free buffers: Zip Line must really bypass the one-card capacity.
    if (id === 'deepsea.current') {
      for (const i of [1, 2, 3]) free[i] = tableau[7].pop();
      for (const i of [5, 6]) tableau[i].push(tableau[7].pop());
    }
    Object.assign(game.state, { tableau, free, found: [0, 0, 0, 0] });
    game.initial = clone(game.state);
    const run = {seed:'x2-check', status:'board', current:{idx:0}, boons:[id], results:[], undos:5, coins:0, charmMemo:{}};
    const memo = {}, api = stubAPI(game, { picks, run, memo });
    const fx = new BoardEffects([{id,kind:'boon',strength:1,level}], {seed:run.seed,boardIndex:0,api,run,memo});
    fx.setup({state:clone(game.initial),initial:clone(game.initial)});
    return {game,run,memo,api,fx,picks,ctx:fx.ctxs[0]};
  }
  const targets = {
    'carvings.totem':[0], 'saffron.loom':[8,5], 'saloon.quickdraw':[0,0],
    'cutpaper.octavo':[8,20], 'cyber.ghost':[0], 'signal.pull':[8,1],
    'carvings.raven':[0,1], 'lowtide.tidepool':[0,0], 'theater.understudy':[0,0],
    'deepsea.current':[8,1], 'toybox.jackinbox':[26,0], 'museum.digsite':[0],
  };
  for (const id of ids) for (const level of [1, 2]) {
    const c = CHARMS[id], f = fixture(id, level, [...(targets[id] || [])]);
    assert.equal(c.ability.uses(f.ctx), level, `${id}: level ${level} uses`);
    assert.equal(f.fx.abilityState(id).uses, level);
    assertAvailablePure(c, f.ctx);
    assert(f.fx.abilityState(id).available, `${id}: fixture is available`);
    const rules = baseRules(), beforeRules = clone(rules);
    c.rules?.(rules, f.ctx);
    assert.deepEqual(rules, beforeRules, `${id}: one-shot ability leaves initial rules alone`);
    // These abilities have no coin/point hook: only the retained play history scores.
    const scored = fakeBoard(rules);
    const extra = {initial:scored.initial,rules,undosUsed:0};
    assert.deepEqual(scoreBoard(scored.history,60,f.fx,extra).toJSON(), scoreBoard(scored.history,60,null,extra).toJSON());
    const before = clone(f.game.state), beforeLiveRules = clone(f.game.rules);
    if (id === 'carvings.totem') f.ctx.api.conceal([8,20]);
    if (id === 'library.bookmark') {
      assert.equal(await f.fx.useAbility(id), false, 'setting does not spend a charge');
      assert.equal(f.fx.abilityState(id).uses, level);
      assert.equal(f.ctx.memo._runtime.badge, 'SET');
      assert(!f.fx.abilityState(id).available, 'no moves since anchor');
      f.game.applyDescriptor({t:'C',src:{kind:'col',i:0},fi:1});
      assert(await f.fx.useAbility(id));
      assert.equal(f.ctx.memo.anchor, null);
      assert.deepEqual(f.game.state, before);
      // History loss clears an anchor for ordinary, free and reset undos.
      for (const ev of [{}, {free:true}, {reset:true}]) {
        f.ctx.memo.anchor = 999; f.ctx.api.badge('SET'); f.fx.emit('undo', ev);
        assert.equal(f.ctx.memo.anchor, null); assert.equal(f.ctx.memo._runtime.badge, '');
      }
      f.ctx.memo.anchor = 999;
      f.fx.emit('move',{move:{t:'C'},manual:true}); assert.equal(f.ctx.memo.anchor,null);
    } else {
      assert(await f.fx.useAbility(id), `${id}: activation`);
      assert.equal(f.game.history.at(-1).t,'X');
      assert.notDeepEqual(f.game.state,before);
      const move = clone(f.game.history.at(-1));
      if (id === 'carvings.totem') {
        assert.deepEqual(f.game.tableau[0],before.tableau[0].slice().reverse());
        assert.deepEqual(f.ctx.api.concealed,[]);
      }
      if (id === 'saffron.loom') assert.deepEqual(f.game.tableau[5],before.tableau[0]);
      if (id === 'cutpaper.octavo') assert.deepEqual(f.game.tableau[0],[20,8,6], 'same-column buried swap');
      if (id === 'deepsea.current') {
        assert.equal(Rules.maxMoveSize(before,false,f.game.rules),1);
        assert.deepEqual(f.game.tableau[1],[22,8,20,6]);
      }
      const after = clone(f.game.state);
      f.game.undo(); assert.deepEqual(f.game.state,before, `${id}: undo`);
      assert.deepEqual(f.game.rules,beforeLiveRules, `${id}: rules undo`);
      f.game.applyDescriptor(move); assert.deepEqual(f.game.state,after, `${id}: saved X replay`);
      f.game.undo();
    }
    assert.equal(f.fx.abilityState(id).uses,level-1);
    if (level === 2) {
      f.picks.push(...(targets[id] || []));
      if (id === 'library.bookmark') {
        assert.equal(await f.fx.useAbility(id),false);
        f.game.applyDescriptor({t:'C',src:{kind:'col',i:0},fi:1});
      }
      assert(await f.fx.useAbility(id), `${id}: second level-2 activation`);
      assert.equal(f.fx.abilityState(id).uses,0);
    }
    assert(!f.fx.abilityState(id).available); assert.equal(await f.fx.useAbility(id),false);
    const cancel = fixture(id,level);
    if (id !== 'library.bookmark') {
      assert.equal(await cancel.fx.useAbility(id),false, `${id}: cancelled target`);
      assert.equal(cancel.fx.abilityState(id).uses,level);
      assert.equal(cancel.game.history.length,0);
    } else {
      cancel.run.undos = 0;
      const noUndo = new BoardEffects([{id,kind:'boon',level}], {seed:'zero',boardIndex:0,api:cancel.api,run:cancel.run,memo:{}});
      noUndo.setup({state:cancel.game.initial}); assert(!noUndo.abilityState(id).available);
    }
    // No possible targets means no usable ability, and the guard stays pure.
    const noTargets = fixture(id,level);
    noTargets.game.state.tableau = Array.from({length:8},()=>[]); noTargets.game.state.free = [0,0,0,0];
    assertAvailablePure(c,noTargets.ctx); assert(!noTargets.fx.abilityState(id).available, `${id}: no targets`);
  }
  // The ghost cell closes as a separate move and reopening/undo restores both layouts.
  for (const level of [1,2]) {
    const f = fixture('cyber.ghost',level,[0]);
    await f.fx.useAbility('cyber.ghost');
    const opened = clone(f.game.state), parked = f.game.history.at(-1), fi = parked.fi;
    f.game.applyCharmMove({t:'X',op:'lowtide.tidepool',fi,col:1,card:f.game.free[fi]});
    f.fx.emit('move',{move:f.game.history.at(-1),manual:true});
    assert.equal(f.game.free.length,4); assert.equal(f.game.history.at(-1).action,'close');
    assert(!f.game.history.at(-1).voyageAbility);
    f.game.undo(); f.game.undo(); assert.deepEqual(f.game.state,opened);
    f.game.undo(); assert.deepEqual(f.game.state,f.game.initial);
  }
  // Concealed and malformed targets cannot be smuggled into custom descriptors.
  const oct = fixture('cutpaper.octavo',1);
  for (const data of [{a:8,b:8},{a:8,b:26},{a:8,b:20,concealed:[8]}]) {
    assert.throws(()=>oct.game.applyCharmMove({t:'X',op:'cutpaper.octavo',...data}));
    assert.deepEqual(oct.game.state,oct.game.initial);
  }
  const loom = fixture('saffron.loom',1);
  for (const data of [{col:0,index:0,to:1,card:8},{col:0,index:0,to:5,card:8,concealed:[20]}]) {
    assert.throws(()=>loom.game.applyCharmMove({t:'X',op:'saffron.loom',...data}));
    assert.deepEqual(loom.game.state,loom.game.initial);
  }
  const hidden = fixture('cutpaper.octavo',1);
  hidden.ctx.api.conceal(hidden.game.tableau.flat()); assert(!hidden.fx.abilityState('cutpaper.octavo').available);
  console.log('OK: x2 — 13 abilities at both levels, scoring, cancellation, X replay/undo and Bookmark anchors');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const h = await import('../charm-content-check.mjs');
  for (const id of ids) for (const level of [1, 2]) for (let strength = 1; strength <= 7; strength++) await h.checkCharm(h.CHARMS[id], strength, level);
  await check(h);
}
