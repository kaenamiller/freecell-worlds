import { defineCharm } from '../../registry.js';
import { registerCustomMove, activeFreeCells, cardsHome, cellIsClosed, isPinned } from '../../../rules.js';

const op = 'bloodmoon.seal';
const copy = (v) => JSON.parse(JSON.stringify(v));
const closed = (st, rules) => st.free.findIndex((_, i) => cellIsClosed(st, i, rules));
const pinned = (st, rules) => st.tableau.some((col) => col.some((card) => isPinned(st, card, rules))) || st.free.some((card) => card && isPinned(st, card, rules));
registerCustomMove(op, {
  apply(st, m, rules) {
    if (m.action === 'unseal') {
      if (!Number.isInteger(m.col) || !st.tableau[m.col]?.length || !(st.sealed & (1 << m.col))) throw new Error('Choose a sealed column');
      m.before = copy(rules.sealedCols || []);
      st.sealed &= ~(1 << m.col); rules.sealedCols = (rules.sealedCols || []).filter((i) => i !== m.col);
    } else if (m.action === 'thaw') {
      if (!rules.cellThaw || m.fi !== activeFreeCells(st, rules) || m.fi >= st.free.length) throw new Error('Choose the next frozen cell');
      m.before = copy(rules.cellThaw);
      rules.cellThaw = { frozen: rules.cellThaw.frozen - 1, at: rules.cellThaw.at.slice(0, -1) };
    } else if (m.action === 'reopen') {
      if (!Number.isInteger(m.fi) || m.fi < 0 || m.fi !== closed(st, rules)) throw new Error('Choose the first closed cell');
      m.before = copy(rules.cellClose);
      const passed = rules.cellClose.at.filter((at) => at <= cardsHome(st));
      const future = rules.cellClose.at.filter((at) => at > cardsHome(st));
      // Occupied closing slots stay usable; move the closure edge past them and
      // the first empty closed slot, retaining every future tide milestone.
      rules.cellClose = { at: [...passed.slice(0, st.free.length - m.fi - 1), ...future] };
    } else if (m.action === 'unpin') {
      const card = m.pinnedCard ?? m.card;
      if (!Number.isInteger(card) || !isPinned(st, card, rules) || ![...st.tableau.flat(), ...st.free].includes(card)) throw new Error('Choose a pinned card in play');
      m.before = copy(rules.pinned);
      rules.pinned = { ...rules.pinned, cards: rules.pinned.cards.filter((id) => id !== card) };
      m.pinnedCard = card;
      // Unpinning changes a rule, not the card's position or visibility.
      delete m.card;
    } else if (m.action === 'uncover') {
      const col = st.tableau[m.col];
      if (!Number.isInteger(m.col) || !col || !Array.isArray(m.hidden) || !m.hidden.length || !m.hidden.every((id) => col.slice(0, -1).includes(id))) throw new Error('Choose a concealed column');
    } else if (m.action !== 'undo') throw new Error('Unknown Broken Seal action');
  },
  undo(st, m, rules) {
    if (m.action === 'unseal') rules.sealedCols = copy(m.before);
    if (m.action === 'thaw') rules.cellThaw = copy(m.before);
    if (m.action === 'reopen') rules.cellClose = copy(m.before);
    if (m.action === 'unpin') rules.pinned = copy(m.before);
    // rules.js restores sealedBefore; visibility and run undos live in the runtime.
  },
});

defineCharm({
  id: op, kind: 'boon', theme: 'bloodmoon', name: 'Broken Seal', icon: '⛓️‍💥', family: 'ability', ease: .25,
  text: 'Once per board, break an obstacle: unseal a column, thaw or reopen a cell, unpin a card, or uncover a face-down column; with none, gain 1 undo.',
  upgrade: 'Twice per board, break an obstacle: unseal a column, thaw or reopen a cell, unpin a card, or uncover a face-down column; with none, gain 1 undo.',
  ability: {
    uses: (ctx) => ctx.level === 2 ? 2 : 1, label: 'Break the seal', available: () => true,
    async use({ api }) {
      // Every obstacle on the board is offered; with more than one kind, the player picks which.
      const st = api.state, hiddenIn = (i, s) => s.tableau[i].slice(0, -1).filter((id) => api.concealed.includes(id));
      const kinds = [
        st.sealed && { value: 'unseal', label: 'Unseal a column' },
        activeFreeCells(st, api.rules) < st.free.length && { value: 'thaw', label: 'Thaw a cell' },
        closed(st, api.rules) >= 0 && { value: 'reopen', label: 'Reopen a cell' },
        pinned(st, api.rules) && { value: 'unpin', label: 'Unpin a card' },
        st.tableau.some((_, i) => hiddenIn(i, st).length) && { value: 'uncover', label: 'Uncover a column' },
      ].filter(Boolean);
      const action = kinds.length > 1 ? await api.choose({ prompt: 'Which obstacle should break?', options: kinds }) : kinds[0]?.value || 'undo';
      if (action == null) return false;
      let data;
      if (action === 'unseal') {
        const col = await api.pick({ kind: 'column', prompt: 'Choose a sealed column to unseal', filter: (i, s) => !!(s.sealed & (1 << i)) });
        if (col == null) return false;
        data = { action, col };
      } else if (action === 'thaw') {
        const fi = await api.pick({ kind: 'freecell', prompt: 'Choose the frozen cell to thaw', filter: (i, s) => i === activeFreeCells(s, api.rules) });
        if (fi == null) return false;
        data = { action, fi };
      } else if (action === 'reopen') {
        const fi = await api.pick({ kind: 'freecell', prompt: 'Choose the closed cell to reopen', filter: (i, s) => i === closed(s, api.rules) });
        if (fi == null) return false;
        data = { action, fi };
      } else if (action === 'unpin') {
        // Pinned cards light up wherever they are; a column offers its nearest-the-top pin.
        const isPin = (id, s) => isPinned(s, id, api.rules);
        const pins = (s) => [...s.free.filter((id) => id && isPin(id, s)), ...s.tableau.map((col) => col.findLast((c) => isPin(c, s))).filter(Boolean)];
        let card;
        if (!pins(st).some((id) => api.concealed.includes(id))) {
          card = await api.pick({ kind: 'card', prompt: 'Choose a pinned card to free', filter: (id, s) => pins(s).includes(id) });
        } else {
          // A face-down pin cannot be aimed at directly, so its column stands in for it.
          const pinIn = (i, s) => s.tableau[i].findLast((c) => isPin(c, s));
          const col = await api.pick({ kind: 'column', prompt: 'Choose a column with a pinned card to free', cards: (i, s) => [pinIn(i, s)], filter: (i, s) => !!pinIn(i, s) });
          card = col == null ? null : pinIn(col, api.state);
        }
        if (card == null) return false;
        data = { action, pinnedCard: card };
      } else if (action === 'uncover') {
        const col = await api.pick({ kind: 'column', prompt: 'Choose a column to turn its face-down cards over', cards: hiddenIn, filter: (i, s) => hiddenIn(i, s).length > 0 });
        if (col == null) return false;
        data = { action, col, hidden: hiddenIn(col, api.state) };
      } else data = { action: 'undo' };
      if (!api.charmMove(op, data)) return false;
      if (data.action === 'uncover') api.reveal(data.hidden);
      api.notify({ unseal: 'Broken Seal: column unsealed', thaw: 'Broken Seal: cell thawed', reopen: 'Broken Seal: cell reopened', unpin: 'Broken Seal: card unpinned', uncover: 'Broken Seal: column uncovered', undo: 'Broken Seal: undo refunded up to the board cap' }[data.action]);
      return true;
    },
  },
  on: {
    move({ api }, { move }) { if (move.t === 'X' && move.op === op && move.action === 'undo') move.granted = api.addUndos(1); },
    undo({ api }, { moves = [] }) {
      for (const m of moves) if (m.t === 'X' && m.op === op) {
        if (m.action === 'undo') api.spendUndos(m.granted ?? 1);
        if (m.action === 'uncover') api.conceal(m.hidden.filter((id) => api.state.tableau.some((col) => col.slice(0, -1).includes(id))));
      }
    },
  },
});
