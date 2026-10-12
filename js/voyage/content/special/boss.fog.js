// Fog changes information only; discoveries and the peek budget live in memo.
import { defineCharm } from '../../registry.js';

const showPeeks = (ctx) => ctx.api.badge(String(ctx.memo.peeks));

// Input calls this only when a reveal starts. It never creates a move or changes
// the saved concealed set; api.badge refreshes/persists the updated budget.
export function spendFogPeek(ctx) {
  if (ctx.memo.peeks <= 0) {
    ctx.api.notify('No peeks left. Empty a column to earn one.');
    return false;
  }
  ctx.memo.peeks--;
  showPeeks(ctx);
  return true;
}

// A pointer gesture that becomes a card drag is free, even if its hold revealed.
export function refundFogPeek(ctx) {
  ctx.memo.peeks = Math.min(6, ctx.memo.peeks + 1);
  showPeeks(ctx);
}

function revealTopThree(ctx) {
  const hidden = new Set(ctx.api.concealed);
  const visible = ctx.api.state.tableau.flatMap((col) => col.slice(-3)).filter((id) => hidden.has(id));
  if (visible.length) ctx.api.reveal(visible);
}

function undoFog(ctx) {
  const historyLength = ctx.api.history.length;
  // A saturated grant has delta zero: undo must not remove an unearned peek.
  const grants = ctx.memo.peekGrants || [];
  const removed = grants.filter((grant) => grant.at > historyLength);
  ctx.memo.peekGrants = grants.filter((grant) => grant.at <= historyLength);
  ctx.memo.peeks = Math.max(0, ctx.memo.peeks - removed.reduce((sum, grant) => sum + grant.delta, 0));
  showPeeks(ctx);
  revealTopThree(ctx);
}

defineCharm({
  id: 'boss.fog',
  kind: 'boss',
  name: 'Fog of War',
  icon: '🌫️',
  tags: ['VIS'],
  text: 'Cards more than 3 deep are face-down; you have 3 peeks (+1 per emptied column).',
  ease: 0,
  dealShift: -0.5,
  boonRelation: (id) => id === 'deepstorage.clearance' ? '!' : '~',
  setup(board, ctx) {
    ctx.memo.peeks ??= 3;
    ctx.memo.peekGrants ??= [];
    showPeeks(ctx);
    ctx.api.conceal(board.state.tableau.flatMap((col) => col.slice(0, Math.max(0, col.length - 3))));
    // Resume setup receives the original deal; discoveries use the live board.
    // Scoped conceal is suppressed during restored setup by BoardEffects.
    revealTopThree(ctx);
  },
  on: {
    start: revealTopThree,
    move: revealTopThree,
    undo: undoFog,
    columnEmpty(ctx, { col }) {
      const delta = ctx.memo.peeks < 6 ? 1 : 0;
      ctx.memo.peekGrants.push({ at: ctx.api.history.length, col, delta });
      ctx.memo.peeks += delta;
      showPeeks(ctx);
    },
  },
});
