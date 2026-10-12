// harvest: boons + challenge. Spec: docs/voyage/charms-design.md (theme `harvest`).
import { defineCharm } from '../registry.js';
import { rankOf } from '../../rules.js';
import { chainsOf, countHome, replay } from './kit.js';

defineCharm({
  id: 'harvest.cellar',
  kind: 'boon',
  theme: 'harvest',
  name: 'Root Cellar',
  icon: '🥔',
  text: 'At the start of each board, +1 undo for every 4 you hold (up to +2).',
  on: {
    start(ctx) {
      const grant = Math.min(2, Math.floor(ctx.run.undos / 4));
      if (grant) {
        ctx.memo.cellarGrant = grant;
        ctx.api.addUndos(grant);
      }
    },
  },
});

defineCharm({
  id: 'harvest.hayride',
  kind: 'boon',
  theme: 'harvest',
  name: 'Hayride',
  icon: '🚜',
  text: 'Your next 2 boards are dealt a full tier gentler.',
  dealShift: (ctx) => (ctx.runMemo.boardsLeft > 0 ? -1 : 0),
  onPick(_run, ctx) {
    ctx.runMemo.boardsLeft = 2;
  },
  on: {
    start(ctx) {
      if (ctx.runMemo.boardsLeft > 0) ctx.runMemo.boardsLeft--;
    },
  },
});

defineCharm({
  id: 'harvest.gleaning',
  kind: 'boon',
  theme: 'harvest',
  name: 'Gleaning',
  icon: '🌾',
  text: '+10 for every Ace and 2 sent home.',
  score(sb) {
    const n = countHome(sb.history, (id) => rankOf(id) <= 2);
    if (n) sb.add('gleaning', 'Gleaning', n * 10);
  },
});

defineCharm({
  id: 'harvest.challenge',
  kind: 'challenge',
  theme: 'harvest',
  name: 'Windfall Tax',
  icon: '🍏',
  tags: ['SCORE'],
  text: (s) => `Each card sent home on its own (not in a chain of 2+) costs ${2 + s} points.`,
  ease: (ctx) => -0.05 * ctx.strength,
  score(sb, ctx) {
    const solo = chainsOf(sb.history).filter((chain) => chain.length === 1).length;
    if (solo) sb.add('windfall', 'Windfall Tax', -solo * (2 + ctx.strength));
  },
});
