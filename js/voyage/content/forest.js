// forest: boons + challenge. Spec: docs/voyage/charms-design.md (theme `forest`).
import { defineCharm } from '../registry.js';
import { ALL_RANKS, cardsOfRanks, countHome, rankMask, suitMask } from './kit.js';

function clubBarrenRanks(strength) {
  const min = Math.max(1, 14 - 2 * strength);
  let mask = 0;
  for (let rank = min; rank <= 13; rank++) mask |= 1 << rank;
  return mask;
}

defineCharm({
  id: 'forest.changeling',
  kind: 'boon',
  theme: 'forest',
  name: 'Changeling',
  icon: '🧚',
  text: 'Jacks are wild: they ignore colour when stacking.',
  ease: 0.25,
  rules(r) {
    r.wildRanks = (r.wildRanks || 0) | rankMask(11);
  },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks([11]), 'wild'); },
});

defineCharm({
  id: 'forest.fireflies',
  kind: 'boon',
  theme: 'forest',
  name: 'Firefly Jar',
  icon: '✨',
  text: 'Each board, 4 buried cards glow; +50 for each one you send home.',
  setup(board, ctx) {
    const buried = board.state.tableau.flatMap((col) => col.slice(0, -1));
    const pool = [...buried];
    const picks = [];
    for (let i = 0; i < 4 && pool.length; i++) {
      const j = Math.floor(ctx.rng() * pool.length);
      picks.push(pool.splice(j, 1)[0]);
    }
    ctx.memo.fireflies = picks;
    if (picks.length) ctx.api.mark(picks, 'glow');
  },
  score(sb, ctx) {
    const ids = new Set(ctx.memo.fireflies || []);
    const home = countHome(sb.history, (id) => ids.has(id));
    if (home) sb.add('fireflies', 'Firefly Jar', home * 50);
  },
});

defineCharm({
  id: 'forest.moss',
  kind: 'boon',
  theme: 'forest',
  name: 'Mossy Bed',
  icon: '🌱',
  text: 'Clubs may also be built down in suit.',
  ease: 0.2,
  rules(r) {
    r.suitBuild = (r.suitBuild || 0) | suitMask(0);
  },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks(ALL_RANKS, [0]), 'wild'); },
});

defineCharm({
  id: 'forest.challenge',
  kind: 'challenge',
  theme: 'forest',
  name: 'Bramble',
  icon: '🌿',
  tags: ['STACK'],
  text: (s) => {
    const min = Math.max(1, 14 - 2 * s);
    const label = min >= 11 ? 'Jack' : min >= 10 ? 'Ten' : String(min);
    return `Nothing can be placed onto Clubs ranked ${label} or higher.`;
  },
  ease: (ctx) => -0.1 * ctx.strength,
  rules(r, ctx) {
    r.barren = { suits: suitMask(0), ranks: clubBarrenRanks(ctx.strength) };
  },
  setup(_board, ctx) {
    const min = Math.max(1, 14 - 2 * ctx.strength);
    const ranks = [];
    for (let rank = min; rank <= 13; rank++) ranks.push(rank);
    ctx.api.mark(cardsOfRanks(ranks, [0]), 'bar');
  },
});
