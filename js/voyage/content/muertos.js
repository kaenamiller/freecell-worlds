// muertos: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `muertos`).
import { defineCharm } from '../registry.js';
import { ALL_RANKS, cardsOfRanks, suitMask } from './kit.js';

defineCharm({
  id: 'muertos.marigold',
  kind: 'boon',
  theme: 'muertos',
  name: 'Marigold Path',
  icon: '🌼',
  family: 'suit',
  text: 'Hearts may also be built down in suit.',
  upgrade: 'Hearts and Diamonds.',
  ease: 0.2,
  rules(r, ctx) {
    const suits = ctx.level >= 2 ? [1, 2] : [2];
    r.suitBuild = (r.suitBuild || 0) | suitMask(...suits);
  },
  setup(_board, ctx) {
    const suits = ctx.level >= 2 ? [1, 2] : [2];
    ctx.api.mark(cardsOfRanks(ALL_RANKS, suits), 'wild');
  },
});

defineCharm({
  id: 'muertos.ofrenda',
  kind: 'boon',
  theme: 'muertos',
  name: 'Ofrenda',
  icon: '🕯️',
  family: 'undo',
  text: 'At each port, gain 2 coins for every undo you hold (up to 16).',
  upgrade: '3 coins per undo (up to 24).',
  onPort(run, ctx) {
    const per = ctx.level >= 2 ? 3 : 2;
    const cap = ctx.level >= 2 ? 24 : 16;
    const gain = Math.min(cap, run.undos * per);
    if (gain) ctx.api.addCoins(gain);
  },
});

defineCharm({
  id: 'muertos.skull',
  kind: 'boon',
  theme: 'muertos',
  name: 'Sugar Skull',
  icon: '💀',
  family: 'undo',
  text: 'Once per run, when you\'d be stuck with no undos, gain 2 undos instead.',
  upgrade: 'Twice per run.',
  on: {
    stuck(ctx) {
      const limit = ctx.level >= 2 ? 2 : 1;
      const used = ctx.runMemo.skullRescues || 0;
      if (used >= limit || ctx.run.undos > 0) return false;
      ctx.runMemo.skullRescues = used + 1;
      ctx.api.addUndos(2);
      ctx.api.notify('Sugar Skull: +2 undos');
      return true;
    },
  },
});

defineCharm({
  id: 'muertos.challenge',
  kind: 'challenge',
  theme: 'muertos',
  name: 'Veil of Marigolds',
  icon: '🎭',
  tags: ['VIS'],
  pressure: true,
  text: (s) => `${2 * s + 1} buried cards start face-down until uncovered.`,
  ease: (ctx) => -0.05 * ctx.strength,
  setup(board, ctx) {
    const buried = board.state.tableau.flatMap((col) => col.slice(0, -1));
    const n = Math.min(2 * ctx.strength + 1, buried.length);
    const picked = ctx.rng.shuffle(buried).slice(0, n);
    if (picked.length) ctx.api.conceal(picked);
  },
});
