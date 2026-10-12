import { targeted } from './_s2.mjs';
export async function check(h) {
  await targeted(h, 'lowtide.tidepool', (g) => { g.moveToFreeCell({kind:'col',i:0},0); return [0,1]; }, (g) => [
    {fi:1,col:0,card:1},{fi:0,col:99,card:g.free[0]},{fi:0,col:0,card:999},{fi:-1,col:0,card:1},
  ]);
  const { assert, Rules, BoardEffects, stubAPI } = h;
  const g = new Rules.Game(1), before = h.clone(g.state);
  const fx = new BoardEffects([{id:'lowtide.tidepool',kind:'boon',strength:1}],{seed:'s2',api:stubAPI(g)}); fx.setup({state:g.initial});
  assert.equal(fx.hasAvailableAbility(),false);
  // Empty destination is allowed, even with an empty-column rank restriction.
  g.state.tableau[1].push(...g.state.tableau[0]); g.state.tableau[0] = [];
  g.moveToFreeCell({kind:'col',i:1},0); g.rules.emptyMinRank = 13;
  const old = h.clone(g.state), card = g.free[0];
  g.applyCharmMove({t:'X',op:'lowtide.tidepool',fi:0,col:0,card}); assert.deepEqual(g.tableau[0],[card]);
  g.undo(); assert.deepEqual(g.state,old);
  assert.equal(before.tableau.flat().length,52);
}
