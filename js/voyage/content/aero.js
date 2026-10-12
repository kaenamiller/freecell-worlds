// aero: boons + challenge. Spec: docs/voyage/charms-design.md (theme `aero`).
import { defineCharm } from '../registry.js';

defineCharm({
  id: 'aero.pocket',
  kind: 'boon',
  theme: 'aero',
  name: 'Air Pocket',
  icon: '🫧',
  text: 'One extra free cell.',
  rules(r) {
    r.freeCells += 1;
  },
});

defineCharm({
  id: 'aero.dolphin',
  kind: 'boon',
  theme: 'aero',
  name: 'Dolphin Leap',
  icon: '🐬',
  text: 'Sending 4+ cards home in a row grants +1 undo (up to 2 per board).',
  on: {
    foundation(ctx) {
      ctx.memo.streak = (ctx.memo.streak || 0) + 1;
      if (ctx.memo.streak < 4) return;
      const grants = ctx.memo.grants || 0;
      if (grants >= 2) return;
      ctx.memo.grants = grants + 1;
      ctx.memo.streak = 0;
      ctx.api.addUndos(1);
    },
    move(ctx) {
      ctx.memo.streak = 0;
    },
    undo(ctx) {
      ctx.memo.streak = 0;
    },
  },
});

defineCharm({
  id: 'aero.lounge',
  kind: 'boon',
  theme: 'aero',
  name: 'Lagoon Lounge',
  icon: '🍹',
  text: 'Efficiency points ×1.3.',
  score(sb) {
    sb.scale('efficiency', 1.3);
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
