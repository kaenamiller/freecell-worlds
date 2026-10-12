// Shared S2 checks; each charm supplies its own target and illegal descriptors.
export function check({ assert, CHARMS }) {
  for (const id of ['space.tractor', 'carvings.raven', 'lowtide.tidepool', 'museum.digsite']) {
    const charm = CHARMS[id];
    assert(charm && !charm.placeholder);
    assert.equal(charm.kind, 'boon');
    assert.equal(charm.theme, id.split('.')[0]);
    assert(charm.ease > 0 && charm.ease <= 0.5);
    assert.equal(charm.ability.uses, 1);
  }
}
export async function targeted(h, id, fixture, illegal) {
  const { assert, Rules, BoardEffects, baseRules, clone, stubAPI, kit, scoreBoard } = h;
  // Extra uses are supplied by the runtime, with no per-charm hard-coded cap.
  const bonusGame = new Rules.Game(1);
  const bonusPicks = fixture(bonusGame);
  const bonus = new BoardEffects([{ id, kind: 'boon', strength: 1 }, { id: 'dev.survey', kind: 'boon', strength: 1 }], {
    seed: 's2-bonus', boardIndex: 0, api: stubAPI(bonusGame, { picks: bonusPicks.length > 1 ? [bonusPicks[0], null] : [null] }),
  });
  bonus.setup({ state: bonusGame.initial, initial: bonusGame.initial, deal: 1 });
  assert.equal(bonus.abilityState(id).uses, 2);
  const bonusBefore = clone(bonusGame.state);
  assert.equal(await bonus.useAbility(id), false, 'cancelling either target preserves bonus uses');
  assert.equal(bonus.abilityState(id).uses, 2);
  assert.deepEqual(bonusGame.state, bonusBefore);
  for (const deal of [1, 617, 11982]) {
    const rules = { ...baseRules(), sealedCols: [0, 3], maxHeight: 7 };
    const game = new Rules.Game(deal, { rules: clone(rules) });
    const initial = clone(game.state);
    const picks = fixture(game);
    const before = clone(game.state), priorHistory = clone(game.history);
    const api = stubAPI(game, { picks: [null, ...picks] });
    let ability;
    api.beginAbility = (id, uses) => { ability = { id, uses }; };
    api.endAbility = () => { ability = null; };
    api.charmMove = (op, data) => game.applyCharmMove({ ...data, t: 'X', op, voyageAbility: clone(ability) });
    const active = [{ id, kind: 'boon', strength: 1 }], memo = {};
    const effects = new BoardEffects(active, { seed: 's2-check', boardIndex: 0, api, memo });
    effects.setup({ state: initial, initial, deal });
    assert(effects.hasAvailableAbility(), `${id}: unused ability protects against stuck`);
    assert.equal(await effects.useAbility(id), false, 'cancel preserves use');
    assert.equal(effects.abilityState(id).uses, 1);
    assert.deepEqual(game.state, before);
    assert.equal(await effects.useAbility(id), true);
    assert.equal(game.history.length, priorHistory.length + 1);
    assert.equal(game.history.at(-1).t, 'X');
    assert.equal(effects.abilityState(id).uses, 0);
    assert.equal(effects.hasAvailableAbility(), false, 'spent ability cannot protect against stuck');
    assert.equal(api.calls.filter(([name]) => name === 'notify').length, 1);
    const after = clone(game.state);
    const cards = after.tableau.flat().concat(after.free.filter(Boolean));
    for (let suit = 0; suit < 4; suit++) for (let rank = 1; rank <= after.found[suit]; rank++) cards.push(Rules.cardId(suit, rank));
    assert.deepEqual(cards.sort((a, b) => a - b), Array.from({ length: 52 }, (_, i) => i + 1));
    assert.deepEqual(kit.replay({ initial, initialRules: rules, history: game.history }, () => {}), after);
    assert.equal(scoreBoard(game.history, 60).stat.moves, game.history.length, 'X counts as one player move');
    // The solver and hints see an ordinary, complete board even across illegal dealt pairs.
    const verdict = Rules.solve(after, { rules: game.rules, timeLimitMs: 20, perRunMs: 20, perRunNodes: 300, attemptLimit: 1, rng: h.stream('s2-solver', id, deal) });
    assert([true, false, null].includes(verdict.solvable));
    const next = Rules.generateMoves(after, { rules: game.rules })[0];
    if (next) { game.applyDescriptor(next); game.undo(); assert.deepEqual(game.state, after); }
    const savedHistory = clone(game.history), savedMemo = clone(memo);
    const resumedGame = new Rules.Game(deal, { rules: clone(rules) });
    for (const move of savedHistory) resumedGame.applyDescriptor(move);
    const resumed = new BoardEffects(active, { seed: 's2-check', boardIndex: 0, api: stubAPI(resumedGame), memo: savedMemo });
    resumed.setup({ state: initial, initial, deal, restored: true });
    assert.deepEqual(resumedGame.state, after, 'JSON history replay restores board');
    assert.equal(resumed.abilityState(id).uses, 0, 'resume preserves spent uses');
    const undone = resumedGame.undo(); resumed.refundAbility(undone.voyageAbility);
    assert.deepEqual(resumedGame.state, before, 'undo restores exact column order/cells/seals');
    assert.deepEqual(resumedGame.rules, rules);
    assert.equal(resumed.abilityState(id).uses, 1, 'undo restores the ability');
    const pending = new BoardEffects(active, { seed: 's2-check', boardIndex: 0, api: stubAPI(resumedGame), memo: clone(savedMemo) });
    pending.setup({ state: initial, initial, deal, restored: true });
    assert(pending.hasAvailableAbility(), 'refunded ability survives another resume');
    for (const data of illegal(resumedGame)) {
      const old = clone(resumedGame.state), length = resumedGame.history.length;
      assert.throws(() => resumedGame.applyCharmMove({ t: 'X', op: id, ...data }));
      assert.deepEqual(resumedGame.state, old, 'illegal move must be atomic');
      assert.equal(resumedGame.history.length, length);
    }
  }
}
