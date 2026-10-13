// C2 content: azulejo, jetset, riverboat, carvings, varsity, driftwood, pinecone, winterglass (+ legacy spot checks).
export async function check({ assert, CHARMS, Rules, baseRules, scoreBoard, BoardEffects, charmContext, stream, kit, fakeBoard, stubAPI }) {
  const rulesCtx = (id, strength, level = 1) => ({
    strength, level, rng: stream('c2', 'rules', strength, id), seed: 'c2', idx: strength - 1, runMemo: {},
    boons: [id], stickers: {}, family: () => 1,
  });

  const tessL1 = CHARMS['azulejo.tessellate'];
  const sbT = scoreBoard(
    [{ t: 'F', card: 5 }, { t: 'F', card: 18 }, { t: 'F', card: 31 }],
    60,
    new BoardEffects([{ id: 'azulejo.tessellate', kind: 'boon', strength: 1, level: 1 }], { seed: 'c2', boardIndex: 0, api: {}, memo: {}, run: null }),
  );
  tessL1.score(sbT, { level: 1 });
  assert.equal(sbT.coinLines.find((l) => l.key === 'tessellate')?.coins, 4, 'tessellate L1: two same-rank homes × 2 coins');
  const sbT2 = scoreBoard([{ t: 'F', card: 5 }, { t: 'F', card: 6 }], 60, null);
  tessL1.score(sbT2, { level: 2 });
  assert.equal(sbT2.coinLines.length, 0, 'tessellate: no match → no coins');

  const cracked = CHARMS['azulejo.challenge'];
  const rAz = baseRules();
  cracked.rules(rAz, rulesCtx('azulejo.challenge', 3));
  assert.equal(rAz.barrenCards.length, 4, 'cracked tiles s3 picks four cards');

  const sleeve = CHARMS['riverboat.sleeve'];
  const rSl = baseRules();
  sleeve.rules(rSl, rulesCtx('riverboat.sleeve', 1, 1));
  assert.equal(rSl.startHome, 1);
  sleeve.rules(rSl, rulesCtx('riverboat.sleeve', 1, 2));
  assert.equal(rSl.startHome, 2);

  const ante = CHARMS['riverboat.challenge'];
  const hist = [
    { t: 'F', card: 1, src: { kind: 'col', i: 0 } },
    { t: 'F', card: 2, src: { kind: 'col', i: 0 } },
    { t: 'F', card: 3, src: { kind: 'col', i: 0 } },
    { t: 'F', card: 4, src: { kind: 'col', i: 0 } },
    { t: 'F', card: 5, src: { kind: 'col', i: 0 } },
    { t: 'M' },
  ];
  const initial = { tableau: [[1, 2, 3]], free: [0, 0, 0, 0], found: [0, 0, 0, 0] };
  const sbAnte = {
    history: hist,
    initial,
    initialRules: {},
    rules: {},
    stat: { moves: 1, freeCellPlacements: 0, chains: [5], cards: 5 },
    coinLines: [],
    addCoins(k, l, n) { this.coinLines.push({ key: k, coins: n }); },
  };
  ante.score(sbAnte, { strength: 3, memo: { ante: 5 } });
  assert.equal(sbAnte.coinLines.find((l) => l.key === 'ante')?.coins, -5);
  assert.equal(sbAnte.coinLines.find((l) => l.key === 'ante-rebate')?.coins, 3);

  const flyer = CHARMS['jetset.flyer'];
  const sbFly = { stat: { moves: 50 }, par: 60, coinLines: [], addCoins(k, l, n) { this.coinLines.push({ key: k, coins: n }); } };
  assert.equal(flyer.coins(10, { level: 1, stars: 3, sb: sbFly }), 16, 'flyer L1 par+3★ pays 6');
  assert.equal(flyer.coins(10, { level: 1, stars: 2, sb: { ...sbFly, stat: { moves: 70 }, par: 60 } }), 10, 'flyer: over par pays nothing');

  const first = CHARMS['jetset.firstclass'];
  assert.equal(first.boardUndos(2, { level: 1, stars: 3 }), 1);
  assert.equal(first.boardUndos(2, { level: 2, stars: 3 }), 2);

  const spirit = CHARMS['rink.couples'];
  const rSp = baseRules();
  spirit.rules(rSp, {
    ...rulesCtx('rink.couples', 1, 1),
    boons: ['rink.couples', 'azulejo.tessellate', 'jetset.flyer', 'darkroom.sheet', 'winterglass.prism'],
    family: (name) => ['rink.couples', 'azulejo.tessellate', 'jetset.flyer', 'darkroom.sheet', 'winterglass.prism']
      .filter((id) => CHARMS[id]?.family === name).length,
  });
  assert.equal(rSp.freeCells, 5, 'spirit L1: four families → +1 cell');

  const catchCharm = CHARMS['darkroom.keeper'];
  const sbCatch = scoreBoard([{ t: 'F', card: 13 }], 60, new BoardEffects([{ id: 'darkroom.keeper', kind: 'boon', strength: 1, level: 1 }], {
    seed: 'c2', boardIndex: 0, api: {}, memo: { 'darkroom.keeper': { suit: 0 } }, run: null,
  }));
  catchCharm.score(sbCatch, { level: 1, memo: { suit: 0 } });
  assert.equal(sbCatch.coinLines[0]?.coins, 12);
  const sbCatchFail = scoreBoard([{ t: 'F', card: 26 }, { t: 'F', card: 13 }], 60, null);
  catchCharm.score(sbCatchFail, { level: 1, memo: { suit: 0 } });
  assert.equal(sbCatchFail.coinLines.length, 0, 'catch: other king first → no coins');

  const frost = CHARMS['winterglass.challenge'];
  const rFr = baseRules();
  frost.rules(rFr, rulesCtx('winterglass.challenge', 7));
  assert.equal(rFr.emptyColors.filter(Boolean).length, 8);

  const prism = CHARMS['winterglass.prism'];
  const rPr = baseRules();
  prism.rules(rPr, rulesCtx('winterglass.prism', 1, 2));
  assert(rPr.wildRanks & kit.rankMask(13), 'prism L2 wild kings');

  const fixture = fakeBoard();
  const dealGame = new Rules.Game(1, { rules: baseRules() });
  const api = stubAPI(dealGame, { run: { undos: 4, results: [], boons: ['riverboat.longshot'], charmMemo: {}, status: 'board' } });
  const longFx = new BoardEffects([{ id: 'riverboat.longshot', kind: 'boon', strength: 1, level: 1 }], {
    seed: 'c2', boardIndex: 0, api, memo: {}, run: { undos: 4, results: [], boons: ['riverboat.longshot'], charmMemo: {}, status: 'board' },
  });
  longFx.setup({ state: Rules.cloneState(dealGame.state), initial: Rules.cloneState(dealGame.state) });
  assert(longFx.abilityState('riverboat.longshot').available);
  await longFx.useAbility('riverboat.longshot');
  assert.equal(longFx.ctxs[0].memo.stake, 2);
  longFx.emit('win', { result: { stars: 3 } });
  assert(api.calls.some(([n, v]) => n === 'addCoins' && v === 24));

  const trail = CHARMS['pinecone.trailhead'];
  assert(trail.ability.uses({ level: 2 }) === 2);
}
