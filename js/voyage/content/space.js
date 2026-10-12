// space: boons + challenge. Spec: docs/voyage/charms-design.md (theme `space`).
// Complex: space.tractor in ./special/space.tractor.js
import { defineCharm } from '../registry.js';
import { cardsOfRanks } from './kit.js';

defineCharm({
  id: 'space.holoscan', kind: 'boon', theme: 'space', name: 'Holo-Scan', icon: '🔭',
  text: 'Twice per board, show the best next move.',
  ability: { uses: 2, label: 'Scan next move', use: (ctx) => ctx.api.hint() },
});

defineCharm({
  id: 'space.mission', kind: 'boon', theme: 'space', name: 'Mission Control', icon: '🛰️',
  text: '+2 undos now, and every ability charm gets one extra use per board.',
  abilityBonus: 1,
  onPick(run) { run.undos += 2; },
});

// Red high cards are magnetised: nothing can be placed onto them.
const stormRanks = (s) => (s >= 6 ? [11, 12, 13] : s >= 4 ? [12, 13] : [13]);
const RED_SUITS = (1 << 1) | (1 << 2);

defineCharm({
  id: 'space.challenge', kind: 'challenge', theme: 'space', name: 'Magnetic Storm', icon: '🧲',
  tags: ['STACK'],
  text: (s) => `Nothing can be placed onto red ${['Kings', 'Queens', 'Jacks'].slice(0, stormRanks(s).length).join(', ').replace(/, ([^,]*)$/, ' or $1')}.`,
  ease: (ctx) => (ctx.strength >= 6 ? -1 : ctx.strength >= 4 ? -0.8 : -0.5),
  rules(r, ctx) {
    const ranks = stormRanks(ctx.strength).reduce((m, k) => m | (1 << k), 0);
    r.barren = r.barren ? { suits: r.barren.suits | RED_SUITS, ranks: r.barren.ranks | ranks } : { suits: RED_SUITS, ranks };
  },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks(stormRanks(ctx.strength), [1, 2]), 'bar'); },
});
