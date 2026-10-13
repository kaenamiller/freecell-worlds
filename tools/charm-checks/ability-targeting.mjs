// Ability targeting: menu choices (choose), the targets each pick offers, and the
// cards it lights. Picks and choices share one fixture queue, in the order asked.
export async function check(h) {
  const { assert, Rules, CHARMS, BoardEffects, baseRules, clone, stubAPI } = h;

  function fixture(id, { level = 1, rules = {}, picks = [], stickers = {} } = {}) {
    const game = new Rules.Game(1, { rules: { ...baseRules(), ...rules } });
    const memo = {}, run = { seed: 'targeting', status: 'board', results: [], boons: [id], undos: 5, coins: 20, charmMemo: {}, stickers: { ...stickers } };
    const api = stubAPI(game, { picks, run, memo });
    const asked = [];
    const { pick, choose } = api;
    api.pick = (o) => { asked.push({ type: 'pick', ...o }); return pick.call(api, o); };
    api.choose = (o) => { asked.push({ type: 'choose', ...o }); return choose.call(api, o); };
    api.charmMove = (op, data) => game.applyCharmMove({ ...data, t: 'X', op });
    const fx = new BoardEffects([{ id, kind: 'boon', strength: 1, level }], { seed: run.seed, boardIndex: 0, api, memo, run });
    fx.setup({ state: clone(game.initial), initial: clone(game.initial) });
    return { game, run, api, fx, asked, ctx: fx.ctxs[0], uses: () => fx.abilityState(id).uses };
  }

  // Safety Pin chooses a suit from a menu; cancelling spends nothing.
  {
    const f = fixture('safetypin.safetypin', { picks: [null, 2] });
    assert.equal(await f.fx.useAbility('safetypin.safetypin'), false);
    assert.equal(f.uses(), 1);
    assert(await f.fx.useAbility('safetypin.safetypin'));
    assert.equal(f.ctx.memo.pinSuit, 2);
    assert.deepEqual(f.asked.map((a) => a.type), ['choose', 'choose']);
    assert.deepEqual(f.asked[1].options.map((o) => o.value), [0, 1, 2, 3]);
  }

  // Misprint L2 chooses the sticker type from a menu, not a column number.
  {
    const top = fixture('risograph.misprint', { level: 2 }).game.tableau[0].at(-1);
    const g = fixture('risograph.misprint', { level: 2, picks: [top, 'lucky'] });
    assert(await g.fx.useAbility('risograph.misprint'));
    assert.equal(g.run.stickers[top], 'lucky');
    assert.deepEqual(g.asked.map((a) => a.type), ['pick', 'choose']);
    assert.deepEqual(g.asked[1].options.map((o) => o.value), ['wild', 'gold', 'lucky', 'key', 'fool']);
  }

  // Replacing a sticker the player already owns asks first; "Keep" spends nothing.
  for (const id of ['runes.amber', 'risograph.misprint']) {
    const probe = fixture(id);
    const card = probe.game.tableau[0].at(-1);
    const keep = fixture(id, { picks: [card, false], stickers: { [card]: 'lucky' } });
    assert.equal(await keep.fx.useAbility(id), false, `${id}: keeping the old sticker cancels`);
    assert.equal(keep.uses(), 1);
    assert.equal(keep.run.stickers[card], 'lucky');
    const swap = fixture(id, { picks: [card, true], stickers: { [card]: 'lucky' } });
    assert(await swap.fx.useAbility(id), `${id}: replacing the old sticker goes ahead`);
    assert.notEqual(swap.run.stickers[card], 'lucky');
    // No existing sticker: no confirmation menu.
    const fresh = fixture(id, { picks: [card] });
    assert(await fresh.fx.useAbility(id));
    assert.deepEqual(fresh.asked.map((a) => a.type), ['pick']);
  }

  // Lampglow only offers columns that hide cards, lights those cards, and skips the
  // pick (straight to a preview) when nothing on the table is face-down.
  {
    const none = fixture('moth.lampglow');
    assert(await none.fx.useAbility('moth.lampglow'));
    assert.deepEqual(none.asked, []);
    assert(none.api.calls.some(([c]) => c === 'preview'));
    const f = fixture('moth.lampglow', { picks: [2] });
    const hidden = f.game.tableau[2].slice(0, -1);
    f.ctx.api.conceal(hidden);
    assert(await f.fx.useAbility('moth.lampglow'));
    const ask = f.asked[0];
    assert.equal(ask.filter(0, f.game.state), false, 'a column with nothing hidden is not a target');
    assert.deepEqual(f.ctx.api.concealed, []);
    assert.equal(f.game.history.length, 0);
    assert.deepEqual(ask.cards(2, { ...f.game.state, tableau: f.game.tableau.map((c, i) => i === 2 ? [...hidden, 1] : c) }).length, 0, 'lights only cards still hidden');
  }

  // Glaze: the menu offers both directions; an Ace cannot go lower.
  {
    const ace = Rules.cardId(0, 1);
    const f = fixture('azulejo.glaze', { picks: [ace, 1] });
    assert(await f.fx.useAbility('azulejo.glaze'));
    const menu = f.asked.find((a) => a.type === 'choose');
    assert.equal(menu.card, ace, 'the menu sits on the chosen card');
    assert.deepEqual(menu.options.map((o) => [o.value, !!o.disabled]), [[-1, true], [1, false]]);
    assert.equal(f.game.rules.rankShift[ace], 1);
    assert.equal(f.api.marks[ace], 'mod-rank-up-2');
    assert.match(CHARMS['azulejo.glaze'].markText(ace, 'mod-rank-up-2', f.ctx), /stacks as 2.*goes home as Ace/);
  }

  // Exposure / Redaction tab only the cards they changed, not sticker cards with the same rule.
  for (const [id, field, style] of [['cinema.exposure', 'wildCards', 'mod-wild'], ['deepstorage.redaction', 'anchorCards', 'mod-anchor']]) {
    const probe = fixture(id);
    const [stickered, chosen] = [probe.game.tableau[1].at(-1), probe.game.tableau[0].at(-1)];
    const f = fixture(id, { picks: [chosen], rules: { [field]: [stickered] } });
    assert(await f.fx.useAbility(id));
    assert.equal(f.api.marks[chosen], style);
    assert.equal(f.api.marks[stickered], undefined, `${id}: a sticker card keeps only its sticker`);
  }

  // Broken Seal asks which obstacle to break when there is more than one kind.
  {
    const probe = fixture('bloodmoon.seal');
    const pinnedCard = probe.game.tableau[3].at(-1);
    const rules = { sealedCols: [0], pinned: { cards: [pinnedCard], until: 20 } };
    const cancel = fixture('bloodmoon.seal', { rules, picks: [null] });
    assert.equal(await cancel.fx.useAbility('bloodmoon.seal'), false);
    assert.equal(cancel.uses(), 1);
    const f = fixture('bloodmoon.seal', { rules, picks: ['unpin', pinnedCard] });
    assert(await f.fx.useAbility('bloodmoon.seal'));
    assert.deepEqual(f.asked[0].options.map((o) => o.value), ['unseal', 'unpin']);
    assert.equal(f.game.history.at(-1).action, 'unpin');
    assert.equal(Rules.isPinned(f.game.state, pinnedCard, f.game.rules), false);
  }

  // Loom picks the deepest card to move; aiming at it shows the whole run that goes.
  {
    const probe = fixture('saffron.loom');
    const col = probe.game.tableau[0], card = col[col.length - 3];
    const st = clone(probe.game.state); st.tableau[5] = [];
    const f = fixture('saffron.loom', { picks: [card, 5] });
    // Loom needs an empty column; the cards cleared from it play no part in this check.
    f.game.state.tableau[5] = [];
    assert(await f.fx.useAbility('saffron.loom'));
    const first = f.asked[0];
    assert.deepEqual(first.group(card, st), col.slice(-3));
    assert.deepEqual(f.game.tableau[5], col.slice(-3));
  }

  // Override drops: every pick has a prompt, and a card pick shows its moving run.
  const { useOverrideDrop } = await import('../../js/voyage/content/special/concrete.spraytag.js');
  for (const [id, freeOnly] of [['theater.understudy', true], ['deepsea.current', false], ['toybox.jackinbox', false]]) {
    const game = new Rules.Game(1, { rules: baseRules() }), asked = [];
    const ctx = { id, api: { state: game.state, rules: game.rules, concealed: [], pick: async (o) => { asked.push(o); return null; } } };
    assert.equal(await useOverrideDrop(ctx, id, {}, freeOnly), false);
    assert(asked[0]?.prompt, `${id}: first pick has a prompt`);
    if (!freeOnly) {
      const col = game.tableau[2];
      assert.deepEqual(asked[0].group(col[col.length - 2], game.state), col.slice(-2), `${id}: aiming shows the run that moves`);
    }
  }

  console.log('OK: ability targeting menus, offered targets, lit cards and card tabs');
}
