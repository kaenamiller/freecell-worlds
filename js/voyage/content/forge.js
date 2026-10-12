// forge: boons + challenge. Spec: docs/voyage/charms-design.md (theme `forge`).
import { defineCharm } from '../registry.js';
import { ALL_RANKS, cardsOfRanks, countHome, rankOf, replay, suitMask } from './kit.js';

function moveCards(m) {
  if (m.t === 'F' || m.t === 'C' || m.t === 'R') return [m.card];
  if (m.t === 'T') return m.cards || [m.card];
  return [];
}

defineCharm({
  id: 'forge.anvil', kind: 'boon', theme: 'forge', name: 'Anvil', icon: '⚒️',
  text: 'Spades may also be built down in suit.',
  ease: 0.15,
  rules(r) {
    r.suitBuild = (r.suitBuild || 0) | suitMask(3);
  },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks(ALL_RANKS, [3]), 'wild'); },
});

defineCharm({
  id: 'forge.temper', kind: 'boon', theme: 'forge', name: 'Temper', icon: '🔥',
  text: 'Free-cell points ×2.',
  score(sb) {
    sb.scale('freecells', 2);
  },
});

defineCharm({
  id: 'forge.ingot', kind: 'boon', theme: 'forge', name: 'Ingot', icon: '🧱',
  text: '+25 per King sent home, and +1 undo when the 4th King goes home.',
  score(sb) {
    const kings = countHome(sb.history, (id) => rankOf(id) === 13);
    if (kings) sb.add('ingot', 'Kings forged', kings * 25);
  },
  on: {
    foundation(ctx, { card }) {
      if (rankOf(card) !== 13) return;
      ctx.memo.kings = (ctx.memo.kings || 0) + 1;
      if (ctx.memo.kings === 4 && !ctx.memo.ingotUndo) {
        ctx.memo.ingotUndo = true;
        ctx.api.addUndos(1);
      }
    },
  },
});

defineCharm({
  id: 'forge.challenge', kind: 'challenge', theme: 'forge', name: 'Hot Iron', icon: '🌡️',
  tags: ['SCORE'],
  text: (s) => `${1 + s} hot cards; once moved, each must reach its foundation within 10 moves or cost 40 points.`,
  setup(board, ctx) {
    const pool = board.state.tableau.flat();
    const n = 1 + ctx.strength;
    const hot = ctx.memo.hot ?? [];
    while (hot.length < n && pool.length) {
      const id = pool[ctx.rng.int(pool.length)];
      if (!hot.includes(id)) hot.push(id);
    }
    ctx.memo.hot = hot;
    ctx.api.mark(hot, 'hot');
  },
  score(sb, ctx) {
    const hot = new Set(ctx.memo.hot || []);
    if (!hot.size) return;
    const dueBy = new Map();
    const homed = new Set();
    const penalized = new Set();
    let n = 0;
    replay(sb, (m) => {
      n++;
      if (m.t === 'F') {
        homed.add(m.card);
        dueBy.delete(m.card);
        return;
      }
      for (const id of moveCards(m)) {
        if (!hot.has(id) || dueBy.has(id) || homed.has(id)) continue;
        dueBy.set(id, n + 10);
      }
      for (const [id, due] of dueBy) {
        if (!homed.has(id) && n > due) penalized.add(id);
      }
    });
    if (penalized.size) sb.add('hotiron', 'Iron cooled too slow', -40 * penalized.size);
  },
});
