// museum: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `museum`).
// Complex: museum.digsite in ./special/museum.digsite.js
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
  family: 'coin',
  text: '+2 coins for each of the four 7-card columns you empty before 30 cards are home.',
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
    return `${n} fragile card${n === 1 ? '' : 's'}; −25 each time one moves again after its first move (except to its foundation), at most twice per card.`;
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
    // Capped at two charges per card: carried along inside runs, an uncapped tax could zero a board.
    const moved = new Set(), charges = new Map();
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
        if ((charges.get(id) || 0) >= 2) continue;
        charges.set(id, (charges.get(id) || 0) + 1);
        penalty += 25;
      }
    });
    if (penalty) sb.add('fragile', 'Fragile Exhibits', -penalty);
  },
});
