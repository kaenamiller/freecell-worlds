// toybox: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `toybox`).
// Complex: toybox.jackinbox in ./special/toybox.jackinbox.js
import { defineCharm } from '../registry.js';
import { cardsOfRanks, rankMask, rankName, replay, suitMask } from './kit.js';
import { stream } from '../rng.js';

const TOWER = { 1: [6, 6], 2: [5, 7], 3: [5, 8], 4: [4, 8], 5: [4, 9], 6: [4, 10], 7: [4, 10] };

defineCharm({
  id: 'toybox.foursquare',
  kind: 'boon',
  theme: 'toybox',
  name: 'Building Blocks',
  icon: '🧱',
  family: 'wild',
  text: 'You can move 1 more card at once for each wild-family boon you hold (this one included).',
  upgrade: '2 more per boon.',
  ease: 0.2,
  rules(r, ctx) {
    const n = ctx.family('wild') || 1;
    const step = ctx.level === 2 ? 2 : 1;
    r.moveBonus = (r.moveBonus || 0) + step * n;
  },
});

defineCharm({
  id: 'toybox.tidyup',
  kind: 'boon',
  theme: 'toybox',
  name: 'Tidy Up',
  icon: '📦',
  family: 'coin',
  text: '+3 coins each time you empty a column before 20 cards are home.',
  upgrade: '+5.',
  score(sb, ctx) {
    if (!sb.initial) return;
    const per = ctx.level === 2 ? 5 : 3;
    let prev = sb.initial.tableau.map((col) => col.length);
    let coins = 0;
    replay(sb, (_move, state) => {
      const home = state.found.reduce((n, rank) => n + rank, 0);
      state.tableau.forEach((col, i) => {
        if (col.length === 0 && prev[i] > 0 && home < 20) coins += per;
      });
      prev = state.tableau.map((col) => col.length);
    });
    if (coins) sb.addCoins('tidyup', 'Tidy Up', coins);
  },
});

defineCharm({
  id: 'toybox.challenge',
  kind: 'challenge',
  theme: 'toybox',
  name: 'Tipped Tower',
  icon: '🧱',
  tags: ['STACK'],
  text: (s) => {
    const [lo, hi] = TOWER[s];
    return lo === hi
      ? `Nothing can be placed on one suit's ${rankName(lo)}s.`
      : `Nothing can be placed on one suit's ${rankName(lo)}s through ${rankName(hi)}s.`;
  },
  ease: (ctx) => -0.07 * ctx.strength,
  rules(r, ctx) {
    const [lo, hi] = TOWER[ctx.strength];
    const ranks = [];
    for (let rank = lo; rank <= hi; rank++) ranks.push(rank);
    r.barren = { suits: suitMask(ctx.rng.int(4)), ranks: rankMask(...ranks) };
  },
  setup(board, ctx) {
    const suit = stream(ctx.seed, 'rules', ctx.run.boardIdx, ctx.id).int(4);
    const [lo, hi] = TOWER[ctx.strength];
    const ranks = [];
    for (let rank = lo; rank <= hi; rank++) ranks.push(rank);
    ctx.api.mark(cardsOfRanks(ranks, [suit]), 'bar');
    ctx.api.badge(`${['♣', '♦', '♥', '♠'][suit]} ${lo === hi ? rankName(lo) : `${rankName(lo)}–${rankName(hi)}`}`);
  },
});
