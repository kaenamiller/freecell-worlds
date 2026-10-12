// cove: boons + challenge. Spec: docs/voyage/charms-design.md (theme `cove`).
import { defineCharm } from '../registry.js';
import { countHome, replay } from './kit.js';

function dealCardIds(state) {
  const ids = [];
  for (const col of state.tableau) ids.push(...col);
  for (const card of state.free) if (card) ids.push(card);
  return ids;
}

defineCharm({
  id: 'cove.treasure',
  kind: 'boon',
  theme: 'cove',
  name: 'Buried Treasure',
  icon: '💰',
  text: 'The deepest card of one column is treasure: +150 when it goes home.',
  setup(board, ctx) {
    const nonempty = board.state.tableau.map((col, i) => (col.length ? i : -1)).filter((i) => i >= 0);
    const colIdx = nonempty.length ? ctx.rng.pick(nonempty) : 0;
    const card = board.state.tableau[colIdx][0];
    ctx.memo.treasure = card;
    ctx.api.mark([card], 'gold');
  },
  score(sb, ctx) {
    const id = ctx.memo.treasure;
    if (id && countHome(sb.history, (c) => c === id)) sb.add('treasure', 'Buried treasure', 150);
  },
});

defineCharm({
  id: 'cove.keg',
  kind: 'boon',
  theme: 'cove',
  name: 'Lucky Doubloon',
  icon: '🪙',
  text: 'Once per board, take back your last move without spending an undo.',
  ease: 0,
  ability: {
    uses: 1,
    label: 'Flip the doubloon',
    available: (ctx) => ctx.api.history.some((m) => !m.auto),
    use(ctx) {
      // Rewind to just before the last player move (auto-play that followed it goes too).
      const h = ctx.api.history;
      let i = h.length - 1;
      while (i >= 0 && h[i].auto) i--;
      if (i < 0) return false;
      ctx.api.addUndos(1);
      if (!ctx.api.rewind(h.length - i)) {
        ctx.api.spendUndos(1);
        return false;
      }
      ctx.api.notify('Lucky Doubloon: move taken back for free');
      return true;
    },
  },
});

defineCharm({
  id: 'cove.parrot',
  kind: 'boon',
  theme: 'cove',
  name: 'Parrot',
  icon: '🦜',
  text: 'The first time on each board you send a card home from a free cell, +1 undo.',
  ease: 0.15,
  on: {
    foundation(ctx, ev) {
      if (ev.src?.kind !== 'free' || ctx.memo.parrot) return;
      ctx.memo.parrot = true;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'cove.challenge',
  kind: 'challenge',
  theme: 'cove',
  name: 'Cursed Gold',
  icon: '🪙',
  tags: ['SCORE'],
  text: (s) => `${1 + s} cursed cards; every move you make while one sits in a free cell costs 3 points per cursed card there.`,
  ease: (ctx) => -0.05 * ctx.strength,
  setup(board, ctx) {
    const pool = dealCardIds(board.state);
    const n = 1 + ctx.strength;
    ctx.memo.cursed = ctx.rng.shuffle(pool).slice(0, n);
    ctx.api.mark(ctx.memo.cursed, 'curse');
  },
  score(sb, ctx) {
    const cursed = new Set(ctx.memo.cursed || []);
    let penalty = 0;
    // Charged per player move for each cursed card parked in a free cell after that move.
    replay(sb, (move, state) => {
      if (move.auto) return;
      for (const card of state.free) if (card && cursed.has(card)) penalty += 3;
    });
    if (penalty) sb.add('curse', 'Cursed gold', -penalty);
  },
});
