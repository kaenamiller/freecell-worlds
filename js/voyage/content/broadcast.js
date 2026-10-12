// broadcast: boons + challenge. Spec: docs/voyage/charms-design.md (theme `broadcast`).
import { defineCharm } from '../registry.js';
import { countHome, rankOf, suitOf } from './kit.js';

const spreadOf = (s) => (s <= 2 ? 4 : s <= 4 ? 3 : 2);

defineCharm({
  id: 'broadcast.tuning', kind: 'boon', theme: 'broadcast', name: 'Tuning', icon: '📡',
  text: 'The first 7 sent home grants +1 undo.',
  on: {
    foundation(ctx, { card }) {
      if (rankOf(card) !== 7 || ctx.memo.paid) return;
      ctx.memo.paid = true;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'broadcast.bars', kind: 'boon', theme: 'broadcast', name: 'Color Bars', icon: '📺',
  text: '+10 points for every heart and diamond sent home.',
  score(sb) {
    const n = countHome(sb.history, (id) => suitOf(id) === 1 || suitOf(id) === 2);
    if (n) sb.add('bars', 'Red cards home', n * 10);
  },
});

defineCharm({
  id: 'broadcast.signoff', kind: 'boon', theme: 'broadcast', name: 'Sign-off', icon: '🌙',
  text: 'If the previous board was 3 stars, this board scores ×1.12.',
  score(sb, ctx) {
    if (ctx.run.results.at(-1)?.stars === 3) sb.mult('Sign-off', 1.12);
  },
});

defineCharm({
  id: 'broadcast.challenge', kind: 'challenge', theme: 'broadcast', name: 'Dead Air', icon: '📻',
  tags: ['FOUND'],
  text: (s) => `Foundations stay within ${spreadOf(s)} ranks of each other.`,
  ease: (ctx) => -0.08 * ctx.strength,
  rules(r, ctx) { r.foundationSpread = spreadOf(ctx.strength); },
});
