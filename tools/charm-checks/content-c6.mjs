// Focused checks for C6 themes: lapis, canopy, diner, cove, keep.
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

  for (let s = 1; s <= 7; s++) {
    const rules = baseRules();
    CHARMS['diner.challenge'].rules(rules, {
      strength: s,
      rng: stream('c6', 'rules', s, 'diner.challenge'),
      seed: 'c6',
      idx: s - 1,
      runMemo: {},
    });
    const mask = clampRules(rules).noCellRanks;
    const ranks = [];
    for (let r = 1; r <= 13; r++) if (mask & (1 << r)) ranks.push(r);
    const want = s <= 3 ? 1 : s <= 6 ? 2 : 3;
    assert.equal(ranks.length, want, `diner banned ranks at s${s}`);
    assert(!ranks.includes(1) && !ranks.includes(13), 'diner never bans Aces or Kings');
  }

  const keepRules = baseRules();
  CHARMS['keep.challenge'].rules(keepRules, { strength: 7, rng: stream('c6', 'rules', 7, 'keep'), seed: 'c6', idx: 6, runMemo: {} });
  assert.equal(clampRules(keepRules).freeCells, 3, 'keep siege s7 removes one cell');

  assert.equal(CHARMS['keep.banner'].offers(1, {}), 2);
}
