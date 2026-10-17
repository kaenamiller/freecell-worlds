// Plaster Studio — solver-visible forms, an undoable mould, and next-board commissions.
import { cardsHome, rankOf, registerCustomMove } from '../../rules.js';
import { defineCharm } from '../registry.js';
import { cardsOfRanks, rankMask, replay } from './kit.js';

const faceUp = (ctx, st, card) => [...st.tableau.flat(), ...st.free].includes(card) && !(ctx.api.concealed || []).includes(card);
const mouldTarget = (ctx, st, card) => faceUp(ctx, st, card) && !(ctx.api.rules.wildRanks & rankMask(rankOf(card)));
// Tab only the ranks this charm cast; other charms' wild ranks keep their own marks.
function mouldMarks(ctx) {
  const ids = cardsOfRanks([...new Set(ctx.api.history.filter((m) => m.t === 'X' && m.op === 'plaster.mould').map((m) => rankOf(m.card)))]);
  ctx.api.unmark((ctx.memo.marked || []).filter((id) => !ids.includes(id)));
  ctx.api.mark(ids, 'mod-wild'); ctx.memo.marked = ids;
}
registerCustomMove('plaster.mould', {
  apply(st, m, rules) {
    if (![...st.tableau.flat(), ...st.free].includes(m.card) || m.concealed?.includes(m.card)) throw new Error('Mould requires a face-up card');
    m.previous = rules.wildRanks || 0;
    rules.wildRanks = m.previous | rankMask(rankOf(m.card));
  },
  undo(_st, m, rules) { rules.wildRanks = m.previous; },
});

defineCharm({
  id: 'plaster.armature', kind: 'boon', theme: 'plaster', name: 'Armature', icon: '🗿', family: 'columns', ease: .35,
  text: 'A column holding a single card accepts any card or valid run on top of it.',
  upgrade: 'A column holding one or two cards accepts any card or valid run on top of it.',
  rules(r, ctx) { r.loneAccepts = Math.max(r.loneAccepts || 0, ctx.level === 2 ? 2 : 1); },
});
defineCharm({
  id: 'plaster.mould', kind: 'boon', theme: 'plaster', name: 'Plaster Mould', icon: '🫙', family: 'wild', ease: .35,
  text: 'Once per board, choose a rank to make its four cards wild for the rest of the board.',
  upgrade: 'Twice per board, choose a rank to make its four cards wild for the rest of the board.',
  setup(_board, ctx) { mouldMarks(ctx); },
  on: { undo(ctx) { mouldMarks(ctx); } },
  ability: {
    uses: (ctx) => ctx.level === 2 ? 2 : 1, label: 'Cast a mould',
    available: (ctx) => !!ctx.api.state && [...ctx.api.state.tableau.flat(), ...ctx.api.state.free.filter(Boolean)].some((card) => mouldTarget(ctx, ctx.api.state, card)),
    async use(ctx) {
      const card = await ctx.api.pick({
        kind: 'card', prompt: 'Choose a card: all four of its rank become wild for the rest of the board',
        filter: (card, st) => mouldTarget(ctx, st, card),
        // Aim at a card to see every card of that rank light up.
        group: (card) => cardsOfRanks([rankOf(card)]),
      });
      if (card == null || !mouldTarget(ctx, ctx.api.state, card)) return false;
      if (!ctx.api.charmMove('plaster.mould', { card, concealed: ctx.api.concealed })) return false;
      mouldMarks(ctx); return true;
    },
  },
});
defineCharm({
  id: 'plaster.commission', kind: 'boon', theme: 'plaster', name: 'Commission', icon: '🖼️', family: 'coin',
  text: 'At each port, commission a rank for 10 coins: each card of that rank sent home before 26 cards are home on your next board pays 4 coins.',
  upgrade: 'At each port, commission a rank for 10 coins: each card of that rank sent home before 26 cards are home on your next board pays 6 coins.',
  portServices(ctx) {
    return [{ id: 'plaster.commission', label: 'Commission a rank', text: 'Choose a card to commission its rank for your next board (once per port).', price: 10, needsCard: true,
      apply(run, card) {
        const memo = (run.charmMemo['plaster.commission'] ??= {});
        if (memo.port === run.port.boardIdx) return false;
        memo.port = run.port.boardIdx; memo.rank = rankOf(card); memo.boardIdx = run.results.length; return true;
      },
    }];
  },
  setup(_board, ctx) {
    if (ctx.runMemo.boardIdx === ctx.run.boardIdx && ctx.runMemo.rank) ctx.api.mark(cardsOfRanks([ctx.runMemo.rank]), 'wanted');
  },
  score(sb, ctx) {
    if (ctx.runMemo.boardIdx !== sb.boardIdx || !ctx.runMemo.rank) return;
    const paid = new Set();
    replay(sb, (move, state) => {
      const cards = move.t === 'F' ? [move.card] : move.homeCards || (move.op === 'voyage.spur' ? [move.card] : []);
      for (const [i, card] of cards.entries()) {
        if (paid.has(card) || rankOf(card) !== ctx.runMemo.rank || cardsHome(state) - cards.length + i + 1 >= 26) continue;
        paid.add(card); sb.addCoins(`commission.${card}`, 'Commission', ctx.level === 2 ? 6 : 4, card);
      }
    });
  },
});
defineCharm({
  id: 'plaster.challenge', kind: 'challenge', theme: 'plaster', name: 'Wet Plaster', icon: '🪣', tags: ['COLUMN'],
  text: (s) => `Empty columns cannot be used until ${4 + 2 * s} cards are home.`,
  ease: (ctx) => {
    const n = 4 + 2 * ctx.strength;
    return n <= 12 ? -.94 - (n - 6) * (1.2 / 6) : -2.14 - (n - 12) * (.9 / 6);
  },
  rules(r, ctx) { r.emptyCure = Math.max(r.emptyCure || 0, 4 + 2 * ctx.strength); },
});
