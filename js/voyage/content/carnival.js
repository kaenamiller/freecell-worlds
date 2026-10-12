// carnival: boons + challenge. Spec: docs/voyage/charms-design.md (theme `carnival`).
import { cardId, SUIT_CHARS } from '../../rules.js';
import { defineCharm } from '../registry.js';
import { cardsOfRanks, rankMask, suitOf } from './kit.js';

const minBlockedRank = (s) => Math.max(1, 14 - 2 * s);

defineCharm({
  id: 'carnival.wheel', kind: 'boon', theme: 'carnival', name: 'Prize Wheel', icon: '🎡',
  text: 'Each board spins a score multiplier between ×1.0 and ×1.3.',
  setup(board, ctx) {
    ctx.memo.mult ??= 1 + ctx.rng.int(4) * 0.1;
    ctx.api.badge(`×${ctx.memo.mult.toFixed(1)}`);
  },
  score(sb, ctx) {
    if (ctx.memo.mult > 1) sb.mult('Prize Wheel', ctx.memo.mult);
  },
});

defineCharm({
  id: 'carnival.ringmaster', kind: 'boon', theme: 'carnival', name: 'Ringmaster', icon: '🎪',
  text: 'Nines are wild: they ignore colour when stacking.',
  ease: 0.2,
  rules(r) {
    r.wildRanks = (r.wildRanks || 0) | rankMask(9);
  },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks([9]), 'wild'); },
});

defineCharm({
  id: 'carnival.ticket', kind: 'boon', theme: 'carnival', name: 'Ticket Stub', icon: '🎟️',
  text: 'Each board cleared with 2★+ earns a ticket; at 3 tickets, gain +3 undos.',
  on: {
    win(ctx, { result }) {
      if (result.stars < 2) return;
      ctx.runMemo.tickets = (ctx.runMemo.tickets || 0) + 1;
      if (ctx.runMemo.tickets >= 3) {
        ctx.runMemo.tickets = 0;
        ctx.api.addUndos(3);
        ctx.api.notify('Three tickets: +3 undos');
      }
    },
  },
});

defineCharm({
  id: 'carnival.challenge', kind: 'challenge', theme: 'carnival', name: 'Rigged Booth', icon: '🎯',
  tags: ['CELLS'],
  text: (s) => `One suit's cards ranked ${minBlockedRank(s)} and up can't enter free cells.`,
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
