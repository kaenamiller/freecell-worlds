// mint: boons + challenge. Spec: docs/voyage/charms-design.md (theme `mint`).
import { defineCharm } from '../registry.js';
import { ALL_RANKS, cardsOfRanks, rankMask, suitMask } from './kit.js';

defineCharm({
  id: 'mint.sterling',
  kind: 'boon',
  theme: 'mint',
  name: 'Sterling',
  icon: '🪙',
  text: 'Diamonds may also be built down in suit.',
  ease: 0.2,
  rules(r) {
    r.suitBuild = (r.suitBuild || 0) | suitMask(1);
  },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks(ALL_RANKS, [1]), 'wild'); },
});

defineCharm({
  id: 'mint.interest',
  kind: 'boon',
  theme: 'mint',
  name: 'Compound Interest',
  icon: '📈',
  text: 'Each board scores +4% per board already cleared.',
  score(sb, ctx) {
    const cleared = ctx.run.boardIdx;
    if (cleared) sb.mult('Compound Interest', 1 + cleared * 0.04);
  },
});

defineCharm({
  id: 'mint.treasury',
  kind: 'boon',
  theme: 'mint',
  name: 'Treasury',
  icon: '🏦',
  text: '+2 undos after every board you clear without using an undo.',
  on: {
    win(ctx, { result }) {
      if (!result.undosUsed) ctx.api.addUndos(2);
    },
  },
});

defineCharm({
  id: 'mint.challenge',
  kind: 'challenge',
  theme: 'mint',
  name: 'Small Change',
  icon: '🪙',
  tags: ['CELLS'],
  text: (s) => {
    const hi = 1 + Math.ceil(s / 2);
    return hi <= 2
      ? 'Cards ranked 2 can\'t enter free cells.'
      : `Cards ranked 2–${hi} can't enter free cells.`;
  },
  ease: (ctx) => -0.07 * ctx.strength,
  rules(r, ctx) {
    const hi = 1 + Math.ceil(ctx.strength / 2);
    let mask = 0;
    for (let rank = 2; rank <= hi; rank++) mask |= rankMask(rank);
    r.noCellRanks = mask;
  },
  setup(_board, ctx) {
    const hi = 1 + Math.ceil(ctx.strength / 2);
    const ranks = [];
    for (let rank = 2; rank <= hi; rank++) ranks.push(rank);
    ctx.api.mark(cardsOfRanks(ranks), 'lock');
  },
});
