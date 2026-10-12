import { targeted } from './_s2.mjs';
export async function check(h) {
  await targeted(h, 'museum.digsite', () => [0], (g) => [
    {col:-1,card:1},{col:99,card:1},{col:0,card:999},{col:0,card:g.tableau[0][0],concealed:[g.tableau[0][0]]},
  ]);
  const { assert, Rules, BoardEffects, stubAPI } = h;
  const g = new Rules.Game(1), fx = new BoardEffects([{id:'museum.digsite',kind:'boon',strength:1}], {seed:'s2',api:stubAPI(g)});
  fx.setup({state:g.initial}); fx.ctxs[0].api.conceal(g.tableau.map((c)=>c[0]));
  assert.equal(fx.hasAvailableAbility(),false,'concealed bottom cards are not targets');
  fx.ctxs[0].api.reveal([g.tableau[0][0]]); assert(fx.hasAvailableAbility());
  const tops = g.tableau.map((c)=>c.at(-1));
  g.state.tableau = tops.map((card)=>[card]);
  assert.equal(fx.hasAvailableAbility(),false,'lifting a sole card would be a no-op');
  assert.throws(()=>g.applyCharmMove({t:'X',op:'museum.digsite',col:0,card:tops[0]}));
}
