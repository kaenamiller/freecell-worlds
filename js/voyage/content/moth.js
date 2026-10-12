// moth: boons + challenge. Spec: docs/voyage/charms-design.md (theme `moth`).
import { cardId } from '../../rules.js';
import { defineCharm } from '../registry.js';
import { countHome, rankMask, rankName, rankOf, suitMask } from './kit.js';
import { stream } from '../rng.js';

function wingRange(s) {
  if (s <= 2) return [13, 13];
  if (s <= 4) return [12, 13];
  if (s <= 6) return [11, 13];
  return [10, 13];
}

const RANK_BADGE = { 1: 'A', 10: '10', 11: 'J', 12: 'Q', 13: 'K' };

defineCharm({
  id: 'moth.lampglow', kind: 'boon', theme: 'moth', name: 'Lampglow', icon: '🕯️',
  text: 'The first two Queens sent home each grant +1 undo.',
  on: {
    foundation(ctx, { card }) {
      if (rankOf(card) !== 12 || (ctx.memo.grants || 0) >= 2) return;
      ctx.memo.grants = (ctx.memo.grants || 0) + 1;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'moth.waltz', kind: 'boon', theme: 'moth', name: 'Waltz', icon: '🦋',
  text: 'A run of 8 or more cards home scores this board ×1.1.',
  score(sb) {
    const longest = sb.stat.chains.length ? Math.max(...sb.stat.chains) : 0;
    if (longest >= 8) sb.mult('Waltz', 1.1);
  },
});

defineCharm({
  id: 'moth.silver', kind: 'boon', theme: 'moth', name: 'Tarnished Silver', icon: '🥈',
  text: '+16 points for every King sent home.',
  score(sb) {
    const n = countHome(sb.history, (id) => rankOf(id) === 13);
    if (n) sb.add('silver', 'Kings home', n * 16);
  },
});

defineCharm({
  id: 'moth.challenge', kind: 'challenge', theme: 'moth', name: 'Folded Wings', icon: '🌙',
  tags: ['STACK'],
  text: (s) => {
    const [lo, hi] = wingRange(s);
    return lo === hi
      ? "Nothing can be placed on one suit's Kings."
      : `Nothing can be placed on one suit's ${rankName(lo)}s through Kings.`;
  },
  ease: (ctx) => -0.07 * ctx.strength,
  rules(r, ctx) {
    const [lo, hi] = wingRange(ctx.strength);
    const ranks = [];
    for (let rank = lo; rank <= hi; rank++) ranks.push(rank);
    r.barren = { suits: suitMask(ctx.rng.int(4)), ranks: rankMask(...ranks) };
  },
  setup(_board, ctx) {
    const suit = stream(ctx.seed, 'rules', ctx.run.boardIdx, ctx.id).int(4);
    const [lo, hi] = wingRange(ctx.strength);
    const ids = [];
    for (let rank = lo; rank <= hi; rank++) ids.push(cardId(suit, rank));
    ctx.api.mark(ids, 'bar');
    const pip = ['♣', '♦', '♥', '♠'][suit];
    const badge = (rank) => RANK_BADGE[rank] || String(rank);
    ctx.api.badge(lo === hi ? `${pip} ${badge(lo)}` : `${pip} ${badge(lo)}–${badge(hi)}`);
  },
});
