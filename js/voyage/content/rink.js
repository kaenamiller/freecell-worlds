// rink: boons + challenge. Spec: docs/voyage/overhaul/ROSTER-52.md (theme `rink`).
import { defineCharm, CHARMS } from '../registry.js';

const familyBreadth = (boons) => new Set((boons || []).map((id) => CHARMS[id]?.family).filter(Boolean)).size;

defineCharm({
  id: 'rink.lutz',
  kind: 'boon',
  theme: 'rink',
  name: 'Triple Lutz',
  icon: '⛸️',
  family: 'coin',
  text: 'Three 3★ boards in a row pay 25 coins (then the streak restarts).',
  upgrade: 'Two in a row pay 15.',
  on: {
    win(ctx, { result }) {
      const need = ctx.level === 2 ? 2 : 3;
      const pay = ctx.level === 2 ? 15 : 25;
      if (result.stars < 3) {
        ctx.runMemo.streak = 0;
        return;
      }
      ctx.runMemo.streak = (ctx.runMemo.streak || 0) + 1;
      if (ctx.runMemo.streak >= need) {
        ctx.api.addCoins(pay);
        ctx.runMemo.streak = 0;
      }
    },
  },
});

defineCharm({
  id: 'rink.couples',
  kind: 'boon',
  theme: 'rink',
  name: 'Couples Skate',
  icon: '💃',
  family: 'fortune',
  text: 'Hold boons from 4 different families: +1 free cell. From 6 families: +1 move capacity too.',
  upgrade: 'Thresholds 3 and 5.',
  rules(r, ctx) {
    const n = familyBreadth(ctx.boons);
    const low = ctx.level === 2 ? 3 : 4;
    const high = ctx.level === 2 ? 5 : 6;
    if (n >= low) r.freeCells += 1;
    if (n >= high) r.moveBonus = (r.moveBonus || 0) + 1;
  },
});

defineCharm({
  id: 'rink.request',
  kind: 'boon',
  theme: 'rink',
  name: 'Request',
  icon: '🎵',
  family: 'ability',
  text: 'Each time you use an ability, gain 1 undo (twice per board).',
  upgrade: 'Three times per board.',
  on: {
    ability(ctx) {
      const cap = ctx.level === 2 ? 3 : 2;
      const grants = ctx.memo.grants || 0;
      if (grants >= cap) return;
      ctx.memo.grants = grants + 1;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'rink.challenge',
  kind: 'challenge',
  theme: 'rink',
  name: 'Judged Routine',
  icon: '📋',
  tags: ['SCORE'],
  pressure: true,
  text: (s) => `Star thresholds are ${4 * s}% higher.`,
  thresholds(arr, ctx) {
    const bump = 1 + 0.04 * ctx.strength;
    return arr.map((n, i) => (i ? Math.round(n * bump) : n));
  },
});
