// runes: boons + challenge. Spec: docs/voyage/charms-design.md (theme `runes`).
import { defineCharm } from '../registry.js';
import { cardsOfRanks, countHome, isCourt, rankMask, rankName } from './kit.js';
import { stream } from '../rng.js';

const harborRank = (s) => (s <= 2 ? 11 : s <= 4 ? 12 : 13);
const woadRank = (rng) => 5 + rng.int(5);

defineCharm({
  id: 'runes.amber', kind: 'boon', theme: 'runes', name: 'Amber', icon: '🟠',
  text: '+14 points for every Jack, Queen and King sent home.',
  score(sb) {
    const n = countHome(sb.history, isCourt);
    if (n) sb.add('amber', 'Courts home', n * 14);
  },
});

defineCharm({
  id: 'runes.keel', kind: 'boon', theme: 'runes', name: 'Keel', icon: '🛶',
  text: 'Your first chain of 9 or more cards home grants +1 undo.',
  on: {
    foundation(ctx) {
      ctx.memo.chain = (ctx.memo.chain || 0) + 1;
      if (!ctx.memo.paid && ctx.memo.chain >= 9) {
        ctx.memo.paid = true;
        ctx.api.addUndos(1);
      }
    },
    move(ctx, { move }) {
      if (move.t !== 'F') ctx.memo.chain = 0;
    },
  },
});

defineCharm({
  id: 'runes.woad', kind: 'boon', theme: 'runes', name: 'Woad', icon: '🫐',
  text: 'Each board, one rank from 5 through 9 is wild.',
  ease: 0.2,
  rules(r, ctx) {
    r.wildRanks = (r.wildRanks || 0) | rankMask(woadRank(ctx.rng));
  },
  setup(_board, ctx) {
    const rank = woadRank(stream(ctx.seed, 'rules', ctx.run.boardIdx, ctx.id));
    ctx.api.mark(cardsOfRanks([rank]), 'wild');
    ctx.api.badge(rankName(rank));
  },
});

defineCharm({
  id: 'runes.challenge', kind: 'challenge', theme: 'runes', name: 'Frozen Harbor', icon: '🧊',
  tags: ['COLUMN'],
  text: (s) => {
    const rank = harborRank(s);
    return rank === 13
      ? 'Empty columns only accept Kings.'
      : `Empty columns only accept ${rankName(rank)}s and above.`;
  },
  ease: (ctx) => -0.08 * ctx.strength,
  rules(r, ctx) { r.emptyMinRank = harborRank(ctx.strength); },
});
