// honeyhouse: boons + challenge. Spec: docs/voyage/charms-design.md (theme `honeyhouse`).
import { cardId } from '../../rules.js';
import { defineCharm } from '../registry.js';
import { countHome, rankMask, rankName, rankOf, suitMask, suitOf } from './kit.js';
import { stream } from '../rng.js';

// The queen is the cap. The sealed band grows downward from her; Kings stay open.
function combRange(s) {
  if (s <= 2) return [12, 12];
  if (s <= 4) return [11, 12];
  if (s <= 6) return [9, 12];
  return [7, 12];
}

const RANK_BADGE = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
const rankBadge = (rank) => RANK_BADGE[rank] || String(rank);

defineCharm({
  id: 'honeyhouse.forager', kind: 'boon', theme: 'honeyhouse', name: 'Forager', icon: '🐝',
  text: 'The first time each suit reaches 5 cards home, +1 undo, up to 2 per board.',
  on: {
    foundation(ctx, { card }) {
      if (rankOf(card) !== 5 || (ctx.memo.grants || 0) >= 2) return;
      const suit = suitOf(card);
      ctx.memo.suits ??= {};
      if (ctx.memo.suits[suit]) return;
      ctx.memo.suits[suit] = true;
      ctx.memo.grants = (ctx.memo.grants || 0) + 1;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'honeyhouse.nectar', kind: 'boon', theme: 'honeyhouse', name: 'Nectar', icon: '🍯',
  text: '+12 points for every heart sent home.',
  score(sb) {
    const n = countHome(sb.history, (id) => suitOf(id) === 2);
    if (n) sb.add('nectar', 'Hearts home', n * 12);
  },
});

defineCharm({
  id: 'honeyhouse.stores', kind: 'boon', theme: 'honeyhouse', name: 'Winter Stores', icon: '🛖',
  text: 'From board 4 on, start with +1 undo and score that board ×1.05.',
  on: {
    start(ctx) { if (ctx.run.boardIdx >= 3) ctx.api.addUndos(1); },
  },
  score(sb, ctx) {
    if (ctx.run.boardIdx >= 3) sb.mult('Winter Stores', 1.05);
  },
});

defineCharm({
  id: 'honeyhouse.challenge', kind: 'challenge', theme: 'honeyhouse', name: 'Capped Comb', icon: '🍯',
  tags: ['STACK'],
  text: (s) => {
    const [lo, hi] = combRange(s);
    return lo === hi
      ? "Nothing can be placed on one suit's Queens."
      : `Nothing can be placed on one suit's ${rankName(lo)}s through Queens.`;
  },
  ease: (ctx) => -0.07 * ctx.strength,
  rules(r, ctx) {
    const [lo, hi] = combRange(ctx.strength);
    const ranks = [];
    for (let rank = lo; rank <= hi; rank++) ranks.push(rank);
    r.barren = { suits: suitMask(ctx.rng.int(4)), ranks: rankMask(...ranks) };
  },
  setup(_board, ctx) {
    const suit = stream(ctx.seed, 'rules', ctx.run.boardIdx, ctx.id).int(4);
    const [lo, hi] = combRange(ctx.strength);
    const ids = [];
    for (let rank = lo; rank <= hi; rank++) ids.push(cardId(suit, rank));
    ctx.api.mark(ids, 'cap');
    const pip = ['♣', '♦', '♥', '♠'][suit];
    ctx.api.badge(lo === hi ? `${pip} ${rankBadge(lo)}` : `${pip} ${rankBadge(lo)}–${rankBadge(hi)}`);
  },
});
