// museum: boons + challenge. Spec: docs/voyage/charms-design.md (theme `museum`).
// digsite (C) lives in ./special/museum.digsite.js
import { defineCharm } from '../registry.js';
import { replay } from './kit.js';

function cardsInMove(move) {
  if (move.t === 'T' && move.cards?.length) return move.cards;
  if (move.card) return [move.card];
  return [];
}

function allDealtCards(state) {
  const ids = [];
  for (const col of state.tableau) ids.push(...col);
  for (const card of state.free) if (card) ids.push(card);
  return ids;
}

defineCharm({
  id: 'museum.fossil',
  kind: 'boon',
  theme: 'museum',
  name: 'Fossil Record',
  icon: '🦴',
  text: 'Your first chain of 6+ cards on each board grants +1 undo.',
  on: {
    foundation(ctx) {
      ctx.memo.chain = (ctx.memo.chain || 0) + 1;
      if (!ctx.memo.chainUndo && ctx.memo.chain >= 6) {
        ctx.memo.chainUndo = true;
        ctx.api.addUndos(1);
      }
    },
    move(ctx, { move }) {
      if (move.t !== 'F') ctx.memo.chain = 0;
    },
  },
});

defineCharm({
  id: 'museum.docent',
  kind: 'boon',
  theme: 'museum',
  name: 'Docent',
  icon: '🎟️',
  text: 'Once per board, show the best next move.',
  ability: {
    uses: 1,
    label: 'Show best move',
    use: (ctx) => ctx.api.hint(),
  },
});

defineCharm({
  id: 'museum.challenge',
  kind: 'challenge',
  theme: 'museum',
  name: 'Fragile Exhibits',
  icon: '🏺',
  tags: ['SCORE'],
  text: (s) => {
    const n = 1 + s;
    return `${n} fragile card${n === 1 ? '' : 's'}; −25 each time one moves again after its first move (except to its foundation).`;
  },
  setup(board, ctx) {
    const need = 1 + ctx.strength;
    const pool = ctx.rng.shuffle(allDealtCards(board.state));
    const fragile = pool.slice(0, Math.min(need, pool.length));
    ctx.memo.fragile = fragile;
    if (fragile.length) ctx.api.mark(fragile, 'fragile');
  },
  score(sb, ctx) {
    const fragile = new Set(ctx.memo.fragile || []);
    if (!fragile.size) return;
    const moved = new Set();
    let penalty = 0;
    replay(sb, (move) => {
      if (move.auto) return;
      for (const id of cardsInMove(move)) {
        if (!fragile.has(id)) continue;
        if (move.t === 'F' && move.card === id) continue;
        if (!moved.has(id)) {
          moved.add(id);
          continue;
        }
        penalty += 25;
      }
    });
    if (penalty) sb.add('fragile', 'Fragile Exhibits', -penalty);
  },
});
