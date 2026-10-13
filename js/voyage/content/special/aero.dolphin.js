import { defineCharm } from '../../registry.js';
import { registerCustomMove, foundationAccepts, foundationDestination, rankOf, suitOf } from '../../../rules.js';

const buried = (st, card) => st.tableau.findIndex((col) => col.slice(0, -1).includes(card));
const eligible = (ctx, st, card) => buried(st, card) >= 0 && !(ctx.api.concealed || []).includes(card) && foundationAccepts(st, card, ctx.api.rules);

registerCustomMove('aero.dolphin', {
  apply(st, m, rules) {
    const col = st.tableau[m.col];
    if (!Number.isInteger(m.col) || !Number.isInteger(m.index) || !col || m.index < 0 || m.index >= col.length - 1 ||
        col[m.index] !== m.card || m.concealed?.includes(m.card) || !foundationAccepts(st, m.card, rules)) {
      throw new Error('Dolphin Leap requires a face-up buried card its foundation accepts');
    }
    m.dest = foundationDestination(st, m.card);
    m.homeCards = [m.card];
    col.splice(m.index, 1);
    if (m.dest === 'spur') st.spur.top = rankOf(m.card);
    else st.found[suitOf(m.card)] = rankOf(m.card);
  },
  undo(st, m) {
    if (m.dest === 'spur') st.spur.top--;
    else st.found[suitOf(m.card)]--;
    st.tableau[m.col].splice(m.index, 0, m.card);
  },
});

defineCharm({
  id: 'aero.dolphin', kind: 'boon', theme: 'aero', name: 'Dolphin Leap', icon: '🐬', family: 'foundation', ease: 0.4,
  text: 'Once per board, a face-up buried card leaps straight home if its foundation will take it.',
  upgrade: 'Twice per board, a face-up buried card leaps straight home if its foundation will take it.',
  ability: {
    uses: (ctx) => ctx.level >= 2 ? 2 : 1, label: 'Leap a buried card home',
    available: (ctx) => !!ctx.api.state?.tableau.some((col) => col.slice(0, -1).some((card) => eligible(ctx, ctx.api.state, card))),
    async use(ctx) {
      const card = await ctx.api.pick({ kind: 'card', prompt: 'Choose a buried card to leap straight home', filter: (card, st) => eligible(ctx, st, card) });
      if (card == null || !eligible(ctx, ctx.api.state, card)) return false;
      const col = buried(ctx.api.state, card), index = ctx.api.state.tableau[col].indexOf(card);
      if (!ctx.api.charmMove('aero.dolphin', { col, index, card, concealed: ctx.api.concealed })) return false;
      ctx.api.notify('Dolphin Leap sent a buried card home.');
      return true;
    },
  },
});
