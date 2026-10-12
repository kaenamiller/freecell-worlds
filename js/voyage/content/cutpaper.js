// cutpaper: boons + challenge. Spec: docs/voyage/charms-design.md (theme `cutpaper`).
import { defineCharm } from '../registry.js';
import { cardsOfRanks, countHome, rankName, rankOf } from './kit.js';

const creaseRank = (s) => (s <= 2 ? 11 : s <= 4 ? 12 : 13);

defineCharm({
  id: 'cutpaper.octavo', kind: 'boon', theme: 'cutpaper', name: 'Octavo', icon: '📄',
  text: 'Eights are wild: they ignore colour when stacking.',
  ease: 0.2,
  rules(r) { r.wildRanks = (r.wildRanks || 0) | (1 << 8); },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks([8]), 'wild'); },
});

defineCharm({
  id: 'cutpaper.musicbox', kind: 'boon', theme: 'cutpaper', name: 'Music Box', icon: '🎶',
  text: 'Your first chain of 8 or more cards home grants +1 undo.',
  on: {
    foundation(ctx) {
      ctx.memo.chain = (ctx.memo.chain || 0) + 1;
      if (!ctx.memo.paid && ctx.memo.chain >= 8) {
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
  id: 'cutpaper.crown', kind: 'boon', theme: 'cutpaper', name: 'Paper Crown', icon: '👑',
  text: '+22 points for every King sent home.',
  score(sb) {
    const n = countHome(sb.history, (id) => rankOf(id) === 13);
    if (n) sb.add('crown', 'Kings home', n * 22);
  },
});

defineCharm({
  id: 'cutpaper.challenge', kind: 'challenge', theme: 'cutpaper', name: 'Crease', icon: '✂️',
  tags: ['COLUMN'],
  text: (s) => {
    const rank = creaseRank(s);
    return rank === 13
      ? 'Empty columns only accept Kings.'
      : `Empty columns only accept ${rankName(rank)}s and above.`;
  },
  ease: (ctx) => -0.08 * ctx.strength,
  rules(r, ctx) { r.emptyMinRank = creaseRank(ctx.strength); },
});
