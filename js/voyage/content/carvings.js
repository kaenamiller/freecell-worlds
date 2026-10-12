// carvings: boons + challenge. Spec: docs/voyage/charms-design.md (theme `carvings`).
// Complex charms for this theme live in ./special/carvings.*.js.
import { defineCharm } from '../registry.js';
import { replay } from './kit.js';

defineCharm({
  id: 'carvings.orca',
  kind: 'boon',
  theme: 'carvings',
  name: 'Orca Pod',
  icon: '🐋',
  text: 'Emptying a column grants +1 undo (up to 2 per board).',
  on: {
    columnEmpty(ctx) {
      const grants = ctx.memo.grants || 0;
      if (grants >= 2) return;
      ctx.memo.grants = grants + 1;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'carvings.totem',
  kind: 'boon',
  theme: 'carvings',
  name: 'Totem Pole',
  icon: '🪵',
  text: '+40 for each column you empty (each column once per board).',
  score(sb) {
    const emptied = new Set();
    const lengths = sb.initial.tableau.map((col) => col.length);
    replay(sb, (move, state) => {
      for (let c = 0; c < 8; c++) {
        const len = state.tableau[c].length;
        if (lengths[c] > 0 && len === 0) emptied.add(c);
        lengths[c] = len;
      }
    });
    if (emptied.size) sb.add('totem', `Columns cleared (${emptied.size})`, emptied.size * 40);
  },
});

defineCharm({
  id: 'carvings.challenge',
  kind: 'challenge',
  theme: 'carvings',
  name: 'Longhouse Beams',
  icon: '🏠',
  tags: ['COLUMN'],
  text: (s) => `No column may grow taller than ${16 - s} cards.`,
  ease: (ctx) => -0.07 * ctx.strength,
  rules(r, ctx) {
    r.maxHeight = 16 - ctx.strength;
  },
});
