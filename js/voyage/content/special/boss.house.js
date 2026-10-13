import { defineCharm } from '../../registry.js';

defineCharm({
  id: 'boss.house', kind: 'boss', name: 'The House', icon: '🎰', tags: ['SCORE'], pressure: true, ease: 0,
  text: 'Star thresholds rise 20%, every free-cell placement costs 1 coin and every paid undo costs 2 coins, and this board’s coin payout is tripled.',
  tell: 'Higher star stakes · cell and undo tolls · triple coins',
  thresholds: (arr) => arr.map((n) => Math.round(n * 1.2)),
  score(sb) {
    const placements = sb.history.filter((m) => m.t === 'C' || (m.t === 'R' && m.to?.kind === 'free') ||
      (m.t === 'X' && (m.op === 'signal.pull' || (m.op === 'cyber.ghost' && m.action === 'open')))).length;
    if (placements) sb.addCoins('house.cells', 'The House · free-cell tolls', -placements);
    if (sb.undosUsed) sb.addCoins('house.undos', 'The House · undo tolls', -2 * sb.undosUsed);
  },
  on: {
    win(ctx, { result }) {
      if (ctx.memo.paid || !Number.isFinite(result.coins)) return;
      ctx.memo.paid = true;
      const bonus = result.coins * 2;
      result.coinLines.push({ key: 'house.payout', label: 'The House · triple payout', coins: bonus });
      result.coins += bonus;
      ctx.api.addCoins(bonus);
    },
  },
  boonRelation: () => '~',
});
