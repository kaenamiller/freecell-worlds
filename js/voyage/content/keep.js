// keep: boons + challenge. Spec: docs/voyage/charms-design.md (theme `keep`).
// Complex charms for this theme (if any) live in ./special/keep.*.js.
import { defineCharm } from '../registry.js';
import { VOYAGE } from '../config.js';

defineCharm({
  id: 'keep.banner',
  kind: 'boon',
  theme: 'keep',
  name: 'Banner',
  icon: '🚩',
  text: "You're always offered at least 2 charms after a board.",
  ease: 0.2,
  offers: (n) => Math.max(n, 2),
});

defineCharm({
  id: 'keep.hearth',
  kind: 'boon',
  theme: 'keep',
  name: 'Hearth',
  icon: '🔥',
  text: '+1 undo at the start of board 4 and +2 at the start of the final board.',
  ease: 0.15,
  on: {
    start(ctx) {
      const i = ctx.run.boardIdx;
      if (i === 3) ctx.api.addUndos(1);
      else if (i === VOYAGE.boards - 1) ctx.api.addUndos(2);
    },
  },
});

defineCharm({
  id: 'keep.challenge',
  kind: 'challenge',
  theme: 'keep',
  name: 'Siege',
  icon: '🏹',
  tags: ['CELLS'],
  text: (s) => (s <= 2
    ? `Each free-cell placement costs ${10 * s} points.`
    : 'One fewer free cell.'),
  ease: (ctx) => (ctx.strength <= 2 ? -0.05 * ctx.strength : 0), // the lost cell is modeled exactly by the seed bank
  rules(r, ctx) {
    if (ctx.strength >= 3) r.freeCells -= 1;
  },
  score(sb, ctx) {
    if (ctx.strength > 2) return;
    const cost = sb.stat.freeCellPlacements * 10 * ctx.strength;
    if (cost) sb.add('siege', 'Siege toll', -cost);
  },
});
