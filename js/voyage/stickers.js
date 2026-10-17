// Persistent card enhancements. The hidden charm participates in composition/runtime only.
import { defineCharm } from './registry.js';
import { replay } from './content/kit.js';

export const STICKERS = {
  wild: { name: 'Wild', text: 'This card ignores colour when stacking.' },
  gold: { name: 'Gold', text: '+5 coins when this card goes home with at least 13 other cards still in play.' },
  lucky: { name: 'Lucky', text: '+1 undo the first time this card goes home each board (within the charm undo cap).' },
  key: { name: 'Key', text: 'This card ignores free-cell restrictions.' },
  fool: { name: 'Fool', text: 'Any card may be placed on this card.' },
};

const cardsOfType = (stickers = {}, type) => Object.entries(stickers)
  .filter(([card, value]) => value === type && Number.isInteger(Number(card)) && Number(card) >= 1 && Number(card) <= 52)
  .map(([card]) => Number(card));

defineCharm({
  id: 'voyage.stickers', kind: 'boon', hidden: true, family: 'sticker',
  name: 'Card Stickers', icon: '✧',
  text: 'Your card stickers apply on every table for the rest of the voyage.',
  rules(r, ctx) {
    for (const [type, field] of [['wild', 'wildCards'], ['fool', 'anchorCards'], ['key', 'freeCards']]) {
      r[field] = [...new Set([...(r[field] || []), ...cardsOfType(ctx.stickers, type)])];
    }
  },
  setup(_board, ctx) {
    for (const type of Object.keys(STICKERS)) {
      const cards = cardsOfType(ctx.stickers, type);
      if (cards.length) ctx.api.mark(cards, `sticker-${type}`);
    }
  },
  score(sb, ctx) {
    const gold = new Set(cardsOfType(ctx.stickers, 'gold'));
    if (!gold.size || !sb.initial) return;
    const paid = new Set();
    replay(sb, (move, state) => {
      if (move.t !== 'F' || !gold.has(move.card) || paid.has(move.card)) return;
      // Replaying the retained history excludes undone homes. Pay each card once even
      // when a foundation-return ability sends it home a second time.
      if (52 - state.found.reduce((sum, rank) => sum + rank, 0) >= 13) {
        paid.add(move.card);
        sb.addCoins(`sticker.gold.${move.card}`, `Gold sticker · card ${move.card}`, 5, move.card);
      }
    });
  },
  on: {
    foundation(ctx, { card }) {
      if (ctx.stickers?.[card] !== 'lucky') return;
      const used = (ctx.memo.lucky ??= []);
      if (used.includes(card)) return;
      used.push(card); // Persisted, deliberately not refunded by undo/return/reset.
      ctx.api.addUndos(1);
    },
  },
});
