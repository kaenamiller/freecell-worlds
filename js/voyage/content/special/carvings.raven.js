import { defineCharm } from '../../registry.js';
import { registerCustomMove } from '../../../rules.js';

const nonempty = (st, i) => Number.isInteger(i) && !!st.tableau[i]?.length;
registerCustomMove('carvings.raven', {
  apply(st, m) {
    if (m.a === m.b || !nonempty(st, m.a) || !nonempty(st, m.b)) {
      throw new Error("Raven's Trick requires two different non-empty columns");
    }
    const a = st.tableau[m.a], b = st.tableau[m.b];
    m.cards = [a.at(-1), b.at(-1)];
    // Like a dealt pile, the new pair need not form a movable sequence.
    [a[a.length - 1], b[b.length - 1]] = [b.at(-1), a.at(-1)];
  },
  undo(st, m) {
    const a = st.tableau[m.a], b = st.tableau[m.b];
    [a[a.length - 1], b[b.length - 1]] = [b.at(-1), a.at(-1)];
  },
});

defineCharm({
  id: 'carvings.raven', kind: 'boon', theme: 'carvings', name: "Raven's Trick", icon: '🐦‍⬛', ease: 0.35,
  text: 'Once per board, swap the top cards of two different non-empty columns.',
  ability: {
    uses: 1, label: 'Swap two column tops',
    available: (ctx) => (ctx.api.state?.tableau.filter((col) => col.length).length || 0) >= 2,
    async use(ctx) {
      const a = await ctx.api.pick({ kind: 'column', filter: (i, st) => nonempty(st, i) });
      if (a == null) return false;
      const b = await ctx.api.pick({ kind: 'column', filter: (i, st) => i !== a && nonempty(st, i) });
      if (b == null) return false;
      if (!ctx.api.charmMove('carvings.raven', { a, b })) return false;
      ctx.api.notify("Raven's Trick swapped two column tops.");
      return true;
    },
  },
});
