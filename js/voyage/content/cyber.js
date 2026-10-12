// cyber: boons + challenge. Spec: docs/voyage/charms-design.md (theme `cyber`).
// Complex charms for this theme live in ./special/cyber.ghost.js.
import { defineCharm } from '../registry.js';

defineCharm({
  id: 'cyber.overclock',
  kind: 'boon',
  theme: 'cyber',
  name: 'Overclock',
  icon: '⚡',
  text: 'You can move 2 more cards at once.',
  ease: 0.35,
  rules(r) {
    r.moveBonus = (r.moveBonus || 0) + 2;
  },
});

defineCharm({
  id: 'cyber.cache',
  kind: 'boon',
  theme: 'cyber',
  name: 'Cache Hit',
  icon: '💾',
  text: 'Your first undo on each board is refunded.',
  on: {
    undo(ctx) {
      if (ctx.memo.refunded) return;
      ctx.memo.refunded = true;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'cyber.challenge',
  kind: 'challenge',
  theme: 'cyber',
  name: 'Packet Loss',
  icon: '📶',
  tags: ['SCORE'],
  text: (s) => {
    if (s <= 2) return 'Some undos cost double: every 3rd undo costs an extra.';
    if (s <= 5) return 'Some undos cost double: every 2nd undo costs an extra.';
    return 'Every undo costs an extra undo.';
  },
  on: {
    undo(ctx) {
      const s = ctx.strength;
      const period = s <= 2 ? 3 : s <= 5 ? 2 : 1;
      ctx.memo.undoCount = (ctx.memo.undoCount || 0) + 1;
      if (ctx.memo.undoCount % period === 0) ctx.api.spendUndos(1);
    },
  },
});
