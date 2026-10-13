// Card overlays for rules that single out ranks, suits, or cards.
import { stream } from '../../js/voyage/rng.js';

export async function check({ assert, CHARMS, baseRules, BoardEffects, fakeBoard, stubAPI, kit, Rules }) {
  const run = (id, strength) => {
    const rules = baseRules();
    CHARMS[id].rules?.(rules, { id, strength, level: 1, rng: stream('marks', 'rules', 0, id), seed: 'marks', idx: 0, runMemo: {} });
    const fixture = fakeBoard(rules);
    const api = stubAPI(fixture.game);
    new BoardEffects([{ id, kind: CHARMS[id].kind, strength }], {
      seed: 'marks', boardIndex: 0, api, memo: {},
      run: { undos: 0, results: [], boons: [], charmMemo: {} },
    }).setup(fixture.board);
    return { rules, marks: api.marks };
  };

  const ids = (marks) => Object.keys(marks).map(Number);
  const only = (marks, style) => assert.deepEqual([...new Set(Object.values(marks))], [style]);

  // v2: Prize Lights' challenge is Full House (no marks); Cracked Tiles marks its barren cards.
  const cracked = run('azulejo.challenge', 1);
  assert.equal(ids(cracked.marks).length, 2, 'cracked tiles marks 1 + s cards');
  only(cracked.marks, 'crack');
  assert.deepEqual(ids(cracked.marks).sort((a, b) => a - b), [...cracked.rules.barrenCards].sort((a, b) => a - b));

  const puzzle = run('prizelights.puzzle', 1);
  const puzzleIds = ids(puzzle.marks);
  assert.equal(puzzleIds.length, 4, "today's puzzle marks its wild rank");
  only(puzzle.marks, 'wild');
  assert.deepEqual([...new Set(puzzleIds.map(kit.rankOf))], kit.ranksIn(puzzle.rules.wildRanks));

  const tower = run('toybox.challenge', 1);
  assert.equal(ids(tower.marks).length, 1, 'tipped tower marks one six');
  only(tower.marks, 'bar');

  const storm = run('signal.challenge', 1);
  assert.equal(ids(storm.marks).length, 2, 'magnetic storm marks the red kings');
  assert.ok(ids(storm.marks).every((id) => kit.rankOf(id) === 13 && kit.suitOf(id) !== 0 && kit.suitOf(id) !== 3));

  const barn = run('lowtide.challenge', 7);
  assert.equal(ids(barn.marks).length, 4, 'barnacles marks every king');
  assert.ok(ids(barn.marks).every((id) => kit.rankOf(id) === 13 && barn.marks[id] === 'bar'));

  const booth = run('carnival.challenge', 1);
  assert.equal(ids(booth.marks).length, 2, 'rigged booth marks queen and king of one suit');
  only(booth.marks, 'lock');

  const senate = run('roman.challenge', 1);
  assert.equal(ids(senate.marks).length, 4, 'senate marks the kings');
  assert.ok(ids(senate.marks).every((id) => kit.rankOf(id) === 13));

  const plate = run('diner.blueplate', 1);
  assert.equal(ids(plate.marks).length, 4);
  only(plate.marks, 'star');

  const rooted = run('conservatory.challenge', 1);
  assert.equal(ids(rooted.marks).length, 4, 'root bound marks the twos');
  assert.ok(ids(rooted.marks).every((id) => kit.rankOf(id) === 2 && rooted.marks[id] === 'oneway'));

  const fixture = fakeBoard();
  const api = stubAPI(fixture.game);
  new BoardEffects([
    { id: 'forest.moss', kind: 'boon', strength: 1 },
    { id: 'forest.challenge', kind: 'challenge', strength: 1 },
  ], {
    seed: 'marks', boardIndex: 0, api, memo: {},
    run: { undos: 0, results: [], boons: [], charmMemo: {} },
  }).setup(fixture.board);
  assert.equal(api.marks[Rules.cardId(0, 13)], 'bar', 'bramble keeps the club king');
  assert.equal(api.marks[Rules.cardId(0, 1)], 'wild', 'moss still marks the club ace');
}
