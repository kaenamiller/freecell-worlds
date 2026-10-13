// lowtide: boons + challenge. Spec: docs/voyage/charms-design.md (theme `lowtide`).
// Complex: lowtide.tidepool in ./special/lowtide.tidepool.js
import { defineCharm } from '../registry.js';
import { cardsOfRanks, chainsOf, rankMask, suitMask } from './kit.js';

const barrenSuits = (s) => 1 + Math.floor((s - 1) / 2);

defineCharm({
  id: 'lowtide.rockpool',
  kind: 'boon',
  theme: 'lowtide',
  name: 'Rock Pool',
  icon: '🪸',
  family: 'cells',
  text: 'One extra free cell that only takes cards ranked 5 or lower.',
  upgrade: 'That cell takes cards ranked 7 or lower.',
  ease: 0.15,
  rules(r, ctx) {
    const slot = r.freeCells;
    r.freeCells += 1;
    r.cellLimits = (r.cellLimits || []).slice();
    while (r.cellLimits.length < r.freeCells) r.cellLimits.push(null);
    r.cellLimits[slot] = { maxRank: ctx.level >= 2 ? 7 : 5 };
  },
  setup(_board, ctx) {
    const max = ctx.level >= 2 ? 7 : 5;
    ctx.api.mark(cardsOfRanks([1, 2, 3, 4, 5, 6, 7].filter((rank) => rank <= max)), 'star');
  },
});

defineCharm({
  id: 'lowtide.starfish',
  kind: 'boon',
  theme: 'lowtide',
  name: 'Starfish',
  icon: '⭐',
  family: 'coin',
  text: '+3 coins for each chain of 5+ cards home before 40 cards are home.',
  upgrade: '+5 coins for each such chain.',
  score(sb, ctx) {
    const pay = ctx.level >= 2 ? 5 : 3;
    let homes = sb.initial?.found?.reduce((n, rank) => n + rank, 0) || 0;
    let paid = 0;
    for (const chain of chainsOf(sb.history)) {
      if (chain.length >= 5 && homes + chain.length < 40) paid++;
      homes += chain.length;
    }
    if (paid) sb.addCoins('starfish', 'Starfish chains', paid * pay);
  },
});

defineCharm({
  id: 'lowtide.challenge',
  kind: 'challenge',
  theme: 'lowtide',
  name: 'Barnacles',
  icon: '🐚',
  tags: ['STACK'],
  text: (s) => `Nothing can be placed on the Kings of ${barrenSuits(s)} suit${barrenSuits(s) > 1 ? 's' : ''}.`,
  ease: (ctx) => -Math.min(1, 0.12 * barrenSuits(ctx.strength)),
  rules(r, ctx) {
    const n = barrenSuits(ctx.strength);
    const suits = ctx.rng.shuffle([0, 1, 2, 3]).slice(0, n);
    r.barren = { suits: suitMask(...suits), ranks: rankMask(13) };
  },
  setup(board, ctx) {
    const suits = [];
    const mask = ctx.api.rules?.barren?.suits || 0;
    for (let s = 0; s < 4; s++) if (mask & (1 << s)) suits.push(s);
    if (suits.length) {
      ctx.api.mark(cardsOfRanks([13], suits), 'bar');
      ctx.api.badge(suits.map((s) => ['♣', '♦', '♥', '♠'][s]).join(' '));
    }
  },
});
