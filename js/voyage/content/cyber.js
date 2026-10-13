// cyber: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `cyber`).
// Complex charms: ./special/cyber.ghost.js, ./special/cyber.zeroday.js
import { defineCharm } from '../registry.js';
import { paidUndo } from './kit.js';

defineCharm({
  id: 'cyber.overclock',
  kind: 'boon',
  theme: 'cyber',
  name: 'Overclock',
  icon: '⚡',
  family: 'columns',
  text: 'You can move 2 more cards at once.',
  upgrade: '3 more.',
  ease: 0.35,
  rules(r, ctx) {
    r.moveBonus = (r.moveBonus || 0) + (ctx.level >= 2 ? 3 : 2);
  },
});

defineCharm({
  id: 'cyber.challenge',
  kind: 'challenge',
  theme: 'cyber',
  name: 'Packet Loss',
  icon: '📶',
  tags: ['SCORE'],
  pressure: true,
  text: (s) => {
    if (s <= 2) return 'Some undos cost double: every 3rd undo costs an extra.';
    if (s <= 5) return 'Some undos cost double: every 2nd undo costs an extra.';
    return 'Every undo costs an extra undo.';
  },
  on: {
    undo(ctx, ev) {
      if (!paidUndo(ev)) return;
      const s = ctx.strength;
      const period = s <= 2 ? 3 : s <= 5 ? 2 : 1;
      ctx.memo.undoCount = (ctx.memo.undoCount || 0) + 1;
      if (ctx.memo.undoCount % period === 0) ctx.api.spendUndos(1);
    },
  },
});
