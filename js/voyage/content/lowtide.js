// lowtide: boons + challenge. Spec: docs/voyage/charms-design.md (theme `lowtide`).
// Complex: lowtide.tidepool in ./special/lowtide.tidepool.js
import { defineCharm } from '../registry.js';
import { cardsOfRanks, chainsOf, rankMask, suitMask } from './kit.js';

const barrenSuits = (s) => 1 + Math.floor((s - 1) / 2);

defineCharm({
  id: 'lowtide.ebb', kind: 'boon', theme: 'lowtide', name: 'Ebb and Flow', icon: '🌊',
  text: '+1 undo every 20 moves (up to 2 per board).',
  on: {
    move(ctx, { manual }) {
      if (!manual) return;
      ctx.memo.moves = (ctx.memo.moves || 0) + 1;
      const grants = Math.min(2, Math.floor(ctx.memo.moves / 20));
      const prev = ctx.memo.ebbGrants || 0;
      if (grants > prev) {
        ctx.memo.ebbGrants = grants;
        ctx.api.addUndos(grants - prev);
      }
    },
  },
});

defineCharm({
  id: 'lowtide.starfish', kind: 'boon', theme: 'lowtide', name: 'Starfish', icon: '⭐',
  text: '+75 for every chain of 5+ cards home.',
  score(sb) {
    const n = chainsOf(sb.history).filter((c) => c.length >= 5).length;
    if (n) sb.add('starfish', 'Starfish chains', n * 75);
  },
});

defineCharm({
  id: 'lowtide.challenge', kind: 'challenge', theme: 'lowtide', name: 'Barnacles', icon: '🐚',
  tags: ['STACK'],
  text: (s) => `Nothing can be placed on the Kings of ${barrenSuits(s)} suit${barrenSuits(s) > 1 ? 's' : ''}.`,
  ease: (ctx) => -Math.min(1, 0.12 * barrenSuits(ctx.strength)),
  rules(r, ctx) {
    const n = barrenSuits(ctx.strength);
    const suits = ctx.rng.shuffle([0, 1, 2, 3]).slice(0, n);
    r.barren = { suits: suitMask(...suits), ranks: rankMask(13) };
  },
  setup(board, ctx) {
    const suits = [];
    const mask = ctx.api.rules?.barren?.suits || 0;
    for (let s = 0; s < 4; s++) if (mask & (1 << s)) suits.push(s);
    if (suits.length) {
      ctx.api.mark(cardsOfRanks([13], suits), 'bar');
      ctx.api.badge(suits.map((s) => ['♣', '♦', '♥', '♠'][s]).join(' '));
    }
  },
});
