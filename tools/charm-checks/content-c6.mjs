// Focused checks for C6 themes: lapis, deepsea, diner, cove, bloodmoon.
export async function check(h) {
  const { assert, CHARMS, baseRules, stream, clampRules } = h;

  for (let s = 1; s <= 7; s++) {
    const rules = baseRules();
    CHARMS['lapis.challenge'].rules(rules, {
      strength: s,
      rng: stream('c6', 'rules', s, 'lapis.challenge'),
      seed: 'c6',
      idx: s - 1,
      runMemo: {},
    });
    const sealed = clampRules(rules).sealedCols;
    const want = s <= 3 ? 1 : 2;
    assert.equal(sealed.length, want, `lapis sealed count at s${s}`);
    for (let i = 1; i < sealed.length; i++) assert(Math.abs(sealed[i] - sealed[i - 1]) > 1, 'lapis sealed cols must not be adjacent');
  }

  // v2: Cherry Counter's challenge is Plate Stack (stacked free cells).
  for (let s = 1; s <= 7; s++) {
    const rules = baseRules();
    CHARMS['diner.challenge'].rules(rules, { id: 'diner.challenge', strength: s, rng: stream('c6', 'rules', s, 'diner.challenge'), seed: 'c6', idx: s - 1, runMemo: {} });
    assert.equal(clampRules(rules).cellStack, s <= 2 ? 2 : s <= 5 ? 3 : 4, `diner plate stack at s${s}`);
  }

  const keepRules = baseRules();
  CHARMS['bloodmoon.challenge'].rules(keepRules, { strength: 7, rng: stream('c6', 'rules', 7, 'bloodmoon'), seed: 'c6', idx: 6, runMemo: {} });
  assert.equal(clampRules(keepRules).freeCells, 3, 'bloodmoon uninvited s7 removes one cell');

  assert.equal(CHARMS['bloodmoon.crest'].offers(1, {}), 2);
}
