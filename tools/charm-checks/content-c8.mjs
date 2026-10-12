// C8 content: toybox, prizelights, safetypin, honeyhouse
export async function check({ assert, CHARMS, baseRules, stream, kit, BoardEffects, fakeBoard, stubAPI }) {
  const bits = (mask) => { const out = []; for (let r = 1; r <= 13; r++) if (mask & (1 << r)) out.push(r); return out; };
  const rulesOf = (id, strength) => {
    const r = baseRules();
    CHARMS[id].rules(r, { strength, rng: stream('c8', 'rules', strength, id), seed: 'c8', idx: strength - 1, runMemo: {} });
    return r;
  };

  assert.equal(rulesOf('toybox.foursquare', 1).wildRanks, kit.rankMask(4));
  assert.equal(rulesOf('safetypin.threechords', 1).wildRanks, kit.rankMask(3));
  const puzzle = bits(rulesOf('prizelights.puzzle', 1).wildRanks);
  assert.equal(puzzle.length, 1);
  assert.ok(puzzle[0] >= 3 && puzzle[0] <= 10, 'puzzle rank is 3–10');

  assert.deepEqual(bits(rulesOf('toybox.challenge', 1).barren.ranks), [6]);
  assert.deepEqual(bits(rulesOf('toybox.challenge', 7).barren.ranks), [4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(bits(rulesOf('honeyhouse.challenge', 1).barren.ranks), [12]);
  assert.deepEqual(bits(rulesOf('honeyhouse.challenge', 3).barren.ranks), [11, 12]);
  assert.deepEqual(bits(rulesOf('honeyhouse.challenge', 5).barren.ranks), [9, 10, 11, 12]);
  assert.deepEqual(bits(rulesOf('honeyhouse.challenge', 7).barren.ranks), [7, 8, 9, 10, 11, 12]);
  assert.equal(CHARMS['honeyhouse.challenge'].text(1), "Nothing can be placed on one suit's Queens.");
  assert.equal(CHARMS['honeyhouse.challenge'].text(3), "Nothing can be placed on one suit's Jacks through Queens.");
  assert.equal(CHARMS['honeyhouse.challenge'].text(7), "Nothing can be placed on one suit's 7s through Queens.");

  const lock1 = bits(rulesOf('prizelights.challenge', 1).noCellRanks);
  const lock7 = bits(rulesOf('prizelights.challenge', 7).noCellRanks);
  assert.equal(lock1.length, 1);
  assert.equal(lock7.length, 3);
  assert.ok(!lock1.includes(1) && !lock7.includes(1), 'lockout never bans aces');
  assert.equal(lock7[2] - lock7[0], 2, 'lockout ranks are consecutive');

  assert.deepEqual(bits(rulesOf('safetypin.challenge', 1).oneWayCellRanks), [2]);
  assert.deepEqual(bits(rulesOf('safetypin.challenge', 7).oneWayCellRanks), [2, 3, 4, 5]);

  const capped = (strength) => {
    const fixture = fakeBoard();
    const api = stubAPI(fixture.game);
    const effects = new BoardEffects([{ id: 'honeyhouse.challenge', kind: 'challenge', strength }], {
      seed: 'c8', boardIndex: 2, api, memo: {}, run: { undos: 1, results: [], boons: [], charmMemo: {} },
    });
    effects.setup(fixture.board);
    return Object.entries(api.marks).map(([id, style]) => ({
      style, rank: kit.rankOf(Number(id)), suit: kit.suitOf(Number(id)),
    }));
  };
  const low = capped(1);
  assert.equal(low.length, 1, 'capped comb marks the queen');
  assert.equal(low[0].style, 'cap');
  assert.equal(low[0].rank, 12);
  assert.equal(low[0].suit, stream('c8', 'rules', 2, 'honeyhouse.challenge').int(4));
  const high = capped(7);
  assert.deepEqual(high.map((c) => c.rank).sort((a, b) => a - b), [7, 8, 9, 10, 11, 12]);
  assert.ok(high.every((c) => c.style === 'cap' && c.suit === low[0].suit), 'the seal stays on one suit');
}
