// moth: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `moth`).
import { defineCharm } from '../registry.js';
import { stream } from '../rng.js';

defineCharm({
  id: 'moth.lampglow',
  kind: 'boon',
  theme: 'moth',
  name: 'Lampglow',
  icon: '🕯️',
  family: 'vision',
  text: 'Once per board, light a column: reveal its face-down cards, or show the best next move if none are hidden.',
  upgrade: 'Twice per board.',
  ease: 0.2,
  ability: {
    uses: (ctx) => ctx.level,
    label: 'Light a column',
    async use(ctx) {
      const hiddenIn = (i, st) => st.tableau[i].slice(0, -1).filter((id) => ctx.api.concealed?.includes(id));
      // With nothing face-down anywhere, the column would not matter: show the move straight away.
      if (!ctx.api.state.tableau.some((_, i) => hiddenIn(i, ctx.api.state).length)) return !!(await ctx.api.preview(1));
      const col = await ctx.api.pick({
        kind: 'column', prompt: 'Choose a column to light: its face-down cards turn over',
        cards: hiddenIn, filter: (i, st) => hiddenIn(i, st).length > 0,
      });
      if (col == null) return false;
      const hidden = hiddenIn(col, ctx.api.state);
      if (hidden.length) {
        ctx.api.reveal(hidden);
        return true;
      }
      return !!(await ctx.api.preview(1));
    },
  },
});

defineCharm({
  id: 'moth.waltz',
  kind: 'boon',
  theme: 'moth',
  name: 'Waltz',
  icon: '🦋',
  family: 'wild',
  text: 'A card may also be placed on a card of the same rank and opposite colour.',
  upgrade: 'A card may also be placed on a card of the same rank, any colour.',
  ease: 0.2,
  rules(r, ctx) {
    r.twinStack = ctx.level === 2 ? 2 : 1;
  },
});

defineCharm({
  id: 'moth.silver',
  kind: 'boon',
  theme: 'moth',
  name: 'Tarnished Silver',
  icon: '🥈',
  family: 'coin',
  text: 'Selling a boon at a port pays 40 coins.',
  upgrade: 'Selling a boon at a port pays 55 coins.',
  price(item, cost, ctx) {
    if (item.kind !== 'sell') return cost;
    return ctx.level === 2 ? 55 : 40;
  },
});

defineCharm({
  id: 'moth.challenge',
  kind: 'challenge',
  theme: 'moth',
  name: 'Lights Out',
  icon: '🌙',
  tags: ['VIS'],
  pressure: true,
  text: (s) => `Every ${16 - s} moves, one random column goes dark below its top card until uncovered.`,
  ease: (ctx) => -0.05 * ctx.strength,
  on: {
    move(ctx, { manual }) {
      if (!manual) return;
      const step = 16 - ctx.strength;
      const moves = ctx.api.history.filter((m) => !m.auto).length;
      if (!step || moves % step !== 0) return;
      const col = stream(ctx.seed, 'lights', moves, ctx.id).int(8);
      const column = ctx.api.state.tableau[col];
      if (column.length < 2) return;
      ctx.api.conceal(column.slice(0, -1));
    },
  },
});
