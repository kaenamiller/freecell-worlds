// toybox: boons + challenge. Spec: docs/voyage/charms-design.md (theme `toybox`).
// Complex: toybox.jackinbox in ./special/toybox.jackinbox.js
import { defineCharm } from '../registry.js';
import { cardsOfRanks, rankMask, rankName, replay, suitMask } from './kit.js';
import { stream } from '../rng.js';

const TOWER = { 1: [6, 6], 2: [5, 7], 3: [5, 8], 4: [4, 8], 5: [4, 9], 6: [4, 10], 7: [4, 10] };

defineCharm({
  id: 'toybox.foursquare', kind: 'boon', theme: 'toybox', name: 'Four Square', icon: '⬛',
  text: 'Fours are wild: they ignore colour when stacking.',
  ease: 0.2,
  rules(r) { r.wildRanks = (r.wildRanks || 0) | rankMask(4); },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks([4]), 'wild'); },
});

defineCharm({
  id: 'toybox.tidyup', kind: 'boon', theme: 'toybox', name: 'Tidy Up', icon: '📦',
  text: '+40 points each time you empty a column.',
  score(sb) {
    if (!sb.initial) return;
    let prev = sb.initial.tableau.map((col) => col.length);
    let n = 0;
    replay(sb, (_move, state) => {
      state.tableau.forEach((col, i) => { if (col.length === 0 && prev[i] > 0) n++; });
      prev = state.tableau.map((col) => col.length);
    });
    if (n) sb.add('tidyup', 'Columns tidied', n * 40);
  },
});

defineCharm({
  id: 'toybox.challenge', kind: 'challenge', theme: 'toybox', name: 'Tipped Tower', icon: '🧱',
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
