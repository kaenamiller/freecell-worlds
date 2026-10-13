import { fixture } from './cyber.ghost.mjs';

export async function check(h) {
  const { assert, Rules, clone, kit } = h;
  const id = 'bloodmoon.seal';
  for (const deal of [1, 2, 617, 11982]) for (const mode of ['unseal', 'thaw', 'uncover', 'undo']) {
    const rules = mode === 'unseal' ? { sealedCols: [0, 3] } : mode === 'thaw' ? { cellThaw: { frozen: 2, at: [8, 20] } } : {};
    const f = fixture(h, id, deal, rules, [null, mode === 'thaw' ? 2 : 0]);
    if (mode === 'uncover') f.effects.ctxs[0].api.conceal(f.game.tableau[0].slice(0, -1));
    const hidden = f.effects.ctxs[0].api.concealed;
    if (mode !== 'undo') { assert.equal(await f.effects.useAbility(id), false); assert.equal(f.effects.abilityState(id).uses, 1); }
    assert(await f.effects.useAbility(id));
    assert.equal(f.game.history.at(-1).action, mode);
    assert(!f.effects.hasAvailableAbility());
    if (mode === 'unseal') { assert.equal(f.game.state.sealed, 8); assert.deepEqual(f.game.rules.sealedCols, [3]); }
    if (mode === 'thaw') assert.equal(Rules.activeFreeCells(f.game.state, f.game.rules), 3);
    if (mode === 'uncover') assert.equal(f.effects.ctxs[0].api.concealed.length, 0);
    if (mode === 'undo') assert.equal(f.run.undos, 9);
    const resumed = f.resume();
    assert.deepEqual(kit.replay({ initial: f.initial, initialRules: f.rules, history: f.game.history }, () => {}), f.game.state);
    Rules.generateMoves(f.game.state, { rules: f.game.rules });
    Rules.solve(f.game.state, { rules: f.game.rules, timeLimitMs: 10, nodeLimit: 1000 });
    resumed.undo(); assert.deepEqual(resumed.state, f.initial); assert.deepEqual(resumed.rules, f.rules);
    f.undo(); assert.deepEqual(f.game.state, f.initial); assert.deepEqual(f.game.rules, f.rules);
    assert.equal(f.effects.abilityState(id).uses, 1);
    if (mode === 'uncover') assert.deepEqual(f.effects.ctxs[0].api.concealed, hidden);
    if (mode === 'undo') assert.equal(f.run.undos, 7, 'undo removes the grant as well as spending one run undo');
  }
  const f = fixture(h, id);
  for (const data of [{ action: 'unseal', col: 0 }, { action: 'unseal', col: -1 }, { action: 'thaw', fi: 0 }, { action: 'uncover', col: 0, hidden: [] }, { action: 'uncover', col: 0, hidden: [f.game.tableau[1][0]] }, { action: 'other' }]) {
    const before = clone(f.game.state); assert.throws(() => f.game.applyCharmMove({ t: 'X', op: id, ...data })); assert.deepEqual(f.game.state, before);
  }
  const thawed = fixture(h, id, 1, { startHome: 1, cellThaw: { frozen: 2, at: [1, 3] } });
  assert.throws(() => thawed.game.applyCharmMove({ t: 'X', op: id, action: 'thaw', fi: 4 }));
}
