import { defineCharm } from '../../registry.js';
import { registerCustomMove } from '../../../rules.js';

const op = 'cutpaper.octavo';
const location = (st, card) => {
  const col = st.tableau.findIndex((cards) => cards.includes(card));
  return col < 0 ? null : { col, index: st.tableau[col].indexOf(card) };
};
const eligible = (ctx, st, card) => !!location(st, card) && !ctx.api.concealed.includes(card);
registerCustomMove(op, {
  apply(st, m) {
    const a = location(st, m.a), b = location(st, m.b);
    if (m.a === m.b || !a || !b || m.concealed?.includes(m.a) || m.concealed?.includes(m.b)) {
      throw new Error('Octavo requires two different face-up tableau cards');
    }
    m.first = a; m.second = b; m.cards = [m.a, m.b];
    [st.tableau[a.col][a.index], st.tableau[b.col][b.index]] = [m.b, m.a];
  },
  undo(st, m) {
    const a = m.first, b = m.second;
    [st.tableau[a.col][a.index], st.tableau[b.col][b.index]] = [m.a, m.b];
  },
});

defineCharm({
  id: op, kind: 'boon', theme: 'cutpaper', name: 'Octavo', icon: '📄', ease: .4,
  family: 'ability',
  text: 'Once per board, swap any two face-up cards on the tableau.',
  upgrade: 'Twice per board, swap any two face-up cards on the tableau.',
  ability: {
    uses: ({ level }) => level === 2 ? 2 : 1, label: 'Swap two face-up tableau cards',
    available: ({ api }) => api.state.tableau.flat().filter((card) => !api.concealed.includes(card)).length >= 2,
    async use(ctx) {
      const { api } = ctx;
      const a = await api.pick({ kind: 'card', prompt: 'Choose the first face-up card to swap', filter: (card, st) => eligible(ctx, st, card) });
      if (a == null) return false;
      const b = await api.pick({ kind: 'card', prompt: 'Choose the card to swap it with', filter: (card, st) => card !== a && eligible(ctx, st, card) });
      if (b == null || !eligible(ctx, api.state, a) || !eligible(ctx, api.state, b) || a === b) return false;
      if (!api.charmMove(op, { a, b, concealed: api.concealed })) return false;
      api.notify('Octavo swapped two face-up tableau cards.');
      return true;
    },
  },
});
