// v2 checks for C6 themes: safetypin, honeyhouse, moth, cutpaper, broadcast, sewing, risograph, runes.
import { composeBoard, applyDealRules } from '../../js/voyage/boardrules.js';

export async function check(h) {
  const {
    assert, CHARMS, baseRules, clampRules, scoreBoard, kit, stream, BoardEffects, fakeBoard, stubAPI,
  } = h;

  const rulesOf = (id, strength, level = 1, boons = [id]) => {
    const r = baseRules();
    CHARMS[id].rules?.(r, {
      strength,
      level,
      boons,
      stickers: {},
      family: (name) => boons.filter((b) => CHARMS[b]?.family === name).length,
      rng: stream('v2-c6', 'rules', strength, id),
      seed: 'v2-c6',
      idx: strength - 1,
      runMemo: {},
    });
    return clampRules(r);
  };

  // threechords: override on ability
  const chordsFx = new BoardEffects(
    [{ id: 'safetypin.threechords', kind: 'boon', strength: 1, level: 1 }],
    { seed: 'v2-c6', boardIndex: 0, api: stubAPI(new h.Rules.Game(1)), memo: {}, run: { status: 'board', boons: ['safetypin.threechords'], charmMemo: {}, results: [], undos: 0, coins: 0 } },
  );
  chordsFx.emit('ability', { id: 'dev.preview' });
  assert(chordsFx.ctxs[0].memo.pendingOverride?.ignoreColour, 'threechords arms colour override');

  // forager: coins only when foundations are tight
  const blank = { found: [0, 0, 0, 0], tableau: [[], [], [], [], [], [], [], []], free: [0, 0, 0, 0] };
  const deal = new h.Rules.Game(1);
  const initial = h.clone(deal.state);
  initial.tableau[0] = [1, 14, 27, 40];
  const sbTight = scoreBoard([
    { t: 'F', card: 1, src: { kind: 'col', i: 0 } },
    { t: 'F', card: 14, src: { kind: 'col', i: 0 } },
    { t: 'F', card: 27, src: { kind: 'col', i: 0 } },
    { t: 'F', card: 40, src: { kind: 'col', i: 0 } },
  ], 60, null, { boardIdx: 0, initial, initialRules: baseRules() });
  CHARMS['honeyhouse.forager'].score(sbTight, { level: 1, strength: 1, memo: {} });
  assert.equal(sbTight.coinTotal, 4, 'forager pays per tight home');
  const initialLoose = h.clone(blank);
  initialLoose.found = [4, 0, 0, 0];
  initialLoose.tableau[0] = [14];
  const sbLoose = scoreBoard([
    { t: 'F', card: 14, src: { kind: 'col', i: 0 } },
  ], 60, null, { boardIdx: 0, initial: initialLoose, initialRules: baseRules() });
  CHARMS['honeyhouse.forager'].score(sbLoose, { level: 1, strength: 1, memo: {} });
  assert.equal(sbLoose.coinTotal, 0, 'forager pays nothing when foundations spread');

  assert.equal(rulesOf('honeyhouse.nectar', 1).freeCells, 5);
  assert.equal(rulesOf('honeyhouse.nectar', 1, 2).cellLimits[4]?.suits, kit.suitMask(1, 2));

  assert.equal(rulesOf('moth.waltz', 1).twinStack, 1);
  assert.equal(rulesOf('moth.waltz', 1, 2).twinStack, 2);

  assert.equal(CHARMS['moth.silver'].price({ kind: 'sell' }, 20, { level: 1 }), 40);
  assert.equal(CHARMS['moth.silver'].price({ kind: 'sell' }, 20, { level: 2 }), 55);

  const musicInitial = h.clone(blank);
  musicInitial.tableau[0] = [1, 2, 3, 4, 5, 6];
  const music = scoreBoard(
    [1, 2, 3, 4, 5, 6].map((card) => ({ t: 'F', card, src: { kind: 'col', i: 0 } })),
    60,
    null,
    { boardIdx: 0, initial: musicInitial, initialRules: baseRules() },
  );
  CHARMS['cutpaper.musicbox'].score(music, { level: 1, strength: 1, memo: { wager: true } });
  assert(music.coinLines.some((l) => l.key === 'musicbox-win'), 'musicbox pays on six-chain with room');
  const musicFail = scoreBoard(
    [{ t: 'F', card: 1, src: { kind: 'col', i: 0 } }, { t: 'M' }],
    60,
    null,
    { boardIdx: 0, initial: h.clone(musicInitial), initialRules: baseRules() },
  );
  CHARMS['cutpaper.musicbox'].score(musicFail, { level: 1, strength: 1, memo: { wager: true } });
  assert(!musicFail.coinLines.some((l) => l.key === 'musicbox-win'), 'musicbox fails without chain');

  assert.equal(CHARMS['broadcast.tuning'].lookahead(2, { level: 1 }), 3);
  assert.equal(CHARMS['broadcast.tuning'].lookahead(2, { level: 2 }), 4);
  assert.equal(rulesOf('broadcast.challenge', 1).emptyFactor, 1);
  assert.equal(rulesOf('broadcast.challenge', 1).phase?.rules?.emptyFactor, 3);

  assert.equal(rulesOf('sewing.thread', 1).suitRunFree, 15);
  assert.equal(rulesOf('sewing.thread', 1).moveBonus, 1);
  assert.equal(rulesOf('sewing.thread', 1, 2, ['sewing.thread', 'forest.moss', 'forge.anvil']).moveBonus, 6);
  assert.equal(rulesOf('sewing.thread', 1, 2).suitBuild, 0);

  const edition = CHARMS['risograph.edition'].coins(100, { level: 1, family: () => 2 });
  assert.equal(edition, 120, 'edition scales with coin family');

  const keelPlan = { ...composeBoard({ challenge: 'runes.challenge', strength: 3, seed: 'v2-c6', idx: 2 }), seed: 'v2-c6', idx: 2 };
  const keelRules = applyDealRules(keelPlan.rules, keelPlan, 1);
  assert(keelRules.noCellCards?.length >= 2, 'keel stones block deepest cards');
  const fixture = fakeBoard(keelRules);
  const api = stubAPI(fixture.game);
  const effects = new BoardEffects([{ id: 'runes.challenge', kind: 'challenge', strength: 3 }], {
    seed: 'v2-c6', boardIndex: 2, api, memo: {}, run: { boons: [], charmMemo: {}, results: [], undos: 0, coins: 0 },
  });
  effects.setup(fixture.board);
  assert(keelRules.noCellCards.every((id) => api.marks[id] === 'lock'), 'keel stones mark locked cards');

  for (const id of [
    'safetypin.threechords', 'safetypin.safetypin', 'safetypin.zine',
    'honeyhouse.forager', 'honeyhouse.nectar', 'honeyhouse.royaljelly',
    'moth.lampglow', 'moth.waltz', 'moth.silver',
    'cutpaper.musicbox', 'cutpaper.crown',
    'broadcast.tuning', 'broadcast.bars', 'broadcast.signoff',
    'sewing.thread', 'sewing.pincushion', 'sewing.ribbon',
    'risograph.misprint', 'risograph.ultramarine', 'risograph.edition',
    'runes.amber', 'runes.keel', 'runes.woad',
  ]) {
    assert(!CHARMS[id].placeholder, `${id} is implemented`);
    assert(CHARMS[id].family, `${id} has family`);
    assert(CHARMS[id].upgrade, `${id} has upgrade`);
  }
}
