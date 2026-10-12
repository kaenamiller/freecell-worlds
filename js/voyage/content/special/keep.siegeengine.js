import { defineCharm } from '../../registry.js';
import { registerCustomMove, activeFreeCells } from '../../../rules.js';

const op = 'keep.siegeengine';
const copy = (v) => JSON.parse(JSON.stringify(v));
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
    } else if (m.action === 'uncover') {
      const col = st.tableau[m.col];
      if (!Number.isInteger(m.col) || !col || !Array.isArray(m.hidden) || !m.hidden.length || !m.hidden.every((id) => col.slice(0, -1).includes(id))) throw new Error('Choose a concealed column');
    } else if (m.action !== 'undo') throw new Error('Unknown Siege Engine action');
  },
  undo(st, m, rules) {
    if (m.action === 'unseal') rules.sealedCols = copy(m.before);
    if (m.action === 'thaw') rules.cellThaw = copy(m.before);
    // rules.js restores sealedBefore; visibility and run undos live in the runtime.
  },
});

defineCharm({
  id: op, kind: 'boon', theme: 'keep', name: 'Siege Engine', icon: '🪨', ease: .25,
  text: 'Once per board, unseal a column, thaw a cell or uncover a concealed column; with no obstacles, gain an undo.',
  ability: {
    uses: 1, label: 'Break an obstacle', available: () => true,
    async use({ api }) {
      let data;
      if (api.state.sealed) {
        const col = await api.pick({ kind: 'column', filter: (i, st) => !!(st.sealed & (1 << i)) });
        if (col == null) return false;
        data = { action: 'unseal', col };
      } else if (activeFreeCells(api.state, api.rules) < api.state.free.length) {
        const fi = await api.pick({ kind: 'freecell', filter: (i, st) => i === activeFreeCells(st, api.rules) });
        if (fi == null) return false;
        data = { action: 'thaw', fi };
      } else if (api.state.tableau.some((col) => col.slice(0, -1).some((id) => api.concealed.includes(id)))) {
        const col = await api.pick({ kind: 'column', filter: (i, st) => st.tableau[i].slice(0, -1).some((id) => api.concealed.includes(id)) });
        if (col == null) return false;
        data = { action: 'uncover', col, hidden: api.state.tableau[col].slice(0, -1).filter((id) => api.concealed.includes(id)) };
      } else data = { action: 'undo' };
      if (!api.charmMove(op, data)) return false;
      if (data.action === 'uncover') api.reveal(data.hidden);
      api.notify({ unseal: 'Siege Engine: column unsealed', thaw: 'Siege Engine: cell thawed', uncover: 'Siege Engine: column uncovered', undo: 'Siege Engine: +1 undo' }[data.action]);
      return true;
    },
  },
  on: {
    move({ api }, { move }) { if (move.t === 'X' && move.op === op && move.action === 'undo') api.addUndos(1); },
    undo({ api }, { moves = [] }) {
      for (const m of moves) if (m.t === 'X' && m.op === op) {
        if (m.action === 'undo') api.spendUndos(1);
        if (m.action === 'uncover') api.conceal(m.hidden.filter((id) => api.state.tableau.some((col) => col.slice(0, -1).includes(id))));
      }
    },
  },
});
