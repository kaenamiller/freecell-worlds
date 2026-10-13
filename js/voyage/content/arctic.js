// arctic: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `arctic`).
// Complex: arctic.aurora, arctic.heatlamp in ./special/
import { defineCharm } from '../registry.js';
import { rankOf, suitOf } from './kit.js';

defineCharm({
  id: 'arctic.sled',
  kind: 'boon',
  theme: 'arctic',
  name: 'Sled Team',
  icon: '🛷',
  family: 'undo',
  text: '+1 undo each time a foundation reaches 7 while another is still below 3 (up to 2 per board).',
  upgrade: 'Up to 3.',
  on: {
    foundation(ctx, { card }) {
      if (rankOf(card) !== 7) return;
      const cap = ctx.level === 2 ? 3 : 2;
      if ((ctx.memo.grants || 0) >= cap) return;
      const suit = suitOf(card);
      const found = ctx.api.state.found;
      if (found[suit] !== 7) return;
      const lagging = found.some((n, i) => i !== suit && n < 3);
      if (!lagging) return;
      ctx.memo.grants = (ctx.memo.grants || 0) + 1;
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
