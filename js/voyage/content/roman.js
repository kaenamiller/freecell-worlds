// roman: boons + challenge. Spec: docs/voyage/charms-design.md (theme `roman`).
import { defineCharm } from '../registry.js';
import { cardsOfRanks, countHome, rankMask, rankOf, ranksIn } from './kit.js';

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
  text: 'Tens are wild: they stack on either colour, and either colour stacks on them.',
  ease: 0.25,
  rules(r) {
    r.wildRanks = (r.wildRanks || 0) | rankMask(10);
  },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks([10]), 'wild'); },
});

defineCharm({
  id: 'roman.colonnade',
  kind: 'boon',
  theme: 'roman',
  name: 'Colonnade',
  icon: '🏛️',
  text: 'Empty columns triple, rather than double, how many cards you can move at once.',
  ease: 0.4,
  rules(r) {
    r.emptyFactor = Math.max(r.emptyFactor || 2, 3);
  },
});

defineCharm({
  id: 'roman.laurel',
  kind: 'boon',
  theme: 'roman',
  name: 'Laurel Crown',
  icon: '🌿',
  text: '+60 points for each suit you complete on a board.',
  score(sb) {
    const kings = countHome(sb.history, (id) => rankOf(id) === 13);
    if (kings) sb.add('laurel', 'Laurel Crown', kings * 60);
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
    if (s <= 2) return 'Court cards can\'t enter free cells: Kings only.';
    if (s <= 4) return 'Court cards can\'t enter free cells: Kings and Queens.';
    if (s <= 6) return 'Court cards can\'t enter free cells: Kings, Queens and Jacks.';
    return 'Court cards can\'t enter free cells: Kings, Queens, Jacks and Tens.';
  },
  ease: (ctx) => -0.12 * ctx.strength,
  rules(r, ctx) {
    r.noCellRanks = (r.noCellRanks || 0) | senateNoCellRanks(ctx.strength);
  },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks(ranksIn(senateNoCellRanks(ctx.strength))), 'lock'); },
});
