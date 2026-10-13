// signal: boons + challenge. Spec: docs/voyage/overhaul/ROSTER-52.md (theme `signal`).
// Complex: signal.pull in ./special/signal.pull.js
import { defineCharm } from '../registry.js';
import { cardsOfRanks } from './kit.js';

defineCharm({
  id: 'signal.lock',
  kind: 'boon',
  theme: 'signal',
  name: 'Lock',
  icon: '🔒',
  family: 'vision',
  text: 'Twice per board, the dish locks onto the best next move for you.',
  upgrade: 'Three times per board.',
  ability: {
    uses: (ctx) => (ctx.level >= 2 ? 3 : 2),
    label: 'Lock next move',
    use: (ctx) => ctx.api.hint(),
  },
});

defineCharm({
  id: 'signal.operator',
  kind: 'boon',
  theme: 'signal',
  name: 'Night Operator',
  icon: '🌙',
  family: 'ability',
  text: '+2 undos now, and every ability charm gets one extra use per board.',
  upgrade: '+2 ability uses instead of +1.',
  abilityBonus: (ctx) => (ctx.level >= 2 ? 2 : 1),
  onPick(run) { run.undos += 2; },
});

// Red high cards are magnetised: nothing can be placed onto them.
const stormRanks = (s) => (s >= 6 ? [11, 12, 13] : s >= 4 ? [12, 13] : [13]);
const RED_SUITS = (1 << 1) | (1 << 2);

defineCharm({
  id: 'signal.challenge',
  kind: 'challenge',
  theme: 'signal',
  name: 'Static',
  icon: '📡',
  tags: ['STACK'],
  text: (s) => `Nothing can be placed onto red ${['Kings', 'Queens', 'Jacks'].slice(0, stormRanks(s).length).join(', ').replace(/, ([^,]*)$/, ' or $1')}.`,
  ease: (ctx) => (ctx.strength >= 6 ? -1 : ctx.strength >= 4 ? -0.8 : -0.5),
  rules(r, ctx) {
    const ranks = stormRanks(ctx.strength).reduce((m, k) => m | (1 << k), 0);
    r.barren = r.barren ? { suits: r.barren.suits | RED_SUITS, ranks: r.barren.ranks | ranks } : { suits: RED_SUITS, ranks };
  },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks(stormRanks(ctx.strength), [1, 2]), 'bar'); },
});
