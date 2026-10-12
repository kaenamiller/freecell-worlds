import { targeted } from './_s2.mjs';
export async function check(h) {
  await targeted(h, 'space.tractor', (g) => [g.tableau[0][0], 0], (g) => [
    { col: 0, index: g.tableau[0].length - 1, card: g.tableau[0].at(-1), fi: 0 },
    { col: 0, index: -1, card: g.tableau[0][0], fi: 0 },
    { col: 0, index: 0, card: g.tableau[0][0], fi: 99 },
    { col: 0, index: 0, card: g.tableau[0][0], fi: 0, concealed: [g.tableau[0][0]] },
    { col: 0, index: 0, card: 999, fi: 0 },
  ]);
  const { assert, Rules, BoardEffects, baseRules, stubAPI } = h;
  for (const extra of [{ cellThaw: { frozen: 4, at: [8, 20, 30, 40] } }, { noCellRanks: 16382 }, { noCellCards: Array.from({length:52},(_,i)=>i+1) }]) {
    const game = new Rules.Game(1, { rules: { ...baseRules(), ...extra } });
    const fx = new BoardEffects([{id:'space.tractor',kind:'boon',strength:1}], { seed:'s2', api:stubAPI(game) });
    fx.setup({state:game.initial});
    assert.equal(fx.hasAvailableAbility(), false, 'no accepting cell means unavailable');
    assert.throws(() => game.applyCharmMove({t:'X',op:'space.tractor',col:0,index:0,card:game.tableau[0][0],fi:0}));
  }
  const game = new Rules.Game(1, { rules:baseRules() }), api = stubAPI(game);
  const fx = new BoardEffects([{id:'space.tractor',kind:'boon',strength:1}], {seed:'s2',api}); fx.setup({state:game.initial});
  fx.ctxs[0].api.conceal(game.tableau.flatMap((c)=>c.slice(0,-1)));
  assert.equal(fx.hasAvailableAbility(), false, 'concealed buried cards are not targets');
  fx.ctxs[0].api.reveal(game.tableau.flat()); assert(fx.hasAvailableAbility());
  game.rules.cellColors = ['red','black','red','black'];
  const card = game.tableau[0][0], fi = game.free.findIndex((_,i)=>Rules.cellAccepts(game.state,i,card,game.rules));
  assert(fi >= 0); const before = h.clone(game.state);
  game.applyCharmMove({t:'X',op:'space.tractor',col:0,index:0,card,fi}); game.undo(); assert.deepEqual(game.state,before);
  game.rules.cellColors = [];
  assert(game.moveToFreeCell({kind:'col',i:1},fi));
  const occupied = h.clone(game.state);
  assert.throws(()=>game.applyCharmMove({t:'X',op:'space.tractor',col:0,index:0,card,fi}));
  assert.deepEqual(game.state,occupied);
}
