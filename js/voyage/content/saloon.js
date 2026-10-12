// saloon: boons + challenge. Spec: docs/voyage/charms-design.md (theme `saloon`).
import { defineCharm } from '../registry.js';
import { cardsOfRanks, countHome, rankMask, rankOf } from './kit.js';

const minJailRank = (s) => Math.max(1, 14 - 2 * s);

defineCharm({
  id: 'saloon.seven', kind: 'boon', theme: 'saloon', name: 'Lucky Seven', icon: '🎲',
  text: 'Sevens are wild: they ignore colour when stacking.',
  ease: 0.2,
  rules(r) {
    r.wildRanks = (r.wildRanks || 0) | rankMask(7);
  },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks([7]), 'wild'); },
});

defineCharm({
  id: 'saloon.wanted', kind: 'boon', theme: 'saloon', name: 'Wanted Poster', icon: '📜',
  text: 'Each board, one buried card is wanted; +120 when it goes home.',
  setup(board, ctx) {
    const buried = [];
    for (const col of board.state.tableau) for (let i = 0; i < col.length - 1; i++) buried.push(col[i]);
    if (!buried.length) return;
    ctx.memo.wanted ??= buried[ctx.rng.int(buried.length)];
    ctx.api.mark([ctx.memo.wanted], 'wanted');
  },
  score(sb, ctx) {
    if (ctx.memo.wanted && countHome(sb.history, (id) => id === ctx.memo.wanted)) sb.add('wanted', 'Wanted card caught', 120);
  },
});

defineCharm({
  id: 'saloon.tab', kind: 'boon', theme: 'saloon', name: 'Run a Tab', icon: '🍺',
  text: '+4 undos now; then −1 undo after each of your next 4 cleared boards.',
  onPick(run, ctx) {
    run.undos += 4;
    ctx.runMemo.debt = 4;
  },
  on: {
    win(ctx) {
      if (!ctx.runMemo.debt) return;
      ctx.api.spendUndos(1);
      ctx.runMemo.debt--;
    },
  },
});

defineCharm({
  id: 'saloon.challenge', kind: 'challenge', theme: 'saloon', name: 'Jailhouse', icon: '🔒',
  tags: ['CELLS'],
  text: (s) => `Cards ranked ${minJailRank(s)} and up in a free cell may only leave to their foundation.`,
  ease: (ctx) => -0.09 * ctx.strength,
  rules(r, ctx) {
    const minRank = minJailRank(ctx.strength);
    let mask = 0;
    for (let rank = minRank; rank <= 13; rank++) mask |= rankMask(rank);
    r.oneWayCellRanks = mask;
  },
  setup(_board, ctx) {
    const ranks = [];
    for (let rank = minJailRank(ctx.strength); rank <= 13; rank++) ranks.push(rank);
    ctx.api.mark(cardsOfRanks(ranks), 'oneway');
  },
});
