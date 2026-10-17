// concrete: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `concrete`).
// Complex: concrete.spraytag in ./special/concrete.spraytag.js
import { defineCharm } from '../registry.js';

defineCharm({
  id: 'concrete.bankshot',
  kind: 'boon',
  theme: 'concrete',
  name: 'Bank Shot',
  icon: '🏀',
  family: 'coin',
  text: '+1 coin for every card sent home straight from a free cell.',
  upgrade: '+2 coins.',
  score(sb, ctx) {
    const n = sb.history.filter((m) => m.t === 'F' && m.src?.kind === 'free').length;
    const rate = ctx.level >= 2 ? 2 : 1;
    for (const m of sb.history) if (m.t === 'F' && m.src?.kind === 'free') sb.cardBonus?.('bankshot', m.card, rate);
    if (n) sb.addCoins('bankshot', 'Bank shots', n * rate);
  },
});

defineCharm({
  id: 'concrete.mixtape',
  kind: 'boon',
  theme: 'concrete',
  name: 'Mixtape',
  icon: '📼',
  family: 'ability',
  text: 'The first time each board you empty a column, your most recently used ability gets its use back.',
  upgrade: 'The first two times.',
  on: {
    ability(ctx, { id }) { ctx.memo.lastAbility = id; },
    columnEmpty(ctx) {
      const limit = ctx.level >= 2 ? 2 : 1;
      const used = ctx.memo.refunds ?? 0;
      if (used >= limit || !ctx.memo.lastAbility) return;
      ctx.memo.refunds = used + 1;
      ctx.api.grantUse(ctx.memo.lastAbility, 1);
    },
  },
});

defineCharm({
  id: 'concrete.challenge',
  kind: 'challenge',
  theme: 'concrete',
  name: 'Shot Clock',
  icon: '⏱️',
  tags: ['SCORE'],
  pressure: true,
  text: (s) => `Each time you make 24 moves without sending a card home, lose ${10 * s} points.`,
  score(sb, ctx) {
    const cost = 10 * ctx.strength;
    let penalty = 0;
    let since = 0;
    for (const m of sb.history) {
      if (m.auto) continue;
      if (m.t === 'F') since = 0;
      else {
        since += 1;
        if (since >= 24) {
          penalty += cost;
          since = 0;
        }
      }
    }
    if (penalty) sb.add('clock', 'Shot Clock', -penalty);
  },
});
