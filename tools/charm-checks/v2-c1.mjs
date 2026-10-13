// C1 v2: roman, cyber, aero, zen, forest, deco, muertos, space (simple roster charms).
export async function check(h) {
  const {
    assert, CHARMS, baseRules, scoreBoard, BoardEffects, kit, fakeBoard, stubAPI, clone, Rules,
  } = h;

  const legion = CHARMS['roman.legion'];
  for (const [level, mask] of [[1, kit.rankMask(10)], [2, kit.rankMask(9, 10)]]) {
    const r = baseRules();
    legion.rules(r, { strength: 1, level, rng: () => 0, seed: 'c1', idx: 0, runMemo: {} });
    assert.equal(r.wildRanks & mask, mask, `roman.legion L${level} wild ranks`);
  }

  const colonnade = CHARMS['roman.colonnade'];
  const rCol = baseRules();
  colonnade.rules(rCol, { strength: 1, level: 2, rng: () => 0, seed: 'c1', idx: 0, runMemo: {} });
  assert.equal(rCol.emptyFactor, 4, 'roman.colonnade L2 quadruples');

  const laurel = CHARMS['roman.laurel'];
  const initial = { tableau: [[13], [], [], [], [], [], [], []], free: [0, 0, 0, 0], found: [12, 12, 12, 12] };
  const hist = [{ t: 'F', card: 13, src: { kind: 'col', i: 0 } }];
  const sbLaurel = scoreBoard(hist, 60, null, { initial, rules: baseRules(), initialRules: baseRules(), boardIdx: 0 });
  laurel.score(sbLaurel, { level: 1, memo: {} });
  assert.equal(sbLaurel.coinLines.find((l) => l.key === 'laurel')?.coins, 1, 'laurel L1: 3 in play → 1 coin');
  const sbLaurel2 = scoreBoard(hist, 60, null, { initial, rules: baseRules(), initialRules: baseRules(), boardIdx: 0 });
  laurel.score(sbLaurel2, { level: 2, memo: {} });
  assert.equal(sbLaurel2.coinLines.find((l) => l.key === 'laurel')?.coins, 3, 'laurel L2: 3 in play → 3 coins');
  const sbNoKing = scoreBoard([], 60, null, { initial, rules: baseRules(), initialRules: baseRules(), boardIdx: 0 });
  laurel.score(sbNoKing, { level: 1, memo: {} });
  assert.equal(sbNoKing.coinTotal, 0, 'laurel negative: no suit complete');

  const overclock = CHARMS['cyber.overclock'];
  const rOc = baseRules();
  overclock.rules(rOc, { strength: 1, level: 2, rng: () => 0, seed: 'c1', idx: 0, runMemo: {} });
  assert.equal(rOc.moveBonus, 3, 'cyber.overclock L2');

  const pocket = CHARMS['aero.pocket'];
  const rPocket = baseRules();
  pocket.rules(rPocket, { strength: 1, level: 2, rng: () => 0, seed: 'c1', idx: 0, runMemo: {} });
  assert.equal(rPocket.freeCells, 5, 'aero.pocket extra cell');
  assert.equal(rPocket.moveBonus, 1, 'aero.pocket L2 move bonus');

  const fixture = fakeBoard();
  const run = { seed: 'c1', undos: 4, boons: ['aero.lounge'], coins: 0, charmMemo: {}, status: 'board' };
  const api = stubAPI(fixture.game, { run, memo: {} });
  const loungeFx = new BoardEffects([{ id: 'aero.lounge', kind: 'boon', strength: 1, level: 1 }], {
    seed: 'c1', boardIndex: 0, api, memo: {}, run,
  });
  loungeFx.setup(fixture.board);
  assert(api.openUndoWindow(), 'aero.lounge opens window');
  assert(!api.openUndoWindow(), 'aero.lounge second window blocked same board');

  const still = CHARMS['zen.stillness'];
  const rStill = baseRules();
  still.rules(rStill, { strength: 1, level: 1, rng: () => 0, seed: 'c1', idx: 0, runMemo: {} });
  assert.equal(rStill.freeCards.length, 52, 'zen.stillness all cards free');
  const rStill2 = baseRules();
  still.rules(rStill2, { strength: 1, level: 2, rng: () => 0, seed: 'c1', idx: 0, runMemo: {} });
  assert.equal(rStill2.freeCells, 5, 'zen.stillness L2 cell');

  const koanApi = stubAPI(fixture.game);
  const koanL2 = new BoardEffects([{ id: 'zen.koan', kind: 'boon', strength: 1, level: 2 }], {
    seed: 'c1', boardIndex: 0, api: koanApi, memo: {},
  });
  koanL2.setup(fixture.board);
  assert.equal(koanL2.abilityState('zen.koan').uses, 2, 'zen.koan L2 two previews');
  assert(koanL2.abilityState('zen.koan').available, 'zen.koan available on live board');

  const fireflies = CHARMS['forest.fireflies'];
  const sbFly = scoreBoard(
    [{ t: 'F', card: 5, src: { kind: 'col', i: 0 } }, { t: 'M', card: 6, src: { kind: 'col', i: 1 }, to: { kind: 'col', i: 2 } }],
    60,
    null,
    { initial: fixture.initial, rules: baseRules(), initialRules: baseRules(), boardIdx: 0 },
  );
  fireflies.score(sbFly, { level: 1, memo: { fireflies: [5] } });
  assert.equal(sbFly.coinLines.find((l) => l.key.startsWith('firefly'))?.coins, 3, 'firefly pays under 26 home');
  const lateInit = {
    tableau: [[], [], [], [], [], [], [], []],
    free: [0, 0, 0, 0],
    found: [6, 6, 6, 6],
  };
  const sbFlyLate = scoreBoard(
    [
      { t: 'F', card: 5, src: { kind: 'col', i: 0 } },
      { t: 'F', card: 6, src: { kind: 'col', i: 1 } },
      { t: 'F', card: 7, src: { kind: 'col', i: 2 } },
    ],
    60,
    null,
    { initial: lateInit, rules: baseRules(), initialRules: baseRules(), boardIdx: 0 },
  );
  fireflies.score(sbFlyLate, { level: 1, memo: { fireflies: [7] } });
  assert.equal(sbFlyLate.coinTotal, 0, 'firefly negative: glowing card home at 27+');

  const champagne = CHARMS['deco.champagne'];
  const ctxChamp = {
    level: 1,
    family: (name) => (name === 'coin' ? 1 : 0) + (name === 'cells' ? 1 : 0) + (name === 'wild' ? 1 : 0) + (name === 'suit' ? 1 : 0),
    boons: ['deco.champagne', 'a', 'b', 'c'],
  };
  assert.equal(champagne.coins(100, ctxChamp), 125, 'champagne +25% at 4 families');
  assert.equal(champagne.coins(100, { ...ctxChamp, family: () => 0 }), 100, 'champagne negative: too few families');

  const velvet = CHARMS['deco.velvet'];
  const rVel = baseRules();
  velvet.rules(rVel, { strength: 1, level: 1, rng: () => 0, seed: 'c1', idx: 0, runMemo: {} });
  assert.equal(rVel.cellLimits[4]?.minRank, 11, 'velvet VIP cell');

  const ofrenda = CHARMS['muertos.ofrenda'];
  const portRun = { undos: 5, coins: 0 };
  ofrenda.onPort(portRun, {
    level: 1,
    api: { addCoins(n) { portRun.coins += n; } },
  });
  assert.equal(portRun.coins, 10, 'ofrenda 5 undos × 2');
  portRun.coins = 0; portRun.undos = 20;
  ofrenda.onPort(portRun, { level: 1, api: { addCoins(n) { portRun.coins += n; } } });
  assert.equal(portRun.coins, 16, 'ofrenda capped at 16');

  const mission = CHARMS['signal.operator'];
  const runPick = { undos: 0 };
  mission.onPick(runPick);
  assert.equal(runPick.undos, 2, 'mission +2 undos on pick');
  const holo = CHARMS['signal.lock'];
  const holoFx = new BoardEffects(
    [{ id: 'signal.lock', kind: 'boon', strength: 1, level: 2 }],
    { seed: 'c1', boardIndex: 0, api: stubAPI(fixture.game), memo: {} },
  );
  holoFx.setup(fixture.board);
  assert.equal(holoFx.abilityState('signal.lock').uses, 3, 'holoscan L2 three scans');

  // _examples.js re-registers this id as a hidden legacy fixture; only a visible one would be a bug.
  assert(!Object.values(CHARMS).some((c) => c.id === 'cyber.cache' && !c.hidden), 'cyber.cache removed');
  assert(CHARMS['aero.dolphin'] && CHARMS['aero.dolphin'].ability, 'dolphin lives in special module');
  assert(CHARMS['deco.velvet'] && !CHARMS['deco.highroller'], 'velvet replaces highroller');
  assert(CHARMS['zen.koan'] && !CHARMS['zen.mindful'], 'koan replaces mindful');
}
