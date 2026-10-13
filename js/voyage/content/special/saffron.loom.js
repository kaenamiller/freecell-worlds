import { defineCharm } from '../../registry.js';
import { registerCustomMove } from '../../../rules.js';

const op = 'saffron.loom';
const empty = (st, i) => Number.isInteger(i) && st.tableau[i]?.length === 0;
const source = (ctx, st, i) => Number.isInteger(i) && st.tableau[i]?.length > 0 && !ctx.api.concealed.includes(st.tableau[i].at(-1));
const depth = (ctx, st, col, card) => {
  const index = st.tableau[col]?.indexOf(card) ?? -1;
  return index >= 0 && !st.tableau[col].slice(index).some((id) => ctx.api.concealed.includes(id));
};
registerCustomMove(op, {
  apply(st, m) {
    const col = st.tableau[m.col];
    if (!Number.isInteger(m.col) || !col || !Number.isInteger(m.index) || m.index < 0 || m.index >= col.length ||
        col[m.index] !== m.card || m.col === m.to || !empty(st, m.to) || col.slice(m.index).some((id) => m.concealed?.includes(id))) {
      throw new Error('Loom requires face-up column tops and a different empty column');
    }
    // Preserve dealt-pile order without requiring a valid movable sequence.
    m.cards = col.splice(m.index); m.count = m.cards.length;
    st.tableau[m.to].push(...m.cards);
  },
  undo(st, m) { st.tableau[m.col].push(...st.tableau[m.to].splice(-m.count)); },
});

defineCharm({
  id: op, kind: 'boon', theme: 'saffron', name: 'Loom', icon: '🧵', ease: .4,
  family: 'columns',
  text: "Once per board, move a column's face-up top cards in order onto an empty column, even if they are not a valid run.",
  upgrade: "Twice per board, move a column's face-up top cards in order onto an empty column, even if they are not a valid run.",
  ability: {
    uses: ({ level }) => level === 2 ? 2 : 1, label: 'Weave cards onto an empty column',
    available: (ctx) => ctx.api.state.tableau.some((_, i) => empty(ctx.api.state, i)) && ctx.api.state.tableau.some((_, i) => source(ctx, ctx.api.state, i)),
    async use(ctx) {
      const { api } = ctx;
      // The card names its column; every card from it to the top moves together.
      const colOf = (st, id) => st.tableau.findIndex((cards) => cards.includes(id));
      const card = await api.pick({
        kind: 'card', prompt: 'Choose the deepest card to move: it and everything above it go together',
        filter: (id, st) => { const c = colOf(st, id); return c >= 0 && source(ctx, st, c) && depth(ctx, st, c, id) && st.tableau.some((_, i) => i !== c && empty(st, i)); },
        group: (id, st) => { const c = colOf(st, id); return st.tableau[c].slice(st.tableau[c].indexOf(id)); },
      });
      if (card == null) return false;
      const col = colOf(api.state, card);
      const to = await api.pick({ kind: 'column', prompt: 'Choose the empty column to weave them onto', filter: (i, st) => i !== col && empty(st, i) });
      if (to == null || !depth(ctx, api.state, col, card) || !empty(api.state, to) || to === col) return false;
      const index = api.state.tableau[col].indexOf(card);
      if (!api.charmMove(op, { col, index, to, card, concealed: api.concealed })) return false;
      api.notify('Loom moved the cards in order onto an empty column.');
      return true;
    },
  },
});
