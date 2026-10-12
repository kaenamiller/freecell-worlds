// varsity: boons + challenge. Spec: docs/voyage/charms-design.md (theme `varsity`).
import { defineCharm } from '../registry.js';

defineCharm({
  id: 'varsity.hattrick',
  kind: 'boon',
  theme: 'varsity',
  name: 'Hat Trick',
  icon: '🏅',
  text: '+2 undos after every 3★ board.',
  on: {
    win(ctx, { result }) {
      if (result?.stars === 3) ctx.api.addUndos(2);
    },
  },
});

defineCharm({
  id: 'varsity.spirit',
  kind: 'boon',
  theme: 'varsity',
  name: 'Team Spirit',
  icon: '📣',
  text: 'Every board scores +3% per charm you hold.',
  score(sb, ctx) {
    const held = ctx.run.boons?.length || 0;
    if (held) sb.mult(`Team Spirit (+${held * 3}%)`, 1 + held * 0.03);
  },
});

defineCharm({
  id: 'varsity.comeback',
  kind: 'boon',
  theme: 'varsity',
  name: 'Comeback',
  icon: '💪',
  text: '×1.15 on any board where you used 2+ undos.',
  score(sb) {
    if (sb.undosUsed >= 2) sb.mult('Comeback', 1.15);
  },
});

defineCharm({
  id: 'varsity.challenge',
  kind: 'challenge',
  theme: 'varsity',
  name: 'Rivalry',
  icon: '🏈',
  tags: ['SCORE'],
  text: (s) => `Star thresholds are ${4 * s}% higher.`,
  thresholds(arr, ctx) {
    const bump = 1 + 0.04 * ctx.strength;
    return arr.map((n, i) => (i ? Math.round(n * bump) : n));
  },
});
