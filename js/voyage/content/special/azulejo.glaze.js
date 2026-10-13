import { defineCharm } from '../../registry.js';
import { registerCustomMove, rankOf } from '../../../rules.js';
import { rankName } from '../kit.js';

const inPlay = (st, card) => st.tableau.some((col) => col.includes(card)) || st.free.includes(card);
const faceUp = (ctx, st, card) => Number.isInteger(card) && card >= 1 && card <= 52 && inPlay(st, card) && !(ctx.api.concealed || []).includes(card);
// A shift is legal when it stays within Ace..King and changes the card's current glaze.
const canShift = (ctx, card, shift) => rankOf(card) + shift >= 1 && rankOf(card) + shift <= 13 && shift !== ctx.api.rules.rankShift?.[card];
const eligible = (ctx, st, card) => faceUp(ctx, st, card) && (canShift(ctx, card, 1) || canShift(ctx, card, -1));
const glazeMark = (card, shift) => `mod-rank-${shift > 0 ? 'up' : 'down'}-${rankOf(card) + shift}`;

// Each glazed card carries a tab with an arrow and the rank it now stacks as.
function syncMarks(ctx) {
  const shifts = ctx.api.rules.rankShift || {};
  const want = Object.fromEntries(Object.entries(shifts).map(([id, shift]) => [id, glazeMark(Number(id), shift)]));
  const had = ctx.memo.marked || {};
  const stale = Object.keys(had).filter((id) => had[id] !== want[id]).map(Number);
  if (stale.length) ctx.api.unmark(stale);
  for (const [id, style] of Object.entries(want)) if (had[id] !== style) ctx.api.mark([Number(id)], style);
  ctx.memo.marked = want;
}

registerCustomMove('azulejo.glaze', {
  apply(st, m, rules) {
    if (!Number.isInteger(m.card) || m.card < 1 || m.card > 52 || !inPlay(st, m.card) || m.concealed?.includes(m.card) ||
        ![-1, 1].includes(m.shift) || rankOf(m.card) + m.shift < 1 || rankOf(m.card) + m.shift > 13 || rules.rankShift?.[m.card] === m.shift) {
      throw new Error('Glaze requires a face-up card and a new rank shift of one');
    }
    m.previous = rules.rankShift == null ? null : { ...rules.rankShift };
    rules.rankShift = { ...(rules.rankShift || {}), [m.card]: m.shift };
  },
  undo(_st, m, rules) {
    if (m.previous == null) delete rules.rankShift;
    else rules.rankShift = { ...m.previous };
  },
});

defineCharm({
  id: 'azulejo.glaze', kind: 'boon', theme: 'azulejo', name: 'Glaze', icon: '🖌️', family: 'wild', ease: 0.3,
  text: 'Once per board, repaint a card to count one rank higher or lower for stacking for the rest of the board.',
  upgrade: 'Twice per board, repaint a card to count one rank higher or lower for stacking for the rest of the board.',
  setup(_board, ctx) {
    // Boards saved before the rank tab stored a plain id list.
    if (Array.isArray(ctx.memo.marked)) { ctx.api.unmark(ctx.memo.marked); ctx.memo.marked = {}; }
    syncMarks(ctx);
  },
  on: { undo(ctx) { syncMarks(ctx); } },
  markText(card, _style, ctx) {
    const shift = ctx.api.rules.rankShift?.[card];
    if (!shift) return null;
    return `Glazed: stacks as ${rankName(rankOf(card) + shift)} for the rest of this board. It still goes home as ${rankName(rankOf(card))}.`;
  },
  ability: {
    uses: (ctx) => ctx.level >= 2 ? 2 : 1, label: 'Repaint a card',
    available: (ctx) => !!ctx.api.state && [...ctx.api.state.tableau.flat(), ...ctx.api.state.free.filter(Boolean)].some((card) => eligible(ctx, ctx.api.state, card)),
    async use(ctx) {
      const card = await ctx.api.pick({ kind: 'card', prompt: 'Choose a card to repaint', filter: (card, st) => eligible(ctx, st, card) });
      if (card == null) return false;
      const rank = rankOf(card), option = (shift) => ({
        value: shift, label: `${shift > 0 ? '▲' : '▼'}${rank + shift >= 1 && rank + shift <= 13 ? ` ${rankName(rank + shift)}` : ''}`,
        detail: rank + shift < 1 || rank + shift > 13 ? (shift > 0 ? 'Kings cannot go higher' : 'Aces cannot go lower')
          : !canShift(ctx, card, shift) ? 'Already glazed this way' : `Stacks as ${rankName(rank + shift)}`,
        disabled: !canShift(ctx, card, shift),
      });
      const shift = await ctx.api.choose({
        card, prompt: `Repaint this ${rankName(rank)} one rank lower or higher for stacking. It still goes home as ${rankName(rank)}.`,
        options: [option(-1), option(1)],
      });
      if (shift == null || !eligible(ctx, ctx.api.state, card) || !canShift(ctx, card, shift)) return false;
      if (!ctx.api.charmMove('azulejo.glaze', { card, shift, concealed: ctx.api.concealed })) return false;
      syncMarks(ctx);
      ctx.api.notify(`Glaze: this card stacks as ${rankName(rankOf(card) + shift)}; its foundation rank stays the same.`);
      return true;
    },
  },
});
