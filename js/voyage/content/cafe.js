// cafe: boons + challenge. Spec: docs/voyage/charms-design.md (theme `cafe`).
import { defineCharm } from '../registry.js';
import { SCORE } from '../config.js';
import { replay, rankOf } from './kit.js';

const efficiencyPoints = (moves, par) => Math.round(Math.max(0, SCORE.efficiencyMax * (2 - moves / par)));

defineCharm({
  id: 'cafe.espresso',
  kind: 'boon',
  theme: 'cafe',
  name: 'Espresso Shot',
  icon: '🫘',
  text: 'Your first 5 moves on each board don\'t count against par.',
  ease: 0.2,
  score(sb) {
    const waived = 5;
    const effective = Math.max(0, sb.stat.moves - waived);
    const line = sb.lines.find((l) => l.key === 'efficiency');
    if (!line) return;
    line.pts = efficiencyPoints(effective, sb.par);
    line.label = `Moves ${sb.stat.moves} vs par ${sb.par} (first ${waived} waived)`;
  },
});

defineCharm({
  id: 'cafe.regulars',
  kind: 'boon',
  theme: 'cafe',
  name: 'Regulars',
  icon: '🪑',
  text: '+3% score per consecutive 2★+ board before this one (up to +15%).',
  score(sb, ctx) {
    let streak = 0;
    for (let i = ctx.run.boardIdx - 1; i >= 0; i--) {
      if ((ctx.run.results[i]?.stars || 0) >= 2) streak++;
      else break;
    }
    const bonus = Math.min(15, streak * 3) / 100;
    if (bonus) sb.mult('Regulars', 1 + bonus);
  },
});

defineCharm({
  id: 'cafe.pastry',
  kind: 'boon',
  theme: 'cafe',
  name: 'Pastry Case',
  icon: '🥐',
  text: '+10 for every Ace, 2 and 3 sent home within your first 30 moves.',
  score(sb) {
    let moves = 0;
    let pts = 0;
    replay(sb, (move) => {
      if (!move.auto) moves++;
      if (move.t === 'F' && moves <= 30 && rankOf(move.card) <= 3) pts += 10;
    });
    if (pts) sb.add('pastry', 'Pastry Case', pts);
  },
});

defineCharm({
  id: 'cafe.challenge',
  kind: 'challenge',
  theme: 'cafe',
  name: 'Last Orders',
  icon: '🔔',
  tags: ['SCORE'],
  text: (s) => `Finish within ${19 - s} minutes or this board is capped at 2★.`,
  starCap(ctx) {
    const limitSec = (19 - ctx.strength) * 60;
    return ctx.elapsed > limitSec ? 2 : 3;
  },
});
