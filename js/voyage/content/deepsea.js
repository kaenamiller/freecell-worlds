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
  text: 'Once per board, find how many moves back the last winnable position was.',
  upgrade: 'Once per board, rewind to the last winnable position without spending undos.',
  ease: (ctx) => (ctx.level >= 2 ? 0.3 : 0.15),
  ability: {
    uses: 1,
    label: 'Sonar ping',
    available: (ctx) => ctx.api.history.some((m) => !m.auto),
    // Level 1 only reports, so it never holds dead-end detection. Level 2 can pull back from a
    // dead end, so it keeps the run alive while unused, but the warning still shows.
    stuck: (ctx) => (ctx.level >= 2 ? 'rescue' : 'none'),
    // Only a found wrong turn spends the charge: clear water, out of range or a lost signal is free.
    async use(ctx) {
      const { api } = ctx;
      const ping = await api.sonar();
      if (!ping) { api.notify('Sonar: signal lost — try again'); return false; }
      if (ping.steps === 0) { api.notify('Sonar: clear water — a win is still possible'); return false; }
      if (ping.steps == null) { api.notify('Sonar: no open water within 10 moves'); return false; }
      const back = `${ping.steps} move${ping.steps === 1 ? '' : 's'}`;
      if (ctx.level < 2) { api.notify(`Sonar: last open water ${back} back`); return true; }
      if (!api.rewind(ping.entries, { free: true })) return false;
      api.notify(`Sonar: pulled back ${back} to open water`);
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
  text: (s) => `Each undo you spend also costs ${Math.ceil(s / 2)} coin${Math.ceil(s / 2) === 1 ? '' : 's'}.`,
  ease: (ctx) => -0.07 * ctx.strength,
  score(sb, ctx) {
    const cost = sb.undosUsed * Math.ceil(ctx.strength / 2);
    if (cost) sb.addCoins('lamprey', 'Lamprey', -cost);
  },
});
