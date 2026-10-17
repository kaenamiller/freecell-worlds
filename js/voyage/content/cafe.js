// cafe: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `cafe`).
import { defineCharm } from '../registry.js';
import { replay, rankOf } from './kit.js';

defineCharm({
  id: 'cafe.espresso',
  kind: 'boon',
  theme: 'cafe',
  name: 'Espresso Shot',
  icon: '🫘',
  family: 'undo',
  text: "Your first undo each board doesn't spend an undo.",
  upgrade: 'Your first two.',
  on: {
    undo(ctx, ev) {
      if (ev.free || ev.reset) return;
      const limit = ctx.level === 2 ? 2 : 1;
      ctx.memo.refunds = (ctx.memo.refunds || 0) + 1;
      if (ctx.memo.refunds <= limit) ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'cafe.regulars',
  kind: 'boon',
  theme: 'cafe',
  name: 'Regulars',
  icon: '🪑',
  family: 'coin',
  text: 'Each board pays +2 coins for every 2★-or-better board in a row just before it (up to +10).',
  upgrade: '+3 (up to +15).',
  score(sb, ctx) {
    let streak = 0;
    for (let i = ctx.run.boardIdx - 1; i >= 0; i--) {
      if ((ctx.run.results[i]?.stars || 0) >= 2) streak++;
      else break;
    }
    const per = ctx.level === 2 ? 3 : 2;
    const cap = ctx.level === 2 ? 15 : 10;
    const coins = Math.min(cap, streak * per);
    if (coins) sb.addCoins('regulars', 'Regulars', coins);
  },
});

defineCharm({
  id: 'cafe.pastry',
  kind: 'boon',
  theme: 'cafe',
  name: 'Pastry Case',
  icon: '🥐',
  family: 'coin',
  text: '+1 coin for each Ace, 2 and 3 sent home within your first 30 moves.',
  upgrade: '+2.',
  score(sb, ctx) {
    const per = ctx.level === 2 ? 2 : 1;
    let moves = 0;
    let coins = 0;
    replay(sb, (move) => {
      if (!move.auto) moves++;
      if (move.t === 'F' && moves <= 30 && rankOf(move.card) <= 3) { coins += per; sb.cardBonus?.('pastry', move.card, per); }
    });
    if (coins) sb.addCoins('pastry', 'Pastry Case', coins);
  },
});

defineCharm({
  id: 'cafe.challenge',
  kind: 'challenge',
  theme: 'cafe',
  name: 'Last Orders',
  icon: '🔔',
  pressure: true,
  tags: ['SCORE'],
  text: (s) => `Finish within ${19 - s} minutes or this board is capped at 2★.`,
  starCap(ctx) {
    const limitSec = (19 - ctx.strength) * 60;
    return ctx.elapsed > limitSec ? 2 : 3;
  },
});
