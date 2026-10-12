// C2 content: muertos, space, azulejo, jetset, riverboat
export async function check({ assert, CHARMS, baseRules, scoreBoard, kit, BoardEffects, fakeBoard, stubAPI }) {
  const marigold = CHARMS['muertos.marigold'];
  const rules = baseRules();
  marigold.rules(rules, { strength: 1, rng: () => 0, seed: 'c2', idx: 0, runMemo: {} });
  assert.equal(rules.suitBuild & kit.suitMask(2), kit.suitMask(2), 'muertos.marigold builds hearts in suit');

  const storm = CHARMS['space.challenge'];
  const r2 = baseRules();
  storm.rules(r2, { strength: 7, rng: () => 0, seed: 'c2', idx: 6, runMemo: {} });
  assert.deepEqual(r2.barren, { suits: kit.suitMask(1, 2), ranks: kit.rankMask(11, 12, 13) }, 'space.challenge s7 red J Q K barren');
  assert.equal(r2.moveBonus || 0, 0, 'space.challenge leaves move capacity alone');
  const root = CHARMS['conservatory.challenge'];
  const r3 = baseRules();
  root.rules(r3, { strength: 7, rng: () => 0, seed: 'c2', idx: 6, runMemo: {} });
  assert.equal(r3.oneWayCellRanks, kit.rankMask(2, 3, 4, 5), 'conservatory.challenge s7 roots 2–5');
  assert.equal(r3.emptyFactor ?? 2, 2, 'conservatory.challenge leaves empty columns alone');

  const ante = CHARMS['riverboat.challenge'];
  const hist = [
    { t: 'F', card: 1 }, { t: 'F', card: 2 }, { t: 'F', card: 3 }, { t: 'F', card: 4 }, { t: 'F', card: 5 },
    { t: 'M' },
  ];
  const sb = scoreBoard(hist, 60, null, { elapsed: 0, boardIdx: 0 });
  ante.score(sb, { strength: 3, memo: {} });
  const line = sb.lines.find((l) => l.key === 'ante');
  assert.equal(line.pts, -90 + 45, 'riverboat.challenge one 5-chain rebate at s3');

  const tess = CHARMS['azulejo.tessellate'];
  const sb2 = scoreBoard([{ t: 'F', card: 5 }, { t: 'M' }, { t: 'F', card: 18 }, { t: 'F', card: 31 }], 60);
  tess.score(sb2, {});
  assert.equal(sb2.lines.find((l) => l.key === 'tessellate')?.pts, 20, 'azulejo.tessellate two rank-5 homes');

  const fixture = fakeBoard();
  const api = stubAPI(fixture.game);
  const effects = new BoardEffects([{ id: 'jetset.flyer', kind: 'boon', strength: 1 }], {
    seed: 'c2', boardIndex: 0, api, memo: {}, run: { undos: 2, results: [], boons: [], charmMemo: {} },
  });
  effects.emit('win', { result: { stars: 3 } });
  assert.equal(api.calls.filter((c) => c[0] === 'addUndos').length, 2, 'jetset.flyer grants two undos on 3★');
}
