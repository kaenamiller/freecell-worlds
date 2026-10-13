import { defineCharm } from '../../registry.js';
import { registerCustomMove, activeFreeCells, cellAccepts } from '../../../rules.js';

const op = 'cyber.ghost';
const copy = (v) => JSON.parse(JSON.stringify(v));
function openCell(history) {
  let open = null;
  for (const m of history) if (m.t === 'X' && m.op === op) open = m.action === 'open' ? m : null;
  return open;
}
function canPark(st, rules, col) {
  if (!Number.isInteger(col) || !st.tableau[col]?.length || st.free.length >= 6) return false;
  const fi = activeFreeCells(st, rules);
  const free = st.free.slice(); free.splice(fi, 0, 0);
  const cellColors = (rules.cellColors || []).slice();
  while (cellColors.length < fi) cellColors.push(null);
  cellColors.splice(fi, 0, null);
  return cellAccepts({ ...st, free }, fi, st.tableau[col].at(-1), { ...rules, freeCells: free.length, cellColors });
}

registerCustomMove(op, {
  apply(st, m, rules) {
    if (m.action === 'open') {
      if (!canPark(st, rules, m.col)) throw new Error('Ghost Cell requires a legal column top and room for a cell');
      m.fi = activeFreeCells(st, rules);
      m.before = { freeCells: rules.freeCells, cellColors: copy(rules.cellColors || []) };
      const colors = (rules.cellColors || []).slice();
      while (colors.length < m.fi) colors.push(null);
      colors.splice(m.fi, 0, null);
      m.card = st.tableau[m.col].pop();
      st.free.splice(m.fi, 0, m.card);
      rules.freeCells = st.free.length; rules.cellColors = colors;
    } else if (m.action === 'close') {
      if (!Number.isInteger(m.fi) || m.fi < 0 || m.fi >= st.free.length || st.free[m.fi]) throw new Error('Only an empty ghost cell can close');
      // A different ability may have moved the parked card. Closing is a secondary
      // move, so undo must refund that ability only when its own move is undone.
      delete m.voyageAbility;
      m.before = { freeCells: rules.freeCells, cellColors: copy(rules.cellColors || []) };
      st.free.splice(m.fi, 1); rules.cellColors.splice(m.fi, 1);
      rules.freeCells = st.free.length;
    } else throw new Error('Unknown Ghost Cell action');
  },
  undo(st, m, rules) {
    if (m.action === 'open') {
      if (st.free[m.fi] !== m.card) throw new Error('Undo later moves before closing the ghost cell');
      st.free.splice(m.fi, 1); st.tableau[m.col].push(m.card);
    } else st.free.splice(m.fi, 0, 0);
    rules.freeCells = m.before.freeCells; rules.cellColors = copy(m.before.cellColors);
  },
});

defineCharm({
  id: op, kind: 'boon', theme: 'cyber', name: 'Ghost Cell', icon: '👻', ease: .3,
  family: 'cells',
  upgrade: 'Twice per board, park a column top in an extra ghost cell that vanishes when the card leaves.',
  text: 'Once per board, park a column top in an extra ghost cell that vanishes when the card leaves.',
  ability: {
    uses: ({ level }) => level === 2 ? 2 : 1, label: 'Open Ghost Cell',
    available: ({ api }) => !openCell(api.history) && api.state.tableau.some((col, i) => canPark(api.state, api.rules, i) && !api.concealed.includes(col.at(-1))),
    async use({ api }) {
      const col = await api.pick({ kind: 'column', prompt: 'Choose a column top to park in a ghost cell', cards: (i, st) => [st.tableau[i].at(-1)], filter: (i, st) => canPark(st, api.rules, i) && !api.concealed.includes(st.tableau[i].at(-1)) });
      if (col == null || !canPark(api.state, api.rules, col)) return false;
      if (!api.charmMove(op, { action: 'open', col })) return false;
      api.notify('Ghost Cell: parked a card in an extra cell');
      return true;
    },
  },
  on: {
    move({ api }) {
      const open = openCell(api.history);
      if (open && api.state.free[open.fi] === 0) {
        api.charmMove(op, { action: 'close', fi: open.fi });
        api.notify('Ghost Cell vanished');
      }
    },
  },
});
