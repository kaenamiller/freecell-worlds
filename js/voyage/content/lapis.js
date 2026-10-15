// lapis: boons + challenge. Spec: docs/voyage/charms-design.md (theme `lapis`).
import { defineCharm } from '../registry.js';
import { suitOf } from './kit.js';

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
  family: 'undo',
  text: '+1 undo each time you complete a suit while 13 or more cards are still in play (twice per board).',
  upgrade: '+1 undo each time you complete a suit while 13 or more cards are still in play (three times per board).',
  ease: 0.2,
  on: {
    foundation(ctx, ev) {
      const st = ctx.api.state;
      const suit = suitOf(ev.card);
      if (st.found[suit] !== 13) return;
      const inPlay = 52 - st.found.reduce((n, rank) => n + rank, 0);
      if (inPlay < 13) return;
      const cap = ctx.level >= 2 ? 3 : 2;
      ctx.memo.ankhGrants = ctx.memo.ankhGrants || 0;
      if (ctx.memo.ankhGrants >= cap) return;
      ctx.memo.ankhGrants += 1;
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
  family: 'cells',
  text: 'Cards leaving a free cell for a column ignore colour.',
  upgrade: 'Cards leaving a free cell for a column ignore colour, and you can move 1 more card at once.',
  ease: 0.15,
  rules(r, ctx) {
    r.cellExitWild = true;
    if (ctx.level >= 2) r.moveBonus = (r.moveBonus || 0) + 1;
  },
});

defineCharm({
  id: 'lapis.horus',
  kind: 'boon',
  theme: 'lapis',
  name: 'Eye of Horus',
  icon: '👁️',
  family: 'vision',
  text: 'Once per board, show the best next move and uncover up to 3 face-down cards.',
  upgrade: 'Once per board, show the best next move and uncover up to 6 face-down cards.',
  ease: 0.25,
  ability: {
    uses: 1,
    label: 'Eye of Horus',
    async use(ctx) {
      const hinted = await ctx.api.hint();
      const limit = ctx.level >= 2 ? 6 : 3;
      const hidden = (ctx.api.concealed || []).slice(0, limit);
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
    return n > 1
      ? `${n} columns are sealed: nothing can be placed on them until you empty them.`
      : '1 column is sealed: nothing can be placed on it until you empty it.';
  },
  ease: 0,
  rules(r, ctx) {
    const n = ctx.strength <= 3 ? 1 : 2;
    r.sealedCols = pickNonAdjacentCols(ctx.rng, n);
  },
});
