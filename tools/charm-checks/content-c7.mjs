// C7 content: deepstorage, cafe, arctic, museum, mint
export async function check({ assert, CHARMS, baseRules, scoreBoard, kit, BoardEffects, fakeBoard, stubAPI, clampRules }) {
  const freeze = CHARMS['arctic.challenge'];
  const r4 = baseRules();
  freeze.rules(r4, { strength: 4, rng: () => 0, seed: 'c7', idx: 3, runMemo: {} });
  assert.deepEqual(clampRules(r4).cellThaw, { frozen: 1, at: [8] }, 'arctic.challenge s4 one frozen cell');
  const r5 = baseRules();
  freeze.rules(r5, { strength: 5, rng: () => 0, seed: 'c7', idx: 4, runMemo: {} });
  assert.equal(clampRules(r5).cellThaw.frozen, 2, 'arctic.challenge s5 two frozen cells');

  const espresso = CHARMS['cafe.espresso'];
  const sb = scoreBoard([...Array(10)].map(() => ({ t: 'M' })), 60, null, { boardIdx: 0 });
  const baseEff = sb.lines.find((l) => l.key === 'efficiency').pts;
  espresso.score(sb);
  const waivedEff = sb.lines.find((l) => l.key === 'efficiency').pts;
  assert.ok(waivedEff > baseEff, 'cafe.espresso waives first five moves vs par');

  const regulars = CHARMS['cafe.regulars'];
  const sb2 = scoreBoard([], 60, null, { boardIdx: 2 });
  regulars.score(sb2, { run: { boardIdx: 2, results: [{ stars: 2 }, { stars: 2 }], boons: [], undos: 0 } });
  assert.equal(sb2.mults.find((m) => m.label === 'Regulars')?.x, 1.06, 'cafe.regulars two-board streak');

  const fragile = CHARMS['museum.challenge'];
  const fixture2 = fakeBoard();
  const card = fixture2.game.state.tableau[0].at(-1);
  const hist = [
    { t: 'T', src: { kind: 'col', i: 0 }, to: 1, count: 1, card },
    { t: 'T', src: { kind: 'col', i: 1 }, to: 2, count: 1, card },
  ];
  const sb3 = scoreBoard(hist, 60, null, { initial: fixture2.initial });
  fragile.score(sb3, { memo: { fragile: [card] } });
  assert.equal(sb3.lines.find((l) => l.key === 'fragile')?.pts, -25, 'museum.challenge second move penalty');

  const fixture = fakeBoard();
  const api = stubAPI(fixture.game);
  const effects = new BoardEffects([{ id: 'deepstorage.clearance', kind: 'boon', strength: 1 }], {
    seed: 'c7', boardIndex: 0, api, memo: {}, run: { undos: 1, results: [], boons: [], charmMemo: {} },
  });
  effects.setup(fixture.board);
  effects.emit('start', {});
  assert.ok(api.calls.some((c) => c[0] === 'addUndos'), 'deepstorage.clearance +1 undo when nothing was concealed');
}
