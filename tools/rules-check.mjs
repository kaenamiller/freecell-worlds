// Pure Node regression checks for the solver-visible Voyage rules kernel.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  Game, deal, cloneState, applyMove, undoMove, generateMoves, solve, hashState,
  canStackOn, canBuildOn, foundationAccepts, cellAccepts, activeFreeCells, maxMoveSize,
  runLength, sequenceStart, isValidSequence, safeToFoundation, safeFoundationMoves,
  canFinishWithFoundationOnly, registerCustomMove, cleanMove, cardId, rankOf, compileRules,
  suitOf, RULE_DEFAULTS, cellIsClosed, freeCapacity, rulesForState,
  cellIsOpen, canPlaceTableau, canReturnFoundation, canPlantSpur, cardsHome, cardIsHome, isSolved,
} from '../js/rules.js';
import { baseRules, rulesKey, composeBoard, hasRestrictions, hasDealRules, applyDealRules } from '../js/voyage/boardrules.js';
import { CHARMS, defineCharm } from '../js/voyage/registry.js';
import { setBank, dealFor, pickDeal, planKey, blendedScore } from '../js/voyage/dealer.js';
import { shortSolve } from '../js/shortsolve.js';
import { shortSolve as difficultyShortSolve } from '../js/difficulty.js';
import { stream } from '../js/voyage/rng.js';
import '../js/voyage/content/bosses.js';

const bit = (r) => 1 << r;
const state = (cols = [], free = [0, 0, 0, 0], found = [0, 0, 0, 0]) => ({
  tableau: Array.from({ length: 8 }, (_, i) => [...(cols[i] || [])]), free: [...free], found: [...found],
});
const gameAt = (st, rules = {}) => { const g = new Game(1, { rules }); g.state = cloneState(st); return g; };
function roundtrip(st, m, rules) {
  const before = cloneState(st);
  applyMove(st, m, rules); undoMove(st, m, rules);
  assert.deepEqual(st, before, `${m.t} roundtrip`);
}
function group(name, fn) { fn(); console.log(`✓ ${name}`); }

group('neutral defaults, numeric dealing and startHome order', () => {
  assert.equal(Object.keys(baseRules()).length, Object.keys(RULE_DEFAULTS).length);
  assert.equal(rulesKey(baseRules()), 'fc4');
  assert.deepEqual(deal(11982), deal(11982, baseRules()));
  for (const n of [1, 2, 5, 13]) {
    const st = deal(42, { ...baseRules(), freeCells: 6, startHome: n });
    assert.deepEqual(st.found, [n, n, n, n]); assert.equal(st.free.length, 6);
    assert.deepEqual(st.tableau, deal(42).tableau.map((c) => c.filter((id) => rankOf(id) > n)));
    assert.deepEqual(new Game(42, { rules: { freeCells: 6, startHome: n } }).state, st);
  }
});
group('wildRanks and suitBuild match every sequence query', () => {
  for (const [r, pair] of [[{ wildRanks: bit(6) }, [7, 6]], [{ wildRanks: bit(7) }, [7, 6]], [{ suitBuild: 1 }, [7, 6]]]) {
    assert(!canStackOn([pair[0]], pair[1])); assert(canStackOn([pair[0]], pair[1], r));
    assert.equal(runLength(pair, r), 2); assert.equal(sequenceStart(pair, r), 0);
    assert(isValidSequence(pair, 2, r)); assert(!isValidSequence(pair, 2));
    assert(!canStackOn([pair[0]], 5, r));
    const g = gameAt(state([[6], [7]]), r); assert(g.moveSequenceToTableau(0, 0, 1)); g.undo();
  }
  assert(!canStackOn([20], 19, { suitBuild: 1 }));
});
group('moveBonus, emptyFactor and emptyMinRank capacity', () => {
  const st = state([[7], [19]]);
  assert.equal(maxMoveSize(st, false), 5 * 64);
  assert.equal(maxMoveSize(st, true, { emptyFactor: 3, moveBonus: 2 }), 5 * 3 ** 5 + 2);
  assert.equal(maxMoveSize(st, true, { emptyFactor: 1, moveBonus: -9 }), 1);
  assert.equal(maxMoveSize(st, false, { emptyMinRank: 2 }), 5);
  assert(!canStackOn([], 12, { emptyMinRank: 13 })); assert(canStackOn([], 13, { emptyMinRank: 13 }));
  const g = gameAt(state([[12]]), { emptyMinRank: 13 }); assert.equal(g.moveSequenceToTableau(0, 0, 1), null);
});
group('noCellRanks, noCellCards (both mask words), colours and one-way cells', () => {
  const st = state([[13], [52], [20]]), r = { noCellRanks: bit(13), noCellCards: [20, 52] };
  for (const id of [13, 20, 52]) assert(!cellAccepts(st, 0, id, r));
  assert(cellAccepts(st, 0, 19, r));
  const lock = { cellColors: ['red', 'black', null, 'red'] };
  assert(!cellAccepts(st, 0, 7, lock)); assert(cellAccepts(st, 1, 7, lock));
  assert(cellAccepts(st, 0, 20, lock)); assert(!cellAccepts(st, 1, 20, lock));
  const moves = generateMoves(st, { rules: lock });
  assert(moves.some((m) => m.t === 'C' && m.card === 13 && m.fi === 1));
  assert(moves.some((m) => m.t === 'C' && m.card === 20 && m.fi === 0));
  const g = gameAt(state([[20]], [6, 0, 0, 0], [5, 0, 0, 0]), { oneWayCellRanks: bit(6) });
  assert.equal(g.moveFreeToTableau(0, 0), null); assert(g.moveToFoundation({ kind: 'free', i: 0 })); g.undo();
  assert(!generateMoves(g.state, { rules: g.rules }).some((m) => m.t === 'T' && m.src.kind === 'free'));
});
group('barren parents, foundationSpread and maxHeight', () => {
  const r = { barren: { suits: 1, ranks: bit(7) } };
  assert(!canStackOn([7], 19, r)); assert(canStackOn([8], 20, r));
  assert(!isValidSequence([7, 19], 2, r)); assert.equal(runLength([7, 19], r), 1);
  const st = state([[4]], [], [3, 1, 1, 1]);
  assert(!foundationAccepts(st, 4, { foundationSpread: 2 }));
  assert(foundationAccepts(st, 4, { foundationSpread: 3 }));
  assert(!safeToFoundation(st, 4, { foundationSpread: 2 }));
  const g = gameAt(state([[6], [20]]), { maxHeight: 1 }); assert.equal(g.moveSequenceToTableau(0, 0, 1), null);
  assert(!generateMoves(g.state, { rules: g.rules }).some((m) => m.t === 'T' && m.to === 1));
});
group('cellThaw thresholds, frozen legality and foundation undo', () => {
  const rules = { cellThaw: { frozen: 2, at: [8, 20] } };
  const st = state([[2]], undefined, [1, 2, 2, 2]);
  assert.equal(activeFreeCells(st, rules), 2); assert(!cellAccepts(st, 2, 13, rules));
  const g = gameAt(st, rules), before = cloneState(g.state);
  assert(g.moveToFoundation({ kind: 'col', i: 0 })); assert.equal(activeFreeCells(g.state, rules), 3);
  g.undo(); assert.deepEqual(g.state, before); assert.equal(activeFreeCells(g.state, rules), 2);
  st.found = [5, 5, 5, 5]; assert.equal(activeFreeCells(st, rules), 4);
  assert(!hasRestrictions({ freeCells: 5, cellThaw: { frozen: 1, at: [13] } }));
});
group('sealed state is persistent, hashed, cloned and reversible', () => {
  const g = new Game(8, { rules: { sealedCols: [0, 2] } }); assert.equal(g.state.sealed, 5);
  g.state = { ...state([[6], [20]]), sealed: 1 };
  assert.equal(g.moveSequenceToTableau(1, 0, 0), null);
  const before = cloneState(g.state), h = hashState(before);
  assert(g.moveSequenceToTableau(0, 0, 1)); assert.equal(g.state.sealed, 0);
  g.undo(); assert.deepEqual(g.state, before); assert.equal(hashState(g.state), h);
  assert.notEqual(hashState(before), hashState({ ...before, sealed: 0 }));
  assert(generateMoves(g.state, { rules: g.rules }).some((m) => m.t === 'T' && m.src.i === 0 && !g.tableau[m.to].length), 'moving a whole sealed column breaks its seal and must be generated');
  for (const m of generateMoves(g.state, { rules: g.rules })) roundtrip(g.state, m, g.rules);
});
group('foundation R moves to columns and cells, including undo', () => {
  const g = gameAt(state([[20]], undefined, [6, 0, 0, 0]), { foundationReturn: true });
  const before = cloneState(g.state);
  const m = g.moveFoundationReturn(0, { kind: 'col', i: 0 }); assert.equal(m.t, 'R'); assert.equal(m.card, 6);
  assert.equal(g.found[0], 5); g.undo(); assert.deepEqual(g.state, before);
  assert(g.moveFoundationReturn(0, { kind: 'free', i: 2 })); g.undo(); assert.deepEqual(g.state, before);
  assert.equal(gameAt(before).moveFoundationReturn(0, { kind: 'free', i: 0 }), null);
  g.rules.noCellRanks = bit(6); assert.equal(g.moveFoundationReturn(0, { kind: 'free', i: 0 }), null);
  g.rules.noCellRanks = 0;
  assert(generateMoves(g.state, { rules: g.rules }).some((m) => m.t === 'R'));
  assert(!safeFoundationMoves(g.state, g.rules).some((m) => m.t === 'R'));
  for (const m of generateMoves(g.state, { rules: g.rules })) roundtrip(g.state, m, g.rules);
  const spread = gameAt(state([], undefined, [6, 3, 3, 3]), { foundationReturn: true, foundationSpread: 3 });
  assert.equal(spread.moveFoundationReturn(1, { kind: 'free', i: 0 }), null);
  const thaw = gameAt(state([], undefined, [2, 2, 2, 2]), { foundationReturn: true, cellThaw: { frozen: 1, at: [8] } });
  assert.equal(thaw.moveFoundationReturn(0, { kind: 'free', i: 3 }), null);
  assert(thaw.moveFoundationReturn(0, { kind: 'free', i: 0 })); thaw.undo();
  const override = gameAt(state([[7]], undefined, [6, 0, 0, 0]), { foundationReturn: true });
  override.override = { ignoreColour: true };
  assert(override.moveFoundationReturn(0, { kind: 'col', i: 0 })); assert.equal(override.override, null);
  override.undo(); assert(override.override.ignoreColour);
});
group('one-shot overrides survive failed drops and undo; custom X rules/state replay', () => {
  const g = gameAt(state([[6], [7]]));
  g.override = { ignoreColour: true, voyageAbility: { id: 'test', uses: 1 } };
  assert.equal(g.moveSequenceToTableau(0, 0, 2)?.override.ignoreColour, true); g.undo();
  assert(g.override.ignoreColour); assert(g.moveSequenceToTableau(0, 0, 1)); assert.equal(g.override, null);
  g.undo(); assert(g.override.ignoreColour);
  const pending = structuredClone(g.override);
  g.state.tableau[1] = [3]; assert.equal(g.moveSequenceToTableau(0, 0, 1), null); assert.deepEqual(g.override, pending);
  g.override = { ignoreRank: true, ignoreColour: true };
  g.state.tableau[1] = [3]; assert(g.moveSequenceToTableau(0, 0, 1)); g.undo();
  g.override = { anyCard: true }; g.state.tableau[0] = [7, 5]; g.state.tableau[1] = [21];
  assert(g.moveSequenceToTableau(0, 0, 1)); g.undo();
  g.override = { ignoreCap: true }; g.state = state([[7, 19, 5]], [10, 11, 12, 13]);
  g.rules.emptyFactor = 1; g.state.tableau[1] = [21]; assert(g.moveSequenceToTableau(0, 0, 1)); g.undo();
  registerCustomMove('test.rules', {
    apply(st, m, rules) { m.old = rules.moveBonus; rules.moveBonus = 3; st.free.push(0); },
    undo(st, m, rules) { rules.moveBonus = m.old; st.free.pop(); },
  });
  const before = cloneState(g.state), oldRules = structuredClone(g.rules);
  const m = g.applyCharmMove({ t: 'X', op: 'test.rules', voyageAbility: { id: 'test', uses: 1 } });
  assert.equal(g.rules.moveBonus, 3); assert.equal(m.voyageAbility.uses, 1); assert.equal(cleanMove(m).op, 'test.rules');
  g.undo(); assert.deepEqual(g.state, before); assert.deepEqual(g.rules, oldRules);
  registerCustomMove('test.unseal', {
    apply(st, m, rules) { m.oldCols = [...rules.sealedCols]; st.sealed = 0; rules.sealedCols = []; },
    undo(st, m, rules) { rules.sealedCols = m.oldCols; },
  });
  g.state.sealed = 1; g.rules.sealedCols = [0];
  const sealedBefore = cloneState(g.state);
  g.applyCharmMove({ t: 'X', op: 'test.unseal' }); assert.equal(g.state.sealed, 0);
  g.undo(); assert.deepEqual(g.state, sealedBefore); assert.deepEqual(g.rules.sealedCols, [0]);
});
group('auto-play safety for wild ranks, legal spread and foundation-only closure', () => {
  const st = state([[6]], undefined, [5, 5, 5, 1]);
  assert(safeToFoundation(st, 6)); assert(!safeToFoundation(st, 6, { wildRanks: bit(6) }));
  st.found[3] = 5; assert(safeToFoundation(st, 6, { wildRanks: bit(5) }));
  const end = state([[13], [26], [39], [52]], undefined, [12, 12, 12, 12]);
  assert(canFinishWithFoundationOnly(end, { foundationSpread: 1 }));
  assert(shortSolve(end, { rules: { foundationSpread: 1 } }));
  assert(difficultyShortSolve(end, { rules: { foundationSpread: 1 } }));
});
group('seeded composition, complete keys, dealShift and restrict classification', () => {
  defineCharm({ id: 'test.seed', kind: 'challenge', rules(r, ctx) { r.noCellRanks = bit(3 + ctx.rng.int(8)); r.sealedCols = [ctx.idx]; }, dealShift: ({ strength }) => -strength / 2 });
  const args = { challenge: 'test.seed', seed: 'test', idx: 3, strength: 2 };
  assert.deepEqual(composeBoard(args), composeBoard(args)); assert.equal(composeBoard(args).dealShift, -1);
  for (const [k, v] of Object.entries({ moveBonus: 1, emptyFactor: 3, wildRanks: 2, suitBuild: 1, foundationReturn: true, startHome: 1, noCellRanks: 2, noCellCards: [52], barren: { suits: 1, ranks: 2 }, foundationSpread: 3, emptyMinRank: 13, cellThaw: { frozen: 1, at: [8] }, sealedCols: [0], maxHeight: 7, cellColors: ['red'], oneWayCellRanks: 2 })) assert.notEqual(rulesKey({ ...baseRules(), [k]: v }), 'fc4', k);
  assert.equal(rulesKey({ noCellCards: [52, 1] }), rulesKey({ noCellCards: [1, 52] }));
  assert(!hasRestrictions(baseRules())); assert(!hasRestrictions({ ...baseRules(), wildRanks: bit(5), startHome: 1 }));
  assert(hasRestrictions({ ...baseRules(), emptyFactor: 1 }));
});

group('card build tables: wild, anchors, upward suits, shifted ranks and barren precedence', () => {
  for (const [r, pair] of [[{ wildCards: [7] }, [7, 6]], [{ wildCards: [6] }, [7, 6]],
    [{ anchorCards: [7] }, [7, 39]], [{ buildUp: 2 }, [5, 19]], [{ rankShift: { 6: 1 } }, [6, 19]], [{ rankShift: { 19: -1 } }, [6, 19]]]) {
    assert(!canBuildOn(...pair)); assert(canBuildOn(...pair, r));
    assert(canStackOn([pair[0]], pair[1], r)); assert.equal(runLength(pair, r), 2);
    assert.equal(sequenceStart(pair, r), 0); assert(isValidSequence(pair, 2, r));
    const g = gameAt(state([[pair[1]], [pair[0]]]), r);
    assert(g.moveSequenceToTableau(0, 0, 1)); g.undo();
  }
  assert(!canBuildOn(7, 39, { anchorCards: [7], barrenCards: [7] }));
  assert(!canBuildOn(7, 39, { anchorCards: [7], barren: { suits: 1, ranks: bit(7) } }));
  assert(!canBuildOn(5, 32, { buildUp: 2 })); // hearts were not selected
  const g = gameAt(state([[6], [7]]));
  assert(!g.canDropTableau(1, 6)); g.rules.wildCards.push(6); assert(g.canDropTableau(1, 6));
  g.rules.wildCards.pop(); assert(!g.canDropTableau(1, 6));
  const compiled = gameAt(state([[6], [7]]), compileRules({ wildCards: [6] }));
  assert(compiled.canDropTableau(1, 6)); compiled.rules.wildCards.length = 0; assert(!compiled.canDropTableau(1, 6));
  g.state = state([[6], [8]]); g.rules.rankShift[6] = 1;
  assert(!g.canDropTableau(1, 6)); // same colour still matters
  g.state.tableau[1] = [21]; assert(g.canDropTableau(1, 6));
  assert(foundationAccepts(state([[6]], undefined, [5, 0, 0, 0]), 6, { rankShift: { 6: 1 } }));
  assert(!safeToFoundation(state([[6]], undefined, [5, 5, 5, 0]), 6, { anchorCards: [6] }));
  assert(!safeToFoundation(state([[6]], undefined, [5, 5, 5, 0]), 6, { wildCards: [6] }));
  assert(!safeToFoundation(state([[6]], undefined, [5, 5, 5, 5]), 6, { buildUp: 2 }));
  registerCustomMove('test.promotion', {
    apply(st, m, rules) { m.before = structuredClone(rules.rankShift); rules.rankShift[6] = 1; },
    undo(st, m, rules) { rules.rankShift = m.before; },
  });
  g.rules.rankShift = {}; g.state = state([[6], [21]]);
  assert(!g.canDropTableau(1, 6)); g.applyCharmMove({ t: 'X', op: 'test.promotion' });
  assert(g.canDropTableau(1, 6)); g.undo(); assert(!g.canDropTableau(1, 6));
});
group('freeCards, bounded cells, closing capacity and occupied closing cells', () => {
  const r = { noCellRanks: bit(7), noCellCards: [7], cellColors: ['red'], cellLimits: [{ minRank: 9, maxRank: 12 }], oneWayCellRanks: bit(7), freeCards: [7] };
  const st = state([[7], [21]]);
  assert(cellAccepts(st, 0, 7, r)); assert(!cellAccepts(st, 0, 8, r));
  assert(!cellAccepts(st, 0, 21, r)); assert(cellAccepts(st, 0, 23, r));
  const g = gameAt(st, r); assert(g.moveToFreeCell({ kind: 'col', i: 0 }, 0));
  assert(g.moveFreeToTableau(0, 1)); g.undo(); g.undo(); assert.deepEqual(g.state, st);
  assert(!hasRestrictions({ freeCells: 5, cellLimits: [null, null, null, null, { maxRank: 5 }] }));
  assert(hasRestrictions({ cellLimits: [{ minRank: 9 }] }));
  const tide = { cellClose: { at: [8, 20, 32] } };
  const t = gameAt(state([[2]], [0, 0, 0, 13], [1, 2, 2, 2]), tide);
  const before = cloneState(t.state); assert(t.moveToFoundation({ kind: 'col', i: 0 }));
  assert(!cellIsClosed(t.state, 3, tide)); assert.equal(freeCapacity(t.state, tide).freeCells, 3);
  assert(t.moveFreeToTableau(3, 0)); assert(cellIsClosed(t.state, 3, tide));
  assert(!cellAccepts(t.state, 3, 7, { ...tide, freeCards: [7] }));
  assert.equal(freeCapacity(t.state, tide).freeCells, 3);
  t.undo(); assert(!cellIsClosed(t.state, 3, tide)); t.undo(); assert.deepEqual(t.state, before);
  t.state.found = [5, 5, 5, 5]; t.state.free.fill(0);
  assert.equal(freeCapacity(t.state, tide).freeCells, 2); assert.equal(maxMoveSize(t.state, false, { ...tide, emptyFactor: 1 }), 3);
  assert(!safeToFoundation(state([[2]], undefined, [1, 2, 2, 2]), 2, tide));
});
group('empty maximum, empty colours, always-counting columns and suit-mask capacity', () => {
  const r = { emptyMaxRank: 5 };
  assert(canStackOn([], 5, r)); assert(!canStackOn([], 6, r));
  assert.equal(maxMoveSize(state([[7]]), false, r), 5);
  assert.equal(maxMoveSize(state([[7]]), false, { ...r, emptyAlwaysCounts: true }), 5 * 128);
  const st = state([[8, 7, 6], [22]], [10, 11, 12, 13]);
  const g = gameAt(st, { suitBuild: 1, suitRunFree: 1, emptyFactor: 1 });
  assert.equal(maxMoveSize(st, false, g.rules, st.tableau[0]), Infinity);
  assert(g.moveSequenceToTableau(0, 0, 1)); g.undo();
  g.rules.suitRunFree = 2; assert.equal(g.moveSequenceToTableau(0, 0, 1), null);
  const c = gameAt(state([[7], [20]]), { emptyColors: [null, null, 'red'] });
  assert(!c.canDropTableau(2, 7)); assert(c.canDropTableau(2, 20));
  assert.equal(maxMoveSize(c.state, false, c.rules), 5);
  assert.equal(maxMoveSize(c.state, false, { ...c.rules, emptyAlwaysCounts: true }), 5 * 64);
});
group('gate and phase switch legality/capacity in both directions under undo', () => {
  const gate = { gate: { suit: 0, after: 6 } };
  const g = gameAt(state([[1], [16]], undefined, [0, 2, 2, 1]), gate);
  assert(!g.canDropFoundation(1)); assert(g.moveToFoundation({ kind: 'col', i: 1 }));
  assert(g.canDropFoundation(1)); g.undo(); assert(!g.canDropFoundation(1));
  const r = { noCellRanks: bit(13), phase: { at: 8, rules: { noCellRanks: 0, oneWayCellRanks: bit(13), foundationSpread: 3, emptyMaxRank: 5, emptyFactor: 1, moveBonus: -1 } } };
  const p = gameAt(state([[2], [13]], undefined, [1, 2, 2, 2]), r);
  const before = cloneState(p.state);
  assert(!p.canDropFreeCell(0, 13)); assert(p.canDropTableau(2, 13));
  assert(p.moveToFoundation({ kind: 'col', i: 0 }));
  assert(p.canDropFreeCell(0, 13)); assert(!p.canDropTableau(2, 13));
  assert.equal(maxMoveSize(p.state, false, p.rules), 4);
  assert(p.moveToFreeCell({ kind: 'col', i: 1 }, 0)); assert.equal(p.moveFreeToTableau(0, 2), null); p.undo();
  p.undo(); assert.deepEqual(p.state, before); assert(!p.canDropFreeCell(0, 13));
  assert(p.canDropTableau(2, 13)); assert.equal(rulesForState(p.state, p.rules).emptyMaxRank, 0);
  const unsafe = state([[4]], undefined, [3, 3, 3, 0]);
  assert(safeToFoundation(unsafe, 4)); assert(!safeToFoundation(unsafe, 4, { phase: { at: 26, rules: { foundationSpread: 3 } } }));
  const back = gameAt(state([], undefined, [2, 2, 2, 2]), { foundationReturn: true, noCellRanks: bit(2), phase: { at: 8, rules: { noCellRanks: 0 } } });
  assert.equal(back.moveFoundationReturn(0, { kind: 'free', i: 0 }), null, 'return must use the phase after losing a home card');
});
group('new override flags round-trip without bypassing missing cells or run validity', () => {
  const r = { barren: { suits: 2, ranks: bit(7) }, maxHeight: 1, emptyMinRank: 13, emptyMaxRank: 2, cellColors: ['red'], cellLimits: [{ maxRank: 2 }], noCellRanks: bit(6), noCellCards: [6] };
  const st = { ...state([[6], [20]]), sealed: 2 }, g = gameAt(st, r);
  assert.equal(g.moveSequenceToTableau(0, 0, 1), null); g.override = { ignoreRestrictions: true, voyageAbility: { id: 'key', uses: 1 } };
  const m = g.moveSequenceToTableau(0, 0, 1); assert(m.override.ignoreRestrictions); assert.equal(g.override, null);
  g.undo(); assert.deepEqual(g.state, st); assert(g.override.ignoreRestrictions);
  const c = g.moveToFreeCell({ kind: 'col', i: 0 }, 0); assert(c.override.ignoreRestrictions); assert.equal(g.override, null);
  g.undo(); assert(g.override.ignoreRestrictions); assert.deepEqual(g.state, st);
  g.rules.cellClose = { at: [0, 0, 0, 0] }; assert.equal(g.moveToFreeCell({ kind: 'col', i: 0 }, 0), null);
  g.rules.cellClose = null; g.rules.cellThaw = { frozen: 4, at: [52, 52, 52, 52] }; assert.equal(g.moveToFreeCell({ kind: 'col', i: 0 }, 0), null);
  const gap = gameAt(state([[5], [20]])); gap.override = { rankGap: 2 };
  assert(gap.moveSequenceToTableau(0, 0, 1)); assert.equal(gap.override, null); gap.undo(); assert.equal(gap.override.rankGap, 2);
  gap.state.tableau[0] = [6]; assert(gap.moveSequenceToTableau(0, 0, 1)); gap.undo(); // one-rank drops still work
  gap.state.tableau[1] = [7]; assert.equal(gap.moveSequenceToTableau(0, 0, 1), null);
  gap.state.tableau[0] = [5, 3]; gap.state.tableau[1] = [20]; assert.equal(gap.moveSequenceToTableau(0, 0, 1), null);
});
group('dealSkew round-robin layouts, startHome and Game agreement', () => {
  for (const [skew, lengths] of [['slope', [10, 9, 8, 7, 6, 5, 4, 3]], ['valley', [4, 6, 7, 9, 9, 7, 6, 4]], [[12, 8, 8, 8, 4, 4, 4, 4], [12, 8, 8, 8, 4, 4, 4, 4]]]) {
    const r = { dealSkew: skew, sealedCols: [0, 7] }, st = deal(42, r);
    assert.deepEqual(st.tableau.map((c) => c.length), lengths); assert.equal(new Set(st.tableau.flat()).size, 52);
    assert.deepEqual(st, new Game(42, { rules: r }).state);
    assert.deepEqual(deal(42, { ...r, startHome: 2 }).tableau, st.tableau.map((c) => c.filter((id) => rankOf(id) > 2)));
  }
  const r = { startHome: 2, dealSkew: [8, 8, 7, 7, 5, 4, 3, 2] }, st = deal(42, r);
  assert.deepEqual(st.tableau.map((c) => c.length), r.dealSkew); assert.equal(st.tableau.flat().length, 44);
  assert.deepEqual(st.found, [2, 2, 2, 2]); assert.deepEqual(new Game(42, { rules: r }).state, st);
  assert.throws(() => deal(42, { dealSkew: [1, 1] }), /dealSkew/);
});
group('stacked cells, pinned sequences, empty-column cap and colour balance', () => {
  const g = gameAt(state([[7], [8], [22], [20]]), { cellStack: 3 });
  assert.equal(g.moveToFreeCell({ kind: 'col', i: 0 }, 2).fi, 0);
  assert.equal(g.moveToFreeCell({ kind: 'col', i: 1 }, 2).fi, 1);
  assert.equal(g.moveFreeToTableau(0, 3), null);
  assert(g.moveFreeToTableau(1, 2)); g.undo(); g.undo(); g.undo(); assert.deepEqual(g.free, [0, 0, 0, 0]);
  const p = gameAt(state([[7, 19], [21], [1]], undefined, [0, 2, 2, 2]), { pinned: { cards: [7, 1], until: 7 } });
  assert(!p.canMoveSequenceStart(0, 0)); assert(p.canMoveSequenceStart(0, 1));
  assert.equal(p.moveToFreeCell({ kind: 'col', i: 2 }, 0), null); assert.equal(p.moveToFoundation({ kind: 'col', i: 2 }), null);
  p.state.found[3]++; assert(p.canMoveSequenceStart(0, 0));
  const cap = gameAt(state([[6], [20], [13]]), { maxEmpty: 5 });
  assert.equal(cap.moveToFreeCell({ kind: 'col', i: 0 }, 0), null); assert.equal(cap.moveSequenceToTableau(0, 0, 1), null);
  assert(cap.moveSequenceToTableau(0, 0, 3)); cap.undo();
  const end = state([[13], [26], [39], [52]], undefined, [12, 12, 12, 12]);
  assert(canFinishWithFoundationOnly(end, { maxEmpty: 1 }), 'cap permits a proved foundation-only finish');
  const c = gameAt(state([[2], [16]], undefined, [1, 2, 0, 2]), { colorSpread: 1 });
  assert.equal(c.moveToFoundation({ kind: 'col', i: 0 }), null); assert(c.moveToFoundation({ kind: 'col', i: 1 }));
  assert(c.moveToFoundation({ kind: 'col', i: 0 })); c.undo(); c.undo(); assert.deepEqual(c.found, [1, 2, 0, 2]);
});
group('source-dependent cell exits and open columns never create run links', () => {
  const g = gameAt(state([[7], [6]], [5, 0, 0, 0]), { cellExitWild: true });
  assert(g.moveFreeToTableau(0, 1)); g.undo(); assert.equal(g.moveSequenceToTableau(1, 0, 0), null);
  const o = gameAt(state([[7], [12]]), { openCols: 1 });
  assert(o.moveSequenceToTableau(1, 0, 0)); assert.equal(runLength(o.tableau[0], o.rules), 1); o.undo();
  o.rules.barrenCards = [7]; assert.equal(o.moveSequenceToTableau(1, 0, 0), null);
  o.override = { ignoreRestrictions: true }; assert(o.moveSequenceToTableau(1, 0, 0)); o.undo();
  assert(!safeToFoundation(state([[6]], undefined, [5, 5, 5, 0]), 6, { cellExitWild: true }));
  assert(!safeToFoundation(state([[1]]), 1, { openCols: 1, emptyMaxRank: 5 }));
});
group('levels, stickers, post-composition synergy and boss confiscation', () => {
  defineCharm({ id: 'test.level', kind: 'boon', family: 'wild', ease: ({ level }) => level / 10,
    rules(r, ctx) { r.wildCards.push(ctx.level); assert.equal(ctx.family('wild'), 1); },
    rulesAfter(r) { r.anchorCards = [...r.wildCards]; } });
  defineCharm({ id: 'test.late', kind: 'boon', family: 'cells', rules(r) { r.wildCards.push(5); } });
  if (!CHARMS['voyage.stickers']) defineCharm({ id: 'voyage.stickers', kind: 'boon', rules(r, ctx) { r.freeCards = Object.keys(ctx.stickers).map(Number); } });
  defineCharm({ id: 'test.confiscate', kind: 'boss', confiscate(ids) { return ids.at(-1); }, rules(r) { r.freeCells--; } });
  const args = { boons: ['test.level', 'test.late'], levels: { 'test.level': 2 }, stickers: { 7: 'key' } };
  const a = composeBoard(args); assert.equal(a.active[0].level, 2); assert.equal(a.ease, .2);
  assert.deepEqual(a.rules.anchorCards, [2, 5]); assert(a.active.some((a) => a.id === 'voyage.stickers' && a.level === 1));
  const b = composeBoard({ ...args, boss: 'test.confiscate' }); assert.equal(b.confiscated, 'test.late');
  assert(!b.active.some((a) => a.id === 'test.late')); assert.deepEqual(args.boons, ['test.level', 'test.late']);
  const snapshot = baseRules(); snapshot.rankShift[7] = 1; snapshot.wildCards.push(7); assert.deepEqual(baseRules().rankShift, {}); assert.deepEqual(baseRules().wildCards, []);
  for (const [key, value] of Object.entries({ wildCards: [7], anchorCards: [7], freeCards: [7], buildUp: 2, suitRunFree: 1, cellLimits: [{ maxRank: 5 }], emptyMaxRank: 5, cellClose: { at: [16] }, gate: { suit: 0, after: 6 }, dealSkew: 'slope', phase: { at: 26, rules: { foundationSpread: 3 } }, rankShift: { 7: 1 }, emptyAlwaysCounts: true, cellStack: 2, pinned: { cards: [7], until: 12 }, maxEmpty: 2, colorSpread: 3, emptyColors: ['red'], barrenCards: [7], cellExitWild: true, openCols: 1 })) assert.notEqual(rulesKey({ ...baseRules(), [key]: value }), 'fc4', key);
  for (const [key, value] of Object.entries({ cellLimits: [{ minRank: 5 }], emptyMaxRank: 5, cellClose: { at: [16] }, gate: { suit: 0, after: 6 }, dealSkew: 'slope', phase: { at: 26, rules: {} }, cellStack: 2, pinned: { cards: [7], until: 12 }, maxEmpty: 2, colorSpread: 3, emptyColors: ['red'], barrenCards: [7] })) assert(hasRestrictions({ ...baseRules(), [key]: value }), key);
  assert.equal(rulesKey(compileRules({ wildCards: [7, 6] })), rulesKey({ wildCards: [6, 7] }));
});
group('twin stacking, shallow capacity and suit-limited cells', () => {
  assert(canBuildOn(9, 22, { twinStack: 1 })); assert(!canBuildOn(9, 48, { twinStack: 1 }));
  assert(canBuildOn(9, 48, { twinStack: 2 })); assert.equal(runLength([9, 22, 48], { twinStack: 1 }), 3);
  const st = state([[9], [22], [4, 16]], [10, 11, 12, 13]);
  assert.equal(maxMoveSize(st, false, { shallowCols: 1 }), 128); assert.equal(maxMoveSize(st, true, { shallowCols: 1 }), 64);
  assert(!cellAccepts(state(), 0, 7, { cellLimits: [{ suits: 2 }] }));
  assert(cellAccepts(state(), 0, 20, { cellLimits: [{ suits: 2 }] }));
  assert(cellAccepts(state(), 0, 7, { cellLimits: [{ suits: 2 }], freeCards: [7] }));
});
group('Suit Spur plant, split homes, hashes, returns and full reverse replay', () => {
  const initial = state([[7], [4], [5], [6], [8], [9]], undefined, [3, 8, 8, 8]);
  const g = gameAt(initial, { foundationReturn: true });
  assert(canPlantSpur(g.state, 7, g.rules)); assert(!canPlantSpur(g.state, 4, g.rules));
  assert(!canPlantSpur({ ...g.state, found: [3, 3, 3, 3] }, 7, { foundationSpread: 3 }));
  const plant = g.applyCharmMove({ t: 'X', op: 'voyage.spur', src: { kind: 'col', i: 0 }, card: 7 });
  assert.deepEqual(g.state.spur, { suit: 0, base: 7, top: 7 }); assert.equal(cardsHome(g.state), 28);
  assert.notEqual(hashState(g.state), hashState({ ...g.state, spur: undefined }));
  const copy = cloneState(g.state); copy.spur.top = 9; assert.equal(g.state.spur.top, 7);
  assert(cardIsHome(g.state, 7)); assert(!cardIsHome(g.state, 5));
  assert(!g.canDropFoundation(8, 'original')); assert(g.canDropFoundation(8, 'spur'));
  assert(g.moveToFoundation({ kind: 'col', i: 4 }, 'spur')); assert.equal(g.history.at(-1).dest, 'spur');
  assert(g.moveFoundationReturn(0, { kind: 'free', i: 0 }, 'spur')); assert.equal(g.history.at(-1).from, 'spur');
  g.undo(); assert.equal(g.state.spur.top, 8);
  assert(g.moveToFoundation({ kind: 'col', i: 5 })); assert.equal(g.state.spur.top, 9);
  for (const i of [1, 2, 3]) assert(g.moveToFoundation({ kind: 'col', i }));
  assert.equal(g.found[0], 6); assert(!foundationAccepts(g.state, 7, g.rules, 'original'));
  assert(g.canReturnFoundation(0, { kind: 'free', i: 0 }, 'spur'));
  while (g.history.length > 1) g.undo(); assert.equal(g.state.spur.top, 7);
  assert.equal(g.moveFoundationReturn(0, { kind: 'free', i: 0 }, 'spur'), null, 'base cannot return');
  g.undo(); assert.deepEqual(g.state, initial); assert.equal(cleanMove(plant).op, 'voyage.spur');
  const free = gameAt(state([], [13, 0, 0, 0], [11, 13, 13, 13]));
  free.applyCharmMove({ t: 'X', op: 'voyage.spur', src: { kind: 'free', i: 0 } });
  assert.deepEqual(free.state.spur, { suit: 0, base: 13, top: 13 }); free.undo(); assert.equal(free.free[0], 13);
  const end = { ...state([[13], [26], [39], [52], [6]], undefined, [5, 12, 12, 12]), spur: { suit: 0, base: 7, top: 12 } };
  assert(canFinishWithFoundationOnly(end));
  const result = solve(end, { timeLimitMs: 1000, attemptLimit: 1, fullOnly: false }); assert.equal(result.solvable, true);
  const sim = gameAt(end);
  for (const m of result.solution) { assert(foundationAccepts(sim.state, m.card, sim.rules, m.dest)); sim.applyDescriptor(m); }
  assert(isSolved(sim.state)); assert.equal(cardsHome(sim.state), 52); assert.equal(sim.found[0], 6); assert.equal(sim.state.spur.top, 13);
  assert(shortSolve(end)); assert(difficultyShortSolve(end));
  for (const m of generateMoves(end, { rules: { foundationReturn: true } })) roundtrip(end, structuredClone(m), { foundationReturn: true });
});
group('multiple theme challenges compose in order before the boss', () => {
  defineCharm({ id: 'test.extra', kind: 'challenge', rules(r, ctx) { r.moveBonus += ctx.strength; } });
  defineCharm({ id: 'test.orderboss', kind: 'boss', rules(r) { r.moveBonus *= 2; } });
  assert.equal(composeBoard({ extraChallenges: ['test.extra'], boss: 'test.orderboss', strength: 3 }).rules.moveBonus, 6);
  assert.equal(composeBoard({ extraChallenges: [{ id: 'test.extra', strength: 4 }], boss: 'test.orderboss', strength: 3 }).rules.moveBonus, 8);
});
group('new bosses: phases, tide thresholds, strongest-boon ties and tag exclusion', () => {
  // Load real boss definitions without relying on the full content roster's migration state.
  assert(CHARMS['boss.eclipse']);
  const eclipse = composeBoard({ boss: 'boss.eclipse', strength: 7 }).rules;
  assert.equal(eclipse.phase.at, 26); assert(eclipse.noCellRanks & bit(13)); assert.equal(eclipse.phase.rules.noCellRanks, 0);
  assert.deepEqual(composeBoard({ boss: 'boss.hightide' }).rules.cellClose.at, [16, 28, 40]);
  defineCharm({ id: 'test.weak', kind: 'boon', ease: .1 });
  defineCharm({ id: 'test.strong', kind: 'boon', ease: .5 });
  defineCharm({ id: 'test.tie', kind: 'boon', ease: .5 });
  defineCharm({ id: 'test.ability', kind: 'boon', ease: 0, ability: {} });
  assert.equal(composeBoard({ boss: 'boss.auditor' }).confiscated, null);
  assert.equal(composeBoard({ boss: 'boss.auditor', boons: ['test.strong', 'test.tie'] }).confiscated, 'test.tie');
  assert.equal(composeBoard({ boss: 'boss.auditor', boons: ['test.weak', 'test.ability'] }).confiscated, 'test.ability');
  const auditor = composeBoard({ boss: 'boss.auditor', boons: ['test.strong', 'test.weak'] });
  assert.equal(auditor.confiscated, 'test.strong'); assert.equal(auditor.ease, .1); assert.equal(auditor.rules.freeCells, 3);
  for (const id of ['boss.eclipse', 'boss.auditor', 'boss.hightide']) {
    assert(CHARMS[id].tags.includes('CELLS')); assert(CHARMS[id].tell); assert.equal(typeof CHARMS[id].boonRelation, 'function');
  }
});

group('52-theme placement, links, capacity, shutters and singleton exits', () => {
  for (const n of [1, 2]) {
    const r = { loneAccepts: n }, col = n === 1 ? [8] : [9, 8];
    assert(canStackOn(col, 13, r)); assert(!canBuildOn(8, 13, r));
    assert.equal(runLength([...col, 13], r), 1); assert(!isValidSequence([...col, 13], 2, r));
    assert(!canStackOn(col, 13, { ...r, barrenCards: [8] }));
    const g = gameAt(state([[13], col]), r); assert(g.moveSequenceToTableau(0, 0, 1)); g.undo();
    assert(!canPlaceTableau({ ...g.state, sealed: 2 }, 1, 13, 1, r));
  }
  for (const skipBuild of [1, 2]) {
    const r = { skipBuild };
    assert(canBuildOn(9, 7, r)); assert.equal(canBuildOn(9, 20, r), skipBuild === 2);
    assert(canStackOn([9], 20, r, {rankGap:2}), 'skip help must preserve a rank-gap ability');
    assert.equal(runLength([9, 7, 5], r), 3); assert.equal(sequenceStart([9, 7, 5], r), 0);
    assert(isValidSequence([9, 7, 5], 3, r)); assert(!canBuildOn(9, 6, r));
    assert(!safeToFoundation(state([[9], [46]], [], [8, 8, 8, 0]), 9, r), 'skip dependents disable auto-home');
  }
  const crowded = state([[9, 21, 7], [23], [11], [12], [13], [14], [15], [16]], [4, 17, 30, 43]);
  assert.equal(maxMoveSize(crowded, false, { fullCellsBonus: 2 }), 3);
  assert.equal(maxMoveSize(crowded, false, { fullCellsBonus: 3 }), 4);
  const g = gameAt(crowded, { fullCellsBonus: 2 }); assert(g.moveSequenceToTableau(0, 0, 1)); g.undo();
  crowded.free[3] = 0; assert.equal(maxMoveSize(crowded, false, { fullCellsBonus: 2 }), 2);
  assert.equal(maxMoveSize(crowded, false, { fullCellsBonus: 2, cellThaw: {frozen:1,at:[9]} }), 3);
  const wet = state([[2]], undefined, [1, 1, 1, 1]), cure = { emptyCure: 5 };
  assert.equal(freeCapacity(wet, cure).emptyCols, 0); assert.equal(maxMoveSize(wet, false, cure), 5);
  assert(!canPlaceTableau(wet, 1, 2, 1, cure));
  const curing = gameAt(wet, cure); assert(curing.moveToFoundation({kind:'col',i:0}));
  assert(canPlaceTableau(curing.state, 1, 13, 1, cure)); curing.undo(); assert(!canPlaceTableau(curing.state, 1, 13, 1, cure));
  assert(!canReturnFoundation({ ...wet, found: [2, 1, 1, 1] }, 0, {kind:'col',i:1}, { ...cure, foundationReturn: true }));
  const shut = state(Array.from({length:8}, (_,i) => [i + 1]));
  for (const k of [1,2]) {
    assert(!cellIsOpen(shut, 3, {cellsNeedEmpty:k})); assert.equal(freeCapacity(shut, {cellsNeedEmpty:k}).freeCells, 4-k);
    assert(!cellAccepts(shut, 3, 8, {cellsNeedEmpty:k,freeCards:[8]}, 0, {ignoreRestrictions:true}));
    const occupied = cloneState(shut); occupied.free[3] = 19; occupied.tableau[1] = [7];
    assert(gameAt(occupied, {cellsNeedEmpty:k}).moveFreeToTableau(3, 1));
  }
  shut.tableau[7] = []; assert(cellIsOpen(shut, 3, {cellsNeedEmpty:2}));
  const cast = {sameColorRanks:bit(12)};
  assert(canBuildOn(13,12,cast)); assert(!canBuildOn(13,25,cast));
  assert(canBuildOn(13,25,{...cast,wildCards:[25]})); assert(canBuildOn(13,25,{...cast,wildRanks:bit(13)}));
  assert(canBuildOn(13,12,{...cast,suitBuild:1})); assert.equal(runLength([13,12],cast),2);
  const trapped = gameAt(state([[6],[20]]), {noExitCols:1});
  assert.equal(trapped.moveToFreeCell({kind:'col',i:0},0),null); assert.equal(trapped.moveSequenceToTableau(0,0,1),null);
  trapped.state.found[0]=5; assert(trapped.moveToFoundation({kind:'col',i:0})); trapped.undo();
  assert(gameAt(state([[7,19],[21]])).moveSequenceToTableau(0,0,1));
  const fullRun=gameAt(state([[7,19],[21]]),{noExitCols:1});
  assert.equal(fullRun.moveSequenceToTableau(0,0,1),null, 'a full run cannot bypass the last-card exit');
  trapped.tableau[0].unshift(9); assert(trapped.moveToFreeCell({kind:'col',i:0},0)); trapped.undo();
  for (const field of ['loneAccepts','skipBuild','fullCellsBonus','emptyCure','cellsNeedEmpty','sameColorRanks','noExitCols']) {
    assert.notEqual(rulesKey({[field]:1}),rulesKey({}));
    assert.equal(hasRestrictions({[field]:1}), ['emptyCure','cellsNeedEmpty','sameColorRanks','noExitCols'].includes(field));
  }
});

// Dealer tests inject the verifier, checking control flow without expensive searches.
setBank({ tiers: [[{ d: 8, mc: 3, m: 40, b: 0, s: 10 }, { d: 13, mc: 3, m: 40, b: 0, s: 20 }, { d: 31, mc: 3, m: 40, b: 0, s: 30 }]], tierCuts: [] });
const plan = { idx: 0, theme: 'test', tier: 1, strength: 2, challenge: 'test.seed', ...composeBoard({ challenge: 'test.seed', seed: 'dealer' }) };
assert.notEqual(planKey(plan, 'd'), planKey({ ...plan, dealShift: -1 }, 'd'));
assert.notEqual(planKey(plan, 'd'), planKey({ ...plan, rules: { ...plan.rules, maxHeight: 7 } }, 'd'));
assert(Math.abs(blendedScore({ mc: 3, s: 10 }, { rules: baseRules(), dealShift: -.5 }) - blendedScore({ mc: 3, s: 10 }, { rules: baseRules() }) - 20 / 7 / 2) < 1e-10);
let tried = [];
const verified = await dealFor(plan, { seed: 'dealer', verifier: async (n) => { tried.push(n); return { solvable: tried.length === 2 ? true : null }; } });
assert(verified.verified); assert.equal(tried.length, 2); assert.notEqual(tried[0], tried[1]);
const relaxed = await dealFor(plan, { seed: 'relax', candidates: 1, verifier: async (_, rules) => ({ solvable: rules.sealedCols?.length ? null : true }) });
assert(relaxed.verified); assert(relaxed.relaxed); assert.equal(relaxed.strength, 0);
await assert.rejects(dealFor({ ...plan, challenge: null }, { seed: 'fail', candidates: 1, verifier: async () => ({ solvable: null }) }), /No verified/);
defineCharm({ id: 'test.help', kind: 'boon', rules(r) { r.freeCells++; } });
const withoutBoons = await dealFor({ ...plan, ...composeBoard({ boons: ['test.help'], challenge: 'test.seed', seed: 'no-boons' }) }, { seed: 'no-boons', verifier: async (_, rules) => { assert.equal(rules.freeCells, 4); return { solvable: true }; } });
assert.equal(withoutBoons.rules.freeCells, 5);
defineCharm({ id: 'test.storm', kind: 'challenge', rules(r, ctx) { r.gate = { suit: 0, after: ctx.strength * 6 }; } });
const stormPlan = { ...plan, extraChallenges: ['test.storm'], ...composeBoard({ challenge: 'test.seed', extraChallenges: ['test.storm'], strength: 2, seed: 'storm' }) };
let sawStorm = false;
const stormPick = await dealFor(stormPlan, { seed: 'storm', candidates: 1, verifier: async (_, rules) => { sawStorm ||= !!rules.gate; return { solvable: rules.gate?.after <= 6 }; } });
assert(sawStorm); assert(stormPick.relaxed); assert.equal(stormPick.rules.gate.after, 6);
const confiscatedPlan = { ...plan, challenge: null, boss: 'boss.auditor', strength: 7, levels: { 'test.strong': 2 }, stickers: { 7: 'key' },
  ...composeBoard({ boss: 'boss.auditor', boons: ['test.strong', 'test.weak'], levels: { 'test.strong': 2 }, stickers: { 7: 'key' } }) };
const relentedAuditor = await dealFor(confiscatedPlan, { seed: 'auditor-relent', candidates: 1, verifier: async (_, rules) => ({ solvable: rules.freeCells === 4 }) });
assert.equal(relentedAuditor.confiscated, null); assert(relentedAuditor.active.some((a) => a.id === 'test.strong' && a.level === 2));
assert(relentedAuditor.active.some((a) => a.id === 'voyage.stickers'));
for (const field of ['emptyCure','cellsNeedEmpty','sameColorRanks','noExitCols']) {
  const restricted = {...plan, challenge:null, active:[], rules:{...baseRules(),[field]:field === 'sameColorRanks' ? bit(12) : 1}};
  assert.equal(pickDeal(restricted, {seed:field}).verified,false);
  let calls=0;
  const result=await dealFor(restricted,{seed:field,verifier:async (_n,r)=>{calls++;assert.equal(r[field],restricted.rules[field]);return {solvable:true};}});
  assert(calls > 0 && result.verified);
}
console.log('✓ dealer candidate loop rejects unknowns, verifies fallback and never bypasses verification');
defineCharm({
  id: 'test.dealrules', kind: 'challenge', tags: ['CELLS'],
  rules() {},
  dealRules(r, ctx) { r.noCellCards = [...(r.noCellCards || []), ctx.state.tableau[0][0]]; },
});
{
  const composed = composeBoard({ challenge: 'test.dealrules', seed: 'deal-rules' });
  const dealPlan = { idx: 0, theme: 'test', tier: 1, strength: 2, challenge: 'test.dealrules', seed: 'deal-rules', ...composed };
  assert(hasDealRules(dealPlan.active));
  assert.equal((dealPlan.rules.noCellCards || []).length, 0);
  assert.equal(pickDeal(dealPlan, { seed: 'deal-rules' }).verified, false);
  const seen = [];
  const dealPick = await dealFor(dealPlan, { seed: 'deal-rules', candidates: 3, verifier: async (n, rules) => {
    const st = deal(n, dealPlan.rules);
    assert.equal(rules.noCellCards[0], st.tableau[0][0], 'verifier must see dealRules restrictions');
    seen.push(n);
    return { solvable: true };
  } });
  assert(seen.length >= 1); assert(dealPick.verified);
  assert.equal(dealPick.rules.noCellCards[0], deal(dealPick.deal, dealPlan.rules).tableau[0][0]);
  assert.deepEqual(applyDealRules(dealPlan.rules, dealPlan, dealPick.deal).noCellCards, dealPick.rules.noCellCards);
  console.log('✓ dealer verifies each candidate under dealRules');
}

// Every generated move is legal to the player and every move is reversible.
const agreementRules = [baseRules(), { wildRanks: bit(5) }, { suitBuild: 1 }, { barren: { suits: 1, ranks: 16382 } }, { noCellRanks: bit(13) }, { noCellCards: [20, 52] }, { cellColors: ['red', 'black', null, 'red'] }, { sealedCols: [0, 2] }, { cellThaw: { frozen: 2, at: [8, 20] } }, { emptyMinRank: 9 }, { maxHeight: 7 }, { foundationSpread: 3 }, { moveBonus: -2 }, { emptyFactor: 1 }, { foundationReturn: true, startHome: 2 },
  { wildCards: [6, 20] }, { anchorCards: [6, 20] }, { freeCards: [6, 20], noCellRanks: bit(6), oneWayCellRanks: bit(7) }, { buildUp: 6 }, { suitBuild: 1, suitRunFree: 1, emptyFactor: 1 },
  { cellLimits: [{ maxRank: 5 }, { minRank: 9 }, { minRank: 3, maxRank: 8 }] }, { emptyMaxRank: 7 }, { cellClose: { at: [2, 6, 12] } }, { gate: { suit: 0, after: 6 } }, { dealSkew: 'slope' },
  { phase: { at: 3, rules: { noCellRanks: bit(13), emptyFactor: 1, moveBonus: -1, emptyMaxRank: 7, oneWayCellRanks: bit(6), gate: { suit: 0, after: 6 } } } }, { rankShift: { 6: 1, 20: -1 } },
  { emptyMinRank: 7, emptyAlwaysCounts: true }, { cellStack: 3 }, { pinned: { cards: [6, 20], until: 12 } }, { maxEmpty: 2 }, { colorSpread: 3 }, { emptyColors: ['red', 'black', null, 'red'] }, { barrenCards: [6, 20] }, { cellExitWild: true }, { openCols: 5 },
  { loneAccepts: 1 }, { loneAccepts: 2 }, { skipBuild: 1 }, { skipBuild: 2 }, { fullCellsBonus: 2 }, { emptyCure: 6 }, { cellsNeedEmpty: 1 }, { cellsNeedEmpty: 2 }, { sameColorRanks: bit(12) | bit(11) }, { noExitCols: 5 }, { emptyCure: 6, cellsNeedEmpty: 2, noExitCols: 255, loneAccepts: 1, skipBuild: 1, fullCellsBonus: 3, sameColorRanks: bit(12) },
  { twinStack: 1 }, { twinStack: 2 }, { shallowCols: 1 }, { cellLimits: [{ suits: 2 }] }];
for (const rules of agreementRules) {
  const g = new Game(8, { rules });
  for (let step = 0; step < 20; step++) {
    const moves = generateMoves(g.state, { rules: g.rules });
    for (const m of moves) {
      roundtrip(g.state, structuredClone(m), g.rules);
      const before = cloneState(g.state);
      let played = m.t === 'F' ? g.moveToFoundation(m.src) : m.t === 'C' ? g.moveToFreeCell(m.src, m.fi)
        : m.t === 'R' ? g.moveFoundationReturn(m.suit, m.to, m.from) : m.src.kind === 'free'
          ? g.moveFreeToTableau(m.src.i, m.to) : g.moveSequenceToTableau(m.src.i, g.tableau[m.src.i].length - m.count, m.to);
      assert(played, `generated ${m.t} must be legal: ${JSON.stringify(rules)}`);
      g.undo(); assert.deepEqual(g.state, before);
    }
    if (!moves.length) break;
    g.applyDescriptor(moves.sort((a, b) => b.score - a.score)[0]);
  }
}
console.log(`✓ generator/player agreement and undo over ${agreementRules.length} rulesets`);

// Fresh full decks, two reproducible wins per new restriction. Replay through the checked
// player API rather than trusting unchecked applyMove, then undo the whole solution.
const restrictedDeals = [
  [{ emptyCure: 6 }, [8, 13]], [{ cellsNeedEmpty: 1 }, [8, 13]], [{ sameColorRanks: bit(12) }, [8, 2]], [{ noExitCols: 3 }, [8, 13]],
  [{ cellLimits: [{ maxRank: 5 }] }, [8, 13]], [{ cellLimits: [{ minRank: 9 }] }, [8, 13]], [{ cellLimits: [{ suits: 2 }] }, [8, 13]],
  [{ emptyMaxRank: 12 }, [8, 13]], [{ cellClose: { at: [16, 28, 40] } }, [8, 13]],
  [{ gate: { suit: 0, after: 12 } }, [8, 438192]], [{ dealSkew: 'slope' }, [8, 13]],
  [{ noCellRanks: bit(11) | bit(12) | bit(13), phase: { at: 26, rules: { noCellRanks: 0, foundationSpread: 3 } } }, [8, 13]],
  [{ cellStack: 4 }, [8, 13]], [{ pinned: { cards: [7], until: 12 } }, [8, 13]],
  [{ maxEmpty: 2 }, [8, 13]], [{ colorSpread: 3 }, [8, 13]], [{ emptyColors: ['red', 'red', 'red', 'red'] }, [8, 13]], [{ barrenCards: [7, 20] }, [8, 13]],
];
for (const [rules, deals] of restrictedDeals) for (const n of deals) {
  const g = new Game(n, { rules }), initial = cloneState(g.state);
  const result = solve(initial, { rules, fullOnly: false, perRunNodes: 6000, perRunMs: 100000, timeLimitMs: 10000,
    attemptLimit: 6, maxDepth: 320, rng: stream(n, 'restriction-check') });
  assert.equal(result.solvable, true, `verify #${n} ${JSON.stringify(rules)}`);
  for (const m of result.solution) {
    const played = m.t === 'F' ? g.moveToFoundation(m.src, m.dest) : m.t === 'C' ? g.moveToFreeCell(m.src, m.fi)
      : m.src.kind === 'free' ? g.moveFreeToTableau(m.src.i, m.to)
        : g.moveSequenceToTableau(m.src.i, g.tableau[m.src.i].length - m.count, m.to);
    assert(played, `solver move must be player-legal: ${JSON.stringify(m)} under ${JSON.stringify(rules)}`);
  }
  assert(g.isWon()); while (g.history.length) g.undo(); assert.deepEqual(g.state, initial);
}
console.log(`✓ ${restrictedDeals.length * 2} restricted full-deck solutions replay and undo through Game`);

// Worker protocols are exercised under Node by providing the worker's standard self shim.
const workerReplies = [];
globalThis.self = { postMessage: (m) => workerReplies.push(m) };
await import('../js/voyage/dealer.worker.js');
self.onmessage({ data: { id: 1, deal: 8, rules: { freeCells: 5, startHome: 13 } } });
assert.equal(workerReplies.at(-1).result.solvable, true); assert.equal(workerReplies.at(-1).result.nodes, 1);
for (const field of ['loneAccepts','skipBuild','fullCellsBonus','emptyCure','cellsNeedEmpty','sameColorRanks','noExitCols']) {
  self.onmessage({data:{id:field,deal:8,rules:{freeCells:4,startHome:12,[field]:field==='sameColorRanks'?bit(12):1},options:{timeLimitMs:1000}}});
  assert.equal(workerReplies.at(-1).result.solvable,true,`dealer worker ${field}`);
}

await import('../js/solver.worker.js');
self.onmessage({ data: { id: 2, state: state([[4]], [], [3, 1, 1, 1]), rules: { foundationSpread: 2, emptyMinRank: 13 }, options: { fullOnly: false, timeLimitMs: 500 } } });
assert.equal(workerReplies.at(-1).result.solvable, false);
delete globalThis.self;
console.log('✓ dealer and hint solver worker protocols use full rules');

const baseline = JSON.parse(readFileSync(new URL('./rules-classic-baseline.json', import.meta.url)));
const realClock = Date.now;
try {
  for (const row of baseline) {
    let tick = 0; Date.now = () => ++tick; // one deterministic bounded pass, independent of host load
    const r = solve(deal(row.deal), { timeLimitMs: 2, perRunMs: 100000, perRunNodes: row.deal <= 30 ? 50000 : 2000, jitter: 0 });
    assert.equal(r.solvable, row.solvable, `classic verdict #${row.deal}`);
    assert.equal(r.nodes, row.nodes, `classic nodes #${row.deal}`);
    assert.deepEqual(r.solution, row.solution, `classic path #${row.deal}`);
  }
} finally { Date.now = realClock; }
console.log(`✓ classic baseline: exact verdict/nodes/path on ${baseline.length} deals (${baseline.filter((r) => r.solvable).length} solved)`);
console.log('rules-check passed');
