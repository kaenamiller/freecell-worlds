// prizelights: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `prizelights`).
import { defineCharm } from '../registry.js';
import { cardsOfRanks, rankMask, rankName } from './kit.js';
import { stream } from '../rng.js';

const maxEmptyAt = (s) => (s <= 2 ? 3 : s <= 4 ? 2 : 1);

function puzzleRanks({ seed, boardIdx, id, level }) {
  const rng = stream(seed, 'rules', boardIdx, id);
  const count = level === 2 ? 2 : 1;
  const ranks = [];
  while (ranks.length < count) {
    const rank = 3 + rng.int(10);
    if (!ranks.includes(rank)) ranks.push(rank);
  }
  return ranks;
}

defineCharm({
  id: 'prizelights.puzzle',
  kind: 'boon',
  theme: 'prizelights',
  name: "Today's Puzzle",
  icon: '🎡',
  family: 'wild',
  text: 'Each board, one rank from 3 to Queen is wild.',
  upgrade: 'Two ranks.',
  ease: 0.2,
  rules(r, ctx) {
    const mask = puzzleRanks({ seed: ctx.seed, boardIdx: ctx.idx, id: ctx.id, level: ctx.level }).reduce((m, rank) => m | rankMask(rank), 0);
    r.wildRanks = (r.wildRanks || 0) | mask;
  },
  setup(_board, ctx) {
    const ranks = puzzleRanks({ seed: ctx.seed, boardIdx: ctx.run.boardIdx, id: 'prizelights.puzzle', level: ctx.level });
    ctx.api.mark(cardsOfRanks(ranks), 'wild');
    ctx.api.badge(ranks.map(rankName).join(' '));
  },
});

defineCharm({
  id: 'prizelights.applause',
  kind: 'boon',
  theme: 'prizelights',
  name: 'Applause',
  icon: '👏',
  family: 'fortune',
  text: 'After a 3★ board, you may take two of the offered boons.',
  upgrade: 'After a 2★ board too.',
  picks(n, ctx) {
    const last = ctx.run.results.at(-1);
    if (!last) return n;
    const stars = last.stars || 0;
    if (stars >= 3 || (ctx.level === 2 && stars >= 2)) return 2;
    return n;
  },
});

defineCharm({
  id: 'prizelights.champion',
  kind: 'boon',
  theme: 'prizelights',
  name: 'Returning Champion',
  icon: '🏆',
  family: 'undo',
  text: 'If the previous board was 3★, start this one with +2 undos.',
  upgrade: '+3.',
  on: {
    start(ctx) {
      if (ctx.run.results.at(-1)?.stars === 3) ctx.api.addUndos(ctx.level === 2 ? 3 : 2);
    },
  },
});

defineCharm({
  id: 'prizelights.challenge',
  kind: 'challenge',
  theme: 'prizelights',
  name: 'Full House',
  icon: '🏠',
  tags: ['COLUMN'],
  text: (s) => {
    const cap = maxEmptyAt(s);
    return `No more than ${cap} column${cap === 1 ? '' : 's'} may be empty at once.`;
  },
  ease: (ctx) => -0.07 * ctx.strength,
  rules(r, ctx) {
    r.maxEmpty = maxEmptyAt(ctx.strength);
  },
});
