import { fixture } from './cyber.ghost.mjs';

export async function check(h) {
  const { assert, Rules, clone, kit, BoardEffects, baseRules, stubAPI, CHARMS } = h;
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
  // Every harmful stamp can be targeted, including buried cards and free cells.
  // Beneficial stickers and tabs survive; replay/resume and undo restore the rules and art.
  for (const style of ['lock', 'bar', 'oneway', 'crack', 'hot', 'curse', 'fragile', 'fragile-used', 'crown', 'thorn', 'noexit']) {
    const f = fixture(h, id);
    const card = f.game.tableau[0][0];
    const other = f.game.tableau[1].at(-1);
    f.effects.ctxs[0].api.mark([card, other], style);
    // Cancel first, then cleanse the buried target.
    f.api.pick = async ({ filter }) => { assert(filter(card, f.game.state)); return null; };
    assert.equal(await f.effects.useAbility(id), false);
    assert.equal(f.effects.abilityState(id).uses, 1);
    f.api.pick = async ({ filter }) => { assert(filter(card, f.game.state)); return card; };
    assert(await f.effects.useAbility(id));
    assert.deepEqual(f.game.rules.cleansedCards, [card]);
    assert.equal(f.api.marks[card], undefined);
    assert.equal(f.api.marks[other], style);
    assert(!f.effects.ctxs[0].api.negativeCards.includes(card));
    assert.deepEqual(f.game.state, f.initial, 'cleansing never moves or reveals the card');
    f.resume();
    f.undo();
    assert.deepEqual(f.game.rules, f.rules);
    assert.equal(f.api.marks[card], style);
  }

  // Face-down cards can be cleansed via their column without revealing them.
  {
    const f = fixture(h, id);
    const card = f.game.tableau[2][0];
    f.effects.ctxs[0].api.mark([card], 'curse');
    f.effects.ctxs[0].api.conceal([card]);
    f.api.choose = async () => 'cleanse';
    f.api.pick = async ({ kind, filter, cards }) => {
      assert.equal(kind, 'column'); assert(filter(2, f.game.state));
      assert.deepEqual(cards(2, f.game.state), [card]); return 2;
    };
    assert(await f.effects.useAbility(id));
    assert.deepEqual(f.effects.ctxs[0].api.concealed, [card]);
    assert.equal(f.api.marks[card], undefined);
    f.undo(); assert.equal(f.api.marks[card], 'curse');
  }
  {
    const f = fixture(h, id), card = f.game.tableau[0].pop();
    f.game.free[0] = card;
    f.effects.ctxs[0].api.mark([card], 'oneway');
    f.api.pick = async ({ kind, filter }) => { assert.equal(kind, 'card'); assert(filter(card, f.game.state)); return card; };
    assert(await f.effects.useAbility(id));
    assert.equal(f.game.free[0], card);
    assert.equal(f.api.marks[card], undefined);
  }

  // Cleansing is per card, retains boons, and works in compiled/phase rules too.
  {
    const card = Rules.cardId(0, 12), redKing = Rules.cardId(1, 13), blackKing = Rules.cardId(3, 13);
    const rules = { ...baseRules(), noCellRanks: 1 << 12, oneWayCellRanks: 1 << 12,
      sameColorRanks: 1 << 12, barrenCards: [redKing], cleansedCards: [card, redKing],
      phase: { at: 0, rules: { noCellRanks: 1 << 12 } }, pinned: { cards: [card], until: 52 } };
    const st = { tableau: [[card], [redKing], [], [], [], [], [], []], free: [0, 0, 0, 0], found: [0, 0, 0, 0], sealed: 0 };
    assert(Rules.cellAccepts(st, 0, card, rules));
    assert(!Rules.isPinned(st, card, rules));
    assert(Rules.canBuildOn(redKing, card, rules));
    assert(!Rules.canBuildOn(blackKing, card, rules));
    assert(Rules.canStackOn([redKing], card, rules, { ignoreCap: true }, st));
    const blocked = { ...rules, cleansedCards: [] };
    assert(!Rules.cellAccepts(st, 0, card, blocked));
    assert(!Rules.canBuildOn(redKing, card, blocked));
    assert(Rules.canBuildOn(blackKing, card, blocked));
    st.tableau[0] = []; st.free[0] = card;
    assert(Rules.generateMoves(st, { rules }).some((m) => m.t === 'T' && m.card === card));
    assert(!Rules.generateMoves(st, { rules: blocked }).some((m) => m.t === 'T' && m.card === card));
    st.free[0] = 0; st.tableau[0] = [card];
    assert(Rules.cellAccepts(st, 0, card, { ...rules, noExitCols: 1, maxEmpty: 1 }));
  }

  // Real scoring challenges stop charging the cleansed card, while past charges stay.
  for (const challenge of ['cove.challenge', 'museum.challenge', 'forge.challenge']) {
    const game = new Rules.Game(1, { rules: baseRules() });
    const initial = clone(game.state), memo = {}, picks = [];
    const api = stubAPI(game, { picks });
    const active = [{ id: challenge, kind: 'challenge', strength: 1 }, { id, kind: 'boon', strength: 1 }, { id: 'voyage.stickers', kind: 'boon', strength: 1 }];
    const fx = new BoardEffects(active, { seed: 'seal-score', boardIndex: 0, api, memo });
    fx.setup({ state: clone(initial), initial });
    const card = fx.ctxs[1].api.negativeCards[0];
    assert(card, challenge);
    fx.ctxs[2].api.mark([card], 'sticker-wild');
    fx.ctxs[1].api.mark([card], 'mod-wild');
    picks.push(card);
    assert(await fx.useAbility(id));
    assert.equal(api.stickerMarks[card], 'sticker-wild');
    assert.equal(api.marks[card], 'mod-wild');
    const cleansed = clone(game.history[0]);
    const col = initial.tableau.findIndex((c) => c.includes(card));
    const row = initial.tableau[col].indexOf(card);
    // Expose the chosen card in the replay fixture without altering its identity.
    const start = clone(initial);
    start.tableau[col].splice(row, 1); start.tableau[0].push(card);
    const enter = { t: 'C', src: { kind: 'col', i: 0 }, fi: 0, card };
    const leave = { t: 'T', src: { kind: 'free', i: 0 }, count: 1, to: 0, card };
    const history = [cleansed, enter, leave, enter, leave];
    // Hot Iron's deadline would elapse without cleansing.
    for (let i = 0; i < 8; i++) history.push(clone(i % 2 ? leave : enter));
    const lines = [];
    CHARMS[challenge].score({ initial: start, initialRules: baseRules(), history, cardPenalty() {},
      add: (...args) => lines.push(args), addCoins: (...args) => lines.push(args) }, fx.ctxs[0]);
    assert.deepEqual(lines, [], challenge + ': no penalty after cleansing');
    const scoreHistory = (history) => {
      const entries = [];
      CHARMS[challenge].score({ initial: start, initialRules: baseRules(), history, cardPenalty() {},
        add: (...args) => entries.push(args), addCoins: (...args) => entries.push(args) }, fx.ctxs[0]);
      return entries;
    };
    const control = scoreHistory(history.slice(1));
    assert(control.length > 0, challenge + ': the uncleansed card incurs its penalty');
    assert.deepEqual(scoreHistory([...history.slice(1), cleansed]), control, 'cleansing preserves already incurred penalties');
    const restoredAPI = stubAPI(game);
    const restored = new BoardEffects(active, { seed: 'seal-score', boardIndex: 0, api: restoredAPI, memo: clone(memo) });
    restored.setup({ state: initial, initial, restored: true });
    assert.equal(restoredAPI.marks[card], 'mod-wild', 'resume keeps the negative stamp cleared and the modification');
    fx.ctxs[1].api.unmark([card]);
    game.undo(); fx.emit('undo', { moves: [cleansed] });
    assert(api.marks[card], 'undo restores the challenge stamp');
  }
  const f = fixture(h, id);
  for (const data of [{ action: 'unseal', col: 0 }, { action: 'unseal', col: -1 }, { action: 'thaw', fi: 0 }, { action: 'uncover', col: 0, hidden: [] }, { action: 'uncover', col: 0, hidden: [f.game.tableau[1][0]] }, { action: 'other' }]) {
    const before = clone(f.game.state); assert.throws(() => f.game.applyCharmMove({ t: 'X', op: id, ...data })); assert.deepEqual(f.game.state, before);
  }
  const thawed = fixture(h, id, 1, { startHome: 1, cellThaw: { frozen: 2, at: [1, 3] } });
  assert.throws(() => thawed.game.applyCharmMove({ t: 'X', op: id, action: 'thaw', fi: 4 }));
}
