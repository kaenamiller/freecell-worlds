import { defineCharm } from '../../registry.js';
import { registerCustomMove } from '../../../rules.js';

const occupied = (st, i) => Number.isInteger(i) && !!st.free[i];
const column = (st, i) => Number.isInteger(i) && !!st.tableau[i];
registerCustomMove('lowtide.tidepool', {
  apply(st, m) {
    if (!occupied(st, m.fi) || !column(st, m.col) || st.free[m.fi] !== m.card) {
      throw new Error('Tide Pool requires an occupied free cell and a column');
    }
    // This ability places below the pile, bypassing ordinary top-drop restrictions.
    st.tableau[m.col].unshift(m.card);
    st.free[m.fi] = 0;
  },
  undo(st, m) {
    st.tableau[m.col].shift();
    st.free[m.fi] = m.card;
  },
});

defineCharm({
  id: 'lowtide.tidepool', kind: 'boon', theme: 'lowtide', name: 'Tide Pool', icon: '🦀', ease: 0.3,
  text: 'Once per board, wash a free-cell card under the bottom of any column.',
  ability: {
    uses: 1, label: 'Wash a card under a column',
    available: (ctx) => !!ctx.api.state?.free.some(Boolean),
    async use(ctx) {
      const fi = await ctx.api.pick({ kind: 'freecell', filter: (i, st) => occupied(st, i) });
      if (fi == null) return false;
      const col = await ctx.api.pick({ kind: 'column', filter: (i, st) => column(st, i) });
      if (col == null || !occupied(ctx.api.state, fi)) return false;
      if (!ctx.api.charmMove('lowtide.tidepool', { fi, col, card: ctx.api.state.free[fi] })) return false;
      ctx.api.notify('Tide Pool washed a free-cell card beneath a column.');
      return true;
    },
  },
});
