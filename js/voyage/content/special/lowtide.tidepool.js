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
  family: 'ability',
  upgrade: 'Twice per board, tuck a free-cell card underneath any column, as its deepest-buried card.',
  text: 'Once per board, tuck a free-cell card underneath any column, as its deepest-buried card.',
  ability: {
    uses: ({ level }) => level === 2 ? 2 : 1, label: 'Wash a card under a column',
    available: (ctx) => !!ctx.api.state?.free.some(Boolean),
    async use(ctx) {
      const fi = await ctx.api.pick({ kind: 'freecell', prompt: 'Choose a free-cell card to wash away', filter: (i, st) => occupied(st, i) });
      if (fi == null) return false;
      const col = await ctx.api.pick({ kind: 'column', prompt: 'Choose the column it washes under', cards: (i, st) => st.tableau[i].slice(0, 1), filter: (i, st) => column(st, i) });
      if (col == null || !occupied(ctx.api.state, fi)) return false;
      if (!ctx.api.charmMove('lowtide.tidepool', { fi, col, card: ctx.api.state.free[fi] })) return false;
      ctx.api.notify('Tide Pool washed a free-cell card beneath a column.');
      return true;
    },
  },
});
