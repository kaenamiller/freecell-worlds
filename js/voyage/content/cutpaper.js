// cutpaper: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `cutpaper`).
// cutpaper.octavo: js/voyage/content/special/cutpaper.octavo.js
import { cardId } from '../../rules.js';
import { defineCharm } from '../registry.js';
import { replay } from './kit.js';

const dealSkewFor = (s) => {
  if (s <= 2) return [8, 8, 7, 7, 6, 6, 5, 5];
  if (s <= 4) return [9, 9, 7, 7, 6, 6, 4, 4];
  if (s <= 6) return [10, 10, 7, 7, 6, 6, 3, 3];
  return [11, 10, 8, 6, 6, 5, 3, 3];
};

defineCharm({
  id: 'cutpaper.musicbox',
  kind: 'boon',
  theme: 'cutpaper',
  name: 'Music Box',
  icon: '🎶',
  family: 'coin',
  text: 'Before your first move, you may stake 5 coins: win 15 if you send 6 cards home in a row while 20 or more are still in play.',
  upgrade: 'Before your first move, you may stake 5 coins: win 25 if you send 6 cards home in a row while 20 or more are still in play.',
  ability: {
    uses: 1,
    when: 'start',
    label: 'Stake 5 coins',
    available: (ctx) => (ctx.run.coins || 0) >= 5 && !ctx.memo.wager,
    async use(ctx) {
      ctx.memo.wager = true;
      ctx.api.notify('Music Box: staked 5 coins on a six-card home run.');
      return true;
    },
  },
  score(sb, ctx) {
    if (!ctx.memo.wager) return;
    sb.addCoins('musicbox-stake', 'Music Box stake', -5);
    let best = 0;
    let run = 0;
    replay(sb, (move, state) => {
      if (move.t === 'F') {
        run++;
        const inPlay = 52 - state.found.reduce((n, r) => n + r, 0);
        if (run >= 6 && inPlay >= 20) best = 1;
      } else {
        run = 0;
      }
    });
    if (best) sb.addCoins('musicbox-win', 'Music Box', ctx.level === 2 ? 25 : 15);
  },
});

defineCharm({
  id: 'cutpaper.crown',
  kind: 'boon',
  theme: 'cutpaper',
  name: 'Paper Crown',
  icon: '👑',
  family: 'sticker',
  text: 'When you take this, the four Kings get Fool stickers: anything may be placed on them.',
  upgrade: 'When upgraded, the Queens get Fool stickers too.',
  onPick(_run, ctx) {
    for (let suit = 0; suit < 4; suit++) ctx.api.addSticker(cardId(suit, 13), 'fool');
  },
  onUpgrade(_run, ctx) {
    for (let suit = 0; suit < 4; suit++) ctx.api.addSticker(cardId(suit, 12), 'fool');
  },
});

defineCharm({
  id: 'cutpaper.challenge',
  kind: 'challenge',
  theme: 'cutpaper',
  name: 'Fold Lines',
  icon: '✂️',
  tags: ['COLUMN'],
  text: (s) => {
    const cols = dealSkewFor(s);
    return `The deal is uneven: columns of ${cols.join('-')}.`;
  },
  ease: (ctx) => -0.08 * ctx.strength,
  rules(r, ctx) {
    r.dealSkew = dealSkewFor(ctx.strength);
  },
});
