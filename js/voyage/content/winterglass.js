// winterglass: boons + challenge. Spec: docs/voyage/charms-design.md (theme `winterglass`).
import { defineCharm } from '../registry.js';
import { SCORE } from '../config.js';
import { cardsOfRanks, rankMask } from './kit.js';

defineCharm({
  id: 'winterglass.prism',
  kind: 'boon',
  theme: 'winterglass',
  name: 'Prism',
  icon: '💎',
  text: 'Queens are wild: they ignore colour when stacking.',
  ease: 0.25,
  rules(r) {
    r.wildRanks = (r.wildRanks || 0) | rankMask(12);
  },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks([12]), 'wild'); },
});

defineCharm({
  id: 'winterglass.snowdrift',
  kind: 'boon',
  theme: 'winterglass',
  name: 'Snowdrift',
  icon: '❄️',
  text: 'Your free-cell point budget is 200 higher.',
  score(sb) {
    const n = sb.stat.freeCellPlacements;
    const line = sb.lines.find((l) => l.key === 'freecells');
    if (line) line.pts = Math.max(0, SCORE.freeCellBudget + 200 - n * SCORE.freeCellCost);
  },
});

defineCharm({
  id: 'winterglass.globe',
  kind: 'boon',
  theme: 'winterglass',
  name: 'Snow Globe',
  icon: '🌨️',
  text: 'The first time each board you fill your last free cell, gain +1 undo.',
  on: {
    freecell(ctx) {
      if (ctx.memo.used) return;
      if (!ctx.api.state.free.every((c) => c !== 0)) return;
      ctx.memo.used = true;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'winterglass.challenge',
  kind: 'challenge',
  theme: 'winterglass',
  name: 'Brittle Glass',
  icon: '🧊',
  tags: ['SCORE'],
  text: (s) => `Each free-cell placement after the ${Math.max(2, 8 - s)}th costs 40 points.`,
  score(sb, ctx) {
    const allowance = Math.max(2, 8 - ctx.strength);
    const extra = Math.max(0, sb.stat.freeCellPlacements - allowance);
    if (extra) sb.add('brittle', 'Brittle Glass', -extra * 40);
  },
});
