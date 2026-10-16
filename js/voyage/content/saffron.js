// saffron: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `saffron`).
// Complex: saffron.loom in ./special/saffron.loom.js
import { defineCharm } from '../registry.js';
import { replay, suitOf } from './kit.js';

defineCharm({
  id: 'saffron.spice',
  kind: 'boon',
  theme: 'saffron',
  name: 'Spice Blend',
  icon: '🌶️',
  family: 'coin',
  text: '+3 coins each time all four foundations are level at the same rank (below Queen).',
  upgrade: '+5 coins.',
  score(sb, ctx) {
    const pay = ctx.level >= 2 ? 5 : 3;
    const tops = [0, 0, 0, 0];
    replay(sb, (move) => {
      if (move.t !== 'F') return;
      tops[suitOf(move.card)]++;
      const rank = tops[0];
      if (rank && rank < 12 && tops.every((t) => t === rank)) sb.addCoins(`spice.${rank}`, 'Spice Blend', pay);
    });
  },
});

defineCharm({
  id: 'saffron.silkroad',
  kind: 'boon',
  theme: 'saffron',
  name: 'Silk Road',
  icon: '🐫',
  family: 'cells',
  text: 'One extra free cell on boards 5–7.',
  upgrade: 'Boards 3–7.',
  rules(r, ctx) {
    const minIdx = ctx.level >= 2 ? 2 : 4;
    if (ctx.idx >= minIdx) r.freeCells = (r.freeCells || 4) + 1;
  },
});

defineCharm({
  id: 'saffron.challenge',
  kind: 'challenge',
  theme: 'saffron',
  name: 'Warp and Weft',
  icon: '🧶',
  tags: ['FOUND'],
  text: (s) => `The number of red cards and black cards on your foundations can never differ by more than ${Math.max(2, 9 - s)}.`,
  ease: (ctx) => -0.06 * ctx.strength,
  rules(r, ctx) {
    r.colorSpread = Math.max(2, 9 - ctx.strength);
  },
});
