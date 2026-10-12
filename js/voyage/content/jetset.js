// jetset: boons + challenge. Spec: docs/voyage/charms-design.md (theme `jetset`).
import { defineCharm } from '../registry.js';
import { SCORE } from '../config.js';

const efficiencyPts = (moves, par) => Math.round(Math.max(0, SCORE.efficiencyMax * (2 - moves / par)));

defineCharm({
  id: 'jetset.overhead', kind: 'boon', theme: 'jetset', name: 'Overhead Bin', icon: '🧳',
  text: 'One extra free cell.',
  rules(r) { r.freeCells += 1; },
});

defineCharm({
  id: 'jetset.firstclass', kind: 'boon', theme: 'jetset', name: 'First Class', icon: '💺',
  text: 'Par is 15% higher when scoring efficiency.',
  score(sb) {
    const line = sb.lines.find((l) => l.key === 'efficiency');
    if (!line) return;
    const par = Math.round(sb.par * 1.15);
    line.label = `Moves ${sb.stat.moves} vs par ${par}`;
    line.pts = efficiencyPts(sb.stat.moves, par);
  },
});

defineCharm({
  id: 'jetset.flyer', kind: 'boon', theme: 'jetset', name: 'Frequent Flyer', icon: '✈️',
  text: '+1 undo after every board you clear, +1 more for 3★.',
  on: {
    win(ctx, { result }) {
      ctx.api.addUndos(1);
      if (result.stars >= 3) ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'jetset.challenge', kind: 'challenge', theme: 'jetset', name: 'Layover', icon: '⏳',
  tags: ['SCORE'],
  text: (s) => `Finish within ${17 - s} minutes; each minute over costs 5% of the board score (up to 50%).`,
  score(sb, ctx) {
    const limit = (17 - ctx.strength) * 60;
    const overMin = Math.max(0, Math.ceil((sb.elapsed - limit) / 60));
    const pct = Math.min(0.5, overMin * 0.05);
    if (pct > 0) sb.add('layover', 'Layover delay', -Math.round(sb.subtotal * pct));
  },
});
