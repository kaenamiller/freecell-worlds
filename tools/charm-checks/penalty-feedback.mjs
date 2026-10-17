import { penaltyFeedback } from '../../js/voyage/penalties.js';
import { ScoreBreakdown } from '../../js/voyage/scoring.js';

export async function check({ assert, CHARMS, Rules, BoardEffects, baseRules, clone, stubAPI, scoreBoard }) {
  const game = new Rules.Game(1, { rules: baseRules() });
  game.tableau[1].push(...game.tableau[0].splice(0, game.tableau[0].length - 1));
  const initial = clone(game.state);
  const api = stubAPI(game), memo = {};
  const fx = new BoardEffects([{ id: 'museum.challenge', kind: 'challenge', strength: 1 }], { seed: 'fragile-feedback', boardIndex: 0, api, memo });
  fx.setup({ state: initial, initial });
  const ctx = fx.ctxs[0];
  const card = game.tableau[0].at(-1);
  ctx.memo.fragile = [card];
  const score = () => scoreBoard(game.history, 60, fx, { initial, initialRules: baseRules(), rules: game.rules });
  let previous = score();
  for (let i = 0; i < 4; i++) {
    // Return between the same column and cell so each move is a legal real descriptor.
    const move = i % 2 ? game.moveFreeToTableau(0, 0) : game.moveToFreeCell({ kind: 'col', i: 0 }, 0);
    fx.emit('move', { move, manual: true });
    assert.equal(api.marks[card], 'fragile-used', 'wear visible after first move');
    const next = score();
    const losses = penaltyFeedback(previous, next, card).filter((l) => l.label === 'Fragile Exhibits');
    assert.deepEqual(losses.map((l) => [l.card, l.amount]), i === 1 || i === 2 ? [[card, 25]] : [], 'free first move and capped charges');
    previous = next;
  }
  assert.match(fx.markTip(card).text, /both 25-point charges used/);
  while (game.history.length) { const move = game.undo(); fx.emit('undo', { move }); }
  assert.equal(api.marks[card], 'fragile', 'undo restores intact diamond');
  assert.match(fx.markTip(card).text, /first move is free/);
  game.moveToFreeCell({ kind: 'col', i: 0 }, 0);
  // Legacy saved boards had an intact mark even after the free move.
  ctx.memo._runtime.marks[card] = 'fragile';
  const resumed = new BoardEffects(fx.active, { seed: 'fragile-feedback', boardIndex: 0, api, memo });
  resumed.setup({ state: initial, initial, restored: true });
  resumed.emit('resume');
  assert.equal(api.marks[card], 'fragile-used', 'resume repairs old saved mark');

  // Card attribution matters when a stationary card expires on another card's move.
  const before = new ScoreBreakdown({}), after = new ScoreBreakdown({});
  after.add('overdue', 'Overdue fines', -25).cardPenalty('overdue', card, 25);
  after.addCoins('curse', 'Cursed gold', -2);
  assert.deepEqual(penaltyFeedback(before, after, 52), [
    { card, amount: 25, unit: 'points', label: 'Overdue fines' },
    { card: 52, amount: 2, unit: 'coins', label: 'Cursed gold' },
  ]);
  assert.deepEqual(penaltyFeedback(after, before, card), [], 'refunds never show damage');
  assert.deepEqual(penaltyFeedback(after, after, card), [], 'no duplicate floats');
  const timed = new ScoreBreakdown({}); timed.add('layover', 'Layover delay', -20);
  assert.deepEqual(penaltyFeedback(before, timed, card), [], 'time decay does not blame a card');

  // Overdue attribution uses the card sitting in the cell, even before it leaves.
  for (let i = 0; i < 14; i++) game.applyDescriptor({ t: 'T', src: { kind: 'col', i: i % 2 ? 1 : 2 }, to: i % 2 ? 2 : 1, count: 1 });
  const overdue = scoreBoard(game.history, 60, null, { initial, rules: game.rules });
  CHARMS['library.challenge'].score(overdue, { strength: 1 });
  assert(overdue.cardPenalties.some((p) => p.card === card && p.amount === 25));
}
