// driftwood: boons + challenge. Spec: docs/voyage/charms-design.md (theme `driftwood`).
import { defineCharm } from '../registry.js';
import { SCORE } from '../config.js';
import { countHome, suitOf } from './kit.js';

const SUIT_BADGE = ['♣', '♦', '♥', '♠'];

defineCharm({
  id: 'driftwood.net',
  kind: 'boon',
  theme: 'driftwood',
  name: 'Spare Net',
  icon: '🪢',
  text: '+4 undos now.',
  onPick(run) {
    run.undos += 4;
  },
});

defineCharm({
  id: 'driftwood.breeze',
  kind: 'boon',
  theme: 'driftwood',
  name: 'Fair Breeze',
  icon: '🌬️',
  text: 'Your first 3 free-cell placements on each board cost no points.',
  score(sb) {
    const n = sb.stat.freeCellPlacements;
    const paid = Math.max(0, n - 3);
    const line = sb.lines.find((l) => l.key === 'freecells');
    if (line) {
      line.label = `Free cells used ×${n}`;
      line.pts = Math.max(0, SCORE.freeCellBudget - paid * SCORE.freeCellCost);
    }
  },
});

defineCharm({
  id: 'driftwood.catch',
  kind: 'boon',
  theme: 'driftwood',
  name: 'Catch of the Day',
  icon: '🐟',
  text: 'Each board picks a suit; its cards are worth +8 each when sent home.',
  setup(board, ctx) {
    if (ctx.memo.suit == null) ctx.memo.suit = ctx.rng.int(4);
    ctx.api.badge(SUIT_BADGE[ctx.memo.suit]);
  },
  score(sb, ctx) {
    const suit = ctx.memo.suit;
    if (suit == null) return;
    const bonus = countHome(sb.history, (id) => suitOf(id) === suit) * 8;
    if (bonus) sb.add('catch', 'Catch of the day', bonus);
  },
});

defineCharm({
  id: 'driftwood.challenge',
  kind: 'challenge',
  theme: 'driftwood',
  name: 'Fog Bank',
  icon: '🌫️',
  tags: ['VIS'],
  text: (s) => `Only the top ${Math.max(2, 7 - s)} cards of each column start face-up.`,
  ease: (ctx) => -0.05 * ctx.strength,
  setup(board, ctx) {
    const visible = Math.max(2, 7 - ctx.strength);
    const hidden = board.state.tableau.flatMap((col) => col.slice(0, Math.max(0, col.length - visible)));
    if (hidden.length) ctx.api.conceal(hidden);
  },
});
