// v2 content checks for agent c4 (lowtide, theater, forge, saloon, lapis, canopy, diner, cove).
export async function check(h) {
  const {
    assert, CHARMS, BoardEffects, scoreBoard, baseRules, fakeBoard, stubAPI, charmContext, kit, clone, Rules,
  } = h;
  const { rankOf, suitOf, replay, chainsOf } = kit;
  const cardId = Rules.cardId;

  // lowtide.rockpool
  const poolRules = baseRules();
  CHARMS['lowtide.rockpool'].rules(poolRules, { level: 1, strength: 1, rng: h.stream('c4', 'rules', 0, 'lowtide.rockpool') });
  assert.equal(poolRules.freeCells, 5);
  assert.equal(poolRules.cellLimits[4]?.maxRank, 5);
  const poolL2 = baseRules();
  CHARMS['lowtide.rockpool'].rules(poolL2, { level: 2, strength: 1, rng: h.stream('c4', 'rules', 0, 'lowtide.rockpool') });
  assert.equal(poolL2.cellLimits[4]?.maxRank, 7);

  // lowtide.starfish coins
  const chainHist = [];
  for (let i = 0; i < 6; i++) chainHist.push({ t: 'F', card: cardId(0, i + 1) });
  const starFx = new BoardEffects([{ id: 'lowtide.starfish', kind: 'boon', strength: 1, level: 1 }], {
    seed: 'c4', boardIndex: 0, api: {}, memo: {}, run: null,
  });
  const starSb = scoreBoard(chainHist, 60, starFx, { initial: fakeBoard().initial });
  assert.equal(starSb.coinLines.find((l) => l.key === 'starfish')?.coins, 3);
  const lateChain = scoreBoard(chainHist, 60, starFx, {
    initial: { ...fakeBoard().initial, found: [10, 10, 10, 9] },
  });
  assert(!lateChain.coinLines.find((l) => l.key === 'starfish'), 'starfish: no pay after 39 homes');

  // theater.encore challengeStrength
  const encore = CHARMS['theater.encore'];
  const encCtx = charmContext({ id: 'theater.encore', kind: 'boon', strength: 3, level: 1 }, {
    seed: 'c4', boardIndex: 2, run: { results: [{ stars: 1 }, { stars: 3 }], boons: ['theater.encore'] },
  });
  encCtx.boardIndex = 2;
  assert.equal(encore.challengeStrength(5, encCtx), 4);
  const encMiss = charmContext({ id: 'theater.encore', kind: 'boon', strength: 3, level: 1 }, {
    seed: 'c4', boardIndex: 2, run: { results: [{ stars: 2 }], boons: ['theater.encore'] },
  });
  encMiss.boardIndex = 2;
  assert.equal(encore.challengeStrength(5, encMiss), 5);

  // theater.curtain grantUse
  const g = fakeBoard().game;
  const curtainMemo = {};
  const curtainApi = stubAPI(g);
  const curtainFx = new BoardEffects(
    [{ id: 'theater.curtain', kind: 'boon', strength: 1, level: 1 }, { id: 'lapis.horus', kind: 'boon', strength: 1, level: 1 }],
    { seed: 'c4', boardIndex: 0, api: curtainApi, memo: curtainMemo, run: { boons: ['theater.curtain', 'lapis.horus'] } },
  );
  curtainFx.setup({ state: clone(g.state), initial: clone(g.initial) });
  const before = curtainFx.abilityState('lapis.horus').uses;
  curtainFx.emit('ability', { id: 'lapis.horus' });
  assert.equal(curtainFx.abilityState('lapis.horus').uses, before + 1);

  // forge.ingot
  const king = cardId(3, 13);
  const ingotFx = new BoardEffects([{ id: 'forge.ingot', kind: 'boon', strength: 1, level: 1 }], {
    seed: 'c4', boardIndex: 0, api: {}, memo: {}, run: null,
  });
  const ingotInitial = clone(fakeBoard().initial);
  ingotInitial.found = [0, 0, 0, 0];
  const ingotSb = {
    history: [{ t: 'F', card: king, src: { kind: 'col', i: 0 } }],
    initial: ingotInitial,
    initialRules: baseRules(),
    lines: [],
    mults: [],
    add() {},
    scale() {},
    mult() {},
    addCoins(k, l, n) { this.coinLines = this.coinLines || []; this.coinLines.push({ key: k, label: l, coins: n }); },
  };
  CHARMS['forge.ingot'].score(ingotSb, { level: 1 });
  assert.equal(ingotSb.coinLines.find((l) => l.key === 'ingot')?.coins, 2);

  // forge.bellows rulesAfter
  const bellowsRules = { cellThaw: { frozen: 1, at: [30] }, cellClose: { at: [40] } };
  CHARMS['forge.bellows'].rulesAfter(bellowsRules, { level: 1 });
  assert.equal(bellowsRules.cellThaw.at[0], 20);
  assert.equal(bellowsRules.cellClose.at[0], 50);

  // forge.anvil L2 suitRunFree
  const anvil = baseRules();
  CHARMS['forge.anvil'].rules(anvil, { level: 2 });
  assert(anvil.suitRunFree & (1 << 3));

  // saloon.wanted (negative: home with no uncover step in history)
  const wantedId = cardId(1, 5);
  const wantedFx = new BoardEffects([{ id: 'saloon.wanted', kind: 'boon', strength: 1, level: 1 }], {
    seed: 'c4', boardIndex: 0, api: {}, memo: { 'saloon.wanted': { wanted: wantedId } }, run: null,
  });
  const wantedSb = {
    history: [{ t: 'F', card: wantedId, src: { kind: 'col', i: 0 } }],
    initial: fakeBoard().initial,
    initialRules: baseRules(),
    lines: [],
    mults: [],
    add() {},
    scale() {},
    mult() {},
    addCoins(k, l, n) { this.coinLines = this.coinLines || []; this.coinLines.push({ key: k, label: l, coins: n }); },
  };
  CHARMS['saloon.wanted'].score(wantedSb, { level: 1, memo: { wanted: wantedId } });
  assert(!wantedSb.coinLines?.find((l) => l.key === 'wanted'), 'wanted: no pay without uncover window');

  // saloon.tab onUpgrade
  const tabRun = { undos: 2, charmMemo: { 'saloon.tab': { debt: 3 } } };
  CHARMS['saloon.tab'].onUpgrade(tabRun, { runMemo: tabRun.charmMemo['saloon.tab'] });
  assert.equal(tabRun.charmMemo['saloon.tab'].debt, 0);

  // lapis.ankh
  const ankhGame = fakeBoard().game;
  const ankhApi = stubAPI(ankhGame);
  const ankhFx = new BoardEffects([{ id: 'lapis.ankh', kind: 'boon', strength: 1, level: 1 }], {
    seed: 'c4', boardIndex: 0, api: ankhApi, memo: {}, run: null,
  });
  const ankhCard = cardId(0, 13);
  ankhGame.state.found = [12, 0, 0, 0];
  ankhGame.state.tableau[0] = [ankhCard];
  ankhGame.applyDescriptor({ t: 'F', card: ankhCard, src: { kind: 'col', i: 0 } });
  ankhFx.emit('foundation', { card: ankhCard });
  assert(ankhApi.calls.some(([n]) => n === 'addUndos'));

  // lapis.canopic
  const canRules = baseRules();
  CHARMS['lapis.canopic'].rules(canRules, { level: 2 });
  assert(canRules.cellExitWild && canRules.moveBonus === 1);

  // deepsea.openwater shallowCols
  const mist = baseRules();
  CHARMS['deepsea.openwater'].rules(mist, { level: 2 });
  assert.equal(mist.shallowCols, 2);

  // deepsea.lamprey
  const leechFx = new BoardEffects([{ id: 'deepsea.challenge', kind: 'challenge', strength: 4 }], {
    seed: 'c4', boardIndex: 0, api: {}, memo: {}, run: null,
  });
  const leechSb = scoreBoard([], 60, leechFx, { undosUsed: 2 });
  assert.equal(leechSb.coinLines.find((l) => l.key === 'lamprey')?.coins, -4);

  // diner.blueplate
  const rank = 7;
  const plateCards = [0, 1, 2, 3].map((s) => cardId(s, rank));
  const plateFx = new BoardEffects([{ id: 'diner.blueplate', kind: 'boon', strength: 1, level: 1 }], {
    seed: 'c4', boardIndex: 0, api: {}, memo: { 'diner.blueplate': { rank } }, run: null,
  });
  const plateHist = plateCards.map((c) => ({ t: 'F', card: c, src: { kind: 'col', i: 0 } }));
  const plateSb = scoreBoard(plateHist, 60, plateFx, { initial: fakeBoard().initial });
  assert.equal(plateSb.coinLines.find((l) => l.key === 'blueplate')?.coins, 12);
  const plateFail = scoreBoard(plateHist, 60, plateFx, {
    initial: { ...fakeBoard().initial, found: [27, 0, 0, 0] },
  });
  assert(!plateFail.coinLines.find((l) => l.key === 'blueplate'));

  // diner.tipjar onPort
  const tipRun = { results: [{}, {}, {}], coins: 0, seed: 'c4' };
  const tipCtx = charmContext({ id: 'diner.tipjar', kind: 'boon', level: 1 }, { seed: 'c4', boardIndex: 2, run: tipRun });
  tipCtx.api.addCoins = (n) => { tipRun.coins += n; };
  CHARMS['diner.tipjar'].onPort(tipRun, tipCtx);
  assert.equal(tipRun.coins, 6);

  // diner.plate stack
  const dinerRules = baseRules();
  CHARMS['diner.challenge'].rules(dinerRules, { strength: 6 });
  assert.equal(dinerRules.cellStack, 4);

  // cove.treasure + cursed
  const treas = cardId(2, 3);
  const treasFx = new BoardEffects([{ id: 'cove.treasure', kind: 'boon', strength: 1, level: 1 }], {
    seed: 'c4', boardIndex: 0, api: {}, memo: { 'cove.treasure': { treasure: [treas] } }, run: null,
  });
  const treasSb = scoreBoard([{ t: 'F', card: treas, src: { kind: 'col', i: 0 } }], 60, treasFx, { initial: fakeBoard().initial });
  assert.equal(treasSb.coinLines.find((l) => l.key === 'treasure')?.coins, 15);

  const curseCard = cardId(0, 4);
  const curseFx = new BoardEffects([{ id: 'cove.challenge', kind: 'challenge', strength: 1 }], {
    seed: 'c4', boardIndex: 0, api: {}, memo: { 'cove.challenge': { cursed: [curseCard] } }, run: null,
  });
  const curseSb = scoreBoard([{ t: 'C', fi: 0, card: curseCard, src: { kind: 'col', i: 0 } }], 60, curseFx, { initial: fakeBoard().initial });
  assert.equal(curseSb.coinLines.find((l) => l.key === 'curse')?.coins, -2);

  // cove.parrot grantUse
  const parrotGame = fakeBoard().game;
  const parrotApi = stubAPI(parrotGame);
  const parrotMemo = { 'cove.parrot': { lastAbility: 'lapis.horus' } };
  const parrotFx = new BoardEffects(
    [{ id: 'cove.parrot', kind: 'boon', strength: 1, level: 1 }, { id: 'lapis.horus', kind: 'boon', strength: 1, level: 1 }],
    { seed: 'c4', boardIndex: 0, api: parrotApi, memo: parrotMemo, run: null },
  );
  parrotFx.setup({ state: clone(parrotGame.state), initial: clone(parrotGame.initial) });
  const parrotBefore = parrotFx.abilityState('lapis.horus').uses;
  await parrotFx.useAbility('cove.parrot');
  assert.equal(parrotFx.abilityState('lapis.horus').uses, parrotBefore + 1);

  assert(CHARMS['lowtide.rockpool'].family === 'cells');
  assert(CHARMS['deepsea.sonar'].ability);
  assert.equal(chainsOf(chainHist).length, 1);
}
