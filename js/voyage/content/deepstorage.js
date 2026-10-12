// deepstorage: boons + challenge. Spec: docs/voyage/charms-design.md (theme `deepstorage`).
import { defineCharm } from '../registry.js';

defineCharm({
  id: 'deepstorage.clearance',
  kind: 'boon',
  theme: 'deepstorage',
  name: 'Clearance',
  icon: '🪪',
  text: 'Face-down cards on your boards start face-up; on boards without any, +1 undo.',
  ease: 0.15,
  setup(board, ctx) {
    const hidden = [...ctx.api.concealed];
    if (hidden.length) ctx.api.reveal(hidden);
    else ctx.memo.grantUndo = true;
  },
  on: {
    start(ctx) {
      if (!ctx.memo.grantUndo) return;
      delete ctx.memo.grantUndo;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'deepstorage.redundancy',
  kind: 'boon',
  theme: 'deepstorage',
  name: 'Redundancy',
  icon: '💽',
  text: 'Every 3rd undo you spend is refunded.',
  on: {
    undo(ctx) {
      ctx.runMemo.spent = (ctx.runMemo.spent || 0) + 1;
      if (ctx.runMemo.spent % 3 === 0) ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'deepstorage.archive',
  kind: 'boon',
  theme: 'deepstorage',
  name: 'Archive',
  icon: '🗄️',
  text: 'One extra free cell.',
  rules(r) {
    r.freeCells += 1;
  },
});

defineCharm({
  id: 'deepstorage.challenge',
  kind: 'challenge',
  theme: 'deepstorage',
  name: 'Redacted',
  icon: '⬛',
  tags: ['VIS'],
  text: (s) => {
    const n = 1 + Math.floor(s / 2);
    return `${n} column${n === 1 ? '' : 's'} ${n === 1 ? 'is' : 'are'} face-down below its top card until uncovered.`;
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
