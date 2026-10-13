// deepsea: boons + challenge. Spec: docs/voyage/overhaul/ROSTER-52.md (theme `deepsea`).
// Complex: deepsea.current in ./special/deepsea.current.js
import { defineCharm } from '../registry.js';

defineCharm({
  id: 'deepsea.sonar',
  kind: 'boon',
  theme: 'deepsea',
  name: 'Sonar',
  icon: '📡',
  family: 'vision',
  text: 'Once per board, check whether this position can still be won.',
  upgrade: 'Twice per board, check whether this position can still be won.',
  ease: 0.2,
  ability: {
    uses: (ctx) => ctx.level,
    label: 'Sonar ping',
    async use(ctx) {
      const verdict = await ctx.api.solvable();
      if (verdict === true) ctx.api.notify('Sonar: a win is still possible');
      else if (verdict === false) ctx.api.notify('Sonar: no win found from here');
      else ctx.api.notify('Sonar: solver timed out');
      return true;
    },
  },
});

defineCharm({
  id: 'deepsea.openwater',
  kind: 'boon',
  theme: 'deepsea',
  name: 'Open Water',
  icon: '🌊',
  family: 'columns',
  text: 'A column holding a single card still counts as empty for move capacity.',
  upgrade: 'Columns holding up to two cards still count as empty for move capacity.',
  ease: 0.15,
  rules(r, ctx) {
    r.shallowCols = ctx.level >= 2 ? 2 : 1;
  },
});

defineCharm({
  id: 'deepsea.challenge',
  kind: 'challenge',
  theme: 'deepsea',
  name: 'Lamprey',
  icon: '🪱',
  tags: ['SCORE'],
  pressure: true,
  text: (s) => `Each undo you spend costs ${Math.ceil(s / 2)} coins.`,
  ease: (ctx) => -0.07 * ctx.strength,
  score(sb, ctx) {
    const cost = sb.undosUsed * Math.ceil(ctx.strength / 2);
    if (cost) sb.addCoins('lamprey', 'Lamprey', -cost);
  },
});
