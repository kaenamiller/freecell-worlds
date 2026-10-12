// conservatory: boons + challenge. Spec: docs/voyage/charms-design.md (theme `conservatory`).
import { defineCharm } from '../registry.js';
import { isRed } from '../../rules.js';
import { SCORE } from '../config.js';
import { cardsOfRanks, rankMask, replay } from './kit.js';

defineCharm({
  id: 'conservatory.graft',
  kind: 'boon',
  theme: 'conservatory',
  name: 'Grafting',
  icon: '🌿',
  text: 'Fives are wild: they ignore colour when stacking.',
  ease: 0.2,
  rules(r) {
    r.wildRanks = (r.wildRanks || 0) | rankMask(5);
  },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks([5]), 'wild'); },
});

defineCharm({
  id: 'conservatory.mist',
  kind: 'boon',
  theme: 'conservatory',
  name: 'Misting System',
  icon: '💧',
  text: 'Red cards cost no points in free cells.',
  score(sb) {
    let redCells = 0;
    replay(sb, (move) => {
      if (move.t === 'C' && isRed(move.card)) redCells++;
      if (move.t === 'R' && move.to?.kind === 'free' && isRed(move.card)) redCells++;
    });
    if (redCells) sb.add('mist', 'Misting rebate', redCells * SCORE.freeCellCost);
  },
});

defineCharm({
  id: 'conservatory.seedbank',
  kind: 'boon',
  theme: 'conservatory',
  name: 'Seed Bank',
  icon: '🌰',
  text: 'Every board scores +40 for each 3★ board earlier in the run.',
  score(sb, ctx) {
    const perfect = ctx.run.results.filter((r) => r.stars >= 3).length;
    if (perfect) sb.add('seedbank', 'Seed Bank', perfect * 40);
  },
});

defineCharm({
  id: 'conservatory.challenge',
  kind: 'challenge',
  theme: 'conservatory',
  name: 'Root Bound',
  icon: '🪴',
  tags: ['CELLS'],
  // Low cards put down roots: once in a free cell they can only leave to their foundation.
  text: (s) => `${s <= 2 ? 'Twos' : `Cards ranked 2 to ${1 + Math.ceil(s / 2)}`} that enter a free cell take root: they can only leave to their foundation.`,
  ease: (ctx) => -0.08 * ctx.strength,
  rules(r, ctx) {
    for (let k = 2; k <= 1 + Math.ceil(ctx.strength / 2); k++) r.oneWayCellRanks = (r.oneWayCellRanks || 0) | (1 << k);
  },
  setup(_board, ctx) {
    const ranks = [];
    for (let rank = 2; rank <= 1 + Math.ceil(ctx.strength / 2); rank++) ranks.push(rank);
    ctx.api.mark(cardsOfRanks(ranks), 'oneway');
  },
});
