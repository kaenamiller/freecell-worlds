// roman: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `roman`).
import { cardsHome } from '../../rules.js';
import { defineCharm } from '../registry.js';
import { cardsOfRanks, rankMask, rankOf, ranksIn, replay, suitOf } from './kit.js';

function senateNoCellRanks(strength) {
  if (strength <= 2) return rankMask(13);
  if (strength <= 4) return rankMask(12, 13);
  if (strength <= 6) return rankMask(11, 12, 13);
  return rankMask(10, 11, 12, 13);
}

defineCharm({
  id: 'roman.legion',
  kind: 'boon',
  theme: 'roman',
  name: 'Legion',
  icon: '🛡️',
  family: 'wild',
  text: 'Tens are wild: they ignore colour when stacking.',
  upgrade: 'Tens and Nines are wild.',
  ease: 0.25,
  rules(r, ctx) {
    const ranks = ctx.level >= 2 ? [9, 10] : [10];
    r.wildRanks = (r.wildRanks || 0) | rankMask(...ranks);
  },
  setup(_board, ctx) {
    ctx.api.mark(cardsOfRanks(ctx.level >= 2 ? [9, 10] : [10]), 'wild');
  },
});

defineCharm({
  id: 'roman.colonnade',
  kind: 'boon',
  theme: 'roman',
  name: 'Colonnade',
  icon: '🏛️',
  family: 'columns',
  text: 'Empty columns triple, rather than double, how many cards you can move at once.',
  upgrade: 'Empty columns quadruple it.',
  ease: 0.4,
  rules(r, ctx) {
    r.emptyFactor = Math.max(r.emptyFactor || 2, ctx.level >= 2 ? 4 : 3);
  },
});

defineCharm({
  id: 'roman.laurel',
  kind: 'boon',
  theme: 'roman',
  name: 'Laurel Crown',
  icon: '🌿',
  family: 'coin',
  text: 'The first suit you complete each board pays 1 coin for every 2 cards still in play at that moment.',
  upgrade: '1 coin for every card still in play.',
  score(sb, ctx) {
    let paid = false;
    replay(sb, (move, state) => {
      if (paid || move.t !== 'F' || rankOf(move.card) !== 13) return;
      const suit = suitOf(move.card);
      if (state.found[suit] !== 13) return;
      paid = true;
      const inPlay = 52 - cardsHome(state);
      const coins = ctx.level >= 2 ? inPlay : Math.floor(inPlay / 2);
      if (coins) sb.addCoins('laurel', 'Laurel Crown', coins, move.card);
    });
  },
});

defineCharm({
  id: 'roman.challenge',
  kind: 'challenge',
  theme: 'roman',
  name: 'Senate Decree',
  icon: '📜',
  tags: ['CELLS'],
  text: (s) => {
    if (s <= 2) return 'Kings can\'t go into free cells.';
    if (s <= 4) return 'Kings and Queens can\'t go into free cells.';
    if (s <= 6) return 'Jacks, Queens and Kings can\'t go into free cells.';
    return 'Tens through Kings can\'t go into free cells.';
  },
  ease: (ctx) => -0.12 * ctx.strength,
  rules(r, ctx) {
    r.noCellRanks = (r.noCellRanks || 0) | senateNoCellRanks(ctx.strength);
  },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks(ranksIn(senateNoCellRanks(ctx.strength))), 'lock'); },
});
