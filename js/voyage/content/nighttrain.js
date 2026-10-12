// nighttrain: boons + challenge. Spec: docs/voyage/charms-design.md (theme `nighttrain`).
import { defineCharm } from '../registry.js';
import { SCORE } from '../config.js';

defineCharm({
  id: 'nighttrain.ontime',
  kind: 'boon',
  theme: 'nighttrain',
  name: 'On Time',
  icon: '🕰️',
  text: '×1.15 on any board finished in under 6 minutes.',
  score(sb) {
    if (sb.elapsed < 360) sb.mult('On Time', 1.15);
  },
});

defineCharm({
  id: 'nighttrain.coupling',
  kind: 'boon',
  theme: 'nighttrain',
  name: 'Express Coupling',
  icon: '🔗',
  text: 'You can move 1 more card at once.',
  ease: 0.15,
  rules(r) {
    r.moveBonus = (r.moveBonus || 0) + 1;
  },
});

defineCharm({
  id: 'nighttrain.railpass',
  kind: 'boon',
  theme: 'nighttrain',
  name: 'Rail Pass',
  icon: '🎫',
  text: "You're offered one more charm after each board (up to 3).",
  offers: (n) => n + 1,
});

defineCharm({
  id: 'nighttrain.challenge',
  kind: 'challenge',
  theme: 'nighttrain',
  name: 'Timetable',
  icon: '🚉',
  tags: ['SCORE'],
  text: (s) => `Par is ${5 * s}% shorter when scoring efficiency.`,
  ease: (ctx) => -0.05 * ctx.strength,
  score(sb, ctx) {
    const adjPar = sb.par * (1 - 0.05 * ctx.strength);
    for (const line of sb.lines) {
      if (line.key !== 'efficiency') continue;
      line.pts = Math.round(Math.max(0, SCORE.efficiencyMax * (2 - sb.stat.moves / adjPar)));
      line.label = `Moves ${sb.stat.moves} vs par ${Math.round(adjPar)}`;
    }
  },
});
