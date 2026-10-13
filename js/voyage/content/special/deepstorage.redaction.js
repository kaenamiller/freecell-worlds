import { defineCharm } from '../../registry.js';
import { registerCustomMove } from '../../../rules.js';

const inPlay = (st, card) => st.tableau.some((col) => col.includes(card)) || st.free.includes(card);
const eligible = (ctx, st, card) => Number.isInteger(card) && card >= 1 && card <= 52 && inPlay(st, card) &&
  !(ctx.api.concealed || []).includes(card) && !(ctx.api.rules.anchorCards || []).includes(card);

// Tab only the cards this charm redacted: Fool-sticker cards already show their sticker.
function syncMarks(ctx) {
  const ids = ctx.api.history.filter((m) => m.t === 'X' && m.op === 'deepstorage.redaction').map((m) => m.card);
  ctx.api.unmark((ctx.memo.marked || []).filter((id) => !ids.includes(id)));
  if (ids.length) ctx.api.mark(ids, 'mod-anchor');
  ctx.memo.marked = [...ids];
}

registerCustomMove('deepstorage.redaction', {
  apply(st, m, rules) {
    if (!Number.isInteger(m.card) || m.card < 1 || m.card > 52 || !inPlay(st, m.card) || m.concealed?.includes(m.card) || (rules.anchorCards || []).includes(m.card)) {
      throw new Error('Redaction requires a face-up card that is not already an anchor');
    }
    m.previous = rules.anchorCards == null ? null : [...rules.anchorCards];
    rules.anchorCards = [...(rules.anchorCards || []), m.card];
  },
  undo(_st, m, rules) {
    if (m.previous == null) delete rules.anchorCards;
    else rules.anchorCards = [...m.previous];
  },
});

defineCharm({
  id: 'deepstorage.redaction', kind: 'boon', theme: 'deepstorage', name: 'Redaction', icon: '⬛', family: 'wild', ease: 0.4,
  text: 'Once per board, choose a face-up card that anything may be placed on for the rest of the board.',
  upgrade: 'Twice per board, choose a face-up card that anything may be placed on for the rest of the board.',
  setup(_board, ctx) { syncMarks(ctx); },
  on: { undo(ctx) { syncMarks(ctx); } },
  ability: {
    uses: (ctx) => ctx.level >= 2 ? 2 : 1, label: 'Redact a card',
    available: (ctx) => !!ctx.api.state && [...ctx.api.state.tableau.flat(), ...ctx.api.state.free.filter(Boolean)].some((card) => eligible(ctx, ctx.api.state, card)),
    async use(ctx) {
      const card = await ctx.api.pick({ kind: 'card', prompt: 'Choose a card that anything may be placed on for the rest of the board', filter: (card, st) => eligible(ctx, st, card) });
      if (card == null || !eligible(ctx, ctx.api.state, card)) return false;
      if (!ctx.api.charmMove('deepstorage.redaction', { card, concealed: ctx.api.concealed })) return false;
      syncMarks(ctx);
      ctx.api.notify('Redaction: anything may stack onto this card.');
      return true;
    },
  },
});
