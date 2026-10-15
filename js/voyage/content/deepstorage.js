// deepstorage: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `deepstorage`).
// Complex: deepstorage.redaction in ./special/deepstorage.redaction.js
import { defineCharm } from '../registry.js';

defineCharm({
  id: 'deepstorage.clearance',
  kind: 'boon',
  theme: 'deepstorage',
  name: 'Clearance',
  icon: '🪪',
  family: 'vision',
  text: 'Face-down cards on your boards start face-up; on boards without any, +1 undo.',
  upgrade: 'Face-down cards start face-up; on boards without any, +1 undo — and +1 undo on every board.',
  ease: 0.15,
  setup(board, ctx) {
    const hidden = [...ctx.api.concealed];
    if (hidden.length) ctx.api.reveal(hidden);
    else ctx.memo.grantUndo = true;
  },
  on: {
    start(ctx) {
      if (ctx.level === 2) ctx.api.addUndos(1);
      if (!ctx.memo.grantUndo) return;
      delete ctx.memo.grantUndo;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'deepstorage.archive',
  kind: 'boon',
  theme: 'deepstorage',
  name: 'Archive',
  icon: '🗄️',
  family: 'sticker',
  text: 'At each port, the first sticker you buy is free.',
  upgrade: 'The first two.',
  price(item, cost, ctx) {
    if (item.kind !== 'sticker') return cost;
    const allowance = ctx.level === 2 ? 2 : 1;
    const bought = ctx.port?.stickers?.filter((o) => o.sold).length || 0;
    return bought < allowance ? 0 : cost;
  },
});

defineCharm({
  id: 'deepstorage.challenge',
  kind: 'challenge',
  theme: 'deepstorage',
  name: 'Redacted',
  icon: '⬛',
  pressure: true,
  tags: ['VIS'],
  text: (s) => {
    const n = 1 + Math.floor(s / 2);
    return n === 1
      ? '1 column starts face-down except for its top card; cards turn up as you uncover them.'
      : `${n} columns start face-down except for their top card; cards turn up as you uncover them.`;
  },
  ease: (ctx) => -0.05 * ctx.strength,
  setup(board, ctx) {
    const need = 1 + Math.floor(ctx.strength / 2);
    const cols = board.state.tableau.map((col, i) => i).filter((i) => board.state.tableau[i].length > 1);
    const picked = ctx.rng.shuffle(cols).slice(0, need);
    const hidden = picked.flatMap((i) => board.state.tableau[i].slice(0, -1));
    ctx.memo.cols = picked;
    if (hidden.length) ctx.api.conceal(hidden);
  },
});
