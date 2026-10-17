// forest: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `forest`).
import { cardsHome } from '../../rules.js';
import { defineCharm } from '../registry.js';
import { ALL_RANKS, cardsOfRanks, rankMask, replay, suitMask } from './kit.js';

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
  family: 'wild',
  text: 'Jacks are wild.',
  upgrade: 'Jacks and Queens are wild.',
  ease: 0.25,
  rules(r, ctx) {
    const ranks = ctx.level >= 2 ? [11, 12] : [11];
    r.wildRanks = (r.wildRanks || 0) | rankMask(...ranks);
  },
  setup(_board, ctx) {
    ctx.api.mark(cardsOfRanks(ctx.level >= 2 ? [11, 12] : [11]), 'wild');
  },
});

defineCharm({
  id: 'forest.fireflies',
  kind: 'boon',
  theme: 'forest',
  name: 'Firefly Jar',
  icon: '✨',
  family: 'coin',
  text: '4 buried cards glow; each one you send home before 26 cards are home pays 3 coins.',
  upgrade: '6 glowing cards, 4 coins each.',
  setup(board, ctx) {
    const buried = board.state.tableau.flatMap((col) => col.slice(0, -1));
    const pool = [...buried];
    const count = ctx.level >= 2 ? 6 : 4;
    const picks = [];
    for (let i = 0; i < count && pool.length; i++) {
      const j = Math.floor(ctx.rng() * pool.length);
      picks.push(pool.splice(j, 1)[0]);
    }
    ctx.memo.fireflies = picks;
    if (picks.length) ctx.api.mark(picks, 'glow');
  },
  score(sb, ctx) {
    const ids = new Set(ctx.memo.fireflies || []);
    if (!ids.size) return;
    const pay = ctx.level >= 2 ? 4 : 3;
    replay(sb, (move, state) => {
      if (move.t !== 'F' || !ids.has(move.card)) return;
      if (cardsHome(state) < 26) sb.addCoins(`firefly.${move.card}`, 'Firefly Jar', pay, move.card);
    });
  },
});

defineCharm({
  id: 'forest.moss',
  kind: 'boon',
  theme: 'forest',
  name: 'Mossy Bed',
  icon: '🌱',
  family: 'suit',
  text: 'Clubs may also be built down in suit.',
  upgrade: 'Clubs may also be built down or up in suit.',
  ease: 0.2,
  rules(r, ctx) {
    r.suitBuild = (r.suitBuild || 0) | suitMask(0);
    if (ctx.level >= 2) r.suitBuildUp = (r.suitBuildUp || 0) | suitMask(0);
  },
  setup(_board, ctx) {
    ctx.api.mark(cardsOfRanks(ALL_RANKS, [0]), 'wild');
  },
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
    if (min <= 1) return 'Nothing can be placed onto any Club.';
    const label = min >= 11 ? 'Jack' : String(min);
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
