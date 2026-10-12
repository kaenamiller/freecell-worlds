// lapis: boons + challenge. Spec: docs/voyage/charms-design.md (theme `lapis`).
import { defineCharm } from '../registry.js';
import { SCORE } from '../config.js';
import { rankOf } from './kit.js';

function pickNonAdjacentCols(rng, count) {
  const picked = [];
  for (const col of rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7])) {
    if (picked.some((p) => Math.abs(p - col) === 1)) continue;
    picked.push(col);
    if (picked.length >= count) break;
  }
  return picked.sort((a, b) => a - b);
}

defineCharm({
  id: 'lapis.ankh',
  kind: 'boon',
  theme: 'lapis',
  name: 'Ankh',
  icon: '☥',
  text: 'Sending a King home grants +1 undo (up to 2 per board).',
  ease: 0.2,
  on: {
    foundation(ctx, ev) {
      if (rankOf(ev.card) !== 13) return;
      ctx.memo.kings ??= 0;
      if (ctx.memo.kings >= 2) return;
      ctx.memo.kings += 1;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'lapis.canopic',
  kind: 'boon',
  theme: 'lapis',
  name: 'Canopic Jars',
  icon: '🏺',
  text: 'Free cells never cost points.',
  score(sb) {
    const line = sb.lines.find((l) => l.key === 'freecells');
    if (!line) return;
    const refund = SCORE.freeCellBudget - line.pts;
    if (refund > 0) sb.add('canopic', 'Canopic Jars', refund);
  },
});

defineCharm({
  id: 'lapis.horus',
  kind: 'boon',
  theme: 'lapis',
  name: 'Eye of Horus',
  icon: '👁️',
  text: 'Once per board, show the best next move and uncover up to 3 face-down cards.',
  ease: 0.25,
  ability: {
    uses: 1,
    label: 'Eye of Horus',
    async use(ctx) {
      const hinted = await ctx.api.hint();
      const hidden = (ctx.api.concealed || []).slice(0, 3);
      if (hidden.length) ctx.api.reveal(hidden);
      return hinted || hidden.length > 0;
    },
  },
});

defineCharm({
  id: 'lapis.challenge',
  kind: 'challenge',
  theme: 'lapis',
  name: 'Sealed Tombs',
  icon: '⚱️',
  tags: ['COLUMN'],
  text: (s) => {
    const n = s <= 3 ? 1 : 2;
    return `${n} column${n > 1 ? 's' : ''} start sealed until emptied.`;
  },
  ease: 0,
  rules(r, ctx) {
    const n = ctx.strength <= 3 ? 1 : 2;
    r.sealedCols = pickNonAdjacentCols(ctx.rng, n);
  },
});
