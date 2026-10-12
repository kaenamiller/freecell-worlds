// Pure content helpers. Replay a COPY: hooks must never mutate the live board or history.
import { applyMove, cardId, cloneState, rankOf, suitOf } from '../../rules.js';

export function replay(sb, fn) {
  if (!sb.initial) throw new Error('replay requires sb.initial');
  const state = cloneState(sb.initial);
  const rules = JSON.parse(JSON.stringify(sb.initialRules || sb.rules || {}));
  sb.history.forEach((move, i) => {
    const m = JSON.parse(JSON.stringify(move));
    applyMove(state, m, rules);
    fn(move, state, i);
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
