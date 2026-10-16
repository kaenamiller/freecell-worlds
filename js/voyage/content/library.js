// library: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `library`).
// Complex: library.bookmark in ./special/library.bookmark.js
import { defineCharm } from '../registry.js';
import { replay } from './kit.js';

defineCharm({
  id: 'library.lending',
  kind: 'boon',
  theme: 'library',
  name: 'Lending Desk',
  icon: '📚',
  family: 'foundation',
  text: 'You may move the top card of a foundation back onto a column or into a free cell.',
  upgrade: '…and +1 move capacity.',
  ease: 0.35,
  rules(r, ctx) {
    r.foundationReturn = true;
    if (ctx.level >= 2) r.moveBonus = (r.moveBonus || 0) + 1;
  },
});

defineCharm({
  id: 'library.quiet',
  kind: 'boon',
  theme: 'library',
  name: 'Quiet Study',
  icon: '🤫',
  family: 'coin',
  text: 'Clear a board without using an undo: +8 coins (+15 on boards 5–7).',
  upgrade: '+12 / +22.',
  score(sb, ctx) {
    if (sb.undosUsed) return;
    const late = sb.boardIdx >= 4 && sb.boardIdx <= 6;
    const coins = ctx.level >= 2 ? (late ? 22 : 12) : (late ? 15 : 8);
    sb.addCoins('quiet', 'Quiet Study', coins);
  },
});

defineCharm({
  id: 'library.challenge',
  kind: 'challenge',
  theme: 'library',
  name: 'Overdue',
  icon: '⏰',
  tags: ['SCORE'],
  pressure: true,
  text: (s) => `A card left in a free cell for more than ${14 - s} moves costs 25 points.`,
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
