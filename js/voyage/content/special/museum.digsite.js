import { defineCharm } from '../../registry.js';
import { registerCustomMove } from '../../../rules.js';

const eligible = (ctx, st, i) => Number.isInteger(i) && st.tableau[i]?.length > 1 && !ctx.api.concealed.includes(st.tableau[i][0]);
registerCustomMove('museum.digsite', {
  apply(st, m) {
    const col = st.tableau[m.col];
    if (!Number.isInteger(m.col) || !col || col.length < 2 || col[0] !== m.card || m.concealed?.includes(m.card)) {
      throw new Error('Dig Site requires a column with a face-up buried bottom card');
    }
    col.push(col.shift());
  },
  undo(st, m) { st.tableau[m.col].unshift(st.tableau[m.col].pop()); },
});

defineCharm({
  id: 'museum.digsite', kind: 'boon', theme: 'museum', name: 'Dig Site', icon: '⛏️', ease: 0.4,
  text: 'Once per board, lift the face-up deepest card of a column to its top.',
  ability: {
    uses: 1, label: 'Lift a column’s deepest card',
    available: (ctx) => !!ctx.api.state?.tableau.some((_, i) => eligible(ctx, ctx.api.state, i)),
    async use(ctx) {
      const col = await ctx.api.pick({ kind: 'column', filter: (i, st) => eligible(ctx, st, i) });
      if (col == null || !eligible(ctx, ctx.api.state, col)) return false;
      if (!ctx.api.charmMove('museum.digsite', { col, card: ctx.api.state.tableau[col][0], concealed: ctx.api.concealed })) return false;
      ctx.api.notify('Dig Site lifted the deepest card to the top.');
      return true;
    },
  },
});
