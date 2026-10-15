// mint: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `mint`).
import { defineCharm } from '../registry.js';
import { ALL_RANKS, cardsOfRanks, suitMask } from './kit.js';
import { stream } from '../rng.js';

const gateAfter = (s) => (s <= 2 ? 6 : s <= 4 ? 10 : s <= 6 ? 14 : 18);

defineCharm({
  id: 'mint.sterling',
  kind: 'boon',
  theme: 'mint',
  name: 'Sterling',
  icon: '🪙',
  family: 'suit',
  text: 'Diamonds may also be built up: a Diamond on a black card one rank lower.',
  upgrade: '…and Diamonds may also be built down in suit.',
  ease: 0.2,
  rules(r, ctx) {
    r.buildUp = (r.buildUp || 0) | suitMask(1);
    if (ctx.level === 2) r.suitBuild = (r.suitBuild || 0) | suitMask(1);
  },
  setup(_board, ctx) {
    ctx.api.mark(cardsOfRanks(ALL_RANKS, [1]), 'wild');
  },
});

defineCharm({
  id: 'mint.interest',
  kind: 'boon',
  theme: 'mint',
  name: 'Compound Interest',
  icon: '📈',
  family: 'coin',
  text: 'At each port, +1 coin for every 5 you hold (up to +10).',
  upgrade: 'Every 4 (up to +15).',
  onPort(_run, ctx) {
    const step = ctx.level === 2 ? 4 : 5;
    const cap = ctx.level === 2 ? 15 : 10;
    const bonus = Math.min(cap, Math.floor(ctx.coins / step));
    if (bonus) ctx.api.addCoins(bonus);
  },
});

defineCharm({
  id: 'mint.treasury',
  kind: 'boon',
  theme: 'mint',
  name: 'Treasury',
  icon: '🏦',
  family: 'undo',
  text: '+2 undos after every board you clear without using an undo.',
  upgrade: '+3.',
  on: {
    win(ctx, { result }) {
      if (!result.undosUsed) ctx.api.addUndos(ctx.level === 2 ? 3 : 2);
    },
  },
});

defineCharm({
  id: 'mint.challenge',
  kind: 'challenge',
  theme: 'mint',
  name: 'Withheld Issue',
  icon: '🪙',
  tags: ['FOUND'],
  text: (s) => {
    const need = gateAfter(s);
    return `One suit (shown on the badge) can't go home until ${need} cards of the other suits are home.`;
  },
  ease: (ctx) => -0.08 * ctx.strength,
  rules(r, ctx) {
    r.gate = { suit: stream(ctx.seed, 'rules', ctx.idx, ctx.id).int(4), after: gateAfter(ctx.strength) };
  },
  setup(_board, ctx) {
    const suit = stream(ctx.seed, 'rules', ctx.run.boardIdx, ctx.id).int(4);
    ctx.api.badge(['♣', '♦', '♥', '♠'][suit]);
  },
});
