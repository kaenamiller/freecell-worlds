// Pure content helpers. Replay a COPY: hooks must never mutate the live board or history.
// The callback receives (move, state, index, rules) after each move, including cleanses.
import { applyMove, cardId, cloneState, rankOf, suitOf } from '../../rules.js';

export function replay(sb, fn) {
  if (!sb.initial) throw new Error('replay requires sb.initial');
  const state = cloneState(sb.initial);
  const rules = JSON.parse(JSON.stringify(sb.initialRules || sb.rules || {}));
  sb.history.forEach((move, i) => {
    const m = JSON.parse(JSON.stringify(move));
    applyMove(state, m, rules);
    fn(move, state, i, rules);
  });
  return state;
}

// Consecutive home runs, as arrays of descriptors (chain.length is its size).
export function chainsOf(history) {
  const chains = [];
  let chain = [];
  for (const move of history) {
    if (move.t === 'F') chain.push(move);
    else if (chain.length) { chains.push(chain); chain = []; }
  }
  if (chain.length) chains.push(chain);
  return chains;
}
export const foundationSequence = (history) => history.filter((m) => m.t === 'F').map((m) => m.card);
export const countHome = (history, pred = () => true) => foundationSequence(history).filter(pred).length;
export const rankMask = (...ranks) => ranks.flat().reduce((mask, rank) => mask | (1 << rank), 0);
export const suitMask = (...suits) => suits.flat().reduce((mask, suit) => mask | (1 << suit), 0);
export const isCourt = (card) => rankOf(card) >= 11;
export const suitName = (suit) => ['Clubs', 'Diamonds', 'Hearts', 'Spades'][suit];
export const rankName = (rank) => ({ 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' }[rank] || String(rank));
export const ALL_RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
export function ranksIn(mask) {
  const ranks = [];
  for (let rank = 1; rank <= 13; rank++) if (mask & (1 << rank)) ranks.push(rank);
  return ranks;
}
export function cardsOfRanks(ranks, suits = [0, 1, 2, 3]) {
  const ids = [];
  for (const suit of suits) for (const rank of ranks) ids.push(cardId(suit, rank));
  return ids;
}
export { rankOf, suitOf };

// Marks that follow the board (No Exit's bottom cards, expiring pins): show `ids` with
// `style` and drop the ones this charm marked before. Only touches what changed, so
// calling it from every move/undo hook stays cheap.
export function liveMarks(ctx, ids, style) {
  const saved = ctx.memo._runtime?.marks || {};
  const gone = (ctx.memo.marked || []).filter((id) => !ids.includes(id) && saved[id]);
  const added = ids.filter((id) => saved[id] !== style);
  if (gone.length) ctx.api.unmark(gone);
  if (added.length) ctx.api.mark(added, style);
  ctx.memo.marked = [...ids];
}

// Pure guards for reset/window abilities. Automatic plays alone cannot be rewound
// as a player step; a won board is never an ability target.
export const hasPlayerMove = (history) => history.some((move) => !move.auto);
export const boardWon = (state) => !!state && state.found.reduce((n, rank) => n + rank, 0) === 52;
export const canUndoBoard = ({ api }) => !!api.state && !boardWon(api.state) && hasPlayerMove(api.history);
export const paidUndo = (ev = {}) => !ev.reset && !ev.free;

// Sticker abilities (Amber, Misprint): a card holds one sticker, so replacing one the
// player already owns needs a yes. Resolves true to go ahead. Not pure: it asks via api.
export async function confirmStickerSwap(ctx, card, type) {
  const old = ctx.api.stickers?.[card];
  if (!old || old === type) return true;
  const name = (t) => t[0].toUpperCase() + t.slice(1);
  return (await ctx.api.choose({
    card, prompt: `This card already carries a ${name(old)} sticker. A card holds one sticker.`,
    options: [{ value: true, label: `Replace with ${type === '?' ? 'a random one' : name(type)}` }, { value: false, label: `Keep ${name(old)}` }],
  })) === true;
}
export const cardName = (card) => `${rankName(rankOf(card))} of ${suitName(suitOf(card))}`;
