// carvings: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `carvings`).
// Complex charms: ./special/carvings.raven.js, ./special/carvings.totem.js
import { defineCharm } from '../registry.js';
import { countHome } from './kit.js';

defineCharm({
  id: 'carvings.orca',
  kind: 'boon',
  theme: 'carvings',
  name: 'Orca Pod',
  icon: '🐋',
  family: 'undo',
  text: '+1 undo each time you empty a column before 30 cards are home (twice per board).',
  upgrade: 'Three times per board.',
  on: {
    columnEmpty(ctx) {
      const cap = ctx.level === 2 ? 3 : 2;
      const grants = ctx.memo.grants || 0;
      if (grants >= cap) return;
      const home = countHome(ctx.api.history || []);
      if (home >= 30) return;
      ctx.memo.grants = grants + 1;
      ctx.api.addUndos(1);
    },
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
