import { targeted } from './_s2.mjs';
export async function check(h) {
  await targeted(h, 'carvings.raven', () => [0, 1], () => [{a:0,b:0},{a:-1,b:1},{a:0,b:99},{a:0.5,b:1}]);
  const { assert, Rules, BoardEffects, stubAPI, baseRules } = h;
  const g = new Rules.Game(1, { rules:baseRules() });
  g.state.tableau = [g.tableau.flat(),[],[],[],[],[],[],[]];
  const fx = new BoardEffects([{id:'carvings.raven',kind:'boon',strength:1}], {seed:'s2',api:stubAPI(g)}); fx.setup({state:g.initial});
  assert.equal(fx.hasAvailableAbility(),false);
  assert.throws(()=>g.applyCharmMove({t:'X',op:'carvings.raven',a:0,b:1}));
  // Cancellation on the second pick also preserves the use and board.
  const g2 = new Rules.Game(1), before = h.clone(g2.state);
  const f2 = new BoardEffects(fx.active,{seed:'s2',api:stubAPI(g2,{picks:[0,null]})}); f2.setup({state:g2.initial});
  assert.equal(await f2.useAbility('carvings.raven'),false); assert.deepEqual(g2.state,before); assert.equal(f2.abilityState('carvings.raven').uses,1);
}
