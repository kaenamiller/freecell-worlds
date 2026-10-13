import { overrideDrop, overrideTargets } from '../../js/voyage/content/special/concrete.spraytag.js';

// Shared round-trip coverage for the one-shot drop family, on numbered deals.
export async function checkOverrideCharm(h, id, flags, freeOnly, sequencesOnly, deals) {
  const { assert, Rules, BoardEffects, clone, stubAPI, scoreBoard, kit } = h;
  for (const deal of deals) {
    const game = new Rules.Game(deal, { rules: sequencesOnly ? { moveBonus: -4 } : {} });
    if (freeOnly) assert(game.moveToFreeCell({ kind: 'col', i: 0 }, 0));
    const before = clone(game.state), originalRules = clone(game.rules), beforeHistory = clone(game.history);
    const candidates = overrideTargets({ api: { state: game.state, rules: game.rules, concealed: [] } }, flags, freeOnly, sequencesOnly);
    const target = candidates.find((m) => !Rules.canPlaceTableau(game.state, m.to, m.card, m.count, game.rules)) || candidates[0];
    assert(target, `${id}: deal ${deal} needs a target`);
    assert(!Rules.canPlaceTableau(game.state, target.to, target.card, target.count, game.rules), 'fixture demonstrates additional capability');
    const sourceChoice = freeOnly ? target.src.i : target.card;
    let meta = null;
    const api = stubAPI(game, { picks: [null, sourceChoice, null, sourceChoice, target.to] });
    const arm = api.override, move = api.charmMove;
    api.beginAbility = (id, uses) => { meta = { id, uses }; };
    api.endAbility = () => { meta = null; };
    api.override = (o) => arm({ ...o, voyageAbility: clone(meta) });
    api.charmMove = (op, data) => move(op, { ...data, voyageAbility: clone(meta) });
    const run = { seed: `s3-${deal}`, current: { idx: 0 }, boons: [id], undos: 5, results: [], charmMemo: {} };
    const active = [{ id, kind: 'boon', strength: 1 }], memo = {};
    const effects = new BoardEffects(active, { seed: run.seed, boardIndex: 0, api, memo, run });
    effects.setup({ state: game.initial, initial: game.initial, deal, restored: false });
    assert(effects.hasAvailableAbility(), 'unused useful ability protects the stuck check');
    assert.equal(await effects.useAbility(id), false, 'first target cancellation');
    assert.equal(await effects.useAbility(id), false, 'second target cancellation');
    assert.equal(effects.abilityState(id).uses, 1);
    assert.equal(game.override, null);
    assert.deepEqual(game.state, before);
    assert.equal(await effects.useAbility(id), true);
    const x = game.history.at(-1), after = clone(game.state);
    assert.equal(x.t, 'X'); assert.equal(x.op, id);
    assert.deepEqual(x.override, { ...flags, voyageAbility: { id, uses: 1 } });
    assert.equal(game.override, null, 'successful X drop consumes the one-shot override');
    assert.equal(effects.abilityState(id).uses, 0);
    assert(!effects.hasAvailableAbility(), 'spent ability cannot protect the stuck check');
    assert(api.calls.some(([name]) => name === 'notify'), 'use toast');
    assert.deepEqual(game.rules, originalRules);
    const all = [...game.state.tableau.flat(), ...game.state.free.filter(Boolean)];
    game.state.found.forEach((rank, suit) => { for (let r = 1; r <= rank; r++) all.push(suit * 13 + r); });
    assert.deepEqual(all.sort((a, b) => a - b), Array.from({ length: 52 }, (_, i) => i + 1), 'every card remains exactly once');
    const extra = { initial: game.initial, rules: game.rules, initialRules: originalRules };
    assert.deepEqual(kit.replay({ ...extra, history: game.history }, () => {}), after);
    assert.equal(scoreBoard(game.history, 60, null, extra).stat.moves, beforeHistory.length + 1, 'one player move');
    const answer = Rules.solve(game.state, { rules: game.rules, timeLimitMs: 20, maxNodes: 1000 });
    assert('solvable' in answer, 'solver accepts the resulting state');
    Rules.generateMoves(game.state, { rules: game.rules }).forEach((m) => {
      const st = Rules.cloneState(game.state); Rules.applyMove(st, m, game.rules); Rules.undoMove(st, m, game.rules);
      assert.deepEqual(st, after, 'solver/hint move round trip');
    });
    // JSON save/replay must retain both the custom drop and its refund metadata.
    const saved = clone({ history: game.history, memo, run });
    const resumedGame = new Rules.Game(deal, { rules: originalRules });
    for (const m of saved.history) resumedGame.applyDescriptor(m);
    assert.deepEqual(resumedGame.state, after);
    const resumed = new BoardEffects(active, { seed: run.seed, boardIndex: 0, api: stubAPI(resumedGame), memo: saved.memo, run: saved.run });
    resumed.setup({ state: resumedGame.initial, initial: resumedGame.initial, deal, restored: true });
    assert.equal(resumed.abilityState(id).uses, 0);
    const undone = resumedGame.undo();
    // Mirror main.js voyageUndone: refund the activation and clear Game's restored override.
    resumed.refundAbility(undone.voyageAbility || undone.override?.voyageAbility);
    resumedGame.override = null;
    assert.deepEqual(resumedGame.state, before);
    assert.deepEqual(resumedGame.history, beforeHistory);
    assert.deepEqual(resumedGame.rules, originalRules);
    assert.equal(resumed.abilityState(id).uses, 1);
    assert(resumed.hasAvailableAbility());
    assert.equal(scoreBoard(resumedGame.history, 60, null, extra).stat.moves, beforeHistory.length);
    // The underlying Game also supports saving/resuming an armed override.
    game.undo(); assert.deepEqual(game.state, before); assert.deepEqual(game.override, x.override);
    const armed = new Rules.Game(deal, { rules: originalRules });
    for (const m of beforeHistory) armed.applyDescriptor(clone(m));
    armed.override = clone(game.override);
    armed.applyCharmMove(clone(x)); assert.equal(armed.override, null); assert.deepEqual(armed.state, after);
    // Reject bad destinations, source/counts, self-drops and each board restriction atomically.
    const invalid = [
      { ...target, to: -1 }, { ...target, to: 8 }, { ...target, count: 0 },
      { ...target, src: { kind: 'free', i: 99 } }, { ...target, src: { kind: 'col', i: 99 } },
      ...(target.src.kind === 'col' ? [{ ...target, to: target.src.i }, { ...target, count: game.tableau[target.src.i].length + 1 }] : []),
      ...(freeOnly ? [{ ...target, src: { kind: 'col', i: 1 } }] : []),
    ];
    for (const bad of invalid) {
      assert.throws(() => game.applyCharmMove({ ...bad, t: 'X', op: id, tableauDrop: true }), /illegal drop/);
      assert.deepEqual(game.state, before); assert.deepEqual(game.history, beforeHistory);
      assert.deepEqual(game.override, x.override, 'rejected drop preserves the override');
    }
    game.state.sealed = 1 << target.to;
    const sealed = clone(game.state);
    assert.throws(() => game.applyCharmMove({ ...target, t: 'X', op: id, tableauDrop: true }), /illegal drop/);
    assert.deepEqual(game.state, sealed);
    assert.equal(overrideTargets({ api: { state: game.state, rules: game.rules, concealed: [] } }, flags, freeOnly, sequencesOnly).some((m) => m.to === target.to), false);
    game.state = clone(before);
    game.rules.maxHeight = game.tableau[target.to].length + target.count - 1;
    assert.throws(() => game.applyCharmMove({ ...target, t: 'X', op: id, tableauDrop: true }), /illegal drop/);
    game.rules = clone(originalRules);
    if (freeOnly) {
      game.rules.oneWayCellRanks = 1 << Rules.rankOf(target.card);
      assert.throws(() => game.applyCharmMove({ ...target, t: 'X', op: id, tableauDrop: true }), /illegal drop/);
      assert(!effects.hasAvailableAbility(), 'one-way cells do not supply Understudy targets');
      game.rules = clone(originalRules);
    }
    assert(!overrideTargets({ api: { state: game.state, rules: game.rules, concealed: [target.card] } }, flags, freeOnly, sequencesOnly).some((m) => m.card === target.card), 'concealed cards excluded');
  }
}

export async function check(h) {
  const { assert, Rules, BoardEffects, clone, stubAPI } = h;
  const flags = { ignoreColour: true, ignoreCap: true };
  for (const deal of [1, 2, 3]) {
    const game = new Rules.Game(deal, { rules: { moveBonus: -4 } });
    const before = clone(game.state), originalRules = clone(game.rules);
    const candidates = overrideTargets({ api: { state: game.state, rules: game.rules, concealed: [] } }, flags);
    const target = candidates.find((m) => !Rules.canPlaceTableau(game.state, m.to, m.card, m.count, game.rules));
    assert(target, `concrete.spraytag: deal ${deal} needs an override-only target`);
    let meta = null;
    const api = stubAPI(game);
    const arm = api.override;
    api.beginAbility = (id, uses) => { meta = { id, uses }; };
    api.endAbility = () => { meta = null; };
    api.override = (o) => game.override ? false : arm({ ...o, voyageAbility: clone(meta) });
    const run = { seed: `spray-${deal}`, current: { idx: 0 }, boons: ['concrete.spraytag'], undos: 5, results: [], charmMemo: {} };
    const memo = {};
    const effects = new BoardEffects([{ id: 'concrete.spraytag', kind: 'boon', strength: 1 }], { seed: run.seed, boardIndex: 0, api, memo, run });
    effects.setup({ state: game.initial, initial: game.initial, deal, restored: false });
    assert.equal(await effects.useAbility('concrete.spraytag'), true);
    assert.equal(game.history.length, 0, 'Spray Tag arms the next player drop');
    assert.deepEqual(game.override, { ...flags, voyageAbility: { id: 'concrete.spraytag', uses: 1 } });
    assert.equal(await effects.useAbility('concrete.spraytag'), false, 'an armed override cannot be replaced');
    const move = target.src.kind === 'free'
      ? game.moveFreeToTableau(target.src.i, target.to)
      : game.moveSequenceToTableau(target.src.i, game.tableau[target.src.i].length - target.count, target.to);
    assert(move);
    assert.equal(move.t, 'T');
    assert.deepEqual(move.override, { ...flags, voyageAbility: { id: 'concrete.spraytag', uses: 1 } });
    assert.equal(game.override, null);
    const after = clone(game.state);
    const resumedGame = new Rules.Game(deal, { rules: originalRules });
    resumedGame.applyDescriptor(clone(move));
    assert.deepEqual(resumedGame.state, after);
    const resumed = new BoardEffects([{ id: 'concrete.spraytag', kind: 'boon', strength: 1 }], {
      seed: run.seed, boardIndex: 0, api: stubAPI(resumedGame), memo: clone(memo), run: clone(run),
    });
    resumed.setup({ state: resumedGame.initial, initial: resumedGame.initial, deal, restored: true });
    assert.equal(resumed.abilityState('concrete.spraytag').uses, 0);
    const undone = resumedGame.undo();
    resumed.refundAbility(undone.override?.voyageAbility);
    resumedGame.override = null;
    assert.deepEqual(resumedGame.state, before);
    assert.deepEqual(resumedGame.rules, originalRules);
    assert.equal(resumed.abilityState('concrete.spraytag').uses, 1);
  }
  // Colour and capacity relax; rank and a legal moving sequence still apply.
  const rank = new Rules.Game(1, { rules: { moveBonus: -52 } });
  const src = { kind: 'col', i: 0 };
  rank.state.tableau = [[8, 20, 6], [23], [1], [2], [3], [4], [5], [7]];
  assert.equal(overrideDrop(rank.state, rank.rules, flags, false, src, 3, 1), null, 'rank still applies');
  rank.state.tableau = [[8, 21, 6], [22], [1], [2], [3], [4], [5], [7]];
  assert.equal(overrideDrop(rank.state, rank.rules, flags, false, src, 3, 1), null, 'broken runs still apply');
  rank.state.tableau = [[8, 20, 6], [22], [1], [2], [3], [4], [5], [7]];
  assert(overrideDrop(rank.state, rank.rules, flags, false, src, 3, 1));
}
