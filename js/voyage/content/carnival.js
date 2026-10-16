// carnival: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `carnival`).
import { cardId, SUIT_CHARS } from '../../rules.js';
import { defineCharm } from '../registry.js';
import { stream } from '../rng.js';
import { cardsOfRanks, rankMask, suitOf } from './kit.js';

const minBlockedRank = (s) => Math.max(1, 14 - 2 * s);

defineCharm({
  id: 'carnival.wheel',
  kind: 'boon',
  theme: 'carnival',
  name: 'Prize Wheel',
  icon: '🎡',
  family: 'coin',
  text: 'Each board spins a coin multiplier from ×1 to ×2 for that board\'s payout.',
  upgrade: '×1.5 to ×2.5.',
  setup(_board, ctx) {
    const steps = 11;
    const base = ctx.level >= 2 ? 1.5 : 1;
    ctx.memo.mult = base + ctx.rng.int(steps) * 0.1;
    ctx.api.badge(`×${ctx.memo.mult.toFixed(1)}`);
  },
  coins(n, ctx) {
    const mult = ctx.memo.mult ?? 1;
    return Math.round(n * mult);
  },
});

defineCharm({
  id: 'carnival.ringmaster',
  kind: 'boon',
  theme: 'carnival',
  name: 'Ringmaster',
  icon: '🎪',
  family: 'wild',
  text: 'Nines are wild.',
  upgrade: 'Nines and Eights.',
  ease: 0.2,
  rules(r, ctx) {
    const ranks = ctx.level >= 2 ? [8, 9] : [9];
    r.wildRanks = (r.wildRanks || 0) | rankMask(...ranks);
  },
  setup(_board, ctx) {
    ctx.api.mark(cardsOfRanks(ctx.level >= 2 ? [8, 9] : [9]), 'wild');
  },
});

// The Fool is picked once from the rules stream, so the marked card is exactly the anchored one.
function foolCards(ctx, boardIdx = ctx.idx) {
  const count = ctx.level >= 2 ? 2 : 1;
  const rng = stream(ctx.seed, 'rules', boardIdx, 'carnival.fool');
  return rng.shuffle(Array.from({ length: 52 }, (_, i) => i + 1)).slice(0, count);
}

defineCharm({
  id: 'carnival.fool',
  kind: 'boon',
  theme: 'carnival',
  name: 'The Fool',
  icon: '🃏',
  family: 'wild',
  text: 'Each board, one random card is the Fool: anything may be placed on it.',
  upgrade: 'Two Fools.',
  rules(r, ctx) {
    const fools = foolCards(ctx);
    if (fools.length) r.anchorCards = [...new Set([...(r.anchorCards || []), ...fools])];
  },
  setup(board, ctx) {
    const onBoard = new Set([...board.state.tableau.flat(), ...board.state.free].filter(Boolean));
    const picks = foolCards(ctx, ctx.run.boardIdx).filter((id) => onBoard.has(id));
    if (picks.length) ctx.api.mark(picks, 'wild');
  },
});

defineCharm({
  id: 'carnival.challenge',
  kind: 'challenge',
  theme: 'carnival',
  name: 'Rigged Booth',
  icon: '🎯',
  tags: ['CELLS'],
  text: (s) => {
    const min = minBlockedRank(s);
    if (min <= 1) return 'No card of one suit (shown on the badge) can go into a free cell.';
    const ranks = min >= 12 ? 'Queen and King' : `${['', '', '2s', '', '4s', '', '6s', '', '8s', '', '10s'][min]} and higher`;
    return `One suit's ${ranks} (shown on the badge) can't go into free cells.`;
  },
  ease: (ctx) => -0.08 * ctx.strength,
  rules(r, ctx) {
    const minRank = minBlockedRank(ctx.strength);
    const suit = ctx.rng.int(4);
    r.noCellCards = [...(r.noCellCards || [])];
    for (let rank = minRank; rank <= 13; rank++) r.noCellCards.push(cardId(suit, rank));
  },
  setup(board, ctx) {
    const cards = ctx.api.rules?.noCellCards || [];
    if (cards.length) {
      ctx.api.mark(cards, 'lock');
      ctx.api.badge(SUIT_CHARS[suitOf(cards[0])]);
    }
  },
});
