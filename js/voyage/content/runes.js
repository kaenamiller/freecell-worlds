// runes: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `runes`).
import { defineCharm } from '../registry.js';
import { cardName, cardsOfRanks, confirmStickerSwap, rankMask } from './kit.js';
import { stream } from '../rng.js';

function pickKeelCols(rng, n) {
  const pool = [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = [];
  for (let i = 0; i < n && pool.length; i++) cols.push(pool.splice(rng.int(pool.length), 1)[0]);
  return cols;
}

defineCharm({
  id: 'runes.amber',
  kind: 'boon',
  theme: 'runes',
  name: 'Amber',
  icon: '🟠',
  family: 'sticker',
  text: 'Once per board, press a Gold sticker onto a face-up card (it lasts the rest of the run, from the next board).',
  upgrade: 'Twice per board.',
  ease: 0.25,
  ability: {
    uses: (ctx) => ctx.level,
    label: 'Press gold',
    async use(ctx) {
      const card = await ctx.api.pick({
        kind: 'card', prompt: 'Choose a card to press a Gold sticker onto (it starts working next board)',
        filter: (id, st) => st.tableau.some((col) => col.includes(id)),
      });
      if (card == null || !(await confirmStickerSwap(ctx, card, 'gold'))) return false;
      if (!ctx.api.addSticker(card, 'gold')) return false;
      ctx.api.notify(`Amber: Gold pressed onto the ${cardName(card)}. It shows from the next board.`);
      return true;
    },
  },
});

defineCharm({
  id: 'runes.keel',
  kind: 'boon',
  theme: 'runes',
  name: 'Shield Wall',
  icon: '🛡️',
  family: 'cells',
  text: 'With 2 or more other cells-family boons, +1 free cell.',
  upgrade: 'With 1 or more other cells-family boons, +1 free cell.',
  rules(r, ctx) {
    const others = ctx.family('cells') - 1;
    const need = ctx.level === 2 ? 1 : 2;
    if (others >= need) r.freeCells = (r.freeCells || 4) + 1;
  },
});

defineCharm({
  id: 'runes.woad',
  kind: 'boon',
  theme: 'runes',
  name: 'Woad',
  icon: '🫐',
  family: 'wild',
  text: 'Each board, one random rank becomes wild for every wild-family boon you hold (this one included).',
  upgrade: 'Each board, two random extra ranks per wild-family boon you hold (this one included).',
  ease: 0.2,
  rules(r, ctx) {
    const wildBoons = ctx.family('wild');
    const per = ctx.level === 2 ? 2 : 1;
    const rng = stream(ctx.seed, 'rules', ctx.idx, ctx.id);
    let mask = r.wildRanks || 0;
    for (let i = 0; i < wildBoons * per; i++) mask |= rankMask(1 + rng.int(13));
    r.wildRanks = mask;
  },
  setup(_board, ctx) {
    const mask = ctx.api.rules?.wildRanks || 0;
    const ranks = [];
    for (let rank = 1; rank <= 13; rank++) if (mask & (1 << rank)) ranks.push(rank);
    if (ranks.length) ctx.api.mark(cardsOfRanks(ranks), 'wild');
  },
});

defineCharm({
  id: 'runes.challenge',
  kind: 'challenge',
  theme: 'runes',
  name: 'Keel Stones',
  icon: '🪨',
  tags: ['CELLS'],
  text: (s) => {
    const n = 2 + Math.floor(s / 2);
    return `In ${n} columns, the deepest-buried card (marked) can't go into a free cell.`;
  },
  ease: (ctx) => -0.07 * ctx.strength,
  rules() {},
  dealRules(r, ctx) {
    const cols = pickKeelCols(ctx.rng, 2 + Math.floor(ctx.strength / 2));
    const cards = cols.map((c) => ctx.state.tableau[c]?.[0]).filter(Boolean);
    if (!cards.length) return;
    r.noCellCards = [...new Set([...(r.noCellCards || []), ...cards])].sort((a, b) => a - b);
  },
  setup(_board, ctx) {
    const cards = ctx.api.rules?.noCellCards || [];
    if (cards.length) ctx.api.mark(cards, 'lock');
  },
});
