// azulejo: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `azulejo`).
import { defineCharm } from '../registry.js';
import { foundationSequence, rankOf } from './kit.js';

function crackedCards(ctx) {
  ctx.memo ??= {};
  if (ctx.memo.cracked) return ctx.memo.cracked;
  const pool = Array.from({ length: 52 }, (_, i) => i + 1);
  return (ctx.memo.cracked = ctx.rng.shuffle(pool).slice(0, 1 + ctx.strength));
}

defineCharm({
  id: 'azulejo.tessellate',
  kind: 'boon',
  theme: 'azulejo',
  name: 'Tessellation',
  icon: '🔷',
  family: 'coin',
  text: '+2 coins each time you send home a card of the same rank as the card sent home just before it.',
  upgrade: '+4 coins.',
  score(sb, ctx) {
    const each = ctx.level === 2 ? 4 : 2;
    const seq = foundationSequence(sb.history);
    let n = 0;
    for (let i = 1; i < seq.length; i++) if (rankOf(seq[i]) === rankOf(seq[i - 1])) { n++; sb.cardBonus?.('tessellate', seq[i], each); }
    if (n) sb.addCoins('tessellate', 'Tessellation', n * each);
  },
});

defineCharm({
  id: 'azulejo.kiln',
  kind: 'boon',
  theme: 'azulejo',
  name: 'Kiln',
  icon: '🔥',
  family: 'undo',
  text: '+1 undo when 26 and when 39 cards are home.',
  upgrade: 'At 13, 26 and 39.',
  on: {
    foundation(ctx) {
      const home = (ctx.memo.home || 0) + 1;
      ctx.memo.home = home;
      const marks = ctx.level === 2 ? [13, 26, 39] : [26, 39];
      const hit = marks.filter((n) => home === n).length;
      const had = ctx.memo.grants || 0;
      if (hit > had) {
        ctx.api.addUndos(hit - had);
        ctx.memo.grants = hit;
      }
    },
  },
});

defineCharm({
  id: 'azulejo.challenge',
  kind: 'challenge',
  theme: 'azulejo',
  name: 'Cracked Tiles',
  icon: '🧱',
  tags: ['STACK'],
  text: (s) => `${1 + s} random cards are cracked: nothing can be placed onto them.`,
  ease: (ctx) => -0.04 * ctx.strength,
  rules(r, ctx) {
    r.barrenCards = [...(r.barrenCards || []), ...crackedCards(ctx)];
  },
  setup(board, ctx) {
    // Mark exactly the cards the rules cracked: the rules and setup hooks get different rng streams.
    const cracked = ctx.api.rules?.barrenCards || [];
    const onBoard = new Set(board.state.tableau.flat().concat(board.state.free.filter(Boolean)));
    const visible = cracked.filter((id) => onBoard.has(id));
    if (visible.length) ctx.api.mark(visible, 'crack');
  },
});
