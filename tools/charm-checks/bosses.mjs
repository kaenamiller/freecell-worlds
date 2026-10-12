// B2 boss content: compose rules, seeded parameters, boonRelation coverage.
import { composeBoard } from '../../js/voyage/boardrules.js';

const BOSS_IDS = [
  'boss.lockdown', 'boss.thaw', 'boss.decree', 'boss.throne',
  'boss.barren', 'boss.lockstep', 'boss.tombs',
];

function boonDiff(CHARMS, baseRules, stream, boonId) {
  const b = CHARMS[boonId];
  const diff = { kind: 'boon', ability: !!b?.ability };
  if (!b?.rules) return diff;
  const before = baseRules();
  const after = baseRules();
  b.rules(after, { strength: 2, rng: stream('boss-check', 'rules', 0, boonId), seed: 'boss-check', idx: 0, runMemo: {} });
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) diff[key] = after[key];
  }
  return diff;
}

export async function check({ assert, CHARMS, baseRules, stream, validateRules, clampRules, BoardEffects, fakeBoard, stubAPI }) {
  const diffFor = (id) => boonDiff(CHARMS, baseRules, stream, id);
  const boonIds = Object.values(CHARMS).filter((c) => c.kind === 'boon' && !c.placeholder).map((c) => c.id);

  for (const bossId of BOSS_IDS) {
    const boss = CHARMS[bossId];
    assert(boss, `${bossId} registered`);
    assert.equal(boss.kind, 'boss');

    const solo = composeBoard({ seed: 'boss-solo', idx: 6, strength: 7, boss: bossId, bossStrength: 7 });
    validateRules(solo.rules);
    assert(solo.rules.freeCells >= 1, `${bossId} respects min free cells`);

    const merged = composeBoard({
      seed: 'boss-merge',
      idx: 6,
      strength: 7,
      boons: ['aero.pocket'],
      challenge: bossId === 'boss.barren' ? 'forest.challenge' : 'lapis.challenge',
      boss: bossId,
      bossStrength: 7,
    });
    validateRules(merged.rules);
    if (bossId === 'boss.thaw') {
      const withArctic = composeBoard({
        seed: 'boss-thaw-merge',
        idx: 6,
        strength: 7,
        boons: ['arctic.heatlamp'],
        boss: bossId,
        bossStrength: 7,
      });
      validateRules(withArctic.rules);
      assert.equal(withArctic.rules.cellThaw.frozen, 4, 'thaw merges cellThaw with heat lamp');
      assert.deepEqual(withArctic.rules.cellThaw.at, [6, 13, 14, 24]);
    }
    if (bossId === 'boss.lockdown') {
      assert.equal(merged.rules.freeCells, 3, 'lockdown merges with +1 cell boon');
    }
    if (bossId === 'boss.lockstep') {
      assert.equal(merged.rules.foundationSpread, 3, 'lockstep caps spread');
    }
    if (bossId === 'boss.barren') {
      assert(merged.rules.barren.suits & (1 << 0), 'barren merges with forest club barren');
    }
    if (bossId === 'boss.tombs') {
      assert.ok(merged.rules.sealedCols.length >= 2, 'tombs merges sealedCols with lapis');
    }

    if (bossId === 'boss.barren') {
      const seed = 'barren-stable';
      const text = boss.text(7, { seed });
      const rules = baseRules();
      boss.rules(rules, { seed, strength: 7, rng: stream(seed, 'rules', 6, bossId), idx: 6, runMemo: {} });
      const suit = (() => {
        for (let s = 0; s < 4; s++) if (text.includes(['Clubs', 'Diamonds', 'Hearts', 'Spades'][s])) return s;
        throw new Error('barren text missing suit name');
      })();
      assert(rules.barren.suits & (1 << suit), 'barren rules suit matches text');
      assert(rules.barren.ranks & (1 << 13) && rules.barren.ranks & (1 << 1), 'barren all ranks');
    }

    if (bossId === 'boss.tombs') {
      const seed = 'tombs-stable';
      const a = baseRules();
      const b = baseRules();
      const ctx = { seed, strength: 7, rng: stream(seed, 'rules', 6, bossId), idx: 6, runMemo: {} };
      boss.rules(a, ctx);
      boss.rules(b, ctx);
      assert.deepEqual(a.sealedCols, b.sealedCols, 'tombs columns stable for seed');
      assert.equal(a.sealedCols.length, 2, 'tombs picks two columns');
      assert.ok(a.sealedCols.every((c, i, arr) => i === 0 || Math.abs(c - arr[i - 1]) > 1), 'tombs non-adjacent');
    }

    if (bossId === 'boss.decree') {
      const fixture = fakeBoard(solo.rules);
      const api = stubAPI(fixture.game);
      const effects = new BoardEffects([{ id: bossId, kind: 'boss', strength: 7 }], {
        seed: 'decree-mark', boardIndex: 6, api, memo: {}, run: { undos: 1, results: [], boons: [], charmMemo: {} },
      });
      effects.setup(fixture.board);
      assert.equal(Object.keys(api.marks).length, 12, 'decree crowns all courts');
      assert(Object.values(api.marks).every((s) => s === 'crown'));
    }

    for (const boonId of boonIds) {
      const rel = boss.boonRelation?.(boonId, diffFor(boonId)) ?? '~';
      assert(['+', '~', '!'].includes(rel), `${bossId} boonRelation(${boonId}) → ${rel}`);
    }
  }
}
