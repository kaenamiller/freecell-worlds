// Sonar: level 1 reports how far back the last winnable position was; level 2 rewinds there
// without spending undos. Only a found wrong turn spends the charge.
export async function check(h) {
  const { assert, Rules, BoardEffects, baseRules, clone, stubAPI } = h;
  const id = 'deepsea.sonar';
  const board = (level, ping) => {
    const game = new Rules.Game(617, { rules: baseRules() });
    const initial = clone(game.state);
    const api = stubAPI(game);
    const rewinds = [];
    api.sonar = async () => ping;
    api.rewind = (n, { free = false } = {}) => { rewinds.push({ n, free }); while (n--) game.undo(); return true; };
    const effects = new BoardEffects([{ id, kind: 'boon', strength: 1, level }], { seed: 'sonar', boardIndex: 0, api, memo: {} });
    effects.setup({ state: clone(initial), initial, deal: 617 });
    const play = () => game.applyDescriptor(Rules.generateMoves(game.state, { rules: game.rules })[0]);
    const notes = () => api.calls.filter(([name]) => name === 'notify').map(([, text]) => text);
    return { game, effects, rewinds, play, notes };
  };

  const fresh = board(1, { steps: 2, entries: 2 });
  assert(!fresh.effects.abilityState(id).available, 'nothing to sound before the first move');

  for (const [ping, text] of [[{ steps: 0, entries: 0 }, 'clear water'], [{ steps: null }, 'no open water'], [null, 'signal lost']]) {
    for (const level of [1, 2]) {
      const b = board(level, ping);
      b.play();
      assert.equal(await b.effects.useAbility(id), false, `${text} keeps the charge`);
      assert.equal(b.effects.abilityState(id).uses, 1);
      assert(b.notes().at(-1).includes(text));
      assert.equal(b.rewinds.length, 0);
    }
  }

  const report = board(1, { steps: 2, entries: 3 });
  for (let i = 0; i < 3; i++) report.play();
  assert(!report.effects.hasAvailableAbility('warn'), 'level 1 never holds the dead-end warning');
  assert(!report.effects.hasAvailableAbility(), 'level 1 cannot save a dead end');
  assert(await report.effects.useAbility(id));
  assert.equal(report.game.history.length, 3, 'level 1 only reports');
  assert.equal(report.notes().at(-1), 'Sonar: last open water 2 moves back');
  assert.equal(report.effects.abilityState(id).uses, 0);

  const pull = board(2, { steps: 1, entries: 2 });
  for (let i = 0; i < 3; i++) pull.play();
  assert(!pull.effects.hasAvailableAbility('warn'), 'level 2 lets the dead-end warning show');
  assert(pull.effects.hasAvailableAbility(), 'level 2 keeps a dead-end run alive');
  assert(await pull.effects.useAbility(id));
  assert.deepEqual(pull.rewinds, [{ n: 2, free: true }]);
  assert.equal(pull.game.history.length, 1);
  assert.equal(pull.notes().at(-1), 'Sonar: pulled back 1 move to open water');
  assert(!pull.effects.hasAvailableAbility());
}
