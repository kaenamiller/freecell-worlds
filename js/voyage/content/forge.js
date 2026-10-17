// forge: boons + challenge. Spec: docs/voyage/charms-design.md (theme `forge`).
import { defineCharm } from '../registry.js';
import { ALL_RANKS, cardsOfRanks, rankOf, replay, suitMask, suitOf } from './kit.js';

function moveCards(m) {
  if (m.t === 'F' || m.t === 'C' || m.t === 'R') return [m.card];
  if (m.t === 'T') return m.cards || [m.card];
  return [];
}

defineCharm({
  id: 'forge.anvil',
  kind: 'boon',
  theme: 'forge',
  name: 'Anvil',
  icon: '⚒️',
  family: 'suit',
  text: 'Spades may also be built down in suit.',
  upgrade: 'Spades may also be built down or up in suit.',
  ease: 0.2,
  rules(r, ctx) {
    r.suitBuild = (r.suitBuild || 0) | suitMask(3);
    if (ctx.level >= 2) r.suitBuildUp = (r.suitBuildUp || 0) | suitMask(3);
  },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks(ALL_RANKS, [3]), 'wild'); },
});

defineCharm({
  id: 'forge.bellows',
  kind: 'boon',
  theme: 'forge',
  name: 'Bellows',
  icon: '🔥',
  family: 'cells',
  text: 'Frozen cells thaw 10 cards sooner, and closing cells close 10 cards later.',
  upgrade: 'Frozen cells thaw 20 cards sooner, and closing cells close 20 cards later.',
  ease: 0.15,
  rulesAfter(r, ctx) {
    const delta = ctx.level >= 2 ? 20 : 10;
    if (r.cellThaw?.at?.length) {
      r.cellThaw.at = r.cellThaw.at.map((n) => Math.max(0, n - delta));
    }
    if (r.cellClose?.at?.length) {
      r.cellClose.at = r.cellClose.at.map((n) => n + delta);
    }
  },
});

defineCharm({
  id: 'forge.ingot',
  kind: 'boon',
  theme: 'forge',
  name: 'Ingot',
  icon: '🧱',
  family: 'coin',
  text: '+2 coins for each King you send home while another foundation is still below 7.',
  upgrade: 'Each such King pays 3 coins.',
  score(sb, ctx) {
    const pay = ctx.level >= 2 ? 3 : 2;
    let kings = 0;
    replay(sb, (m, state) => {
      if (m.t !== 'F' || rankOf(m.card) !== 13) return;
      const suit = suitOf(m.card);
      for (let s = 0; s < 4; s++) {
        if (s !== suit && state.found[s] < 7) {
          kings++;
          sb.cardBonus?.('ingot', m.card, pay);
          break;
        }
      }
    });
    if (kings) sb.addCoins('ingot', 'Kings forged', kings * pay);
  },
});

defineCharm({
  id: 'forge.challenge',
  kind: 'challenge',
  theme: 'forge',
  name: 'Hot Iron',
  icon: '🌡️',
  tags: ['SCORE'],
  pressure: true,
  text: (s) => `${1 + s} cards are hot: once you move one, send it home within 10 moves or lose 40 points.`,
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
    replay(sb, (m, _state, _index, rules) => {
      for (const id of rules.cleansedCards || []) { hot.delete(id); dueBy.delete(id); }
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
    for (const id of penalized) sb.cardPenalty('hotiron', id, 40);
    if (penalized.size) sb.add('hotiron', 'Iron cooled too slow', -40 * penalized.size);
  },
});
