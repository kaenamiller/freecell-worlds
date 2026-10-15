// diner: boons + challenge. Spec: docs/voyage/charms-design.md (theme `diner`).
import { defineCharm } from '../registry.js';
import { cardsOfRanks, countHome, rankOf, replay } from './kit.js';

const rankBadge = (rank) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[rank] || String(rank));

function plateStackCells(strength) {
  if (strength <= 2) return 2;
  if (strength <= 5) return 3;
  return 4;
}

defineCharm({
  id: 'diner.blueplate',
  kind: 'boon',
  theme: 'diner',
  name: 'Blue Plate Special',
  icon: '🍽️',
  family: 'coin',
  text: 'Each board features a rank; send all four of it home before 30 cards are home for 12 coins.',
  upgrade: 'Send all four of that rank home before 30 cards are home for 20 coins.',
  setup(board, ctx) {
    ctx.memo.rank = ctx.rng.int(13) + 1;
    ctx.api.mark(cardsOfRanks([ctx.memo.rank]), 'star');
    ctx.api.badge(rankBadge(ctx.memo.rank));
  },
  score(sb, ctx) {
    const rank = ctx.memo.rank;
    if (!rank) return;
    const pay = ctx.level >= 2 ? 20 : 12;
    let homes = sb.initial?.found?.reduce((n, rank) => n + rank, 0) || 0;
    let rankHomes = 0;
    let won = false;
    replay(sb, (m) => {
      if (m.t !== 'F') return;
      homes++;
      if (rankOf(m.card) === rank) {
        rankHomes++;
        if (rankHomes === 4 && homes < 30) won = true;
      }
    });
    if (won) sb.addCoins('blueplate', `Blue plate (${rankBadge(rank)})`, pay);
  },
});

defineCharm({
  id: 'diner.coffee',
  kind: 'boon',
  theme: 'diner',
  name: 'Bottomless Coffee',
  icon: '☕',
  family: 'undo',
  text: '+1 undo at the start of every board.',
  upgrade: '+2 undos at the start of every board.',
  ease: 0.15,
  on: {
    start(ctx) {
      ctx.api.addUndos(ctx.level >= 2 ? 2 : 1);
    },
  },
});

defineCharm({
  id: 'diner.tipjar',
  kind: 'boon',
  theme: 'diner',
  name: 'Tip Jar',
  icon: '🫙',
  family: 'coin',
  text: 'At every port, +2 coins for each board cleared so far.',
  upgrade: 'At every port, +3 coins for each board cleared so far.',
  onPort(run, ctx) {
    const per = ctx.level >= 2 ? 3 : 2;
    const cleared = run.results.length;
    if (cleared) ctx.api.addCoins(cleared * per);
  },
});

defineCharm({
  id: 'diner.challenge',
  kind: 'challenge',
  theme: 'diner',
  name: 'Plate Stack',
  icon: '🍽️',
  tags: ['CELLS'],
  text: (s) => {
    const k = plateStackCells(s);
    if (k === 4) return 'Your free cells stack like plates: they fill left to right, and only the last card put in can come out.';
    return `Your first ${k} free cells stack like plates: they fill left to right, and only the last card put in can come out.`;
  },
  ease: (ctx) => -0.08 * ctx.strength,
  rules(r, ctx) {
    r.cellStack = plateStackCells(ctx.strength);
  },
});
