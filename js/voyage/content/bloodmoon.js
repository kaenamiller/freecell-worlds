// bloodmoon: boons + challenge. Spec: docs/voyage/overhaul/ROSTER-52.md (theme `bloodmoon`).
// Complex: bloodmoon.seal in ./special/bloodmoon.seal.js
import { defineCharm } from '../registry.js';
import { VOYAGE } from '../config.js';

defineCharm({
  id: 'bloodmoon.crest',
  kind: 'boon',
  theme: 'bloodmoon',
  name: 'The Crest',
  icon: '🛡️',
  family: 'fortune',
  text: "You're always offered at least 2 charms after a board.",
  upgrade: 'Always offered 3.',
  ease: 0.2,
  offers(n, ctx) {
    const min = ctx.level === 2 ? 3 : 2;
    return Math.max(n, min);
  },
});

defineCharm({
  id: 'bloodmoon.candle',
  kind: 'boon',
  theme: 'bloodmoon',
  name: 'The Last Candle',
  icon: '🕯️',
  family: 'undo',
  text: '+1 undo at the start of board 4 and +2 at the start of the final board.',
  upgrade: '+2 on board 4, +3 on the finale.',
  ease: 0.15,
  on: {
    start(ctx) {
      const i = ctx.run.boardIdx;
      const finale = VOYAGE.boards - 1;
      if (i === 3) ctx.api.addUndos(ctx.level === 2 ? 2 : 1);
      else if (i === finale) ctx.api.addUndos(ctx.level === 2 ? 3 : 2);
    },
  },
});

defineCharm({
  id: 'bloodmoon.challenge',
  kind: 'challenge',
  theme: 'bloodmoon',
  name: 'Uninvited',
  icon: '🚪',
  tags: ['CELLS'],
  text: (s) => (s <= 2
    ? `Each card you put into a free cell costs ${10 * s} points.`
    : 'One fewer free cell.'),
  ease: (ctx) => (ctx.strength <= 2 ? -0.05 * ctx.strength : 0),
  rules(r, ctx) {
    if (ctx.strength >= 3) r.freeCells -= 1;
  },
  score(sb, ctx) {
    if (ctx.strength > 2) return;
    const cost = sb.stat.freeCellPlacements * 10 * ctx.strength;
    if (cost) sb.add('uninvited', 'Uninvited toll', -cost);
  },
});
