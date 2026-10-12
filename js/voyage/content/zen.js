// zen: boons + challenge. Spec: docs/voyage/charms-design.md (theme `zen`).
import { defineCharm } from '../registry.js';
import { SCORE } from '../config.js';

defineCharm({
  id: 'zen.stillness',
  kind: 'boon',
  theme: 'zen',
  name: 'Stillness',
  icon: '🪷',
  text: 'Free-cell placements cost half the usual points (10 per card).',
  score(sb) {
    const line = sb.lines.find((l) => l.key === 'freecells');
    if (!line) return;
    const halfCost = SCORE.freeCellCost / 2;
    line.pts = Math.max(0, SCORE.freeCellBudget - sb.stat.freeCellPlacements * halfCost);
  },
});

defineCharm({
  id: 'zen.calm',
  kind: 'boon',
  theme: 'zen',
  name: 'Calm Waters',
  icon: '🎐',
  text: 'Every board is dealt half a tier gentler.',
  dealShift: -0.5,
});

defineCharm({
  id: 'zen.mindful',
  kind: 'boon',
  theme: 'zen',
  name: 'Mindful Pace',
  icon: '🍵',
  text: '×1.15 score when you finish at or under par.',
  score(sb) {
    if (sb.stat.moves <= sb.par) sb.mult('Mindful Pace', 1.15);
  },
});

defineCharm({
  id: 'zen.challenge',
  kind: 'challenge',
  theme: 'zen',
  name: 'Raked Sand',
  icon: '〰️',
  tags: ['SCORE'],
  text: (s) => `Every move over par costs ${4 + 2 * s} points.`,
  score(sb, ctx) {
    const over = sb.stat.moves - sb.par;
    if (over > 0) sb.add('raked', 'Raked Sand', -over * (4 + 2 * ctx.strength));
  },
});
