// riverboat: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `riverboat`).
import { defineCharm } from '../registry.js';
import { replay } from './kit.js';

defineCharm({
  id: 'riverboat.sleeve',
  kind: 'boon',
  theme: 'riverboat',
  name: 'Ace in the Sleeve',
  icon: '🂡',
  family: 'foundation',
  text: 'Aces start on the foundations.',
  upgrade: 'Aces and Twos start home.',
  ease: 0.35,
  rules(r, ctx) {
    r.startHome = Math.max(r.startHome || 0, ctx.level === 2 ? 2 : 1);
  },
});

defineCharm({
  id: 'riverboat.longshot',
  kind: 'boon',
  theme: 'riverboat',
  name: 'Long Shot',
  icon: '🎲',
  family: 'fortune',
  text: 'Before your first move each board, you may stake up to 2 undos: finish with 3★ to get them back plus 12 coins each; otherwise they\'re gone.',
  upgrade: 'Stake up to 3, 18 coins each.',
  undoCapExempt: true,
  ability: {
    uses: 1,
    when: 'start',
    label: 'Stake undos on 3★',
    available: (ctx) => (ctx.run.undos || 0) > 0 && !ctx.memo.stake,
    async use(ctx) {
      const max = ctx.level === 2 ? 3 : 2;
      const stake = Math.min(ctx.run.undos, max);
      if (!stake) return false;
      const spent = ctx.api.spendUndos(stake);
      if (!spent) return false;
      ctx.memo.stake = spent;
      ctx.api.notify(`Long Shot: staked ${spent} undo${spent === 1 ? '' : 's'} on a 3★ finish.`);
      return true;
    },
  },
  on: {
    win(ctx, { result }) {
      const stake = ctx.memo.stake || 0;
      if (!stake) return;
      const each = ctx.level === 2 ? 18 : 12;
      if (result.stars >= 3) {
        ctx.api.addUndos(stake);
        ctx.api.addCoins(stake * each);
        ctx.api.notify(`Long Shot pays ${stake * each} coins and returns your stake.`);
      }
      ctx.memo.stake = 0;
    },
  },
});

defineCharm({
  id: 'riverboat.markeddeck',
  kind: 'boon',
  theme: 'riverboat',
  name: 'Marked Deck',
  icon: '🃏',
  family: 'sticker',
  text: 'At each port, put a free Wild sticker on a card of your choice.',
  upgrade: '…or a free Fool sticker.',
  portServices(ctx) {
    const type = ctx.level === 2 ? 'fool' : 'wild';
    const name = type === 'fool' ? 'Fool' : 'Wild';
    return [{
      id: 'riverboat.markeddeck',
      label: 'Marked card',
      text: `Place a free ${name} sticker on a card of your choice (once per visit).`,
      price: 0,
      needsCard: true,
      apply(run, card) {
        const memo = (run.charmMemo['riverboat.markeddeck'] ??= {});
        const key = `port-${run.port?.boardIdx}`;
        if (memo[key]) return false;
        memo[key] = true;
        run.stickers[card] = type;
        return true;
      },
    }];
  },
});

defineCharm({
  id: 'riverboat.challenge',
  kind: 'challenge',
  theme: 'riverboat',
  name: 'Ante',
  icon: '🪙',
  tags: ['SCORE'],
  pressure: true,
  text: (s) => `Pay ${2 + s} coins when the board starts. Win back 3 coins each time you send 5+ cards home in a row before 40 are home (up to twice).`,
  ease: (ctx) => -0.04 * ctx.strength,
  on: {
    start(ctx) {
      ctx.memo.ante = 2 + ctx.strength;
    },
  },
  score(sb, ctx) {
    const ante = ctx.memo.ante || 0;
    if (ante) sb.addCoins('ante', 'Ante', -ante);
    let home = 0;
    let run = 0;
    let rebates = 0;
    replay(sb, (move) => {
      if (move.t === 'F') {
        run++;
        home++;
        return;
      }
      if (run >= 5 && home - run < 40) rebates = Math.min(2, rebates + 1);
      run = 0;
    });
    if (run >= 5 && home - run < 40) rebates = Math.min(2, rebates + 1);
    if (rebates) sb.addCoins('ante-rebate', 'Ante rebate', rebates * 3);
  },
});
