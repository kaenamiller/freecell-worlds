// safetypin: boons + challenge. Spec: docs/voyage/charms-design.md (theme `safetypin`).
import { defineCharm } from '../registry.js';
import { cardsOfRanks, countHome, rankMask, rankOf } from './kit.js';

const pitHi = (s) => 1 + Math.ceil(s / 2);

defineCharm({
  id: 'safetypin.threechords', kind: 'boon', theme: 'safetypin', name: 'Three Chords', icon: '🎸',
  text: 'Threes are wild: they ignore colour when stacking.',
  ease: 0.2,
  rules(r) { r.wildRanks = (r.wildRanks || 0) | rankMask(3); },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks([3]), 'wild'); },
});

defineCharm({
  id: 'safetypin.safetypin', kind: 'boon', theme: 'safetypin', name: 'Safety Pin', icon: '📌',
  text: 'One buried card is pinned. Sending it home grants +1 undo.',
  setup(board, ctx) {
    const buried = [];
    for (const col of board.state.tableau) for (let i = 0; i < col.length - 1; i++) buried.push(col[i]);
    if (!buried.length) return;
    ctx.memo.pin ??= buried[ctx.rng.int(buried.length)];
    ctx.api.mark([ctx.memo.pin], 'glow');
  },
  on: {
    foundation(ctx, { card }) {
      if (card !== ctx.memo.pin || ctx.memo.paid) return;
      ctx.memo.paid = true;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'safetypin.zine', kind: 'boon', theme: 'safetypin', name: 'Zine', icon: '📰',
  text: '+30 points for each Jack and Queen sent home.',
  score(sb) {
    const n = countHome(sb.history, (id) => rankOf(id) === 11 || rankOf(id) === 12);
    if (n) sb.add('zine', 'Jacks and Queens', n * 30);
  },
});

defineCharm({
  id: 'safetypin.challenge', kind: 'challenge', theme: 'safetypin', name: 'No Re-entry', icon: '🚪',
  tags: ['CELLS'],
  text: (s) => {
    const hi = pitHi(s);
    return hi === 2
      ? 'A 2 in a free cell can leave only to its foundation.'
      : `Cards ranked 2–${hi} in a free cell can leave only to their foundation.`;
  },
  ease: (ctx) => -0.07 * ctx.strength,
  rules(r, ctx) {
    const hi = pitHi(ctx.strength);
    let mask = 0;
    for (let rank = 2; rank <= hi; rank++) mask |= rankMask(rank);
    r.oneWayCellRanks = mask;
  },
  setup(_board, ctx) {
    const ranks = [];
    for (let rank = 2; rank <= pitHi(ctx.strength); rank++) ranks.push(rank);
    ctx.api.mark(cardsOfRanks(ranks), 'oneway');
  },
});
