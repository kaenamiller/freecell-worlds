// Backrooms — crowded cells, a buried-card escape and a limited run exit.
import { canPlaceTableau, isPinned, registerCustomMove } from '../../rules.js';
import { defineCharm } from '../registry.js';
import { VOYAGE } from '../config.js';
import { liveMarks } from './kit.js';

const source = (st, card) => st.tableau.findIndex((col) => col.includes(card) && col.at(-1) !== card);
const destination = (st, rules, card, to) => Number.isInteger(to) && to >= 0 && to < st.tableau.length && to !== source(st, card) &&
  canPlaceTableau(st, to, card, 1, { ...rules, loneAccepts: 0, openCols: 0, cellExitWild: false });
const eligible = (ctx, st, card) => source(st, card) >= 0 && !(ctx.api.concealed || []).includes(card) && !isPinned(st, card, ctx.api.rules) &&
  st.tableau.some((_col, to) => destination(st, ctx.api.rules, card, to));
registerCustomMove('backrooms.noclip', {
  apply(st, m, rules) {
    const from = source(st, m.card);
    if (from < 0 || m.concealed?.includes(m.card) || isPinned(st, m.card, rules) || !destination(st, rules, m.card, m.to)) throw new Error('Noclip requires a buried face-up card and a fitting column');
    m.from = from; m.index = st.tableau[from].indexOf(m.card);
    st.tableau[from].splice(m.index, 1); st.tableau[m.to].push(m.card);
  },
  undo(st, m) { st.tableau[m.to].pop(); st.tableau[m.from].splice(m.index, 0, m.card); },
});

defineCharm({
  id: 'backrooms.hum', kind: 'boon', theme: 'backrooms', name: 'Fluorescent Hum', icon: '💡', family: 'cells', ease: .2,
  text: 'While all active free cells are full, you can move 2 more cards at once.',
  upgrade: 'While all active free cells are full, you can move 3 more cards at once.',
  rules(r, ctx) { r.fullCellsBonus = (r.fullCellsBonus || 0) + (ctx.level === 2 ? 3 : 2); },
});
defineCharm({
  id: 'backrooms.noclip', kind: 'boon', theme: 'backrooms', name: 'Noclip', icon: '🚪', family: 'ability', ease: .4,
  text: 'Once per board, move a face-up buried card through the wall onto a column top where it fits.',
  upgrade: 'Twice per board, move a face-up buried card through the wall onto a column top where it fits.',
  ability: {
    uses: (ctx) => ctx.level === 2 ? 2 : 1, label: 'Slip through the wall',
    available: (ctx) => !!ctx.api.state && ctx.api.state.tableau.flat().some((card) => eligible(ctx, ctx.api.state, card)),
    async use(ctx) {
      const card = await ctx.api.pick({ kind: 'card', prompt: 'Choose a face-up buried card to slip through the wall', filter: (card, st) => eligible(ctx, st, card) });
      if (card == null || !eligible(ctx, ctx.api.state, card)) return false;
      const to = await ctx.api.pick({ kind: 'column', prompt: 'Choose the column it comes out on', filter: (to, st) => destination(st, ctx.api.rules, card, to) });
      if (to == null || !destination(ctx.api.state, ctx.api.rules, card, to)) return false;
      return !!ctx.api.charmMove('backrooms.noclip', { card, to, concealed: ctx.api.concealed, tableauDrop: true });
    },
  },
});
defineCharm({
  id: 'backrooms.exitsign', kind: 'boon', theme: 'backrooms', name: 'Exit Sign', icon: '🟩', family: 'fortune', ease: 0,
  text: 'Once per run, before your first move, step out of a non-final board for a 1★ clear.',
  upgrade: 'Twice per run, before your first move, step out of a non-final board for a 1★ clear.',
  ability: {
    uses: 1, when: 'start', label: 'Step out',
    available: (ctx) => ctx.run.boardIdx < VOYAGE.boards - 1 && (ctx.runMemo.exits || 0) < (ctx.level === 2 ? 2 : 1),
    use(ctx) {
      if (ctx.run.boardIdx >= VOYAGE.boards - 1 || (ctx.runMemo.exits || 0) >= (ctx.level === 2 ? 2 : 1)) return false;
      ctx.runMemo.exits = (ctx.runMemo.exits || 0) + 1;
      if (ctx.api.concedeBoard()) return true;
      ctx.runMemo.exits--; return false;
    },
  },
});
defineCharm({
  id: 'backrooms.challenge', kind: 'challenge', theme: 'backrooms', name: 'No Exit', icon: '🔁', tags: ['COLUMN'],
  text: (s) => `The last card in ${s <= 2 ? 2 : s <= 4 ? 4 : 8} columns can only leave to its foundation.`,
  ease: (ctx) => ctx.strength <= 2 ? 0 : ctx.strength <= 4 ? -.94 : -1.71,
  rules(r, ctx) {
    const cols = ctx.rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, ctx.strength <= 2 ? 2 : ctx.strength <= 4 ? 4 : 8);
    r.noExitCols = (r.noExitCols || 0) | cols.reduce((mask, col) => mask | (1 << col), 0);
  },
  setup(_board, ctx) { noExitMarks(ctx); },
  on: { move(ctx) { noExitMarks(ctx); }, undo(ctx) { noExitMarks(ctx); } },
});
// The bottom card of each No Exit column is the one that can only leave to its foundation.
function noExitMarks(ctx) {
  const st = ctx.api.state, mask = ctx.api.rules?.noExitCols || 0;
  liveMarks(ctx, st ? st.tableau.filter((col, c) => col.length && (mask & (1 << c))).map((col) => col[0]) : [], 'noexit');
}
