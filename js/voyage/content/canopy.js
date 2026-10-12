// canopy: boons + challenge. Spec: docs/voyage/charms-design.md (theme `canopy`).
// Complex charms for this theme (if any) live in ./special/canopy.*.js.
import { defineCharm } from '../registry.js';
import { SCORE } from '../config.js';
import { countHome, rankOf, replay } from './kit.js';

function dealCardIds(state) {
  const ids = [];
  for (const col of state.tableau) ids.push(...col);
  for (const card of state.free) if (card) ids.push(card);
  return ids;
}

defineCharm({
  id: 'canopy.cameratrap',
  kind: 'boon',
  theme: 'canopy',
  name: 'Camera Trap',
  icon: '📷',
  text: '3 rare cards are marked each board: +60 each sent home, +1 undo when all 3 are home.',
  setup(board, ctx) {
    const pool = dealCardIds(board.state);
    ctx.memo.camera = ctx.rng.shuffle(pool).slice(0, 3);
    ctx.api.mark(ctx.memo.camera, 'camera');
  },
  score(sb, ctx) {
    const ids = ctx.memo.camera || [];
    const n = countHome(sb.history, (id) => ids.includes(id));
    if (n) sb.add('camera', 'Camera trap', n * 60);
  },
  on: {
    foundation(ctx, ev) {
      const ids = ctx.memo.camera;
      if (!ids?.includes(ev.card)) return;
      ctx.memo.home ??= {};
      ctx.memo.home[ev.card] = true;
      if (ctx.memo.bonus || ids.some((id) => !ctx.memo.home[id])) return;
      ctx.memo.bonus = true;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'canopy.mistnet',
  kind: 'boon',
  theme: 'canopy',
  name: 'Mist Net',
  icon: '🕸️',
  text: 'Aces, 2s and 3s cost no points in free cells.',
  ease: 0.15,
  score(sb) {
    let exempt = 0;
    replay(sb, (move) => {
      if (move.t === 'C' && rankOf(move.card) <= 3) exempt += 1;
      if (move.t === 'R' && move.to?.kind === 'free' && rankOf(move.card) <= 3) exempt += 1;
    });
    if (exempt) sb.add('mistnet', 'Mist Net', exempt * SCORE.freeCellCost);
  },
});

defineCharm({
  id: 'canopy.challenge',
  kind: 'challenge',
  theme: 'canopy',
  name: 'Leeches',
  icon: '🪱',
  tags: ['SCORE'],
  text: (s) => `Each undo also costs ${15 * s} points.`,
  ease: (ctx) => -0.07 * ctx.strength,
  score(sb, ctx) {
    const cost = sb.undosUsed * 15 * ctx.strength;
    if (cost) sb.add('leeches', 'Leeches', -cost);
  },
});
