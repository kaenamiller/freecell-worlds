import { defineCharm } from '../../registry.js';
import { registerCustomMove, cellAccepts } from '../../../rules.js';

const buried = (st, card) => st.tableau.findIndex((col) => col.slice(0, -1).includes(card));
const cells = (st, card, rules) => st.free.map((_, i) => i).filter((i) => cellAccepts(st, i, card, rules));
const eligible = (ctx, st, card) => buried(st, card) >= 0 && !ctx.api.concealed.includes(card) && cells(st, card, ctx.api.rules).length > 0;

registerCustomMove('signal.pull', {
  apply(st, m, rules) {
    const col = st.tableau[m.col];
    if (!Number.isInteger(m.col) || !Number.isInteger(m.index) || !Number.isInteger(m.fi) ||
        !col || m.index < 0 || m.index >= col.length - 1 || col[m.index] !== m.card ||
        m.concealed?.includes(m.card) || !cellAccepts(st, m.fi, m.card, rules)) {
      throw new Error('Pull requires a face-up buried card and an accepting empty cell');
    }
    col.splice(m.index, 1);
    st.free[m.fi] = m.card;
  },
  undo(st, m) {
    st.free[m.fi] = 0;
    st.tableau[m.col].splice(m.index, 0, m.card);
  },
});

defineCharm({
  id: 'signal.pull', kind: 'boon', theme: 'signal', name: 'Pull', icon: '📶', ease: 0.4,
  family: 'ability',
  upgrade: 'Twice per board, pull a face-up buried card into an empty free cell that accepts it.',
  text: 'Once per board, pull a face-up buried card into an empty free cell that accepts it.',
  ability: {
    uses: ({ level }) => level === 2 ? 2 : 1, label: 'Pull a buried card',
    available: (ctx) => !!ctx.api.state?.tableau.some((col) => col.slice(0, -1).some((card) => eligible(ctx, ctx.api.state, card))),
    async use(ctx) {
      const card = await ctx.api.pick({ kind: 'card', prompt: 'Choose a face-up buried card to pull out', filter: (card, st) => eligible(ctx, st, card) });
      if (card == null) return false;
      const fi = await ctx.api.pick({ kind: 'freecell', prompt: 'Choose the free cell it lands in', filter: (i, st) => Number.isInteger(i) && cellAccepts(st, i, card, ctx.api.rules) });
      if (fi == null || !eligible(ctx, ctx.api.state, card)) return false;
      const col = buried(ctx.api.state, card), index = ctx.api.state.tableau[col].indexOf(card);
      if (!ctx.api.charmMove('signal.pull', { col, index, fi, card, concealed: ctx.api.concealed })) return false;
      ctx.api.notify('Pull dragged a buried card into a free cell.');
      return true;
    },
  },
});
