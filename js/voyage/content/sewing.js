// sewing: boons + challenge. Spec: docs/voyage/charms-design.md (theme `sewing`).
import { defineCharm } from '../registry.js';
import { cardsOfRanks, countHome, rankMask, rankName, suitMask, suitOf } from './kit.js';

function snagRanks(s) {
  if (s <= 2) return [13];
  if (s <= 4) return [12, 13];
  return [11, 12, 13];
}

defineCharm({
  id: 'sewing.thread', kind: 'boon', theme: 'sewing', name: 'Red Thread', icon: '🧵',
  text: 'Hearts may also be built down in suit.',
  ease: 0.15,
  rules(r) { r.suitBuild = (r.suitBuild || 0) | suitMask(2); },
});

defineCharm({
  id: 'sewing.button', kind: 'boon', theme: 'sewing', name: 'Button', icon: '🔘',
  text: 'The first time you empty a column, +1 undo.',
  on: {
    columnEmpty(ctx) {
      if (ctx.memo.paid) return;
      ctx.memo.paid = true;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'sewing.ribbon', kind: 'boon', theme: 'sewing', name: 'Ribbon', icon: '🎀',
  text: '+14 points for every heart sent home.',
  score(sb) {
    const n = countHome(sb.history, (id) => suitOf(id) === 2);
    if (n) sb.add('ribbon', 'Hearts home', n * 14);
  },
});

defineCharm({
  id: 'sewing.challenge', kind: 'challenge', theme: 'sewing', name: 'Snag', icon: '📌',
  tags: ['CELLS'],
  text: (s) => {
    const names = snagRanks(s).map((rank) => `${rankName(rank)}s`);
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
    return `${list} can't enter free cells.`;
  },
  ease: (ctx) => -0.07 * ctx.strength,
  rules(r, ctx) { r.noCellRanks = rankMask(...snagRanks(ctx.strength)); },
  setup(_board, ctx) {
    const ranks = snagRanks(ctx.strength);
    ctx.api.mark(cardsOfRanks(ranks), 'lock');
    ctx.api.badge(ranks.map(rankName).join(' '));
  },
});
