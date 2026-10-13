import { defineCharm } from '../../registry.js';
import { registerCustomMove, canPlaceTableau, canLeaveCell, sequenceStart, rankOf, rulesForState, applyMove, undoMove } from '../../../rules.js';

// Shared by the three one-shot drops. Only the landing rule is relaxed: runs,
// sealed columns, height limits and one-way cells retain their normal legality.
export function overrideDrop(st, rules, flags, freeOnly, src, count, to) {
  if (!src || !Number.isInteger(src.i) || !Number.isInteger(count) || count < 1 ||
      !Number.isInteger(to) || to < 0 || to >= st.tableau.length) return null;
  let card;
  if (src.kind === 'free') {
    card = st.free[src.i];
    const r = rulesForState(st, rules);
    if (count !== 1 || !canLeaveCell(st, src.i, rules) ||
        ((r.oneWayCellRanks & (1 << rankOf(card))) && !r.freeCards.includes(card))) return null;
  } else if (src.kind === 'col' && !freeOnly) {
    const col = st.tableau[src.i];
    if (!col || src.i === to || count > col.length || col.length - count < sequenceStart(col, rules)) return null;
    card = col[col.length - count];
  } else return null;
  if (!canPlaceTableau(st, to, card, count, rules, flags)) return null;
  return { t: 'T', src: { ...src }, count, to, card };
}

export function registerOverrideDrop(op, flags, freeOnly = false) {
  registerCustomMove(op, {
    apply(st, m, rules) {
      const drop = overrideDrop(st, rules, flags, freeOnly, m.src, m.count, m.to);
      if (!drop) throw new Error(`${op}: illegal drop`);
      m.drop = drop;
      applyMove(st, m.drop, rules);
      m.card = m.drop.card;
      m.cards = m.drop.cards || [m.drop.card];
    },
    undo(st, m, rules) { undoMove(st, m.drop, rules); },
  });
}

export function overrideTargets(ctx, flags, freeOnly = false, sequencesOnly = false) {
  const { state: st, rules, concealed = [] } = ctx.api;
  if (!st) return [];
  const sources = [];
  if (!freeOnly) st.tableau.forEach((col, i) => {
    for (let start = sequenceStart(col, rules); start < col.length; start++) {
      const cards = col.slice(start);
      if (cards.some((card) => concealed.includes(card)) || (sequencesOnly && cards.length < 2)) continue;
      sources.push({ src: { kind: 'col', i }, count: cards.length, card: col[start] });
    }
  });
  if (!sequencesOnly) st.free.forEach((card, i) => {
    if (card && !concealed.includes(card)) sources.push({ src: { kind: 'free', i }, count: 1, card });
  });
  return sources.flatMap((source) => st.tableau.flatMap((_, to) =>
    overrideDrop(st, rules, flags, freeOnly, source.src, source.count, to) ? [{ ...source, to }] : []));
}

const PROMPTS = {
  'theater.understudy': ['Choose a free-cell card to cast', 'Choose the column it joins: rank and colour are ignored'],
  'deepsea.current': ['Choose the deepest card of a run for the current to carry', 'Choose where the current carries it'],
  'toybox.jackinbox': ['Choose a card or run to pop', 'Choose where it lands: rank is ignored, colour still counts'],
};

export async function useOverrideDrop(ctx, op, flags, freeOnly = false, sequencesOnly = false, label = null) {
  const candidates = () => overrideTargets(ctx, flags, freeOnly, sequencesOnly);
  const [first, second] = PROMPTS[op] || ['Choose a card to move', 'Choose where it lands'];
  const choice = await ctx.api.pick({
    kind: freeOnly ? 'freecell' : 'card', prompt: first,
    filter: (value) => candidates().some((m) => (freeOnly ? m.src.i : m.card) === value),
    // Aiming at a buried card shows the whole run that would move with it.
    group: freeOnly ? null : (card, st) => { const col = st.tableau.find((cards) => cards.includes(card)); return col ? col.slice(col.indexOf(card)) : [card]; },
  });
  if (choice == null) return false;
  const to = await ctx.api.pick({
    kind: 'column', prompt: second,
    filter: (value) => candidates().some((m) => (freeOnly ? m.src.i : m.card) === choice && m.to === value),
  });
  if (to == null) return false;
  // Revalidate after both asynchronous picks, before arming or spending anything.
  const move = candidates().find((m) => (freeOnly ? m.src.i : m.card) === choice && m.to === to);
  if (!move || !ctx.api.override(flags)) return false;
  const applied = ctx.api.charmMove(op, { src: move.src, count: move.count, to, tableauDrop: true });
  if (!applied) return false;
  const names = { 'concrete.spraytag': 'Spray Tag', 'theater.understudy': 'Understudy', 'deepsea.current': 'Current', 'toybox.jackinbox': 'Jack-in-the-Box' };
  ctx.api.notify(`${label || names[ctx.id] || 'Charm'} used`);
  return true;
}

const flags = { ignoreColour: true, ignoreCap: true };
defineCharm({
  id: 'concrete.spraytag', kind: 'boon', theme: 'concrete', name: 'Spray Tag', icon: '🎨', ease: 0.2,
  family: 'ability',
  text: 'Once per board, your next drop ignores colour and how many cards you can move.',
  upgrade: 'Twice per board, your next drop ignores colour and how many cards you can move.',
  ability: {
    uses: (ctx) => ctx.level >= 2 ? 2 : 1, label: 'Spray a column drop',
    available: (ctx) => overrideTargets(ctx, flags).length > 0,
    use(ctx) {
      if (!ctx.api.override(flags)) return false;
      ctx.api.notify('Spray Tag armed: your next drop ignores colour and move capacity.');
      return true;
    },
  },
});
