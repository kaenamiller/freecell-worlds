// library: boons + challenge. Spec: docs/voyage/charms-design.md (theme `library`).
// Complex charms for this theme (if any) live in ./special/library.*.js.
import { defineCharm } from '../registry.js';
import { isRed } from '../../rules.js';
import { replay } from './kit.js';

defineCharm({
  id: 'library.lending',
  kind: 'boon',
  theme: 'library',
  name: 'Lending Desk',
  icon: '📚',
  text: 'You may move the top card of a foundation back onto a column or into a free cell.',
  ease: 0.35,
  rules(r) {
    r.foundationReturn = true;
  },
});

defineCharm({
  id: 'library.quiet',
  kind: 'boon',
  theme: 'library',
  name: 'Quiet Study',
  icon: '🤫',
  text: '×1.1 on any board where you use no undos.',
  score(sb) {
    if (!sb.undosUsed) sb.mult('Quiet Study', 1.1);
  },
});

defineCharm({
  id: 'library.challenge',
  kind: 'challenge',
  theme: 'library',
  name: 'Overdue',
  icon: '⏰',
  tags: ['SCORE'],
  text: (s) => `Each card that stays in a free cell longer than ${14 - s} moves costs 25 points.`,
  ease: (ctx) => -0.05 * ctx.strength,
  score(sb, ctx) {
    const limit = 14 - ctx.strength;
    const dwell = new Map();
    let moves = 0;
    let penalty = 0;
    replay(sb, (move) => {
      if (!move.auto) moves++;
      if (move.t === 'C') dwell.set(move.card, moves);
      const src = move.src;
      if (src?.kind === 'free' && move.t !== 'C') {
        const since = dwell.get(move.card);
        if (since != null) {
          if (moves - since > limit) penalty += 25;
          dwell.delete(move.card);
        }
      }
    });
    for (const since of dwell.values()) if (moves - since > limit) penalty += 25;
    if (penalty) sb.add('overdue', 'Overdue fines', -penalty);
  },
});
