import { fixture } from './cyber.ghost.mjs';

export async function check(h) {
  const { assert, Rules, clone } = h;
  const id = 'library.bookmark';
  for (const deal of [1, 2, 617, 11982]) {
    const f = fixture(h, id, deal);
    f.run.undos = 0; assert(!f.effects.hasAvailableAbility(), 'an unaffordable rewind cannot rescue a stuck board');
    f.run.undos = 8;
    const play = () => { const m = Rules.generateMoves(f.game.state, { rules: f.game.rules })[0]; assert(m); f.emit(f.game.applyDescriptor(m)); };
    play();
    const before = clone(f.game.state);
    assert(f.effects.hasAvailableAbility());
    assert.equal(await f.effects.useAbility(id), false, 'setting keeps the rewind use');
    assert.equal(f.effects.abilityState(id).uses, 1);
    assert(!f.effects.hasAvailableAbility(), 'nothing to rewind at the marker');
    f.resume();
    play(); play(); play();
    f.resume();
    f.run.undos = 0; assert(!f.effects.hasAvailableAbility());
    assert.equal(await f.effects.useAbility(id), false);
    f.run.undos = 8;
    assert(f.effects.hasAvailableAbility());
    assert(await f.effects.useAbility(id));
    assert.deepEqual(f.game.state, before);
    assert.equal(f.game.history.length, 2);
    assert.equal(f.run.undos, 7);
    assert.equal(f.effects.abilityState(id).uses, 0);
    assert(!f.effects.hasAvailableAbility());
    f.resume();
    f.undo(); assert.equal(f.memo[id].anchor, null);
    assert.equal(f.effects.abilityState(id).uses, 1, 'undoing the marker refunds the ability');
    f.undo(); assert.deepEqual(f.game.state, f.initial);
    await f.effects.useAbility(id); play();
    f.undo(); f.undo(); assert.equal(f.memo[id].anchor, null, 'undo past an armed marker clears it');
    assert.equal(f.effects.abilityState(id).uses, 1);
    const initial = clone(f.game.state);
    assert.throws(() => f.game.applyCharmMove({ t: 'X', op: id, token: -1 })); assert.deepEqual(f.game.state, initial);
  }
}
