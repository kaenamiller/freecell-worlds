// diner: boons + challenge. Spec: docs/voyage/charms-design.md (theme `diner`).
import { defineCharm } from '../registry.js';
import { cardsOfRanks, countHome, rankMask, rankName, rankOf } from './kit.js';
import { stream } from '../rng.js';

const rankBadge = (rank) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[rank] || String(rank));

function bannedRankCount(strength) {
  if (strength <= 3) return 1;
  if (strength <= 6) return 2;
  return 3;
}

defineCharm({
  id: 'diner.blueplate',
  kind: 'boon',
  theme: 'diner',
  name: 'Blue Plate Special',
  icon: '🍽️',
  text: 'Each board features a rank; its four cards are worth +20 each when sent home.',
  setup(board, ctx) {
    ctx.memo.rank = ctx.rng.int(13) + 1;
    ctx.api.mark(cardsOfRanks([ctx.memo.rank]), 'star');
    ctx.api.badge(rankBadge(ctx.memo.rank));
  },
  score(sb, ctx) {
    const rank = ctx.memo.rank;
    if (!rank) return;
    const n = countHome(sb.history, (id) => rankOf(id) === rank);
    if (n) sb.add('blueplate', `Blue plate (${rankName(rank)})`, n * 20);
  },
});

defineCharm({
  id: 'diner.coffee',
  kind: 'boon',
  theme: 'diner',
  name: 'Bottomless Coffee',
  icon: '☕',
  text: '+1 undo at the start of every board.',
  ease: 0.15,
  on: {
    start(ctx) {
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'diner.tipjar',
  kind: 'boon',
  theme: 'diner',
  name: 'Tip Jar',
  icon: '🫙',
  text: 'Every board scores +25 per board already cleared this run.',
  score(sb, ctx) {
    const cleared = ctx.run.results.length;
    if (cleared) sb.add('tipjar', 'Tip jar', cleared * 25);
  },
});

defineCharm({
  id: 'diner.challenge',
  kind: 'challenge',
  theme: 'diner',
  name: "86'd",
  icon: '🚫',
  tags: ['CELLS'],
  text: (s) => {
    const n = bannedRankCount(s);
    return `${n} rank${n > 1 ? 's' : ''} (never Aces or Kings) cannot enter free cells.`;
  },
  ease: (ctx) => -0.08 * ctx.strength,
  rules(r, ctx) {
    const n = bannedRankCount(ctx.strength);
    const ranks = ctx.rng.shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).slice(0, n);
    r.noCellRanks = rankMask(...ranks);
  },
  setup(_board, ctx) {
    const n = bannedRankCount(ctx.strength);
    const ranks = stream(ctx.seed, 'rules', ctx.run.boardIdx, ctx.id).shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).slice(0, n);
    ctx.api.mark(cardsOfRanks(ranks), 'lock');
  },
});
