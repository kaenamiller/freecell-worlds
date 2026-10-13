// C8 content: toybox, prizelights, safetypin, honeyhouse. Most of these themes were reworked in
// v2; their new charms are covered by v2-c5.mjs and v2-c6.mjs. What remains here is unchanged.
export async function check({ assert, CHARMS, baseRules, stream }) {
  const bits = (mask) => { const out = []; for (let r = 1; r <= 13; r++) if (mask & (1 << r)) out.push(r); return out; };
  const rulesOf = (id, strength, level = 1) => {
    const r = baseRules();
    const boons = [id];
    CHARMS[id].rules(r, { id, strength, level, boons, family: (name) => boons.filter((b) => CHARMS[b]?.family === name).length,
      rng: stream('c8', 'rules', strength, id), seed: 'c8', idx: strength - 1, runMemo: {} });
    return r;
  };

  const puzzle = bits(rulesOf('prizelights.puzzle', 1).wildRanks);
  assert.equal(puzzle.length, 1);
  assert.ok(puzzle[0] >= 3 && puzzle[0] <= 12, 'puzzle rank is 3 to Queen');
  assert.equal(bits(rulesOf('prizelights.puzzle', 1, 2).wildRanks).length, 2, 'two puzzle ranks at level 2');

  assert.deepEqual(bits(rulesOf('toybox.challenge', 1).barren.ranks), [6]);
  assert.deepEqual(bits(rulesOf('toybox.challenge', 7).barren.ranks), [4, 5, 6, 7, 8, 9, 10]);
}
