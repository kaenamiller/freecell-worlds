import { defineCharm } from '../../registry.js';
import { registerCustomMove } from '../../../rules.js';

const op = 'carvings.totem';
const eligible = (st, i) => Number.isInteger(i) && st.tableau[i]?.length > 1;
registerCustomMove(op, {
  apply(st, m) {
    if (!eligible(st, m.col)) throw new Error('Totem Pole requires a column with at least two cards');
    m.cards = st.tableau[m.col].slice();
    st.tableau[m.col].reverse();
  },
  undo(st, m) { st.tableau[m.col].reverse(); },
});

defineCharm({
  id: op, kind: 'boon', theme: 'carvings', name: 'Totem Pole', icon: '🪵', ease: .4,
  family: 'columns',
  text: 'Once per board, reverse a column so its deepest card comes to the top, revealing any concealed cards in it.',
  upgrade: 'Twice per board, reverse a column so its deepest card comes to the top, revealing any concealed cards in it.',
  ability: {
    uses: ({ level }) => level === 2 ? 2 : 1, label: 'Turn a column upside down',
    available: ({ api }) => api.state.tableau.some((_, i) => eligible(api.state, i)),
    async use({ api }) {
      const col = await api.pick({ kind: 'column', prompt: 'Choose a column to turn upside down: its deepest card comes to the top', cards: (i, st) => [st.tableau[i][0]], filter: (i, st) => eligible(st, i) });
      if (col == null || !eligible(api.state, col)) return false;
      const move = api.charmMove(op, { col });
      if (!move) return false;
      // Explicit reveals, like ordinary exposure, stay visible after undo.
      api.reveal(move.cards);
      api.notify('Totem Pole turned a column upside down.');
      return true;
    },
  },
});
