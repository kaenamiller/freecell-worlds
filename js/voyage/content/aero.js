// aero: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `aero`).
// Complex: aero.dolphin in ./special/aero.dolphin.js
import { defineCharm } from '../registry.js';
import { canUndoBoard } from './kit.js';

defineCharm({
  id: 'aero.pocket',
  kind: 'boon',
  theme: 'aero',
  name: 'Air Pocket',
  icon: '🫧',
  family: 'cells',
  text: 'One extra free cell.',
  upgrade: 'One extra free cell and +1 move capacity.',
  rules(r, ctx) {
    r.freeCells += 1;
    if (ctx.level >= 2) r.moveBonus = (r.moveBonus || 0) + 1;
  },
});

defineCharm({
  id: 'aero.lounge',
  kind: 'boon',
  theme: 'aero',
  name: 'Lagoon Lounge',
  icon: '🍹',
  family: 'undo',
  text: 'Once per board, open the lounge: undo as many moves as you like for free until you play forward again.',
  upgrade: 'Twice per board.',
  ability: {
    uses: (ctx) => ctx.level,
    label: 'Open lounge',
    available: (ctx) => canUndoBoard(ctx) && !ctx.api.undoWindowUsed,
    use: ({ api }) => api.openUndoWindow(),
  },
});

defineCharm({
  id: 'aero.challenge',
  kind: 'challenge',
  theme: 'aero',
  name: 'Riptide',
  icon: '🌀',
  tags: ['FOUND'],
  text: (s) => `No foundation may get more than ${Math.max(2, 9 - s)} ranks ahead of the lowest.`,
  ease: (ctx) => -0.08 * ctx.strength,
  rules(r, ctx) {
    r.foundationSpread = Math.max(2, 9 - ctx.strength);
  },
});
