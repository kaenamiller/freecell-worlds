import { defineCharm } from '../../registry.js';
import { canPlantSpur } from '../../../rules.js';

const source = (st, card) => {
  const fi = st.free.indexOf(card);
  if (fi >= 0) return { kind: 'free', i: fi };
  const i = st.tableau.findIndex((col) => col.at(-1) === card);
  return i >= 0 ? { kind: 'col', i } : null;
};
const eligible = ({ api }, st, card) => !api.concealed.includes(card) && !!source(st, card) && canPlantSpur(st, card, api.rules);

defineCharm({
  id: 'arctic.aurora', kind: 'boon', theme: 'arctic', name: 'Aurora', icon: '🌌', family: 'foundation', ease: .4,
  text: 'Once per board, send an exposed card at least 2 above its foundation home as the base of a fifth pile and finish its suit on two piles.',
  upgrade: 'Twice per board, send an exposed card at least 2 above its foundation home as the base of a fifth pile and finish its suit on two piles.',
  ability: {
    uses: (ctx) => ctx.level === 2 ? 2 : 1, label: 'Plant a fifth foundation',
    available: (ctx) => !!ctx.api.state && [...ctx.api.state.free, ...ctx.api.state.tableau.map((col) => col.at(-1))].some((card) => card && eligible(ctx, ctx.api.state, card)),
    async use(ctx) {
      const card = await ctx.api.pick({ kind: 'card', prompt: 'Choose a card to start a fifth foundation', filter: (card, st) => eligible(ctx, st, card) });
      if (card == null || !eligible(ctx, ctx.api.state, card)) return false;
      if (!ctx.api.charmMove('voyage.spur', { src: source(ctx.api.state, card), card, homeCards: [card] })) return false;
      ctx.api.notify('Aurora: finish this suit on its original pile and the fifth foundation.');
      return true;
    },
  },
});
