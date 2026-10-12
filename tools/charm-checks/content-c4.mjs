// Focused checks for C4 theme content (library, conservatory, nighttrain, saffron, harvest).
export async function check(h) {
  const { assert, CHARMS, scoreBoard, BoardEffects, kit, baseRules, fakeBoard } = h;
  const { initial } = fakeBoard();
  const history = [
    { t: 'F', card: 1, src: { kind: 'col', i: 0 } },
    { t: 'F', card: 14, src: { kind: 'col', i: 1 } },
    { t: 'F', card: 27, src: { kind: 'col', i: 2 } },
    { t: 'F', card: 40, src: { kind: 'col', i: 3 } },
  ];
  const effects = new BoardEffects([{ id: 'saffron.spice', kind: 'boon', strength: 1 }], { seed: 'c4', boardIndex: 0, api: {}, memo: {}, run: null });
  const sb = scoreBoard(history, 60, effects, { initial, rules: baseRules() });
  assert.equal(sb.lines.find((l) => l.key === 'spice')?.pts, 30, 'Spice Blend pays when all suits reach rank 1');

  const wind = CHARMS['harvest.challenge'];
  const wfx = new BoardEffects([{ id: 'harvest.challenge', kind: 'challenge', strength: 3 }], { seed: 'c4', boardIndex: 2, api: {}, memo: {}, run: null });
  const soloHist = [{ t: 'F', card: 1 }, { t: 'C', fi: 0, card: 2 }, { t: 'F', card: 14 }];
  const wsb = scoreBoard(soloHist, 60, wfx, { initial: null, rules: baseRules() });
  const tax = wsb.lines.find((l) => l.key === 'windfall')?.pts;
  assert.equal(tax, -10, 'Windfall Tax charges solo homes at strength 3');
  assert.equal(kit.chainsOf(soloHist).filter((c) => c.length === 1).length, 2);
}
