// Pure Node regression checks for the solver-visible Voyage rules kernel.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  Game, deal, cloneState, applyMove, undoMove, generateMoves, solve, hashState,
  canStackOn, canBuildOn, foundationAccepts, cellAccepts, activeFreeCells, maxMoveSize,
  runLength, sequenceStart, isValidSequence, safeToFoundation, safeFoundationMoves,
  canFinishWithFoundationOnly, registerCustomMove, cleanMove, cardId, rankOf, compileRules,
} from '../js/rules.js';
import { baseRules, rulesKey, composeBoard, hasRestrictions } from '../js/voyage/boardrules.js';
import { CHARMS, defineCharm } from '../js/voyage/registry.js';
import { setBank, dealFor, pickDeal, planKey, blendedScore } from '../js/voyage/dealer.js';
import { shortSolve } from '../js/shortsolve.js';
import { shortSolve as difficultyShortSolve } from '../js/difficulty.js';

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
  assert.equal(Object.keys(baseRules()).length, 17);
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
console.log('✓ dealer candidate loop rejects unknowns, verifies fallback and never bypasses verification');

// Every generated move is legal to the player and every move is reversible.
for (const rules of [baseRules(), { wildRanks: bit(5) }, { suitBuild: 1 }, { barren: { suits: 1, ranks: 16382 } }, { noCellRanks: bit(13) }, { noCellCards: [20, 52] }, { cellColors: ['red', 'black', null, 'red'] }, { sealedCols: [0, 2] }, { cellThaw: { frozen: 2, at: [8, 20] } }, { emptyMinRank: 9 }, { maxHeight: 7 }, { foundationSpread: 3 }, { moveBonus: -2 }, { emptyFactor: 1 }, { foundationReturn: true, startHome: 2 }]) {
  const g = new Game(8, { rules });
  for (let step = 0; step < 20; step++) {
    const moves = generateMoves(g.state, { rules: g.rules });
    for (const m of moves) {
      roundtrip(g.state, structuredClone(m), g.rules);
      const before = cloneState(g.state);
      let played = m.t === 'F' ? g.moveToFoundation(m.src) : m.t === 'C' ? g.moveToFreeCell(m.src, m.fi)
        : m.t === 'R' ? g.moveFoundationReturn(m.suit, m.to) : m.src.kind === 'free'
          ? g.moveFreeToTableau(m.src.i, m.to) : g.moveSequenceToTableau(m.src.i, g.tableau[m.src.i].length - m.count, m.to);
      assert(played, `generated ${m.t} must be legal: ${JSON.stringify(rules)}`);
      g.undo(); assert.deepEqual(g.state, before);
    }
    if (!moves.length) break;
    g.applyDescriptor(moves.sort((a, b) => b.score - a.score)[0]);
  }
}
console.log('✓ generator/player agreement and undo over 15 rulesets');

// Worker protocols are exercised under Node by providing the worker's standard self shim.
const workerReplies = [];
globalThis.self = { postMessage: (m) => workerReplies.push(m) };
await import('../js/voyage/dealer.worker.js');
self.onmessage({ data: { id: 1, deal: 8, rules: { freeCells: 5, startHome: 13 } } });
assert.equal(workerReplies.at(-1).result.solvable, true); assert.equal(workerReplies.at(-1).result.nodes, 1);
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
