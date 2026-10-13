// sewing: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `sewing`).
import { defineCharm } from '../registry.js';
import { rankName, suitMask } from './kit.js';

const shortThreadMax = (s) => (s <= 2 ? 10 : s <= 4 ? 8 : s <= 6 ? 6 : 5);

defineCharm({
  id: 'sewing.thread',
  kind: 'boon',
  theme: 'sewing',
  name: 'Red Thread',
  icon: '🧵',
  family: 'suit',
  text: 'A run of a single suit moves as one piece, however long.',
  upgrade: 'A run of a single suit moves as one piece, and Hearts may also be built down in suit.',
  ease: 0.2,
  rules(r, ctx) {
    r.suitRunFree = 15;
    if (ctx.level === 2) r.suitBuild = (r.suitBuild || 0) | suitMask(2);
  },
});

defineCharm({
  id: 'sewing.pincushion',
  kind: 'boon',
  theme: 'sewing',
  name: 'Pincushion',
  icon: '📍',
  family: 'columns',
  text: 'Each board, one random column takes any card on top, whatever its rank or colour.',
  upgrade: 'Each board, two random columns take any card on top.',
  ease: 0.2,
  rules(r, ctx) {
    const n = ctx.level === 2 ? 2 : 1;
    const cols = ctx.rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, n);
    r.openCols = cols.reduce((mask, col) => mask | (1 << col), 0);
  },
  setup(board, ctx) {
    const mask = ctx.api.rules?.openCols || 0;
    for (let c = 0; c < 8; c++) {
      if (!(mask & (1 << c))) continue;
      const top = board.state.tableau[c].at(-1);
      if (top) ctx.api.mark([top], 'glow');
    }
  },
});

defineCharm({
  id: 'sewing.ribbon',
  kind: 'boon',
  theme: 'sewing',
  name: 'Ribbon',
  icon: '🎀',
  family: 'sticker',
  text: 'Ports offer a tailor: move one of your stickers to another card, free once per visit.',
  upgrade: 'Ports offer a tailor: every sticker move is free.',
  portServices(ctx) {
    const alwaysFree = ctx.level === 2;
    return [{
      id: 'sewing.ribbon.tailor',
      label: 'Tailor',
      text: alwaysFree
        ? 'Move one of your stickers to another card for free.'
        : 'Move one of your stickers to another card, free once per visit.',
      price: 0,
      needsCard: true,
      apply(run, dest) {
        const memo = (run.charmMemo['sewing.ribbon'] ??= {});
        const key = `port-${run.port?.boardIdx}`;
        if (!alwaysFree && memo[key]) return false;
        const src = Object.keys(run.stickers).find((c) => Number(c) !== dest);
        if (!src) return false;
        const type = run.stickers[src];
        delete run.stickers[src];
        run.stickers[dest] = type;
        if (!alwaysFree) memo[key] = true;
        return true;
      },
    }];
  },
});

defineCharm({
  id: 'sewing.challenge',
  kind: 'challenge',
  theme: 'sewing',
  name: 'Short Thread',
  icon: '🪡',
  tags: ['COLUMN'],
  text: (s) => {
    const rank = shortThreadMax(s);
    return rank === 5
      ? 'Empty columns only accept sequences headed by a Five or lower.'
      : `Empty columns only accept sequences headed by ${rankName(rank)} or lower.`;
  },
  ease: (ctx) => -0.08 * ctx.strength,
  rules(r, ctx) {
    r.emptyMaxRank = shortThreadMax(ctx.strength);
  },
});
