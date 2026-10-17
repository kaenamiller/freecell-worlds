import { bonusFeedback } from '../../js/voyage/penalties.js';
import { ScoreBreakdown } from '../../js/voyage/scoring.js';

export async function check({ assert, CHARMS, Rules, BoardEffects, baseRules, clone, stubAPI, scoreBoard }) {
  const initial = { tableau: [[1], [14], [], [], [], [], [], []], free: [0, 0, 0, 0], found: [0, 0, 0, 0] };
  const history = [
    { t: 'F', src: { kind: 'col', i: 0 }, card: 1 },
    { t: 'F', src: { kind: 'col', i: 1 }, card: 14, auto: true },
  ];
  const context = { memo: { fireflies: [1, 14] }, level: 1 };
  const score = (h, ctx = context, start = initial) => scoreBoard(h, 60, { score(sb) { CHARMS['forest.fireflies'].score(sb, ctx); } }, { initial: start, rules: baseRules() });
  const before = score([]), first = score(history.slice(0, 1)), both = score(history);
  assert.deepEqual(bonusFeedback(before, both, 52).map((b) => [b.card, b.amount, b.unit, b.label, b.bonus]), [
    [1, 3, 'coins', 'Firefly Jar', true], [14, 3, 'coins', 'Firefly Jar', true],
  ], 'batch and automatic homes pay above each correct card');
  assert.deepEqual(bonusFeedback(first, both, 52).map((b) => b.card), [14], 'only newly collected reward');
  assert.deepEqual(bonusFeedback(both, first, 1), [], 'undo is not a reward');
  assert.deepEqual(bonusFeedback(both, both, 1), [], 'HUD refresh and resume do not repeat rewards');
  assert.equal(bonusFeedback(score([], { ...context, level: 2 }), score(history, { ...context, level: 2 }), 52)[0].amount, 4, 'upgraded payout');
  const late = { ...clone(initial), tableau: [[27], [40], [], [], [], [], [], []], found: [12, 12, 0, 0] };
  const lateMoves = history.map((m, i) => ({ ...m, card: i ? 40 : 27 }));
  const lateCtx = { ...context, memo: { fireflies: [27, 40] } };
  assert.deepEqual(bonusFeedback(score([], lateCtx, late), score(lateMoves, lateCtx, late), 52).map((b) => b.card), [27], 'deadline enforced at the exact home count');

  const gold = new ScoreBreakdown({});
  Object.assign(gold, { initial, history, rules: baseRules() });
  CHARMS['voyage.stickers'].score(gold, { stickers: { 1: 'gold', 14: 'gold' } });
  assert.deepEqual(bonusFeedback(new ScoreBreakdown({}), gold, 52).map((b) => [b.card, b.amount]), [[1, 5], [14, 5]], 'Gold sticker payout attribution');
  const passive = new ScoreBreakdown({}).add('cards', 'Cards home', 100).add('freecells', 'Free cells', 50).add('efficiency', 'Efficiency', 100).add('chains', 'Chains', 50);
  assert.deepEqual(bonusFeedback(new ScoreBreakdown({}), passive, 1), [], 'ordinary scoring is not a charm cash-in');
  const refund = new ScoreBreakdown({}).addCoins('curse', 'Cursed Gold', -2);
  assert.deepEqual(bonusFeedback(refund, new ScoreBreakdown({}), 1), [], 'penalty refunds are not collected bonuses');

  const game = new Rules.Game(1, { rules: baseRules() }), api = stubAPI(game), rewards = [];
  api.cardBonus = (reward) => rewards.push(reward);
  const memo = { _undoGrants: 2 }, run = { status: 'board', stickers: { 1: 'lucky', 14: 'lucky' }, boons: [], charmMemo: {} };
  const fx = new BoardEffects([{ id: 'voyage.stickers', kind: 'boon', strength: 1 }], { seed: 'bonus-feedback', boardIndex: 0, api, memo, run });
  fx.setup({ state: clone(game.initial), initial: clone(game.initial) });
  fx.emit('foundation', { card: 1 });
  fx.emit('foundation', { card: 1 });
  fx.emit('foundation', { card: 14 });
  assert.deepEqual(rewards, [{ card: 1, amount: 1, unit: 'undos', label: 'Lucky sticker' }], 'Lucky shows only the actual capped grant, once');
}
