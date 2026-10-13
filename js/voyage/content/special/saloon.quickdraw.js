import { defineCharm } from '../../registry.js';
import { registerCustomMove } from '../../../rules.js';

const op = 'saloon.quickdraw';
const occupied = (st, i) => Number.isInteger(i) && !!st.free[i];
const nonempty = (st, i) => Number.isInteger(i) && !!st.tableau[i]?.length;
registerCustomMove(op, {
  apply(st, m) {
    if (!occupied(st, m.fi) || !nonempty(st, m.col)) throw new Error('Quick Draw requires an occupied free cell and a non-empty column');
    const col = st.tableau[m.col];
    m.cards = [st.free[m.fi], col.at(-1)];
    // The swapped column top has the same loose-pair semantics as a dealt pile.
    [st.free[m.fi], col[col.length - 1]] = [col.at(-1), st.free[m.fi]];
  },
  undo(st, m) {
    const col = st.tableau[m.col];
    [st.free[m.fi], col[col.length - 1]] = [col.at(-1), st.free[m.fi]];
  },
});

defineCharm({
  id: op, kind: 'boon', theme: 'saloon', name: 'Quick Draw', icon: '🔫', ease: .35,
  family: 'ability',
  text: 'Once per board, swap a free-cell card with the top card of any non-empty column.',
  upgrade: 'Twice per board, swap a free-cell card with the top card of any non-empty column.',
  ability: {
    uses: ({ level }) => level === 2 ? 2 : 1, label: 'Swap a free-cell card and a column top',
    available: ({ api }) => api.state.free.some(Boolean) && api.state.tableau.some((col) => col.length > 0),
    async use({ api }) {
      const fi = await api.pick({ kind: 'freecell', prompt: 'Choose a free-cell card to draw', filter: (i, st) => occupied(st, i) });
      if (fi == null) return false;
      const col = await api.pick({ kind: 'column', prompt: 'Choose the column top it swaps with', cards: (i, st) => [st.tableau[i].at(-1)], filter: (i, st) => nonempty(st, i) });
      if (col == null || !occupied(api.state, fi) || !nonempty(api.state, col)) return false;
      if (!api.charmMove(op, { fi, col })) return false;
      api.notify('Quick Draw swapped a free-cell card and a column top.');
      return true;
    },
  },
});
