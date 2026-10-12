// arctic: boons + challenge. Spec: docs/voyage/charms-design.md (theme `arctic`).
import { defineCharm } from '../registry.js';
import { rankOf, suitOf } from './kit.js';

defineCharm({
  id: 'arctic.aurora',
  kind: 'boon',
  theme: 'arctic',
  name: 'Aurora',
  icon: '🌌',
  text: 'Each chain of 6+ cards home is worth ×1.1 on the board (up to ×1.3).',
  score(sb) {
    const big = sb.stat.chains.filter((n) => n >= 6).length;
    const bonus = Math.min(0.3, big * 0.1);
    if (bonus) sb.scale('chains', 1 + bonus);
  },
});

defineCharm({
  id: 'arctic.heatlamp',
  kind: 'boon',
  theme: 'arctic',
  name: 'Heat Lamp',
  icon: '💡',
  text: 'One extra free cell, frozen until 13 cards are home.',
  // The bank rates the extra cell as fully open; it starts frozen (calibration: one cell frozen
  // until 8 home ≈ −0.76 tiers), so hand most of that back.
  ease: -0.6,
  rules(r) {
    r.freeCells += 1;
    const t = r.cellThaw || { frozen: 0, at: [] };
    r.cellThaw = { frozen: t.frozen + 1, at: [...t.at, 13].sort((a, b) => a - b) };
  },
});

defineCharm({
  id: 'arctic.sled',
  kind: 'boon',
  theme: 'arctic',
  name: 'Sled Team',
  icon: '🛷',
  text: '+1 undo each time a foundation first reaches 7 (up to 2 per board).',
  on: {
    foundation(ctx, { card }) {
      if (rankOf(card) !== 7) return;
      const suit = suitOf(card);
      ctx.memo.sevens ??= {};
      if (ctx.memo.sevens[suit]) return;
      const count = Object.keys(ctx.memo.sevens).length;
      if (count >= 2) return;
      ctx.memo.sevens[suit] = true;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'arctic.challenge',
  kind: 'challenge',
  theme: 'arctic',
  name: 'Deep Freeze',
  icon: '🧊',
  tags: ['CELLS'],
  text: (s) => {
    const frozen = s >= 5 ? 2 : 1;
    return frozen === 1 ? '1 free cell starts frozen and thaws once 8 cards are home.' : '2 free cells start frozen; they thaw at 8 and 20 cards home.';
  },
  ease: (ctx) => -(ctx.strength >= 5 ? 0.1 : 0.06) * ctx.strength,
  rules(r, ctx) {
    const frozen = ctx.strength >= 5 ? 2 : 1;
    const t = r.cellThaw || { frozen: 0, at: [] };
    r.cellThaw = { frozen: t.frozen + frozen, at: [...t.at, ...[8, 20].slice(0, frozen)].sort((a, b) => a - b) };
  },
});
