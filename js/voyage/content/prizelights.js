// prizelights: boons + challenge. Spec: docs/voyage/charms-design.md (theme `prizelights`).
import { defineCharm } from '../registry.js';
import { cardsOfRanks, rankMask, rankName } from './kit.js';
import { stream } from '../rng.js';

const lockCount = (s) => (s <= 2 ? 1 : s <= 5 ? 2 : 3);

function lockRanks(strength, rng) {
  const n = lockCount(strength);
  const start = 2 + rng.int(13 - n);
  return Array.from({ length: n }, (_, i) => start + i);
}

defineCharm({
  id: 'prizelights.puzzle', kind: 'boon', theme: 'prizelights', name: "Today's Puzzle", icon: '🎡',
  text: 'Each board, one rank from 3 through 10 is wild.',
  ease: 0.2,
  rules(r, ctx) {
    const rank = 3 + ctx.rng.int(8);
    r.wildRanks = (r.wildRanks || 0) | rankMask(rank);
  },
  setup(board, ctx) {
    const rank = 3 + stream(ctx.seed, 'rules', ctx.run.boardIdx, ctx.id).int(8);
    ctx.api.mark(cardsOfRanks([rank]), 'wild');
    ctx.api.badge(rankName(rank));
  },
});

defineCharm({
  id: 'prizelights.applause', kind: 'boon', theme: 'prizelights', name: 'Applause', icon: '👏',
  text: '+25 points for every card in your longest run home, when that run is at least 4.',
  score(sb) {
    const longest = sb.stat.chains.length ? Math.max(...sb.stat.chains) : 0;
    if (longest >= 4) sb.add('applause', `Applause (chain ${longest})`, longest * 25);
  },
});

defineCharm({
  id: 'prizelights.champion', kind: 'boon', theme: 'prizelights', name: 'Returning Champion', icon: '🏆',
  text: 'If the previous board was 3 stars, start this one with +1 undo.',
  on: {
    start(ctx) {
      if (ctx.run.results.at(-1)?.stars === 3) ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'prizelights.challenge', kind: 'challenge', theme: 'prizelights', name: 'Lockout', icon: '🔒',
  tags: ['CELLS'],
  text: (s) => {
    const n = lockCount(s);
    return n === 1
      ? "One rank, never an Ace, can't enter free cells."
      : `${n} consecutive ranks, never Aces, can't enter free cells.`;
  },
  ease: (ctx) => -0.07 * ctx.strength,
  rules(r, ctx) {
    r.noCellRanks = rankMask(...lockRanks(ctx.strength, ctx.rng));
  },
  setup(board, ctx) {
    const ranks = lockRanks(ctx.strength, stream(ctx.seed, 'rules', ctx.run.boardIdx, ctx.id));
    ctx.api.mark(cardsOfRanks(ranks), 'lock');
    ctx.api.badge(ranks.map(rankName).join(' '));
  },
});
