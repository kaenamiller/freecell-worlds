import { pathToFileURL } from 'node:url';
import { overrideTargets } from '../../js/voyage/content/special/concrete.spraytag.js';

const ids = ['cyber.zeroday', 'aero.dolphin', 'azulejo.glaze', 'winterglass.icicle', 'deepstorage.redaction', 'concrete.spraytag'];
const flagsFor = {
  'cyber.zeroday': { ignoreRestrictions: true },
  'winterglass.icicle': { rankGap: 2 },
  'concrete.spraytag': { ignoreColour: true, ignoreCap: true },
};

export async function check(h) {
  const { assert, Rules, CHARMS, BoardEffects, baseRules, clone, stubAPI, scoreBoard, kit } = h;
  h.checkV2Definitions(ids.map((id) => CHARMS[id]));
  for (const id of ids) for (const level of [1, 2]) {
    for (let strength = 1; strength <= 7; strength++) await h.checkCharm(CHARMS[id], strength, level);
    const game = new Rules.Game(id === 'cyber.zeroday' ? 3 : 1, { rules: baseRules() });
    const original = clone(game.state), originalRules = clone(game.rules);
    let picks, target;
    if (id === 'aero.dolphin') {
      target = game.tableau.flatMap((col, i) => col.slice(0, -1).filter((card) => Rules.foundationAccepts(game.state, card, game.rules)).map((card) => ({ card, col: i, index: col.indexOf(card) })))[0];
      picks = [null, target.card];
    } else if (id === 'azulejo.glaze') {
      target = { card: 24, shift: level === 1 ? -1 : 1 };
      // Card pick, then the up/down menu (cancelled once at each step).
      picks = [null, target.card, null, target.card, target.shift];
    } else if (id === 'deepstorage.redaction') {
      target = { card: game.tableau[0].at(-1) };
      picks = [null, target.card];
    } else {
      const flags = flagsFor[id];
      if (id === 'cyber.zeroday') game.state.sealed = 255;
      const candidates = overrideTargets({ api: { state: game.state, rules: game.rules, concealed: [] } }, flags);
      target = candidates.find((m) => !Rules.canPlaceTableau(game.state, m.to, m.card, m.count, game.rules)) || candidates[0];
      assert(target, `${id}: useful numbered-deal target`);
      picks = [];
    }
    const before = clone(game.state), beforeRules = clone(game.rules), memo = {};
    const run = { seed: 'x1', status: 'board', current: { idx: 0 }, boons: [id], levels: { [id]: level }, undos: 5, coins: 0, results: [], charmMemo: {} };
    const api = stubAPI(game, { picks, run, memo });
    let meta = null;
    api.beginAbility = (id, uses) => { meta = { id, uses, grants: 0 }; };
    api.endAbility = () => { meta = null; };
    const arm = api.override, move = api.charmMove;
    api.override = (flags) => game.override ? false : arm({ ...flags, voyageAbility: clone(meta) });
    api.charmMove = (op, data) => move(op, { ...data, voyageAbility: clone(meta) });
    const active = [{ id, kind: 'boon', strength: 1, level }];
    const fx = new BoardEffects(active, { seed: run.seed, boardIndex: 0, api, memo, run });
    fx.setup({ state: original, initial: original });
    assert.equal(fx.abilityState(id).uses, level);
    assert(fx.abilityState(id).available);
    h.assertAvailablePure(CHARMS[id], fx.ctxs[0]);
    if (picks.length) {
      assert.equal(await fx.useAbility(id), false, 'first picker cancellation');
      if (id === 'azulejo.glaze') assert.equal(await fx.useAbility(id), false, 'second picker cancellation');
      assert.equal(fx.abilityState(id).uses, level);
      assert.deepEqual(game.state, before); assert.deepEqual(game.rules, beforeRules);
    }
    assert.equal(await fx.useAbility(id), true);
    assert.equal(fx.abilityState(id).uses, level - 1);
    if (['cyber.zeroday', 'winterglass.icicle', 'concrete.spraytag'].includes(id)) {
      assert.equal(game.history.length, 0, 'arming waits for the next placement');
      if (level === 2) assert.equal(await fx.useAbility(id), false, 'cannot replace an armed override');
      const applied = target.src.kind === 'free' ? game.moveFreeToTableau(target.src.i, target.to) : game.moveSequenceToTableau(target.src.i, game.tableau[target.src.i].length - target.count, target.to);
      assert(applied);
      assert.equal(game.override, null);
      assert.deepEqual(applied.override, { ...flagsFor[id], voyageAbility: { id, uses: level, grants: 0 } });
    } else {
      assert.equal(game.history.length, 1); assert.equal(game.history[0].t, 'X');
      if (id === 'aero.dolphin') {
        assert.equal(Rules.cardsHome(game.state), 1);
        assert.deepEqual(game.history[0].homeCards, [target.card]);
        assert.equal(game.tableau[target.col].includes(target.card), false);
      }
      if (id === 'azulejo.glaze') {
        assert.equal(game.rules.rankShift[target.card], target.shift);
        const shifted = Rules.rankOf(target.card) + target.shift;
        const parent = Rules.cardId(0, shifted + 1);
        assert(Rules.canBuildOn(parent, target.card, game.rules));
        assert(!Rules.canBuildOn(parent, target.card, beforeRules));
        assert.equal(Rules.foundationAccepts(game.state, target.card, game.rules), Rules.foundationAccepts(game.state, target.card, beforeRules), 'foundations use printed rank');
        assert.equal(api.marks[target.card], `mod-rank-${target.shift > 0 ? 'up' : 'down'}-${shifted}`);
      }
      if (id === 'deepstorage.redaction') {
        assert(game.rules.anchorCards.includes(target.card));
        assert(Rules.canBuildOn(target.card, 13, game.rules));
        assert(!Rules.canBuildOn(target.card, 13, beforeRules));
        assert.equal(api.marks[target.card], 'mod-anchor');
      }
    }
    const after = clone(game.state), afterRules = clone(game.rules), history = clone(game.history);
    const extra = { initial: before, initialRules: beforeRules, rules: game.rules };
    assert.deepEqual(kit.replay({ ...extra, history }, () => {}), after);
    const sb = scoreBoard(history, 60, fx, extra);
    assert.equal(sb.stat.moves, 1); assert.deepEqual(sb.coinLines, [], 'ability charms do not grant play coins');
    if (id === 'aero.dolphin') {
      assert.deepEqual(sb.stat.chains, [], 'Dolphin X never extends an F chain');
      assert.equal(sb.stat.cards, 1, 'Dolphin X counts as a card home');
    }
    const resumedGame = new Rules.Game(1, { rules: clone(beforeRules) });
    resumedGame.state = clone(before); resumedGame.initial = clone(before);
    for (const m of history) resumedGame.applyDescriptor(m);
    assert.deepEqual(resumedGame.state, after); assert.deepEqual(resumedGame.rules, afterRules);
    const resumedAPI = stubAPI(resumedGame);
    const resumed = new BoardEffects(active, { seed: run.seed, boardIndex: 0, api: resumedAPI, memo: clone(memo), run: clone(run) });
    resumed.setup({ state: original, initial: original, restored: true });
    assert.equal(resumed.abilityState(id).uses, level - 1);
    const undone = resumedGame.undo();
    resumed.refundAbility(undone.voyageAbility || undone.override?.voyageAbility);
    resumedGame.override = null;
    resumed.emit('undo', { move: undone, moves: [undone] });
    assert.deepEqual(resumedGame.state, before); assert.deepEqual(resumedGame.rules, beforeRules);
    assert.equal(resumed.abilityState(id).uses, level);
    if (['azulejo.glaze', 'deepstorage.redaction'].includes(id)) assert(!resumedAPI.marks[target.card], 'undo removes the singled-out mark');
    assert.equal(scoreBoard(resumedGame.history, 60, resumed, extra).stat.moves, 0);
    game.state = original; game.rules = originalRules;
  }

  // Conditions which must fail: concealment, illegal rank shifts, foundation bans,
  // destination restrictions and invalid multi-card runs.
  for (const id of ['aero.dolphin', 'azulejo.glaze', 'deepstorage.redaction']) {
    const game = new Rules.Game(1, { rules: baseRules() }), api = stubAPI(game);
    const fx = new BoardEffects([{ id, kind: 'boon', strength: 1 }], { seed: 'negative', api });
    fx.setup({ state: game.initial });
    fx.ctxs[0].api.conceal(game.tableau.flat());
    assert.equal(fx.abilityState(id).available, false);
    assert.equal(await fx.useAbility(id), false);
    const before = clone(game.state), rules = clone(game.rules);
    const card = id === 'aero.dolphin' ? 1 : 24;
    assert.throws(() => game.applyCharmMove({ t: 'X', op: id, card, col: 5, index: 3, shift: -1, concealed: [card] }));
    assert.deepEqual(game.state, before); assert.deepEqual(game.rules, rules);
  }
  const game = new Rules.Game(1, { rules: baseRules() });
  game.rules.gate = { suit: 0, after: 13 };
  assert.throws(() => game.applyCharmMove({ t: 'X', op: 'aero.dolphin', col: 5, index: 3, card: 1 }));
  for (const shift of [-2, 0, 2]) assert.throws(() => game.applyCharmMove({ t: 'X', op: 'azulejo.glaze', card: 24, shift }));
  assert.throws(() => game.applyCharmMove({ t: 'X', op: 'azulejo.glaze', card: 1, shift: -1 }));
  assert.throws(() => game.applyCharmMove({ t: 'X', op: 'azulejo.glaze', card: 26, shift: 1 }));
  game.applyCharmMove({ t: 'X', op: 'azulejo.glaze', card: 24, shift: -1 });
  game.applyCharmMove({ t: 'X', op: 'azulejo.glaze', card: 24, shift: 1 });
  game.undo(); assert.equal(game.rules.rankShift[24], -1); game.undo();
  game.rules.anchorCards = [24];
  game.applyCharmMove({ t: 'X', op: 'deepstorage.redaction', card: 45 });
  game.rules.barrenCards = [45];
  assert(!Rules.canBuildOn(45, 13, game.rules), 'barren beats anchors');
  game.undo(); assert.deepEqual(game.rules.anchorCards, [24], 'undo preserves pre-existing anchors');
  // Zero-Day can unlock a free-cell placement, but cannot create frozen cells.
  game.rules = { ...baseRules(), noCellRanks: 16382 };
  const api = stubAPI(game), fx = new BoardEffects([{ id: 'cyber.zeroday', kind: 'boon', strength: 1 }], { seed: 'cell', api });
  fx.setup({ state: game.initial });
  assert(!game.moveToFreeCell({ kind: 'col', i: 0 }, 0));
  assert(await fx.useAbility('cyber.zeroday'));
  assert(game.moveToFreeCell({ kind: 'col', i: 0 }, 0));
  assert.equal(game.override, null); game.undo();
  game.rules.cellThaw = { frozen: 4, at: [10, 20, 30, 40] };
  assert(!game.moveToFreeCell({ kind: 'col', i: 0 }, 0));

  // Spray Tag lifts capacity while retaining rank and a valid moving sequence.
  const cap = new Rules.Game(1, { rules: { ...baseRules(), moveBonus: -52 } });
  cap.state.tableau = [[8, 20, 6], [22], [1], [2], [3], [4], [5], [7]];
  const source = { src: { kind: 'col', i: 0 }, count: 3, to: 1, card: 8 };
  assert(!Rules.canPlaceTableau(cap.state, 1, 8, 3, cap.rules));
  assert(Rules.canPlaceTableau(cap.state, 1, 8, 3, cap.rules, flagsFor['concrete.spraytag']));
  const before = clone(cap.state);
  cap.override = flagsFor['concrete.spraytag'];
  assert(cap.moveSequenceToTableau(source.src.i, 0, source.to));
  cap.undo();
  assert.deepEqual(cap.state, before);
  console.log('OK: x1 six charms at L1/L2, cancellation, overrides, marks, restrictions, replay and undo');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const h = await import('../charm-content-check.mjs');
  await check(h);
}
