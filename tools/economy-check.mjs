#!/usr/bin/env node
// Pure Node coverage of the run economy, including a complete seven-board voyage.
import assert from 'node:assert/strict';
import { createRun, startBoard, winBoard, pickCharm, runView, boardPlan, upcomingPlans, refreshMap, boardOffers, concedeBoard, saveRun, loadRun, RUN_VERSION } from '../js/voyage/run.js';
import { createMap, chooseNode, nextChoices, mapView } from '../js/voyage/map.js';
import { CHARMS, defineCharm, BoardEffects, boonsForTheme, baseRules, composeBoard } from '../js/voyage/charms.js';
import { ScoreBreakdown, scoreBoard } from '../js/voyage/scoring.js';
import { createPort, buyBoon, buySticker, upgradeBoon, buyUndo, sellBoon, rerollPort, leavePort, portService, portPrice, economy, spendCoins } from '../js/voyage/port.js';
import { VOYAGE } from '../js/voyage/config.js';
import { Game, cardId, cloneState, cellAccepts, canBuildOn } from '../js/rules.js';
import { planKey } from '../js/voyage/dealer.js';
import { voyageStats, recordEconomy, resetVoyageStats } from '../js/voyage/stats.js';

const copy = (value) => JSON.parse(JSON.stringify(value));
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) };
const group = (name, fn) => { fn(); console.log(`✓ ${name}`); };
const testIds = [];
function testCharm(id, extra = {}) {
  testIds.push(id);
  return defineCharm({ id, kind: 'boon', family: 'coin', theme: 'roman', name: id, icon: '✧', text: `${id} level one`, upgrade: `${id} level two`, ...extra });
}
const state = (tableau, found = [0, 0, 0, 0]) => ({ tableau: Array.from({ length: 8 }, (_, i) => [...(tableau[i] || [])]), free: [0, 0, 0, 0], found: [...found] });

// A real one-move endgame, avoiding solver/dealer timing in the run-flow checks.
function finishBoard(run, node = nextChoices(run.map)[0], effectsFactory = null) {
  const cur = startBoard(run, node.id, { deal: 1, par: 1, rules: baseRules() });
  const game = new Game(1, { rules: cur.rules });
  cur.initial = state([[cardId(0, 13)]], [12, 13, 13, 13]);
  game.state = cloneState(cur.initial);
  const effects = effectsFactory?.(cur, game) || null;
  assert(game.applyDescriptor({ t: 'F', card: cardId(0, 13), src: { kind: 'col', i: 0 } }));
  assert(game.isWon());
  return winBoard(run, game.history, effects, { elapsed: 12 });
}
function docked({ seed = 'economy-port', boons = [], idx = 3, coins = 500 } = {}) {
  const run = createRun({ seed });
  run.status = 'port'; run.boons = [...boons]; run.coins = coins;
  run.economy.coinsEarned = coins;
  run.results = [{ idx, total: 100, stars: 1 }];
  createPort(run);
  return run;
}
function unchanged(run, action) {
  const before = copy(run);
  assert.equal(action(), false);
  assert.deepEqual(run, before, 'Failed action must be atomic');
}

group('coin lines, base formula, held coins/boardUndos hooks and single payout', () => {
  const sb = new ScoreBreakdown({});
  sb.add('score', 'Score', 20).mult('Double score', 2).addCoins('gold', 'Gold', 5).addCoins('fee', 'Fee', -2);
  assert.equal(sb.coinTotal, 3); assert.equal(sb.total, 40);
  assert.deepEqual(sb.toJSON().coinLines, [{ key: 'gold', label: 'Gold', coins: 5 }, { key: 'fee', label: 'Fee', coins: -2 }]);
  testCharm('economy.double', { score: (sb) => sb.addCoins('bonus', 'Hook coins', 7), coins: (n, ctx) => { assert.equal(ctx.level, 2); assert.equal(ctx.family('coin'), 1); return n * 2; }, boardUndos: (n) => n - 2 });
  const run = createRun({ seed: 'formula' }); run.boons = ['economy.double']; run.levels['economy.double'] = 2;
  const undos = run.undos;
  const result = finishBoard(run, undefined, (cur, game) => new BoardEffects(cur.active, { seed: run.seed, boardIndex: cur.idx, run, memo: cur.memo, api: { state: game.state, rules: game.rules, history: game.history } }));
  const expected = 2 * (VOYAGE.coins.base + VOYAGE.coins.perStar * result.stars + Math.floor(result.total / VOYAGE.coins.perPoints) + 7);
  assert.equal(result.coins, expected); assert.equal(run.coins, expected);
  assert.equal(result.coinLines.reduce((n, l) => n + l.coins, 0), result.coins);
  assert.equal(run.undos, undos + 1);
  assert.throws(() => winBoard(run, [], null), /winBoard in status/);
  testCharm('economy.zero', { coins: () => -10 });
  const zero = createRun({ seed: 'zero' }); zero.boons = ['economy.zero'];
  const zr = finishBoard(zero);
  assert.equal(zr.coins, 0); assert.equal(zr.coinLines.reduce((n, l) => n + l.coins, 0), 0);
});

group('markets fall after boards 2, 4 and 6 on every route', () => {
  const marketRows = new Set(VOYAGE.markets.map((market) => market.afterBoard - 1));
  for (let seed = 0; seed < 200; seed++) {
    const map = createMap(`harbours-${seed}`);
    assert.deepEqual(map, createMap(`harbours-${seed}`));
    for (let row = 0; row < VOYAGE.boards; row++) {
      const choices = nextChoices(map);
      if (marketRows.has(row)) assert(choices.every((n) => n.port), `Board ${row + 1} always docks`);
      else assert(choices.every((n) => !n.port));
      for (const node of Object.values(map.nodes)) {
        assert.equal(node.port, marketRows.has(node.row));
        assert.equal(typeof node.storm, 'boolean');
        if (node.port || node.row === 0 || node.row === 6) assert.equal(node.storm, false);
        if (node.storm) {
          const own = CHARMS[Object.values(CHARMS).find((c) => c.kind === 'challenge' && c.theme === node.theme).id];
          const second = CHARMS[node.stormChallenge];
          assert(second && second.theme !== own.theme);
          assert(!second.tags.some((tag) => own.tags.includes(tag)));
        }
        if (!node.links.length) continue;
        const children = node.links.map((id) => map.nodes[id]);
        assert(children.every((child) => child.port === marketRows.has(child.row)));
      }
      assert(mapView(map).flat().every((n) => typeof n.port === 'boolean'));
      chooseNode(map, choices[(seed + row) % choices.length].id);
    }
  }
});

group('storm nodes compose two challenges, double earned coins and offer three boons', () => {
  const run = createRun({ seed: 'storm-flow' });
  const node = nextChoices(run.map).find((n) => !n.port);
  assert(node);
  const own = Object.values(CHARMS).find((c) => c.kind === 'challenge' && c.theme === node.theme);
  const second = Object.values(CHARMS).find((c) => c.kind === 'challenge' && c.theme !== node.theme && !c.tags.some((tag) => own.tags.includes(tag)));
  node.storm = true; node.stormChallenge = second.id;
  const plan = boardPlan(run, node.theme);
  assert.equal(plan.active.filter((a) => a.kind === 'challenge').length, 2);
  assert.deepEqual(plan.extraChallenges, [second.id]);
  const composed = composeBoard({ boons: run.boons, challenge: own.id, extraChallenges: [second.id], strength: plan.strength, boonStrength: 2, seed: run.seed, idx: 1, runMemo: run.charmMemo });
  assert.deepEqual(plan.rules, composed.rules);
  const mapped = runView(run).map.flat().find((n) => n.id === node.id);
  assert(mapped.storm); assert.equal(mapped.stormChallenge.id, second.id);
  const result = finishBoard(run, node, () => ({ score() {}, offers: () => 1, starCap: () => 1, thresholds: (arr) => arr }));
  assert.equal(result.stars, 1); assert(result.storm);
  assert.equal(run.reward.offers.length, 3);
  assert.equal(result.coins, 2 * (VOYAGE.coins.base + VOYAGE.coins.perStar + Math.floor(result.total / VOYAGE.coins.perPoints)));
  assert.equal(result.coinLines.reduce((sum, l) => sum + l.coins, 0), result.coins);
  const cur = runView(run).current;
  assert.equal(cur.stormChallenge.id, second.id); assert.equal(cur.extraChallenges.length, 1);
});

group('port seeding, hidden filtering, purchases, insufficient funds and limits', () => {
  testCharm('economy.pick', { onPick: (run, ctx) => { assert.equal(ctx.level, 1); ctx.api.addUndos(8); ctx.api.addCoins(3); ctx.runMemo.picked = true; } });
  const run = docked();
  assert.deepEqual(run.port, docked().port);
  assert.equal(run.port.kind, 'boons');
  assert.equal(run.port.boons.length, 3); assert.equal(run.port.stickers.length, 0);
  assert(run.port.boons.every((o) => !CHARMS[o.id].hidden && !run.boons.includes(o.id)));
  run.port.boons[0] = { id: 'economy.pick', sold: false };
  const poor = copy(run); poor.coins = 0;
  unchanged(poor, () => buyBoon(poor, 'economy.pick'));
  unchanged(poor, () => buySticker(poor, 0, 1));
  unchanged(run, () => buySticker(run, 0, 1));
  unchanged(run, () => upgradeBoon(run, 'economy.pick'));
  unchanged(poor, () => buyUndo(poor));
  unchanged(poor, () => rerollPort(poor));
  const undos = run.undos, coins = run.coins;
  assert(buyBoon(run, 'economy.pick', { addUndos: () => { throw new Error('Run-level grants must bypass the board cap'); } }));
  assert.equal(run.undos, undos + 8); assert.equal(run.coins, coins - 45 + 3);
  assert.equal(run.charmMemo['economy.pick'].picked, true);
  unchanged(run, () => buyBoon(run, 'economy.pick'));
  unchanged(run, () => buyBoon(run, 'voyage.stickers'));
  const beforeUndos = run.undos;
  for (let i = 0; i < 3; i++) assert(buyUndo(run));
  assert.equal(run.undos, beforeUndos + 3);
  unchanged(run, () => buyUndo(run));
  const boonStock = copy(run.port.boons);
  assert(rerollPort(run)); assert.notDeepEqual(run.port.boons, boonStock);
  unchanged(run, () => rerollPort(run));
  const stickers = docked({ idx: 1, seed: 'economy-stickers' });
  assert.equal(stickers.port.kind, 'stickers');
  assert.equal(stickers.port.stickers.length, 3); assert.equal(stickers.port.boons.length, 0);
  unchanged(stickers, () => buyBoon(stickers, stickers.port.boons[0]?.id));
  unchanged(stickers, () => buySticker(stickers, -1, 1));
  unchanged(stickers, () => buySticker(stickers, 0, 0));
  unchanged(stickers, () => buySticker(stickers, 0, 53));
  unchanged(stickers, () => buySticker(stickers, 0, '7'));
  stickers.port.stickers = [{ type: 'wild', sold: false }, { type: 'fool', sold: false }, { type: 'key', sold: false }];
  assert(buySticker(stickers, 0, 7)); assert.equal(stickers.stickers[7], 'wild');
  assert(buySticker(stickers, 1, 7)); assert.deepEqual(stickers.stickers, { 7: 'fool' });
  unchanged(stickers, () => buySticker(stickers, 1, 8));
  const stickerStock = copy(stickers.port.stickers);
  assert(rerollPort(stickers)); assert.notDeepEqual(stickers.port.stickers, stickerStock);
  unchanged(stickers, () => rerollPort(stickers));
  assert.equal(economy(stickers).stickersBought, 2);
  const upgrades = docked({ idx: 5, boons: ['economy.pick'] });
  assert.equal(upgrades.port.kind, 'upgrades');
  unchanged(upgrades, () => rerollPort(upgrades));
  unchanged(upgrades, () => buyBoon(upgrades, 'economy.pick'));
});

group('docking/price modifiers, upgrade hook, selling and Grand Port', () => {
  testCharm('economy.merchant', {
    onPort(run, ctx) { ctx.api.addCoins(10); ctx.api.addUndos(1); ctx.port.extraBoons++; ctx.port.discount = .25; ctx.port.freeReroll = true; ctx.runMemo.visits = (ctx.runMemo.visits || 0) + 1; },
    price: (item, cost) => item.kind === 'sell' ? cost + 5 : cost - 1,
    onUpgrade(run, ctx) { assert.equal(ctx.level, 2); ctx.api.addUndos(6); ctx.api.addCoins(4); ctx.runMemo.upgraded = true; },
  });
  const run = docked({ boons: ['economy.merchant'] });
  assert.equal(run.coins, 510); assert.equal(run.port.boons.length, 4); assert.equal(run.charmMemo['economy.merchant'].visits, 1);
  const before = copy(run); createPort(run); assert.deepEqual(run, before, 'Docking cannot replay onPort');
  assert.equal(portPrice(run, { kind: 'undo' }, 15), 11);
  const poor = copy(run); poor.coins = 0; unchanged(poor, () => upgradeBoon(poor, 'economy.merchant'));
  const upgrading = docked({ idx: 5, boons: ['economy.merchant'], seed: 'economy-upgrade' });
  const undos = upgrading.undos, coins = upgrading.coins;
  assert(upgradeBoon(upgrading, 'economy.merchant'));
  assert.equal(upgrading.levels['economy.merchant'], 2); assert.equal(upgrading.undos, undos + 6); assert.equal(upgrading.coins, coins - 29 + 4);
  assert(upgrading.charmMemo['economy.merchant'].upgraded);
  unchanged(upgrading, () => upgradeBoon(upgrading, 'economy.merchant'));
  const view = runView(run);
  assert.equal(view.port.sell[0].price, 25); assert.deepEqual(view.port.upgrades, []);
  const upgradedView = runView(upgrading);
  assert.equal(upgradedView.boons[0].level, 2); assert.equal(upgradedView.boons[0].text, 'economy.merchant level two');
  const purse = run.coins; assert(rerollPort(run)); assert.equal(run.coins, purse);
  assert(sellBoon(run, 'economy.merchant')); assert.equal(run.coins, purse + 25);
  assert(!run.boons.includes('economy.merchant')); assert(!('economy.merchant' in run.levels));
  unchanged(run, () => sellBoon(run, 'economy.merchant'));
  const grand = docked({ idx: 5, boons: ['economy.pick'] });
  assert.equal(grand.port.kind, 'upgrades'); assert.equal(grand.port.boons.length, 0);
  assert.equal(runView(grand).port.upgrades.length, 1);
  assert.equal(runView(grand).port.sell[0].price, 20);
  const gc = grand.coins; assert(sellBoon(grand, 'economy.pick')); assert.equal(grand.coins, gc + 20);
  const rareId = 'economy.rare'; testCharm(rareId, { ease: .4 });
  const rare = docked({ idx: 5, boons: [rareId] }); assert.equal(runView(rare).port.sell[0].price, 20);
  const normal = docked(); normal.port.boons[0] = { id: rareId, sold: false };
  const nc = normal.coins; assert(buyBoon(normal, rareId)); assert.equal(normal.coins, nc - 60);
});

group('content port services, target validation, atomic rejection and saved resume', () => {
  testCharm('economy.services', { portServices: () => [
    { id: 'copy-gold', label: 'Gold leaf', text: 'Gold sticker on a card.', price: 12, needsCard: true, apply(run, card) { run.stickers[card] = 'gold'; } },
    { id: 'boon-note', label: 'Note', text: 'Remember a held boon.', price: 2, needsBoon: true, apply(run, id) { run.charmMemo[id].noted = true; } },
    { id: 'decline', label: 'Decline', text: 'Reject safely.', price: 1, apply(run) { run.coins = 0; run.stickers[1] = 'wild'; return false; } },
  ] });
  let run = docked({ boons: ['economy.services'] });
  assert.equal(runView(run).port.services.length, 3);
  unchanged(run, () => portService(run, 'copy-gold', 53));
  unchanged(run, () => portService(run, 'boon-note', 'unknown'));
  unchanged(run, () => portService(run, 'decline'));
  unchanged(run, () => portService(run, 'missing'));
  const poor = copy(run); poor.coins = 0; unchanged(poor, () => portService(poor, 'copy-gold', 7));
  assert(portService(run, 'copy-gold', 7)); assert.equal(run.stickers[7], 'gold');
  assert(portService(run, 'boon-note', 'economy.services')); assert(run.charmMemo['economy.services'].noted);
  assert(buyUndo(run)); assert(rerollPort(run));
  saveRun(run); const before = copy(run); const view = copy(runView(run)); run = loadRun();
  assert.deepEqual(run, before); assert.deepEqual(runView(run), view);
  assert.equal(runView(run).port.provisions.left, 2); assert.equal(runView(run).port.reroll.used, true);
  assert(portService(run, 'copy-gold', 8), 'Function must be re-derived after JSON resume');
  assert(leavePort(run)); assert.equal(run.status, 'map'); assert.equal(runView(run).port, null);
  unchanged(run, () => buyUndo(run)); unchanged(run, () => leavePort(run));
  saveRun({ ...run, v: RUN_VERSION - 1 }); assert.equal(loadRun(), null);
});

group('sticker rules/marks, gold timing/history and lucky grants resisting undo/resume', () => {
  const stickers = { 1: 'wild', 2: 'key', 3: 'fool', 4: 'gold', 5: 'lucky' };
  const composed = composeBoard({ stickers });
  assert.deepEqual(composed.rules.wildCards, [1]); assert.deepEqual(composed.rules.freeCards, [2]); assert.deepEqual(composed.rules.anchorCards, [3]);
  assert(composed.active.some((a) => a.id === 'voyage.stickers'));
  const marks = [];
  const run = createRun({ seed: 'sticker-runtime' }); run.stickers = stickers;
  const effects = new BoardEffects(composed.active, { seed: run.seed, boardIndex: 0, run, memo: {}, api: { mark: (ids, style) => marks.push({ ids, style }), clearMarks() {}, refresh() {}, conceal() {} } });
  effects.setup({ state: new Game(1).state });
  for (const type of Object.values(stickers)) assert(marks.some((m) => m.style === `sticker-${type}`));
  testCharm('economy.mark', { setup: (_board, ctx) => ctx.api.mark([1], 'star') });
  const together = [];
  const marked = new BoardEffects([{ id: 'economy.mark', kind: 'boon', strength: 1 }, ...composed.active], { seed: run.seed, boardIndex: 0, run, memo: {}, api: { mark: (ids, style) => together.push({ ids, style }), clearMarks() {}, refresh() {}, conceal() {} } });
  marked.setup({ state: new Game(1).state });
  assert(together.some((m) => m.ids.includes(1) && m.style === 'star'));
  assert(together.some((m) => m.ids.includes(1) && m.style === 'sticker-wild'), 'Sticker marks must coexist with charm marks');
  const changed = composeBoard({ stickers: { 1: 'fool' } });
  assert.deepEqual(changed.rules.wildCards, []); assert.deepEqual(changed.rules.anchorCards, [1]);
  assert.equal(canBuildOn(3, cardId(0, 7), composed.rules), true, 'Fool ignores rank and colour');
  const locks = { ...composed.rules, noCellRanks: 1 << 2, noCellCards: [2], cellColors: ['red'], oneWayCellRanks: 1 << 2, cellLimits: [{ maxRank: 1 }] };
  assert.equal(cellAccepts(state([[2]]), 0, 2, locks), true);
  const initial = state([[1], Array.from({ length: 12 }, (_, i) => 13 - i), [52]], [0, 13, 13, 12]);
  const game = new Game(1); game.state = cloneState(initial);
  assert(game.applyDescriptor({ t: 'F', card: 1, src: { kind: 'col', i: 0 } }));
  assert(game.applyDescriptor({ t: 'F', card: 2, src: { kind: 'col', i: 1 } }));
  run.stickers = { 1: 'gold', 2: 'gold' };
  const gold = new BoardEffects([{ id: 'voyage.stickers', kind: 'boon', strength: 1 }], { seed: run.seed, boardIndex: 0, run, memo: {}, api: {} });
  assert.equal(scoreBoard(game.history, 10, gold, { initial, rules: baseRules() }).coinTotal, 5, 'Exactly 13 remaining pays; 12 does not');
  game.undo(); game.undo();
  assert.equal(scoreBoard(game.history, 10, gold, { initial, rules: baseRules() }).coinTotal, 0, 'Undone homes earn nothing');
  assert(game.applyDescriptor({ t: 'F', card: 1, src: { kind: 'col', i: 0 } }));
  assert(game.applyDescriptor({ t: 'R', card: 1, suit: 0, to: { kind: 'free', i: 0 } }));
  assert(game.applyDescriptor({ t: 'F', card: 1, src: { kind: 'free', i: 0 } }));
  assert.equal(scoreBoard(game.history, 10, gold, { initial, rules: baseRules() }).coinTotal, 5, 'Foundation returns cannot farm gold coins');
  run.status = 'board'; run.current = { memo: {} }; run.stickers = { 1: 'lucky', 2: 'lucky', 3: 'lucky', 4: 'lucky' };
  let grants = 0;
  const lucky = new BoardEffects([{ id: 'voyage.stickers', kind: 'boon', strength: 1 }], { seed: run.seed, boardIndex: 0, run, memo: run.current.memo, api: { addUndos: (n) => { grants += n; }, notify() {} } });
  lucky.emit('foundation', { card: 1 }); lucky.emit('undo', {}); lucky.emit('foundation', { card: 1 });
  for (const card of [2, 3, 4]) lucky.emit('foundation', { card });
  assert.equal(grants, VOYAGE.charmUndoCap);
  const resumed = new BoardEffects(lucky.active, { seed: run.seed, boardIndex: 0, run: copy(run), memo: copy(run.current.memo), api: { addUndos: () => { throw new Error('Lucky must not replay after resume'); } } });
  resumed.emit('foundation', { card: 1 });
  assert(!runView(createRun()).boons.some((c) => c.hidden));
  assert(!boonsForTheme(undefined).includes('voyage.stickers'));
});

group('levels/stickers in plans and dealer keys, lookahead and challengeStrength hooks', () => {
  testCharm('economy.plans', { family: 'cells', rules(r, ctx) { r.freeCells += ctx.level; }, lookahead: () => 99, challengeStrength: (s, ctx) => { assert(Array.isArray(ctx.run.results)); return s - 3; } });
  const run = createRun({ seed: 'plans' }); run.boons = ['economy.plans'];
  const theme = nextChoices(run.map)[0].theme;
  const p1 = boardPlan(run, theme, { idx: 3 });
  assert.equal(p1.strength, 1); assert.equal(p1.active.find((a) => a.kind === 'boon').strength, 4);
  run.levels['economy.plans'] = 2; run.stickers = { 7: 'wild' };
  const p2 = boardPlan(run, theme, { idx: 3 });
  assert.equal(p2.active.find((a) => a.id === 'economy.plans').level, 2); assert.equal(p2.rules.freeCells, 6); assert(p2.rules.wildCards.includes(7));
  assert.deepEqual(p2.levels, run.levels); assert.deepEqual(p2.stickers, run.stickers);
  assert.notEqual(planKey(p1, run.seed), planKey(p2, run.seed));
  assert.notEqual(planKey(p2, run.seed), planKey({ ...p2, stickers: { 7: 'gold' } }, run.seed));
  assert(upcomingPlans(run).every((p) => p.levels['economy.plans'] === 2 && p.stickers[7] === 'wild'));
  assert.equal(run.map.lookahead, 4); assert.equal(mapView(run.map).length, 4);
  run.boons = []; refreshMap(run); assert.equal(run.map.lookahead, 2); assert.equal(mapView(run.map).length, 2);
  const final = boardPlan(run, theme, { idx: 6 });
  if (final.boss) assert.equal(final.active.find((a) => a.kind === 'boss').strength, 7);
});

group('two-pick rewards resume midway and dock only after the final pick', () => {
  testCharm('economy.picks', { picks: () => 99 });
  const run = createRun({ seed: 'two-picks' }); run.boons = ['economy.picks'];
  const node = nextChoices(run.map)[0]; node.port = true;
  finishBoard(run, node, () => ({ score() {}, offers: () => 3, starCap: () => 3, thresholds: (a) => a }));
  assert.equal(run.reward.picks, 2); assert.equal(runView(run).reward.picks, 2);
  assert(upcomingPlans(run).some((p) => p.active.filter((a) => a.kind === 'boon').length === 3));
  const first = run.reward.offers[0]; pickCharm(run, first);
  assert.equal(run.status, 'reward'); assert.equal(run.reward.picks, 1); assert(!run.reward.offers.includes(first));
  saveRun(run); const resumed = loadRun(); assert.equal(resumed.reward.picks, 1);
  const second = resumed.reward.offers[0]; pickCharm(resumed, second);
  assert.equal(resumed.status, 'port'); assert.deepEqual(resumed.results[0].charms, [first, second]); assert.equal(resumed.results[0].charm, first);
  assert.equal(resumed.economy.portVisits, 1);
});

group('economy statistics sync once, including direct run-level coin hooks', () => {
  resetVoyageStats();
  const run = docked({ idx: 1, coins: 100, boons: ['economy.pick'] });
  assert(buyUndo(run)); assert(buySticker(run, 0, 7));
  run.port = null; run.results = [{ idx: 5, total: 100, stars: 1 }]; run.status = 'port';
  createPort(run);
  assert(upgradeBoon(run, 'economy.pick'));
  recordEconomy(run); const stats = copy(voyageStats);
  recordEconomy(run); assert.deepEqual(voyageStats, stats);
  saveRun(run); recordEconomy(loadRun()); assert.deepEqual(voyageStats, stats);
  assert.equal(voyageStats.portVisits, 2); assert.equal(voyageStats.stickersBought, 1); assert.equal(voyageStats.coinsSpent, run.economy.coinsSpent);
  assert.equal(voyageStats.upgrades, 1);
  run.coins += 4; recordEconomy(run); assert.equal(voyageStats.coinsEarned, 104);
  resetVoyageStats(); assert.equal(voyageStats.coinsEarned, 0);
});

// Remove test definitions so the scripted voyage shops/rewards use production content.
for (const id of testIds) delete CHARMS[id];
group('complete create → board → win → reward → port → map voyage, no UI', () => {
  let run = createRun({ seed: 'full-economy-voyage' });
  for (let idx = 0; idx < VOYAGE.boards; idx++) {
    const choices = nextChoices(run.map);
    const node = choices.find((n) => n.port) || choices[0];
    if (idx === 6) node.port = true; // Even corrupted finale metadata cannot dock.
    const result = finishBoard(run, node);
    assert.equal(result.idx, idx); assert(result.coins > 0);
    if (idx === 6) { assert.equal(run.status, 'won'); assert.equal(run.port, null); break; }
    while (run.status === 'reward') pickCharm(run, run.reward.offers[0]);
    const expectPort = [1, 3, 5].includes(idx);
    assert.equal(!!node.port, expectPort);
    if (expectPort) {
      assert.equal(run.status, 'port'); assert(runView(run).port);
      assert.equal(run.port.kind, { 1: 'stickers', 3: 'boons', 5: 'upgrades' }[idx]);
      const view = runView(run);
      assert.equal(view.markets.some((market) => market.kind === run.port.kind), true);
      saveRun(run); run = loadRun(); assert.equal(run.status, 'port');
      buyUndo(run); assert(leavePort(run));
    }
    assert.equal(run.status, 'map'); saveRun(run); run = loadRun();
  }
  assert.equal(run.results.length, 7); assert.equal(run.economy.portVisits, 3);
  saveRun(run); assert.equal(loadRun(), null);
  const empty = createRun({ seed: 'no-reward' }); const node = nextChoices(empty.map)[0]; node.port = true;
  startBoard(empty, node.id, { deal: 1, par: 60 }); empty.current.offers = [];
  winBoard(empty, [], null); assert.equal(empty.status, 'port');
});
group('immediate board spending, concession and seeded offer-pool hooks', () => {
  const run=createRun({seed:'n52-economy'}); run.coins=10;
  assert.equal(spendCoins(run,5),false);
  const node=nextChoices(run.map)[0]; node.port=true;
  const cur=startBoard(run,node.id,{deal:1,par:60,rules:baseRules()});
  for (const n of [-1,1.5,NaN,Infinity,11,'5']) unchanged(run,()=>spendCoins(run,n));
  assert(spendCoins(run,5)); assert.equal(run.coins,5); assert.equal(run.economy.coinsSpent,5);
  const game=new Game(1); const move=game.moveToFreeCell({kind:'col',i:0},0); assert(move); game.undo(); assert.equal(run.coins,5,'undo never returns board-time coins');
  testCharm('economy.offerpool',{offerPool:(offers,ctx)=>{assert.equal(ctx.level,2);assert.equal(ctx.theme,node.theme);return ['economy.hidden','economy.placeholder',run.boons[0],ctx.rng.pick(offers),...offers];}});
  testCharm('economy.hidden',{hidden:true}); testCharm('economy.placeholder',{placeholder:true});
  run.boons=['economy.offerpool']; run.levels['economy.offerpool']=2;
  const pool=boardOffers(run,node.theme,0); assert.deepEqual(pool,boardOffers(copy(run),node.theme,0));
  assert(pool.every((id)=>!run.boons.includes(id)&&!CHARMS[id].hidden&&!CHARMS[id].placeholder));
  cur.offers=pool; cur.storm=true;
  testCharm('economy.two-picks',{picks:()=>2}); run.boons.push('economy.two-picks');
  const result=concedeBoard(run,[],{offers:()=>3,score:()=>{}});
  assert(result.conceded); assert.equal(result.stars,1); assert.equal(result.coins,0); assert.equal(run.coins,5);
  assert.equal(run.reward.offers.length,1); assert.equal(run.reward.picks,1); assert.equal(run.reward.stars,1);
  saveRun(run); const saved=loadRun(); assert(saved.results[0].conceded); assert.equal(saved.reward.offers.length,1);
  pickCharm(run,run.reward.offers[0]); assert.equal(run.status,'port'); assert(run.port);
  assert.equal(concedeBoard(run),false);
  const final=createRun({seed:'n52-final'}); startBoard(final,nextChoices(final.map)[0].id,{deal:1,par:60}); final.current.idx=6;
  unchanged(final,()=>concedeBoard(final));
  const none=createRun({seed:'n52-no-offer'}); const n=nextChoices(none.map)[0]; n.port=true; startBoard(none,n.id,{deal:1,par:60}); none.current.offers=[];
  assert(concedeBoard(none)); assert.equal(none.status,'reward'); assert.equal(none.reward.offers.length,1);
  assert(!none.boons.includes(none.reward.offers[0])); pickCharm(none,none.reward.offers[0]); assert.equal(none.status,'port');
  // History-earned coin lines survive concession; the board formula is omitted.
  const earned=createRun({seed:'n52-earned'}); startBoard(earned,nextChoices(earned.map)[0].id,{deal:1,par:60});
  const payout=concedeBoard(earned,[],{score:(sb)=>sb.addCoins('played','Played objective',7)}); assert.equal(payout.coins,7); assert(!payout.coinLines.some((line)=>['base','stars','points'].includes(line.key)));
  const fee=createRun({seed:'n52-fee'}); startBoard(fee,nextChoices(fee.map)[0].id,{deal:1,par:60});
  assert.equal(concedeBoard(fee,[],{score:(sb)=>sb.addCoins('fee','Fee',-7)}).coins,0);
});
console.log('OK: Voyage economy, all port actions, persistence, hooks, stickers, levels and full run');
