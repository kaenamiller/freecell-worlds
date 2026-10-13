// Focused checks for C4 theme content (library, conservatory, nighttrain, saffron, harvest).
export async function check(h) {
  const { assert, CHARMS, scoreBoard, BoardEffects, kit, baseRules, fakeBoard } = h;
  // Spice Blend now pays coins; its v2 behaviour is covered by v2-c3.mjs.
  const wind = CHARMS['harvest.challenge'];
  const wfx = new BoardEffects([{ id: 'harvest.challenge', kind: 'challenge', strength: 3 }], { seed: 'c4', boardIndex: 2, api: {}, memo: {}, run: null });
  const soloHist = [{ t: 'F', card: 1 }, { t: 'C', fi: 0, card: 2 }, { t: 'F', card: 14 }];
  const wsb = scoreBoard(soloHist, 60, wfx, { initial: null, rules: baseRules() });
  const tax = wsb.lines.find((l) => l.key === 'windfall')?.pts;
  assert.equal(tax, -10, 'Windfall Tax charges solo homes at strength 3');
  assert.equal(kit.chainsOf(soloHist).filter((c) => c.length === 1).length, 2);
}
