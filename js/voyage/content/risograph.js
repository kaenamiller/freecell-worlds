// risograph: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `risograph`).
import { defineCharm } from '../registry.js';
import { cardName, cardsOfRanks, confirmStickerSwap, rankMask, ranksIn } from './kit.js';

const STICKER_TYPES = ['wild', 'gold', 'lucky', 'key', 'fool'];

function evenBarrenRanks(s) {
  if (s <= 3) return rankMask(2, 4, 6);
  const ranks = [];
  for (let rank = 2; rank <= 12; rank += 2) ranks.push(rank);
  return rankMask(...ranks);
}

defineCharm({
  id: 'risograph.misprint',
  kind: 'boon',
  theme: 'risograph',
  name: 'Misprint',
  icon: '🖨️',
  family: 'sticker',
  text: 'Once per board, misprint a face-up card: it gets a random sticker for the rest of the run (from the next board).',
  upgrade: 'Once per board, misprint a face-up card: you choose the sticker.',
  ease: 0.25,
  ability: {
    uses: 1,
    label: 'Misprint a card',
    async use(ctx) {
      const card = await ctx.api.pick({
        kind: 'card', prompt: 'Choose a column top to misprint (its sticker starts working next board)',
        filter: (id, st) => st.tableau.some((col) => col.at(-1) === id),
      });
      if (card == null) return false;
      let type;
      if (ctx.level === 2) {
        const { STICKERS } = await import('../stickers.js');
        type = await ctx.api.choose({
          card, prompt: 'Choose the sticker to misprint onto this card.',
          options: STICKER_TYPES.map((t) => ({ value: t, label: STICKERS[t]?.name || t, detail: STICKERS[t]?.text })),
        });
        if (type == null || !(await confirmStickerSwap(ctx, card, type))) return false;
      } else {
        if (!(await confirmStickerSwap(ctx, card, '?'))) return false;
        type = STICKER_TYPES[ctx.rng.int(STICKER_TYPES.length)];
      }
      if (!ctx.api.addSticker(card, type)) return false;
      ctx.api.notify(`Misprint: the ${cardName(card)} gets a ${type[0].toUpperCase() + type.slice(1)} sticker from the next board.`);
      return true;
    },
  },
});

defineCharm({
  id: 'risograph.ultramarine',
  kind: 'boon',
  theme: 'risograph',
  name: 'Ultramarine',
  icon: '🔵',
  family: 'coin',
  text: 'At each port, +1 coin for every sticker you own.',
  upgrade: 'At each port, +2 coins for every sticker you own.',
  onPort(run, ctx) {
    const n = Object.keys(run.stickers).length;
    if (!n) return;
    const each = ctx.level === 2 ? 2 : 1;
    ctx.api.addCoins(n * each);
  },
});

defineCharm({
  id: 'risograph.edition',
  kind: 'boon',
  theme: 'risograph',
  name: 'Second Edition',
  icon: '🗞️',
  family: 'coin',
  text: 'Every board\'s coin payout is +10% for each coin-family boon you hold (this one included).',
  upgrade: 'Every board\'s coin payout is +15% for each coin-family boon you hold (this one included).',
  coins(n, ctx) {
    const pct = ctx.level === 2 ? 0.15 : 0.10;
    const coinBoons = ctx.family('coin');
    return Math.round(n * (1 + pct * coinBoons));
  },
});

defineCharm({
  id: 'risograph.challenge',
  kind: 'challenge',
  theme: 'risograph',
  name: 'Misregistration',
  icon: '🟥',
  tags: ['STACK'],
  text: (s) => (s <= 3
    ? 'Nothing can be placed onto a 2, 4 or 6.'
    : 'Nothing can be placed onto a 2, 4, 6, 8, 10 or Queen.'),
  ease: (ctx) => -0.08 * ctx.strength,
  rules(r, ctx) {
    r.barren = { suits: 15, ranks: evenBarrenRanks(ctx.strength) };
  },
  setup(_board, ctx) {
    const ranks = ranksIn(evenBarrenRanks(ctx.strength));
    if (ranks.length) ctx.api.mark(cardsOfRanks(ranks), 'bar');
  },
});
