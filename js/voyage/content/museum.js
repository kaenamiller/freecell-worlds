// museum: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `museum`).
// Complex: museum.digsite in ./special/museum.digsite.js
import { defineCharm } from '../registry.js';
import { replay } from './kit.js';

function cardsInMove(move) {
  if (move.t === 'T' && move.cards?.length) return move.cards;
  if (move.card) return [move.card];
  return [];
}

// Derive wear from history so undo, reset and resumed games show the same status.
function fragileMoves(history, id) {
  return history.filter((m) => !m.auto && m.t !== 'F' && cardsInMove(m).includes(id)).length;
}

function syncFragile(ctx) {
  for (const id of ctx.memo.fragile || []) {
    const style = fragileMoves(ctx.api.history || [], id) ? 'fragile-used' : 'fragile';
    if (ctx.memo._runtime?.marks?.[id] !== style) ctx.api.mark([id], style);
  }
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
  family: 'coin',
  text: '+2 coins for each of the four starting 7-card columns you empty before 30 cards are home.',
  upgrade: '+4.',
  score(sb, ctx) {
    if (!sb.initial) return;
    const per = ctx.level === 2 ? 4 : 2;
    const sevenCols = new Set(sb.initial.tableau.map((col, i) => (col.length === 7 ? i : -1)).filter((i) => i >= 0));
    const cleared = new Set();
    let home = 0;
    replay(sb, (_move, state) => {
      home = state.found.reduce((n, rank) => n + rank, 0);
      state.tableau.forEach((col, i) => {
        if (col.length === 0 && sevenCols.has(i) && !cleared.has(i) && home < 30) cleared.add(i);
      });
    });
    const coins = Math.min(4, cleared.size) * per;
    if (coins) sb.addCoins('fossil', 'Fossil Record', coins);
  },
});

defineCharm({
  id: 'museum.docent',
  kind: 'boon',
  theme: 'museum',
  name: 'Docent',
  icon: '🎟️',
  family: 'ability',
  text: 'Your ability boons get +1 use per board for every 2 ability boons you hold (this one included).',
  upgrade: 'For every ability boon.',
  abilityBonus(ctx) {
    const n = ctx.family('ability');
    return ctx.level === 2 ? n : Math.floor(n / 2);
  },
});

defineCharm({
  id: 'museum.challenge',
  kind: 'challenge',
  theme: 'museum',
  name: 'Fragile Exhibits',
  icon: '🏺',
  pressure: true,
  tags: ['SCORE'],
  text: (s) => {
    const n = 1 + s;
    return `${n} cards are fragile: the first move is free, but each later move costs 25 points (up to twice per card). Sending one home is always free.`;
  },
  setup(board, ctx) {
    const need = 1 + ctx.strength;
    const pool = ctx.rng.shuffle(allDealtCards(board.state));
    const fragile = pool.slice(0, Math.min(need, pool.length));
    ctx.memo.fragile ??= fragile;
    syncFragile(ctx);
  },
  on: {
    resume(ctx) { syncFragile(ctx); },
    move(ctx) { syncFragile(ctx); },
    undo(ctx) { syncFragile(ctx); },
  },
  markText(id, _style, ctx) {
    const moves = fragileMoves(ctx.api.history || [], id);
    if (!moves) return 'Intact exhibit: its first move is free. Later moves cost 25 points, up to twice. Sending it home is always free.';
    const left = Math.max(0, 3 - moves);
    return left ? `Cracked exhibit: free move used. Each further move costs 25 points (${left} charge${left === 1 ? '' : 's'} left). Sending it home is always free.`
      : 'Cracked exhibit: both 25-point charges used. Further moves are free.';
  },
  score(sb, ctx) {
    const fragile = new Set(ctx.memo.fragile || []);
    if (!fragile.size) return;
    // Capped at two charges per card: carried along inside runs, an uncapped tax could zero a board.
    const moved = new Set(), charges = new Map();
    let penalty = 0;
    replay(sb, (move, _state, _index, rules) => {
      if (move.auto) return;
      for (const id of cardsInMove(move)) {
        if (!fragile.has(id) || rules.cleansedCards?.includes(id)) continue;
        if (move.t === 'F' && move.card === id) continue;
        if (!moved.has(id)) {
          moved.add(id);
          continue;
        }
        if ((charges.get(id) || 0) >= 2) continue;
        charges.set(id, (charges.get(id) || 0) + 1);
        penalty += 25;
        sb.cardPenalty('fragile', id, 25);
      }
    });
    if (penalty) sb.add('fragile', 'Fragile Exhibits', -penalty);
  },
});
