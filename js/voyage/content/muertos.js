// muertos: boons + challenge. Spec: docs/voyage/charms-design.md (theme `muertos`).
import { defineCharm } from '../registry.js';
import { ALL_RANKS, cardsOfRanks, suitMask } from './kit.js';

defineCharm({
  id: 'muertos.marigold', kind: 'boon', theme: 'muertos', name: 'Marigold Path', icon: '🌼',
  text: 'Hearts may also be built down in suit.',
  ease: 0.2,
  rules(r) { r.suitBuild = (r.suitBuild || 0) | suitMask(2); },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks(ALL_RANKS, [2]), 'wild'); },
});

defineCharm({
  id: 'muertos.ofrenda', kind: 'boon', theme: 'muertos', name: 'Ofrenda', icon: '🕯️',
  text: '+20 for every undo you still hold when a board ends.',
  score(sb) { if (sb.undosLeft) sb.add('ofrenda', 'Ofrenda', sb.undosLeft * 20); },
});

defineCharm({
  id: 'muertos.skull', kind: 'boon', theme: 'muertos', name: 'Sugar Skull', icon: '💀',
  text: 'Once per run, when you\'d be stuck with no undos, gain 2 undos instead.',
  on: {
    stuck(ctx) {
      if (ctx.runMemo.rescued || ctx.run.undos > 0) return false;
      ctx.runMemo.rescued = true;
      ctx.api.addUndos(2);
      ctx.api.notify('Sugar Skull: +2 undos');
      return true;
    },
  },
});

defineCharm({
  id: 'muertos.challenge', kind: 'challenge', theme: 'muertos', name: 'Veil of Marigolds', icon: '🎭',
  tags: ['VIS'],
  text: (s) => `${2 * s + 1} buried cards start face-down until uncovered.`,
  ease: (ctx) => -0.05 * ctx.strength,
  setup(board, ctx) {
    const buried = board.state.tableau.flatMap((col) => col.slice(0, -1));
    const n = Math.min(2 * ctx.strength + 1, buried.length);
    const picked = ctx.rng.shuffle(buried).slice(0, n);
    if (picked.length) ctx.api.conceal(picked);
  },
});
