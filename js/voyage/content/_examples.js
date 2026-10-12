// DEV ONLY: not imported by index.js. Checker/browser fixtures import this explicitly.
import { defineCharm } from '../registry.js';
import * as Rules from '../../rules.js';
import { replay, countHome, rankMask, suitMask, rankOf } from './kit.js';

export function registerExampleMoves() {
  if (!Rules.registerCustomMove) return false;
  Rules.registerCustomMove('dev.swap', {
    apply(st, m) {
      const a = st.tableau[m.a], b = st.tableau[m.b];
      if (!a?.length || !b?.length || m.a === m.b) throw new Error('Swap requires two different non-empty columns');
      m.cards = [a.at(-1), b.at(-1)];
      [a[a.length - 1], b[b.length - 1]] = [b.at(-1), a.at(-1)];
    },
    undo(st, m) {
      const a = st.tableau[m.a], b = st.tableau[m.b];
      [a[a.length - 1], b[b.length - 1]] = [b.at(-1), a.at(-1)];
    },
  });
  return true;
}
registerExampleMoves();

export const examples = [
  defineCharm({
    id: 'dev.survey', kind: 'boon', theme: 'roman', name: 'Survey Kit', icon: '⌖',
    text: 'Mark a card, add an ability use, and play a hint.', abilityBonus: 1,
    rules(r) { r.wildRanks = (r.wildRanks || 0) | rankMask(10); r.suitBuild = (r.suitBuild || 0) | suitMask(0); },
    setup(board, ctx) {
      ctx.memo.card ??= board.state.tableau[0].at(-1);
      ctx.api.mark([ctx.memo.card], 'wanted'); ctx.api.badge('♦');
    },
    onPick(run, ctx) { ctx.runMemo.picked = true; ctx.api.addUndos(1); },
    ability: { uses: 1, label: 'Scout a move', use: (ctx) => ctx.api.hint() },
    offers: (n) => n + 1,
    thresholds: (arr) => arr.map((n, i) => i ? Math.round(n * .95) : n),
    score(sb, ctx) {
      replay(sb, () => {});
      sb.add('survey', 'Surveyed cards', countHome(sb.history, (id) => id === ctx.memo.card) * 25);
    },
    on: { reveal(ctx) { ctx.memo.reveals = (ctx.memo.reveals || 0) + 1; } },
  }),
  defineCharm({
    id: 'dev.workshop', kind: 'boon', theme: 'roman', name: 'Workshop', icon: '⇄',
    text: 'Pick two columns and swap their top cards; undo restores them.',
    ability: {
      uses: 2, label: 'Swap column tops',
      available: (ctx) => !!ctx.api.state?.tableau.filter((c) => c.length).length,
      async use(ctx) {
        // Other modes exercise the remaining runtime primitives in the checker.
        if (ctx.memo.mode === 'cells') return ctx.api.setFreeCells(ctx.api.state.free.length + 1);
        if (ctx.memo.mode === 'override') return ctx.api.override({ ignoreColour: true, ignoreRank: true });
        if (ctx.memo.mode === 'home') return ctx.api.autoHome();
        const a = await ctx.api.pick({ kind: 'column', filter: (i, st) => st.tableau[i].length > 0 });
        if (a == null) return false;
        const b = await ctx.api.pick({ kind: 'column', filter: (i, st) => i !== a && st.tableau[i].length > 0 });
        if (b == null) return false;
        return !!ctx.api.charmMove('dev.swap', { a, b });
      },
    },
  }),
  defineCharm({
    id: 'dev.veil', kind: 'challenge', theme: 'roman', name: 'Practice Fog', icon: '◩', tags: ['VIS', 'SCORE'],
    text: (s) => `Conceal ${s} buried cards in each column.`,
    setup(board, ctx) {
      ctx.api.conceal(board.state.tableau.flatMap((col) => col.slice(Math.max(0, col.length - 1 - ctx.strength), -1)));
      ctx.api.badge(String(ctx.strength));
    },
    starCap: (ctx) => ctx.elapsed > 600 ? 2 : 3,
    score(sb) { sb.add('fog', 'Fog practice', countHome(sb.history, (id) => rankOf(id) === 1) * 5); },
    on: {
      stuck(ctx) {
        if (ctx.runMemo.rescued) return false;
        ctx.runMemo.rescued = true; ctx.api.addUndos(2); ctx.api.notify('Practice rescue'); return true;
      },
    },
  }),
];
