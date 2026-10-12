// Focused checks for C5 themes (carnival, canyon, lowtide, theater, forge, saloon).
export async function check(h) {
  const { assert, CHARMS, baseRules, stream, kit } = h;
  const carnival = CHARMS['carnival.challenge'];
  const rules = baseRules();
  carnival.rules(rules, { strength: 3, rng: stream('c5', 'rules', 2, carnival.id), seed: 'c5', idx: 2, runMemo: {} });
  assert(rules.noCellCards.length >= 2, 'Rigged Booth blocks a suit slice');
  const canyon = CHARMS['canyon.challenge'];
  const canyonRules = baseRules();
  canyon.rules(canyonRules, { strength: 7, rng: stream('c5', 'rules', 6, canyon.id), seed: 'c5', idx: 6, runMemo: {} });
  assert.equal(canyonRules.cellColors.filter(Boolean).length, 4, 'Two-Tone Strata locks all cells at s7');
  const saloon = CHARMS['saloon.challenge'];
  const jail = baseRules();
  saloon.rules(jail, { strength: 1, rng: stream('c5', 'rules', 0, saloon.id), seed: 'c5', idx: 0, runMemo: {} });
  assert(jail.oneWayCellRanks & kit.rankMask(12), 'Jailhouse one-way from rank 12 at s1');
  assert(!(CHARMS['carnival.wheel'].placeholder), 'carnival content is real');
}
