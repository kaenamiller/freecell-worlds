import { defineCharm } from '../../registry.js';
import { cardsHome, registerCustomMove } from '../../../rules.js';

const op = 'arctic.heatlamp';
registerCustomMove(op, {
  apply(st, m, rules) {
    if (!['column', 'home'].includes(m.trigger) || st.free.length >= 6 ||
        (m.trigger === 'column' ? !Number.isInteger(m.col) || st.tableau[m.col]?.length !== 0 : cardsHome(st) < 8)) {
      throw new Error('Heat Lamp requires an emptied column or 8 cards home and room for a cell');
    }
    m.before = { count: st.free.length, freeCells: rules.freeCells };
    st.free.push(0); rules.freeCells = st.free.length;
    // A passive cell gain must not refund the ability that triggered it.
    delete m.voyageAbility;
  },
  undo(st, m, rules) {
    if (st.free.slice(m.before.count).some(Boolean)) throw new Error('Undo later moves before switching off Heat Lamp');
    st.free.length = m.before.count; rules.freeCells = m.before.freeCells;
  },
});

function switchOn(ctx, trigger, data = {}) {
  const { api } = ctx;
  if (api.state.free.length >= 6 || api.history.some((m) => m.t === 'X' && m.op === op && m.trigger === trigger)) return;
  if (api.charmMove(op, { trigger, ...data })) api.notify('Heat Lamp: an extra free cell switched on.');
}

defineCharm({
  id: op, kind: 'boon', theme: 'arctic', name: 'Heat Lamp', icon: '💡', family: 'cells', ease: .4,
  text: 'The first time you empty a column each board, an extra free cell switches on.',
  upgrade: 'An extra free cell switches on the first time you empty a column each board and the first time 8 cards are home.',
  on: {
    columnEmpty(ctx, { col }) {
      if (ctx.api.state.tableau[col]?.length === 0) switchOn(ctx, 'column', { col });
    },
    move(ctx) {
      if (ctx.level === 2 && cardsHome(ctx.api.state) >= 8) switchOn(ctx, 'home');
    },
  },
});
