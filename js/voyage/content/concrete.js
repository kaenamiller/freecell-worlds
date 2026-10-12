// concrete: boons + challenge. Spec: docs/voyage/charms-design.md (theme `concrete`).
// Complex charms for this theme live in ./special/concrete.*.js.
import { defineCharm } from '../registry.js';
import { SCORE } from '../config.js';

defineCharm({
  id: 'concrete.bankshot',
  kind: 'boon',
  theme: 'concrete',
  name: 'Bank Shot',
  icon: '🏀',
  text: '+12 for each card sent home straight from a free cell.',
  score(sb) {
    const n = sb.history.filter((m) => m.t === 'F' && m.src?.kind === 'free').length;
    if (n) sb.add('bankshot', 'Bank shots', n * 12);
  },
});

defineCharm({
  id: 'concrete.mixtape',
  kind: 'boon',
  theme: 'concrete',
  name: 'Mixtape',
  icon: '📼',
  text: 'Your longest chain on each board scores double.',
  score(sb) {
    const longest = sb.stat.chains.length ? Math.max(...sb.stat.chains) : 0;
    if (!longest) return;
    const k = Math.min(longest, SCORE.chainCap);
    const bonus = (SCORE.chainUnit * k * (k - 1)) / 2;
    if (bonus) sb.add('mixtape', `Mixtape (chain ${longest})`, bonus);
  },
});

defineCharm({
  id: 'concrete.challenge',
  kind: 'challenge',
  theme: 'concrete',
  name: 'Shot Clock',
  icon: '⏱️',
  tags: ['SCORE'],
  text: (s) => `Every 24 moves in a row without sending a card home costs ${10 * s} points.`,
  score(sb, ctx) {
    const cost = 10 * ctx.strength;
    let penalty = 0;
    let since = 0;
    for (const m of sb.history) {
      if (m.auto) continue;
      if (m.t === 'F') since = 0;
      else {
        since += 1;
        if (since >= 24) {
          penalty += cost;
          since = 0;
        }
      }
    }
    if (penalty) sb.add('clock', 'Shot Clock', -penalty);
  },
});
