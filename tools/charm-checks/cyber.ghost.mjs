// Also exports a small runtime fixture used by the other S1 checks.
export function fixture(h, id, deal = 1, extraRules = {}, picks = []) {
  const { Rules, BoardEffects, baseRules, clone, stubAPI } = h;
  const rules = { ...baseRules(), ...extraRules };
  const game = new Rules.Game(deal, { rules: clone(rules) });
  const initial = clone(game.state);
  const run = { seed: 's1-check', undos: 8, boons: [id], results: [], charmMemo: {} };
  const memo = {}, active = [{ id, kind: 'boon', strength: 1 }];
  const api = stubAPI(game, { picks });
  let ability, effects;
  api.beginAbility = (id, uses) => { ability = { id, uses }; };
  api.endAbility = () => { ability = null; };
  api.addUndos = (n) => { run.undos += n; };
  api.spendUndos = (n) => { const spent = Math.min(n, run.undos); run.undos -= spent; return spent; };
  const emit = (m) => effects.emit('move', { move: m, manual: !m.auto });
  api.charmMove = (op, data) => {
    const m = game.applyCharmMove({ ...data, t: 'X', op, ...(ability ? { voyageAbility: { ...ability } } : {}) });
    emit(m); return m;
  };
  const undone = (moves) => {
    run.undos--;
    for (const m of moves) effects.refundAbility(m.voyageAbility || m.override?.voyageAbility);
    effects.emit('undo', { move: moves[0], moves });
  };
  api.rewind = (n) => {
    if (!n || run.undos <= 0) return false;
    const moves = [];
    while (n--) moves.push(game.undo());
    undone(moves); return true;
  };
  effects = new BoardEffects(active, { seed: run.seed, boardIndex: 0, api, memo, run });
  effects.setup({ state: clone(initial), initial, deal, restored: false });
  return { game, initial, rules, run, memo, api, effects, emit,
    undo() { const m = game.undo(); if (m) undone([m]); return m; },
    resume() {
      const resumed = new Rules.Game(deal, { rules: clone(rules) });
      for (const m of clone(game.history)) resumed.applyDescriptor(m);
      h.assert.deepEqual(resumed.state, game.state); h.assert.deepEqual(resumed.rules, game.rules);
      const fx = new BoardEffects(active, { seed: run.seed, boardIndex: 0, api: stubAPI(resumed), memo: clone(memo), run: clone(run) });
      fx.setup({ state: clone(initial), initial, deal, restored: true });
      h.assert.deepEqual(fx.abilityState(id), effects.abilityState(id));
      h.assert.deepEqual(fx.ctxs[0].api.concealed, effects.ctxs[0].api.concealed);
      return resumed;
    },
  };
}

export async function check(h) {
  const { assert, Rules, clone, kit, scoreBoard } = h;
  for (const deal of [1, 2, 617, 11982]) {
    const picks = [null];
    const f = fixture(h, 'cyber.ghost', deal, {}, picks);
    // Find a legal top-card exit on the real deal, using only generated moves.
    let exit;
    for (let i = 0; i < 12; i++) {
      const moves = Rules.generateMoves(f.game.state, { rules: f.game.rules });
      exit = moves.find((m) => m.src?.kind === 'col' && (m.t === 'F' || (m.t === 'T' && m.count === 1)));
      if (exit) break;
      assert(moves[0]); f.emit(f.game.applyDescriptor(moves[0]));
    }
    assert(exit, 'real-deal fixture must expose a legal exit');
    picks.push(exit.src.i);
    const preOpen = clone(f.game.state), historyLength = f.game.history.length;
    assert(f.effects.hasAvailableAbility());
    assert.equal(await f.effects.useAbility('cyber.ghost'), false);
    assert.equal(f.effects.abilityState('cyber.ghost').uses, 1);
    assert.equal(await f.effects.useAbility('cyber.ghost'), true);
    assert.equal(f.game.free.length, 5);
    assert(!f.effects.hasAvailableAbility());
    Rules.solve(f.game.state, { rules: f.game.rules, timeLimitMs: 10, nodeLimit: 1000 });
    assert.throws(() => f.game.applyCharmMove({ t: 'X', op: 'cyber.ghost', action: 'close', fi: f.game.history.at(-1).fi }), /empty ghost cell/);
    f.resume();
    assert.equal(scoreBoard(f.game.history, 60, null, { initial: f.initial }).stat.moves, historyLength + 1);
    assert.deepEqual(kit.replay({ initial: f.initial, initialRules: f.rules, history: f.game.history }, () => {}), f.game.state);
    const beforeExit = clone(f.game.state);
    const open = f.game.history.find((m) => m.op === 'cyber.ghost');
    const m = exit.t === 'F' ? f.game.moveToFoundation({ kind: 'free', i: open.fi }) : f.game.moveFreeToTableau(open.fi, exit.to);
    assert(m);
    f.api.beginAbility('another.ability', 1); f.emit(m); f.api.endAbility();
    assert.equal(f.game.free.length, 4);
    assert.equal(f.game.history.at(-1).action, 'close');
    assert.equal(f.game.history.at(-1).voyageAbility, undefined, 'closing must not refund an unrelated triggering ability');
    Rules.solve(f.game.state, { rules: f.game.rules, timeLimitMs: 10, nodeLimit: 1000 });
    f.resume();
    f.undo(); assert.equal(f.game.free.length, 5);
    f.undo(); assert.deepEqual(f.game.state, beforeExit);
    f.undo(); assert.deepEqual(f.game.state, preOpen); assert.deepEqual(f.game.rules, f.rules);
    assert.equal(f.effects.abilityState('cyber.ghost').uses, 1);
    assert(!Rules.solve(f.game.state, { rules: f.game.rules, timeLimitMs: 15, nodeLimit: 1000 }).solution?.some((m) => m.t === 'X'));
  }
  const f = fixture(h, 'cyber.ghost', 1, { cellThaw: { frozen: 2, at: [8, 20] }, cellColors: ['red', 'black', 'red', 'black'] }, [0]);
  const active = Rules.activeFreeCells(f.game.state, f.game.rules);
  await f.effects.useAbility('cyber.ghost');
  assert.equal(f.game.history[0].fi, active);
  assert.equal(Rules.activeFreeCells(f.game.state, f.game.rules), active + 1);
  assert.deepEqual(f.game.rules.cellColors, ['red', 'black', null, 'red', 'black']);
  f.resume(); f.undo(); assert.deepEqual(f.game.rules, f.rules);
  for (const data of [{ action: 'open', col: -1 }, { action: 'open', col: 8 }, { action: 'close', fi: 9 }, { action: 'other' }]) {
    const before = clone(f.game.state); assert.throws(() => f.game.applyCharmMove({ t: 'X', op: 'cyber.ghost', ...data })); assert.deepEqual(f.game.state, before);
  }
  const full = fixture(h, 'cyber.ghost', 1, { freeCells: 6 }); assert(!full.effects.hasAvailableAbility());
  const barred = fixture(h, 'cyber.ghost', 1, { noCellRanks: 16382 }); assert(!barred.effects.hasAvailableAbility());
  assert.throws(() => barred.game.applyCharmMove({ t: 'X', op: 'cyber.ghost', action: 'open', col: 0 }));
}
