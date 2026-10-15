// conservatory: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `conservatory`).
import { defineCharm } from '../registry.js';
import { cardsOfRanks, ranksIn } from './kit.js';

function expandWildRanks(mask, level) {
  let expanded = mask;
  for (const rank of ranksIn(mask)) {
    if (rank > 1) expanded |= 1 << (rank - 1);
    if (level >= 2 && rank < 13) expanded |= 1 << (rank + 1);
  }
  return expanded;
}

defineCharm({
  id: 'conservatory.graft',
  kind: 'boon',
  theme: 'conservatory',
  name: 'Grafting',
  icon: '🌿',
  family: 'wild',
  text: 'The rank below each of your wild ranks is also wild.',
  upgrade: '…and the rank above.',
  ease: 0.2,
  rulesAfter(r, ctx) {
    if (!r.wildRanks) return;
    r.wildRanks = expandWildRanks(r.wildRanks, ctx.level);
  },
  setup(_board, ctx) {
    const ranks = ranksIn(ctx.api.rules?.wildRanks || 0);
    if (ranks.length) ctx.api.mark(cardsOfRanks(ranks), 'wild');
  },
});

defineCharm({
  id: 'conservatory.mist',
  kind: 'boon',
  theme: 'conservatory',
  name: 'Misting System',
  icon: '💧',
  family: 'cells',
  text: 'Each board, the first few cards you put into free cells give +1 undo each: one card per cells-family boon you hold (this one included).',
  upgrade: 'One more card counts.',
  on: {
    freecell(ctx) {
      const cap = ctx.family('cells') + (ctx.level >= 2 ? 1 : 0);
      const n = ctx.memo.mistGrants ?? 0;
      if (n >= cap) return;
      ctx.memo.mistGrants = n + 1;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'conservatory.seedbank',
  kind: 'boon',
  theme: 'conservatory',
  name: 'Seed Bank',
  icon: '🌰',
  family: 'coin',
  text: 'Each 3★ board plants a seed; at every port, each seed pays 3 coins.',
  upgrade: '5 coins per seed.',
  onPort(run, ctx) {
    const seeds = run.results.filter((r) => r.stars >= 3).length;
    const per = ctx.level >= 2 ? 5 : 3;
    if (seeds) ctx.api.addCoins(seeds * per);
  },
});

defineCharm({
  id: 'conservatory.challenge',
  kind: 'challenge',
  theme: 'conservatory',
  name: 'Root Bound',
  icon: '🪴',
  tags: ['CELLS'],
  text: (s) => `${['', '', '2s', '2s and 3s', '2s through 4s', '2s through 5s'][1 + Math.ceil(s / 2)]} that go into a free cell take root: they can only leave by going home.`,
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
