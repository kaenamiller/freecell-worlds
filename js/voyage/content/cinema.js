// Silent Cinema — exposure, one recharge per ability, and a non-final cliffhanger.
import { cardsHome, registerCustomMove } from '../../rules.js';
import { defineCharm } from '../registry.js';
import { VOYAGE } from '../config.js';
import { cardsOfRanks, rankMask } from './kit.js';

const eligible = (ctx, st, card) => [...st.tableau.flat(), ...st.free].includes(card) && !(ctx.api.concealed || []).includes(card) && !(ctx.api.rules.wildCards || []).includes(card);
// Tab only the cards this charm exposed: Wild-sticker cards already show their sticker.
const ownCards = (ctx, op) => ctx.api.history.filter((m) => m.t === 'X' && m.op === op).map((m) => m.card);
function exposureMarks(ctx) {
  const ids = ownCards(ctx, 'cinema.exposure');
  ctx.api.unmark((ctx.memo.marked || []).filter((id) => !ids.includes(id)));
  ctx.api.mark(ids, 'mod-wild'); ctx.memo.marked = [...ids];
}
registerCustomMove('cinema.exposure', {
  apply(st, m, rules) {
    if (![...st.tableau.flat(), ...st.free].includes(m.card) || m.concealed?.includes(m.card) || (rules.wildCards || []).includes(m.card)) throw new Error('Exposure requires a face-up card that is not already wild');
    m.previous = [...(rules.wildCards || [])]; rules.wildCards = [...m.previous, m.card];
  },
  undo(_st, m, rules) { rules.wildCards = [...m.previous]; },
});

defineCharm({
  id: 'cinema.exposure', kind: 'boon', theme: 'cinema', name: 'Double Exposure', icon: '🎞️', family: 'wild', ease: .3,
  text: 'Once per board, choose a face-up card that ignores colour for the rest of the board.',
  upgrade: 'Twice per board, choose a face-up card that ignores colour for the rest of the board.',
  setup(_board, ctx) { exposureMarks(ctx); }, on: { undo(ctx) { exposureMarks(ctx); } },
  ability: {
    uses: (ctx) => ctx.level === 2 ? 2 : 1, label: 'Double expose a card',
    available: (ctx) => !!ctx.api.state && [...ctx.api.state.tableau.flat(), ...ctx.api.state.free.filter(Boolean)].some((card) => eligible(ctx, ctx.api.state, card)),
    async use(ctx) {
      const card = await ctx.api.pick({ kind: 'card', prompt: 'Choose a card to ignore colour for the rest of the board', filter: (card, st) => eligible(ctx, st, card) });
      if (card == null || !eligible(ctx, ctx.api.state, card)) return false;
      if (!ctx.api.charmMove('cinema.exposure', { card, concealed: ctx.api.concealed })) return false;
      exposureMarks(ctx); return true;
    },
  },
});
defineCharm({
  id: 'cinema.projectionist', kind: 'boon', theme: 'cinema', name: 'Projectionist', icon: '📽️', family: 'ability', ease: .25,
  text: 'Each exhausted ability recharges once per board when at least 26 cards are home.',
  upgrade: 'Each exhausted ability recharges once per board when at least 20 cards are home.',
  on: { foundation(ctx) {
    if (cardsHome(ctx.api.state) < (ctx.level === 2 ? 20 : 26)) return;
    const used = (ctx.memo.recharged ??= {});
    for (const [id, uses] of Object.entries(ctx.api.abilityUses())) {
      if (uses || used[id]) continue;
      if (ctx.api.grantUse(id, 1)) used[id] = true;
    }
  } },
});
defineCharm({
  id: 'cinema.cliffhanger', kind: 'boon', theme: 'cinema', name: 'Cliffhanger', icon: '🎬', family: 'fortune', ease: 0,
  text: 'Once per run, being stuck with no undos on a non-final board gives a 1★ clear and continues your voyage.',
  upgrade: 'Twice per run, being stuck with no undos on a non-final board gives a 1★ clear and continues your voyage.',
  on: { stuck(ctx) {
    if (ctx.run.boardIdx >= VOYAGE.boards - 1 || ctx.run.undos > 0 || (ctx.runMemo.exits || 0) >= (ctx.level === 2 ? 2 : 1)) return false;
    ctx.runMemo.exits = (ctx.runMemo.exits || 0) + 1;
    if (ctx.api.concedeBoard()) return true;
    ctx.runMemo.exits--; return false;
  } },
});
const castRanks = (strength) => strength <= 2 ? [12] : strength <= 4 ? [11, 12] : strength <= 6 ? [10, 11, 12] : [9, 10, 11, 12];
defineCharm({
  id: 'cinema.challenge', kind: 'challenge', theme: 'cinema', name: 'Typecast', icon: '🎭', tags: ['STACK'],
  text: (s) => `${s <= 2 ? 'Queens' : s <= 4 ? 'Queens and Jacks' : s <= 6 ? 'Queens, Jacks and 10s' : '9s through Queens'} may only be placed on a card of their own colour one rank higher.`,
  // Measured −0.95 for Queens; larger masks measured ~0 at short budget (noise). Kept monotonic.
  ease: (ctx) => ctx.strength <= 2 ? -.95 : ctx.strength <= 4 ? -1.2 : ctx.strength <= 6 ? -1.45 : -1.7,
  rules(r, ctx) { r.sameColorRanks = (r.sameColorRanks || 0) | rankMask(castRanks(ctx.strength)); },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks(castRanks(ctx.strength)), 'curse'); },
});
