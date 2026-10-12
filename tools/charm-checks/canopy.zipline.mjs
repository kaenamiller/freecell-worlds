import { checkOverrideCharm } from './concrete.spraytag.mjs';
export async function check(h) {
  await checkOverrideCharm(h, 'canopy.zipline', { ignoreCap: true }, false, true, [12, 27, 42]);
  const game = new h.Rules.Game(12, { rules: { moveBonus: -4 } });
  // Capacity is the only relaxation: wrong rank/colour and invalid runs fail.
  h.assert.throws(() => game.applyCharmMove({ t: 'X', op: 'canopy.zipline', src: { kind: 'col', i: 0 }, count: 2, to: 1 }), /illegal drop/);
  h.assert.throws(() => game.applyCharmMove({ t: 'X', op: 'canopy.zipline', src: { kind: 'col', i: 0 }, count: 3, to: 4 }), /illegal drop/);
}
