// saloon: boons + challenge. Spec: docs/voyage/charms-design.md (theme `saloon`).
// Complex: saloon.quickdraw in ./special/saloon.quickdraw.js
import { defineCharm } from '../registry.js';
import { cardsOfRanks, countHome, rankMask, rankOf, replay } from './kit.js';

const minJailRank = (s) => Math.max(1, 14 - 2 * s);

function isExposed(state, id) {
  if (state.free.includes(id)) return true;
  for (const col of state.tableau) if (col.length && col[col.length - 1] === id) return true;
  return false;
}

defineCharm({
  id: 'saloon.wanted',
  kind: 'boon',
  theme: 'saloon',
  name: 'Wanted Poster',
  icon: '📜',
  family: 'coin',
  text: 'Each board one buried card is wanted: bring it home within 8 moves of uncovering it for 15 coins.',
  upgrade: 'Bring it home within 8 moves of uncovering it for 25 coins.',
  setup(board, ctx) {
    const buried = [];
    for (const col of board.state.tableau) for (let i = 0; i < col.length - 1; i++) buried.push(col[i]);
    if (!buried.length) return;
    ctx.memo.wanted ??= buried[ctx.rng.int(buried.length)];
    ctx.api.mark([ctx.memo.wanted], 'wanted');
  },
  score(sb, ctx) {
    const wanted = ctx.memo.wanted;
    if (!wanted || !countHome(sb.history, (id) => id === wanted)) return;
    const pay = ctx.level >= 2 ? 25 : 15;
    let exposedAt = null;
    let homeAt = null;
    let move = 0;
    replay(sb, (m, state) => {
      move++;
      if (exposedAt == null && isExposed(state, wanted)) exposedAt = move;
      if (m.t === 'F' && m.card === wanted) homeAt = move;
    });
    if (exposedAt != null && homeAt != null && homeAt - exposedAt <= 8) {
      sb.addCoins('wanted', 'Wanted card caught', pay);
    }
  },
});

defineCharm({
  id: 'saloon.tab',
  kind: 'boon',
  theme: 'saloon',
  name: 'Run a Tab',
  icon: '🍺',
  family: 'undo',
  text: '+4 undos now; then −1 undo after each of your next 4 cleared boards.',
  upgrade: 'Upgrading cancels what is left of the tab.',
  onPick(run, ctx) {
    run.undos += 4;
    ctx.runMemo.debt = 4;
  },
  onUpgrade(_run, ctx) {
    ctx.runMemo.debt = 0;
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
  id: 'saloon.challenge',
  kind: 'challenge',
  theme: 'saloon',
  name: 'Jailhouse',
  icon: '🔒',
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
