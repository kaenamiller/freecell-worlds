// saffron: boons + challenge. Spec: docs/voyage/charms-design.md (theme `saffron`).
import { defineCharm } from '../registry.js';
import { colorOf } from '../../rules.js';
import { foundationSequence, replay, suitOf } from './kit.js';

defineCharm({
  id: 'saffron.spice',
  kind: 'boon',
  theme: 'saffron',
  name: 'Spice Blend',
  icon: '🌶️',
  text: '+30 each time all four foundations reach the same rank.',
  score(sb) {
    let bonus = 0;
    const tops = [0, 0, 0, 0];
    replay(sb, (move) => {
      if (move.t !== 'F') return;
      tops[suitOf(move.card)]++;
      const rank = tops[0];
      if (rank && tops.every((t) => t === rank)) bonus += 30;
    });
    if (bonus) sb.add('spice', 'Spice Blend', bonus);
  },
});

defineCharm({
  id: 'saffron.silkroad',
  kind: 'boon',
  theme: 'saffron',
  name: 'Silk Road',
  icon: '🐫',
  text: 'One extra free cell on boards 5–7.',
  rules(r, ctx) {
    if (ctx.idx >= 4) r.freeCells = (r.freeCells || 4) + 1;
  },
});

defineCharm({
  id: 'saffron.loom',
  kind: 'boon',
  theme: 'saffron',
  name: 'Loom',
  icon: '🧵',
  text: '+5 for each move of 3+ cards at once.',
  score(sb) {
    let woven = 0;
    replay(sb, (move) => {
      if (move.t === 'T' && move.count >= 3) woven++;
    });
    if (woven) sb.add('loom', 'Loom', woven * 5);
  },
});

defineCharm({
  id: 'saffron.challenge',
  kind: 'challenge',
  theme: 'saffron',
  name: 'Woven Pattern',
  icon: '🧶',
  tags: ['SCORE'],
  text: (s) => `Each time 3+ cards of the same colour go home in a row, lose ${10 * s} points.`,
  ease: (ctx) => -0.06 * ctx.strength,
  score(sb, ctx) {
    const seq = foundationSequence(sb.history);
    let run = 0;
    let last = null;
    let hits = 0;
    const closeRun = () => {
      if (run >= 3) hits++;
      run = 0;
      last = null;
    };
    for (const card of seq) {
      const color = colorOf(card);
      if (color === last) run++;
      else { closeRun(); run = 1; last = color; }
    }
    closeRun();
    if (hits) sb.add('woven', 'Woven Pattern', -10 * ctx.strength * hits);
  },
});
