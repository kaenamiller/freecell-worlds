// azulejo: boons + challenge. Spec: docs/voyage/charms-design.md (theme `azulejo`).
import { defineCharm } from '../registry.js';
import { replay, foundationSequence, rankOf } from './kit.js';

defineCharm({
  id: 'azulejo.tessellate', kind: 'boon', theme: 'azulejo', name: 'Tessellation', icon: '🔷',
  text: '+10 for each card sent home with the same rank as the card sent home before it.',
  score(sb) {
    const seq = foundationSequence(sb.history);
    let pts = 0;
    for (let i = 1; i < seq.length; i++) if (rankOf(seq[i]) === rankOf(seq[i - 1])) pts += 10;
    if (pts) sb.add('tessellate', 'Tessellation', pts);
  },
});

defineCharm({
  id: 'azulejo.fountain', kind: 'boon', theme: 'azulejo', name: 'Courtyard Fountain', icon: '⛲',
  text: '+10 for each card moved from a free cell back onto a column.',
  score(sb) {
    let n = 0;
    replay(sb, (move) => { if (move.t === 'T' && move.src?.kind === 'free') n++; });
    if (n) sb.add('fountain', 'Courtyard returns', n * 10);
  },
});

defineCharm({
  id: 'azulejo.kiln', kind: 'boon', theme: 'azulejo', name: 'Kiln', icon: '🔥',
  text: '+1 undo for every 13 cards sent home (up to 3 per board).',
  on: {
    foundation(ctx) {
      ctx.memo.home = (ctx.memo.home || 0) + 1;
      const want = Math.min(3, Math.floor(ctx.memo.home / 13));
      const had = ctx.memo.grants || 0;
      if (want > had) {
        ctx.api.addUndos(want - had);
        ctx.memo.grants = want;
      }
    },
  },
});

defineCharm({
  id: 'azulejo.challenge', kind: 'challenge', theme: 'azulejo', name: 'Cracked Tiles', icon: '🧱',
  tags: ['SCORE'],
  text: (s) => `${1 + s} cracked cards; −30 each time one enters a free cell.`,
  ease: (ctx) => -0.04 * ctx.strength,
  setup(board, ctx) {
    const n = 1 + ctx.strength;
    const pool = board.state.tableau.flat();
    ctx.memo.cracked = ctx.rng.shuffle(pool).slice(0, Math.min(n, pool.length));
    if (ctx.memo.cracked.length) ctx.api.mark(ctx.memo.cracked, 'crack');
  },
  score(sb, ctx) {
    const cracked = new Set(ctx.memo.cracked || []);
    if (!cracked.size) return;
    let penalty = 0;
    replay(sb, (move) => { if (move.t === 'C' && cracked.has(move.card)) penalty += 30; });
    if (penalty) sb.add('cracked', 'Cracked tiles', -penalty);
  },
});
