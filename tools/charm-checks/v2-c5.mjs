// v2 content checks for agent c5: keep, deepstorage, cafe, arctic, museum, mint, toybox, prizelights.
export async function check(h) {
  const {
    assert, CHARMS, baseRules, clampRules, stream, kit, charmContext, BoardEffects, fakeBoard, stubAPI, scoreBoard,
  } = h;

  const rulesCtx = (id, strength, level = 1) => ({
    strength, level, seed: 'v2-c5', idx: strength - 1, runMemo: {}, boons: [id],
    family: (name) => +(CHARMS[id].family === name),
    rng: stream('v2-c5', 'rules', strength - 1, id),
  });

  assert.equal(CHARMS['bloodmoon.crest'].offers(1, { level: 1 }), 2);
  assert.equal(CHARMS['bloodmoon.crest'].offers(1, { level: 2 }), 3);

  const archive = CHARMS['deepstorage.archive'];
  assert.equal(archive.price({ kind: 'sticker', type: 'wild' }, 30, { level: 1, port: { stickers: [] } }), 0);
  assert.equal(archive.price({ kind: 'sticker', type: 'wild' }, 30, { level: 1, port: { stickers: [{ sold: true }] } }), 30);
  assert.equal(archive.price({ kind: 'boon', id: 'x' }, 45, { level: 1, port: { stickers: [] } }), 45);

  const mintRules = baseRules();
  CHARMS['mint.challenge'].rules(mintRules, rulesCtx('mint.challenge', 7));
  assert.equal(clampRules(mintRules).gate.after, 18);

  const sterlingL1 = baseRules();
  CHARMS['mint.sterling'].rules(sterlingL1, rulesCtx('mint.sterling', 1, 1));
  assert.equal(sterlingL1.buildUp, kit.suitMask(1));
  const sterlingL2 = baseRules();
  CHARMS['mint.sterling'].rules(sterlingL2, rulesCtx('mint.sterling', 1, 2));
  assert.equal(sterlingL2.buildUp, kit.suitMask(1, 2));

  const fullHouse = baseRules();
  CHARMS['prizelights.challenge'].rules(fullHouse, rulesCtx('prizelights.challenge', 3));
  assert.equal(clampRules(fullHouse).maxEmpty, 2);

  const blocksL1 = baseRules();
  CHARMS['toybox.foursquare'].rules(blocksL1, { ...rulesCtx('toybox.foursquare', 1), family: () => 2 });
  assert.equal(blocksL1.moveBonus, 2);
  const blocksL2 = baseRules();
  CHARMS['toybox.foursquare'].rules(blocksL2, { ...rulesCtx('toybox.foursquare', 1, 2), family: () => 2 });
  assert.equal(blocksL2.moveBonus, 4);

  const puzzleMask = (level) => {
    const r = baseRules();
    CHARMS['prizelights.puzzle'].rules(r, rulesCtx('prizelights.puzzle', 1, level));
    const ranks = kit.ranksIn(r.wildRanks);
    assert.ok(ranks.every((rank) => rank >= 3 && rank <= 12));
    return ranks.length;
  };
  assert.equal(puzzleMask(1), 1);
  assert.equal(puzzleMask(2), 2);

  assert.equal(CHARMS['prizelights.applause'].picks(1, { level: 1, run: { results: [{ stars: 3 }] } }), 2);
  assert.equal(CHARMS['prizelights.applause'].picks(1, { level: 1, run: { results: [{ stars: 2 }] } }), 1);
  assert.equal(CHARMS['prizelights.applause'].picks(1, { level: 2, run: { results: [{ stars: 2 }] } }), 2);

  assert.equal(CHARMS['museum.docent'].abilityBonus({ level: 1, family: () => 4 }), 2);
  assert.equal(CHARMS['museum.docent'].abilityBonus({ level: 2, family: () => 4 }), 4);

  const coinSb = (history, initial, boardIdx = 1, results = [{ stars: 3 }, { stars: 3 }]) => ({
    initial,
    initialRules: baseRules(),
    history,
    stat: { moves: history.length, freeCellPlacements: 0, chains: [], cards: 52 },
    lines: [],
    mults: [],
    coinLines: [],
    coinTotal: 0,
    add() {},
    scale() {},
    mult() {},
    addCoins(key, label, n) {
      this.coinLines.push({ key, label, coins: n });
      this.coinTotal += n;
    },
  });

  const regulars = CHARMS['cafe.regulars'];
  const noStreak = coinSb([], { tableau: [[1]], free: [0, 0, 0, 0], found: [0, 0, 0, 0] }, 0, []);
  regulars.score(noStreak, charmContext({ id: 'cafe.regulars', kind: 'boon', level: 1 }, { seed: 'v2-c5', boardIndex: 0, run: { results: [], boardIdx: 0, boons: [], undos: 0, coins: 0 } }));
  assert.equal(noStreak.coinTotal, 0, 'regulars: no streak → no coins');
  const streakSb = coinSb([], { tableau: [[1]], free: [0, 0, 0, 0], found: [0, 0, 0, 0] });
  regulars.score(streakSb, charmContext({ id: 'cafe.regulars', kind: 'boon', level: 1 }, {
    seed: 'v2-c5', boardIndex: 2, run: { boardIdx: 2, results: [{ stars: 3 }, { stars: 2 }], boons: [], undos: 0, coins: 0 },
  }));
  assert.equal(streakSb.coinTotal, 4, 'regulars: two-board streak');

  const pastry = CHARMS['cafe.pastry'];
  const slowPastry = coinSb([], { tableau: [[5]], free: [0, 0, 0, 0], found: [0, 0, 0, 0] });
  pastry.score(slowPastry, charmContext({ id: 'cafe.pastry', kind: 'boon', level: 1 }, { seed: 'v2-c5', boardIndex: 0, run: { boardIdx: 0, results: [], boons: [], undos: 0, coins: 0 } }));
  assert.equal(slowPastry.coinTotal, 0, 'pastry: no early homes');

  if (fakeBoard && stubAPI && BoardEffects) {
    const fixture = fakeBoard();
    const espressoApi = stubAPI(fixture.game);
    const espressoFx = new BoardEffects([{ id: 'cafe.espresso', kind: 'boon', strength: 1, level: 1 }], {
      seed: 'v2-c5', boardIndex: 0, api: espressoApi, memo: {}, run: { undos: 1, results: [], boons: [], charmMemo: {} },
    });
    espressoFx.setup(fixture.board);
    espressoFx.emit('undo', { move: fixture.undone, moves: [fixture.undone] });
    assert.equal(espressoApi.calls.filter(([n]) => n === 'addUndos').length, 1);
    espressoFx.emit('undo', { move: fixture.undone, moves: [fixture.undone], free: true });
    assert.equal(espressoApi.calls.filter(([n]) => n === 'addUndos').length, 1, 'espresso ignores free undo');

    const sb = scoreBoard(fixture.history, 60, null, { initial: fixture.initial });
    CHARMS['toybox.tidyup'].score(sb, charmContext({ id: 'toybox.tidyup', kind: 'boon', level: 1 }, { seed: 'v2-c5', boardIndex: 0, run: { boardIdx: 0, results: [], boons: [], undos: 0, coins: 0 } }));
    assert.equal(sb.coinTotal || 0, 0, 'tidyup: no column clears on fixture history');
  }

  const run = { seed: 'v2-c5', coins: 20, boons: ['mint.interest'], levels: { 'mint.interest': 1 }, status: 'port', port: { stickers: [] }, charmMemo: {} };
  const before = run.coins;
  const portApi = { addCoins: (n) => { run.coins += n; } };
  const portCtx = { ...charmContext({ id: 'mint.interest', kind: 'boon', level: 1 }, { seed: 'v2-c5', boardIndex: 0, run }), api: portApi, coins: 20 };
  CHARMS['mint.interest'].onPort(run, portCtx);
  assert.equal(run.coins - before, 4, 'mint interest at 20 coins');
}
