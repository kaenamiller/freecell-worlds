// C3 v2: concrete, library, conservatory, nighttrain, saffron, harvest, carnival, canyon.
export async function check(h) {
  const {
    assert, CHARMS, baseRules, scoreBoard, BoardEffects, kit, stream, fakeBoard, stubAPI,
  } = h;

  const bank = CHARMS['concrete.bankshot'];
  const sbBank = scoreBoard(
    [{ t: 'F', card: 1, src: { kind: 'free', i: 0 } }, { t: 'F', card: 14, src: { kind: 'col', i: 0 } }],
    60,
    null,
    { boardIdx: 0 },
  );
  bank.score(sbBank, { level: 1 });
  assert.equal(sbBank.coinLines.find((l) => l.key === 'bankshot')?.coins, 1, 'bankshot L1 one free-cell home');
  const sbBank2 = scoreBoard(
    [{ t: 'F', card: 1, src: { kind: 'free', i: 0 } }],
    60,
    null,
    { boardIdx: 0 },
  );
  bank.score(sbBank2, { level: 2 });
  assert.equal(sbBank2.coinTotal, 2, 'bankshot L2 doubles rate');

  const fixture = fakeBoard();
  const boardMemo = {};
  const run = { seed: 'c3', undos: 2, boons: ['concrete.mixtape', 'signal.lock'], coins: 0, charmMemo: {}, status: 'board', results: [] };
  const api = stubAPI(fixture.game, { run, memo: boardMemo });
  const mixFx = new BoardEffects([
    { id: 'concrete.mixtape', kind: 'boon', strength: 1, level: 1 },
    { id: 'signal.lock', kind: 'boon', strength: 1, level: 1 },
  ], { seed: 'c3', boardIndex: 0, api, memo: boardMemo, run });
  mixFx.setup(fixture.board);
  boardMemo['signal.lock']._runtime.abilityUses = 0;
  mixFx.ctxs[0].memo.lastAbility = 'signal.lock';
  mixFx.emit('columnEmpty', { col: 0 });
  assert.equal(mixFx.abilityState('signal.lock').uses, 1, 'mixtape refunds last ability');

  const quiet = CHARMS['library.quiet'];
  const sbQuiet = scoreBoard([], 60, null, { undosUsed: 0, boardIdx: 4 });
  quiet.score(sbQuiet, { level: 1 });
  assert.equal(sbQuiet.coinLines[0]?.coins, 15, 'quiet L1 board 5 bonus');
  const sbLoud = scoreBoard([], 60, null, { undosUsed: 2, boardIdx: 0 });
  quiet.score(sbLoud, { level: 1 });
  assert.equal(sbLoud.coinTotal, 0, 'quiet negative: undos used');

  const lending = CHARMS['library.lending'];
  const lendRules = baseRules();
  lending.rules(lendRules, { strength: 1, level: 2, rng: () => 0, seed: 'c3', idx: 0, runMemo: {} });
  assert.equal(lendRules.moveBonus, 1, 'lending L2 move bonus');

  const graftRules = baseRules();
  graftRules.wildRanks = kit.rankMask(11);
  CHARMS['conservatory.graft'].rulesAfter(graftRules, { strength: 1, level: 1, rng: () => 0, seed: 'c3', idx: 0, runMemo: {} });
  assert.equal(graftRules.wildRanks & kit.rankMask(10, 11), kit.rankMask(10, 11), 'graft expands below');

  const mistRun = { ...run, boons: ['conservatory.mist', 'aero.pocket'] };
  const mistApi = stubAPI(fixture.game, { run: mistRun, memo: {} });
  const mistFx = new BoardEffects([{ id: 'conservatory.mist', kind: 'boon', strength: 1, level: 1 }], {
    seed: 'c3', boardIndex: 0, api: mistApi, memo: {}, run: mistRun,
  });
  mistFx.setup(fixture.board);
  mistFx.emit('freecell', { card: 1, move: { t: 'C' } });
  mistFx.emit('freecell', { card: 2, move: { t: 'C' } });
  assert.equal(mistApi.calls.filter((c) => c[0] === 'addUndos').length, 2, 'mist grants per cells family');

  const seedRun = { seed: 'c3', coins: 0, results: [{ stars: 3 }, { stars: 2 }, { stars: 3 }], boons: ['conservatory.seedbank'], levels: { 'conservatory.seedbank': 1 } };
  CHARMS['conservatory.seedbank'].onPort(seedRun, {
    level: 1,
    port: { extraBoons: 0 },
    api: { addCoins(n) { seedRun.coins += n; } },
  });
  assert.equal(seedRun.coins, 6, 'seedbank two seeds × 3 coins');

  const ontime = CHARMS['smokewatch.report'];
  const sbTime = scoreBoard([], 60, null, { elapsed: 300 });
  ontime.score(sbTime, { level: 1 });
  assert.equal(sbTime.coinTotal, 10, 'on time under 6 minutes');
  const sbLate = scoreBoard([], 60, null, { elapsed: 400 });
  ontime.score(sbLate, { level: 1 });
  assert.equal(sbLate.coinTotal, 0, 'on time negative: too slow');

  const timetable = CHARMS['smokewatch.challenge'];
  const sbTimeTbl = scoreBoard(Array(70).fill({ t: 'M', auto: false }), 60, null, { boardIdx: 0 });
  timetable.score(sbTimeTbl, { strength: 3 });
  assert.ok(sbTimeTbl.coinTotal < 0, 'timetable charges over par');

  const spice = CHARMS['saffron.spice'];
  const spiceHist = [
    { t: 'F', card: 5, src: { kind: 'col', i: 0 } },
    { t: 'F', card: 18, src: { kind: 'col', i: 1 } },
    { t: 'F', card: 31, src: { kind: 'col', i: 2 } },
    { t: 'F', card: 44, src: { kind: 'col', i: 3 } },
  ];
  const sbSpice = scoreBoard(spiceHist, 60, null, { boardIdx: 0, initial: fixture.initial });
  spice.score(sbSpice, { level: 1 });
  assert.equal(sbSpice.coinTotal, 3, 'spice sync below queen');

  const warp = CHARMS['saffron.challenge'];
  const warpRules = baseRules();
  warp.rules(warpRules, { strength: 5, rng: stream('c3', 'rules', 5, warp.id), seed: 'c3', idx: 4, runMemo: {} });
  assert.equal(warpRules.colorSpread, 4, 'warp and weft spread');

  const glean = CHARMS['harvest.gleaning'];
  const sbGlean = scoreBoard([{ t: 'F', card: 1, src: { kind: 'col', i: 0 } }, { t: 'M' }], 60, null, { boardIdx: 0, initial: fixture.initial });
  glean.score(sbGlean, { level: 1 });
  assert.equal(sbGlean.coinTotal, 4, 'gleaning ace in first moves');

  const cellarMemo = {};
  const cellarRun = { ...run, boons: ['harvest.cellar', 'signal.lock'] };
  const cellarApi = stubAPI(fixture.game, { run: cellarRun, memo: cellarMemo });
  cellarApi.boardMemo = cellarMemo;
  const cellarFx = new BoardEffects([
    { id: 'harvest.cellar', kind: 'boon', strength: 1, level: 1 },
    { id: 'signal.lock', kind: 'boon', strength: 1, level: 1 },
  ], { seed: 'c3', boardIndex: 0, api: cellarApi, memo: cellarMemo, run: cellarRun });
  cellarFx.setup(fixture.board);
  cellarMemo['signal.lock']._runtime.abilityUses = 2;
  cellarFx.emit('win', { result: { stars: 2, moves: 40, par: 60 } });
  assert.equal(cellarApi.calls.find((c) => c[0] === 'addUndos')?.[1], 2, 'cellar banks unused abilities');

  const wheel = CHARMS['carnival.wheel'];
  const wheelFx = new BoardEffects([{ id: 'carnival.wheel', kind: 'boon', strength: 1, level: 1 }], {
    seed: 'c3', boardIndex: 0, api: stubAPI(fixture.game), memo: {}, run: { results: [], boons: [], charmMemo: {} },
  });
  wheelFx.setup(fixture.board);
  const mult = wheelFx.ctxs[0].memo.mult;
  assert.ok(mult >= 1 && mult <= 2.01, 'wheel multiplier range');
  assert.equal(wheel.coins(20, wheelFx.ctxs[0]), Math.round(20 * mult), 'wheel coins hook');

  // The Fool anchors the card the rules stream picks, and setup marks that same card.
  const foolRules = baseRules();
  CHARMS['carnival.fool'].rules(foolRules, { id: 'carnival.fool', seed: 'c3', idx: 0, level: 1, strength: 1 });
  assert.equal(foolRules.anchorCards.length, 1, 'one fool');
  const foolApi = stubAPI(fixture.game);
  const foolFx = new BoardEffects([{ id: 'carnival.fool', kind: 'boon', strength: 1, level: 1 }], {
    seed: 'c3', boardIndex: 0, api: foolApi, memo: {}, run: { results: [], boons: [], charmMemo: {} },
  });
  foolFx.setup(fixture.board);
  const marked = Object.keys(foolApi.marks).map(Number);
  assert.ok(marked.every((id) => foolRules.anchorCards.includes(id)), 'fool anchor is the marked card');
  const twoFools = baseRules();
  CHARMS['carnival.fool'].rules(twoFools, { id: 'carnival.fool', seed: 'c3', idx: 0, level: 2, strength: 1 });
  assert.equal(twoFools.anchorCards.length, 2, 'two fools at level 2');

  const bloomApi = stubAPI(fixture.game, { run: { undos: 1, charmMemo: {} } });
  const bloomFx = new BoardEffects([{ id: 'canyon.bloom', kind: 'boon', strength: 1, level: 1 }], {
    seed: 'c3', boardIndex: 0, api: bloomApi, memo: {}, run: { undos: 1, charmMemo: {} },
  });
  bloomFx.setup(fixture.board);
  bloomFx.emit('win', { result: { moves: 50, par: 60 } });
  assert.equal(bloomApi.calls.find((c) => c[0] === 'addUndos')?.[1], 2, 'desert bloom at par');

  const echoApi = stubAPI(fixture.game);
  const echoFx = new BoardEffects([{ id: 'canyon.echo', kind: 'boon', strength: 2, level: 2 }], {
    seed: 'c3', boardIndex: 0, api: echoApi, memo: {}, run: { undos: 1, charmMemo: {} },
  });
  echoFx.setup(fixture.board);
  echoFx.emit('undo', { move: { t: 'R', src: { kind: 'free' } }, free: false, reset: false });
  assert.equal(echoApi.calls.find((c) => c[0] === 'addUndos')?.[1], 1, 'echo L2 refunds leave-free');
  echoApi.calls.length = 0;
  echoFx.emit('undo', { move: { t: 'R', src: { kind: 'free' } }, free: true, reset: false });
  assert.equal(echoApi.calls.filter((c) => c[0] === 'addUndos').length, 0, 'echo ignores free undo');
}
