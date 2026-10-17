// FreeCell rules engine + solvability solver.
// Pure logic only (no DOM) so it can run inside a Web Worker.

export const SUITS = [0, 1, 2, 3]; // 0=C, 1=D, 2=H, 3=S
export const SUIT_CHARS = ['C', 'D', 'H', 'S'];
export const RED = [false, true, true, false];

export const suitOf = (id) => ((id - 1) / 13) | 0;
export const rankOf = (id) => ((id - 1) % 13) + 1;
export const isRed = (id) => RED[suitOf(id)];
export const colorOf = (id) => (RED[suitOf(id)] ? 1 : 0);
export const cardId = (suit, rank) => suit * 13 + rank; // 1..52

// JSON-plain board defaults. Compiled rules stay private to a search/action.
export const RULE_DEFAULTS = Object.freeze({
  freeCells: 4, moveBonus: 0, emptyFactor: 2, wildRanks: 0, suitBuild: 0,
  foundationReturn: false, startHome: 0, noCellRanks: 0, noCellCards: [],
  barren: null, foundationSpread: 0, emptyMinRank: 0, cellThaw: null,
  sealedCols: [], maxHeight: 0, cellColors: [], oneWayCellRanks: 0,
  wildCards: [], anchorCards: [], freeCards: [], buildUp: 0, suitBuildUp: 0, suitRunFree: 0,
  cellLimits: [], emptyMaxRank: 0, emptyKings: false, cellClose: null, gate: null, dealSkew: null,
  phase: null, rankShift: {},
  emptyAlwaysCounts: false, cellStack: 0, pinned: null, maxEmpty: 0,
  colorSpread: 0, emptyColors: [], barrenCards: [],
  cellExitWild: false, openCols: 0,
  twinStack: 0, shallowCols: 0,
  loneAccepts: 0, skipBuild: 0, fullCellsBonus: 0,
  emptyCure: 0, cellsNeedEmpty: 0, sameColorRanks: 0, noExitCols: 0, cleansedCards: [],
});

export function compileRules(r = RULE_DEFAULTS) {
  if (r._compiled) return r;
  const out = { ...RULE_DEFAULTS, ...r, _compiled: true, noCellLo: 0, noCellHi: 0 };
  for (const id of out.noCellCards) {
    if (id <= 32) out.noCellLo |= 1 << (id - 1);
    else out.noCellHi |= 1 << (id - 33);
  }
  // Only variant stacking pays for a lookup table; classic keeps its original predicate.
  if (out.wildRanks || out.suitBuild || out.barren || out.barrenCards.length || out.wildCards.length || out.anchorCards.length || out.buildUp || out.suitBuildUp || out.twinStack || out.skipBuild || out.sameColorRanks || Object.keys(out.rankShift).length) {
    out.build = new Uint8Array(53 * 53);
    for (let parent = 1; parent <= 52; parent++) for (let child = 1; child <= 52; child++) {
      const pr = rankOf(parent) + (out.rankShift[parent] || 0), cr = rankOf(child) + (out.rankShift[child] || 0), ps = suitOf(parent);
      const barred = !cardIsCleansed(parent, out) && (out.barrenCards.includes(parent) || (out.barren && (out.barren.suits & (1 << ps)) && (out.barren.ranks & (1 << rankOf(parent)))));
      const same = colorOf(parent) === colorOf(child);
      const colour = ((!cardIsCleansed(child, out) && (out.sameColorRanks & (1 << rankOf(child)))) ? same : !same) || (out.wildRanks & ((1 << rankOf(parent)) | (1 << rankOf(child)))) ||
        out.wildCards.includes(parent) || out.wildCards.includes(child) || ((out.suitBuild & (1 << ps)) && ps === suitOf(child));
      out.build[parent * 53 + child] = !barred && (out.anchorCards.includes(parent) ||
        (cr === pr && out.twinStack && (out.twinStack >= 2 || colour)) ||
        (cr === pr - 1 && colour) || (cr === pr - 2 && out.skipBuild && (out.skipBuild >= 2 || same)) || (cr === pr + 1 && (out.buildUp & (1 << suitOf(child))) && colour) ||
        (cr === pr + 1 && (out.suitBuildUp & (1 << ps)) && ps === suitOf(child))) ? 1 : 0;
    }
  }
  out.classic = Object.keys(RULE_DEFAULTS).every((k) => k === 'freeCells' || JSON.stringify(out[k]) === JSON.stringify(RULE_DEFAULTS[k]));
  if (out.phase) {
    const overrides = {};
    for (const k of ['noCellRanks', 'oneWayCellRanks', 'foundationSpread', 'emptyMinRank', 'emptyMaxRank', 'gate', 'emptyFactor', 'emptyAlwaysCounts', 'moveBonus'])
      if (Object.hasOwn(out.phase.rules || {}, k)) overrides[k] = out.phase.rules[k];
    out.phaseRules = compileRules({ ...r, ...overrides, phase: null, _compiled: false });
  }
  return out;
}
const CLASSIC_RULES = compileRules();
const resolved = (r) => !r ? CLASSIC_RULES : r._compiled ? r : compileRules(r);

export const cardsHome = (st) => st.found[0] + st.found[1] + st.found[2] + st.found[3] + (st.spur ? st.spur.top - st.spur.base + 1 : 0);
export const suitHomeCount = (st, suit) => st.found[suit] + (st.spur?.suit === suit ? st.spur.top - st.spur.base + 1 : 0);
export const foundationTop = (st, suit) => st.spur?.suit === suit ? Math.max(st.found[suit], st.spur.top) : st.found[suit];
export const cardIsHome = (st, card) => rankOf(card) <= st.found[suitOf(card)] ||
  (st.spur?.suit === suitOf(card) && rankOf(card) >= st.spur.base && rankOf(card) <= st.spur.top);
export const foundationDestination = (st, card) => st.spur?.suit === suitOf(card) && rankOf(card) >= st.spur.base ? 'spur' : 'original';
// Plain game.rules is deliberately recompiled: X moves may mutate nested arrays/maps in place.
export function rulesForState(st, rules, homeAdjustment = 0) {
  const r = resolved(rules);
  return r.phase && cardsHome(st) + homeAdjustment >= r.phase.at ? r.phaseRules : r;
}

export function canBuildOn(parent, child, rules) {
  return builds(parent, child, resolved(rules));
}

function builds(parent, child, r) {
  return r.build ? !!r.build[parent * 53 + child]
    : rankOf(child) === rankOf(parent) - 1 && colorOf(child) !== colorOf(parent);
}

export function activeFreeCells(st, rules, homeAdjustment = 0) {
  const r = resolved(rules), thaw = r.cellThaw;
  if (!thaw) return st.free.length;
  const home = cardsHome(st) + homeAdjustment;
  let frozen = Math.min(st.free.length, Math.max(0, thaw.frozen));
  for (let i = 0; i < thaw.frozen; i++) if (home >= (thaw.at[i] ?? Infinity)) frozen--;
  return st.free.length - Math.max(0, frozen);
}

export function cellIsClosed(st, i, rules, homeAdjustment = 0) {
  const r = resolved(rules);
  if (r.cellsNeedEmpty && !st.tableau.some((col) => !col.length) && i >= Math.max(0, activeFreeCells(st, r, homeAdjustment) - r.cellsNeedEmpty)) return true;
  const closed = r.cellClose?.at.filter((h) => cardsHome(st) + homeAdjustment >= h).length || 0;
  return i >= Math.max(0, st.free.length - closed) && !st.free[i] && closed > 0;
}

export function cellIsOpen(st, i, rules, homeAdjustment = 0) {
  return i >= 0 && i < activeFreeCells(st, rules, homeAdjustment) && !cellIsClosed(st, i, rules, homeAdjustment);
}

// Broken Seal removes negative card effects for this board, including phase rules.
export function cardIsCleansed(card, rules) { return !!rules?.cleansedCards?.includes(card); }

export function isPinned(st, card, rules) {
  const p = resolved(rules).pinned;
  return !cardIsCleansed(card, rules) && !!p && cardsHome(st) < p.until && p.cards.includes(card);
}

export function canLeaveCell(st, i, rules) {
  const r = rulesForState(st, rules), card = st.free[i];
  if (!card || isPinned(st, card, r)) return false;
  if (i < r.cellStack) for (let j = i + 1; j < Math.min(st.free.length, r.cellStack); j++) if (st.free[j]) return false;
  return true;
}

export function cellEntryIndex(st, i, rules) {
  const r = resolved(rules);
  if (i < 0 || i >= st.free.length) return i;
  if (i < r.cellStack) return st.free.findIndex((card, j) => j < r.cellStack && !card);
  return i;
}

function sourceOf(st, card, count = 1) {
  const fi = st.free.indexOf(card);
  if (fi >= 0) return { kind: 'free', i: fi };
  const ci = st.tableau.findIndex((col) => col[col.length - count] === card);
  return ci < 0 ? null : { kind: 'col', i: ci };
}

function noExit(st, src, r, count = 1) {
  return src?.kind === 'col' && !cardIsCleansed(st.tableau[src.i][0], r) && !!(r.noExitCols & (1 << src.i)) && st.tableau[src.i].length === count;
}

function preservesEmptyLimit(st, src, count, to, r) {
  if (!r.maxEmpty || src?.kind !== 'col' || st.tableau[src.i].length !== count || cardIsCleansed(st.tableau[src.i][0], r)) return true;
  const before = st.tableau.filter((c) => !c.length).length;
  const after = before + 1 - (to != null && !st.tableau[to].length ? 1 : 0);
  return after <= r.maxEmpty || after <= before;
}

export function cellAccepts(st, i, card, rules, homeAdjustment = 0, override) {
  const r = rulesForState(st, rules, homeAdjustment);
  if (!card || i < 0 || i >= st.free.length || st.free[i] || !cellIsOpen(st, i, r, homeAdjustment)) return false;
  if ((!override?.ignoreRestrictions && noExit(st, sourceOf(st, card), r)) || isPinned(st, card, r) || !preservesEmptyLimit(st, sourceOf(st, card), 1, null, r)) return false;
  if (i < r.cellStack) for (let j = 0; j < i; j++) if (!st.free[j]) return false;
  if (cardIsCleansed(card, r) || r.freeCards.includes(card) || override?.ignoreRestrictions) return true;
  if ((r.noCellRanks & (1 << rankOf(card))) || (card <= 32
    ? r.noCellLo & (1 << (card - 1)) : r.noCellHi & (1 << (card - 33)))) return false;
  const lock = r.cellColors[i];
  const limit = r.cellLimits[i];
  return (!lock || (lock === 'red') === isRed(card)) && (!limit ||
    ((limit.maxRank == null || rankOf(card) <= limit.maxRank) && (limit.minRank == null || rankOf(card) >= limit.minRank) && (limit.suits == null || (limit.suits & (1 << suitOf(card))))));
}

export function canPlaceTableau(st, i, card, count = 1, rules, override, cards) {
  const r = rulesForState(st, rules), col = st.tableau[i];
  if (!col || !card || (!override?.ignoreRestrictions && ((st.sealed & (1 << i)) || (r.maxHeight && col.length + count > r.maxHeight)))) return false;
  let placementOverride = override;
  if ((col.length && ((r.openCols & (1 << i)) || (r.loneAccepts && col.length <= r.loneAccepts))) || (r.cellExitWild && st.free.includes(card)))
    placementOverride = { ...override, ignoreColour: true, ...(col.length && ((r.openCols & (1 << i)) || (r.loneAccepts && col.length <= r.loneAccepts)) ? { ignoreRank: true } : {}) };
  if (!override?.ignoreRestrictions && noExit(st, sourceOf(st, card, count), r, count)) return false;
  if (!canStackOn(col, card, r, placementOverride, st)) return false;
  if (r.pinned || r.cellStack || r.maxEmpty) {
    const src = sourceOf(st, card, count);
    const moving = cards || (src?.kind === 'col' ? st.tableau[src.i].slice(-count) : [card]);
    if (moving.some((id) => isPinned(st, id, r)) || (src?.kind === 'free' && !canLeaveCell(st, src.i, r)) || !preservesEmptyLimit(st, src, count, i, r)) return false;
  }
  if (!col.length && !override?.ignoreRestrictions && r.emptyColors[i] && (r.emptyColors[i] === 'red') !== isRed(card)) return false;
  if (!cards && r.suitRunFree && count > 1) cards = st.tableau.find((c) => c[c.length - count] === card)?.slice(-count);
  return count === 1 || override?.ignoreCap || count <= maxMoveSize(st, col.length <= r.shallowCols, r, cards);
}

// R moves must remain legal after lowering the foundation (including re-freezing a cell).
export function canReturnFoundation(st, suit, to, rules, override, from = 'original') {
  const r = rulesForState(st, rules, -1);
  const spur = from === 'spur';
  if (!r.foundationReturn || !to || (spur ? st.spur?.suit !== suit || st.spur.top <= st.spur.base : !st.found[suit])) return false;
  if (r.foundationSpread) {
    let lo = 13, hi = 0;
    for (let s = 0; s < 4; s++) {
      const original = st.found[s] - (s === suit && !spur ? 1 : 0);
      const n = st.spur?.suit === s ? Math.max(original, st.spur.top - (s === suit && spur ? 1 : 0)) : original;
      lo = Math.min(lo, n); hi = Math.max(hi, n);
    }
    if (hi - lo > r.foundationSpread) return false;
  }
  const card = cardId(suit, spur ? st.spur.top : st.found[suit]);
  if (r.colorSpread && Math.abs(suitHomeCount(st, 1) + suitHomeCount(st, 2) - suitHomeCount(st, 0) - suitHomeCount(st, 3) + (RED[suit] ? -1 : 1)) > r.colorSpread) return false;
  if (to.kind === 'free') return cellAccepts(st, to.i, card, r, -1, override);
  if (to.kind !== 'col') return false;
  let placementState = st;
  if (r.emptyCure) {
    placementState = { ...st, found: [...st.found], ...(st.spur ? { spur: { ...st.spur } } : {}) };
    if (spur) placementState.spur.top--;
    else placementState.found[suit]--;
  }
  return !!canPlaceTableau(placementState, to.i, card, 1, r, override);
}

const customMoves = new Map();
export function registerCustomMove(op, handlers) {
  if (!op || typeof handlers?.apply !== 'function' || typeof handlers?.undo !== 'function') throw new Error('invalid custom move');
  customMoves.set(op, handlers);
}
function customHandler(m) {
  const h = customMoves.get(m.op);
  if (!h) throw new Error(`Unknown custom move: ${m.op}`);
  return h;
}

// ---------------------------------------------------------------------------
// Dealing
// ---------------------------------------------------------------------------

// Microsoft FreeCell deal generation. The deal number seeds a 31-bit LCG from
// the Microsoft C runtime; this reproduces the canonical numbered deals.
// Reference: Jim Horne's mshuffle.txt / Rosetta Code "Deal cards for FreeCell".
export function shuffleForDeal(dealNumber) {
  let state = (dealNumber >>> 0) || 1;
  const rnd = () => {
    state = (Math.imul(state, 214013) + 2531011) & 0x7fffffff;
    return state >> 16;
  };
  const deal = new Array(52);
  for (let i = 0; i < 52; i++) deal[i] = 51 - i;
  for (let i = 0; i < 51; i++) {
    const j = 51 - (rnd() % (52 - i));
    const t = deal[i];
    deal[i] = deal[j];
    deal[j] = t;
  }
  // Deck values are rank-major / suit-minor (0 = Ace of Clubs .. 51 = King of
  // Spades). Convert to our suit-major id (1..52).
  return deal.map((v) => (v % 4) * 13 + ((v / 4) | 0) + 1);
}

// The number of free cells is `state.free.length` (4 in classic FreeCell). Everything below —
// move generation, the solver and the Game class — reads it from the state, so a variant only
// needs to deal with a different count.
export function dealFromSequence(sequence, freeCells = 4) {
  const tableau = [[], [], [], [], [], [], [], []];
  for (let k = 0; k < 52; k++) tableau[k % 8].push(sequence[k]);
  return { tableau, free: new Array(freeCells).fill(0), found: [0, 0, 0, 0] };
}

export function deal(dealNumber, rules = 4) {
  const r = typeof rules === 'number' ? { freeCells: rules } : rules || RULE_DEFAULTS;
  const home = Math.max(0, Math.min(13, Math.floor(r.startHome || 0)));
  const sequence = shuffleForDeal(dealNumber);
  let st;
  if (r.dealSkew) {
    const presets = { slope: [10, 9, 8, 7, 6, 5, 4, 3], valley: [4, 6, 7, 9, 9, 7, 6, 4] };
    const lengths = typeof r.dealSkew === 'string' ? presets[r.dealSkew] : r.dealSkew;
    const total = lengths?.reduce((a, b) => a + b, 0);
    if (!Array.isArray(lengths) || lengths.length !== 8 || lengths.some((n) => !Number.isInteger(n) || n < 0) || (total !== 52 && total !== 52 - home * 4))
      throw new Error('dealSkew needs eight nonnegative lengths totaling 52 or the cards remaining after startHome');
    const cards = total === 52 ? sequence : sequence.filter((id) => rankOf(id) > home);
    st = { tableau: Array.from({ length: 8 }, () => []), free: new Array(r.freeCells ?? 4).fill(0), found: [0, 0, 0, 0] };
    let c = 0;
    for (const card of cards) {
      while (st.tableau[c].length >= lengths[c]) c = (c + 1) % 8;
      st.tableau[c].push(card); c = (c + 1) % 8;
    }
  } else st = dealFromSequence(sequence, r.freeCells ?? 4);
  if (home) {
    st.found.fill(home);
    st.tableau = st.tableau.map((col) => col.filter((id) => rankOf(id) > home));
  }
  if (r.sealedCols?.length) st.sealed = r.sealedCols.reduce((mask, i) => mask | (st.tableau[i]?.length ? 1 << i : 0), 0);
  return st;
}

export function randomDealNumber() {
  return 1 + Math.floor(Math.random() * 32000);
}

export function cloneState(st) {
  return {
    tableau: st.tableau.map((c) => c.slice()),
    free: st.free.slice(),
    found: st.found.slice(),
    ...(st.sealed !== undefined ? { sealed: st.sealed } : {}),
    ...(st.spur ? { spur: { ...st.spur } } : {}),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function canStackOn(column, card, rules, override, st) {
  const r = st ? rulesForState(st, rules) : resolved(rules);
  if (column.length === 0) return !!override?.ignoreRestrictions || ((!r.emptyCure || (st ? cardsHome(st) : 0) >= r.emptyCure) && (!r.emptyMinRank || rankOf(card) >= r.emptyMinRank) && (!r.emptyMaxRank || rankOf(card) <= r.emptyMaxRank || (r.emptyKings && rankOf(card) === 13)));
  const top = column[column.length - 1];
  if (r.loneAccepts && column.length <= r.loneAccepts) override = { ...override, ignoreRank: true, ignoreColour: true };
  if (!override) return builds(top, card, r);
  if (!override.ignoreRestrictions && !cardIsCleansed(top, r) && (r.barrenCards.includes(top) || (r.barren && (r.barren.suits & (1 << suitOf(top))) && (r.barren.ranks & (1 << rankOf(top)))))) return false;
  if (r.anchorCards.includes(top)) return true;
  const pr = rankOf(top) + (r.rankShift[top] || 0), cr = rankOf(card) + (r.rankShift[card] || 0);
  if (!override.ignoreRank && cr !== pr - 1 && !(override.rankGap === 2 && cr === pr - 2) && !(cr === pr + 1 && (r.buildUp & (1 << suitOf(card)))) && !(cr === pr + 1 && (r.suitBuildUp & (1 << suitOf(card))) && suitOf(card) === suitOf(top)) && !(cr === pr && r.twinStack) && !(cr === pr - 2 && r.skipBuild)) return false;
  if (cr === pr - 2 && r.skipBuild && !override.ignoreRank) {
    if (override.ignoreColour || r.skipBuild >= 2 || colorOf(card) === colorOf(top)) return true;
    if (override.rankGap !== 2) return false; // a two-rank ability still adds its ordinary colour link
  }
  if (cr === pr && r.twinStack >= 2) return true;
  return override.ignoreColour || ((r.sameColorRanks & (1 << rankOf(card))) && !cardIsCleansed(card, r) && !override.ignoreRestrictions ? colorOf(card) === colorOf(top) : colorOf(card) !== colorOf(top)) ||
    !!(r.wildRanks & ((1 << rankOf(card)) | (1 << rankOf(top)))) ||
    r.wildCards.includes(card) || r.wildCards.includes(top) ||
    !!((r.suitBuild & (1 << suitOf(card))) && suitOf(card) === suitOf(top)) ||
    !!(cr === pr + 1 && (r.suitBuildUp & (1 << suitOf(card))) && suitOf(card) === suitOf(top));
}

export function foundationAccepts(st, card, rules, dest = foundationDestination(st, card)) {
  if (!card) return false;
  if (dest === 'spur') {
    if (st.spur?.suit !== suitOf(card) || rankOf(card) !== st.spur.top + 1) return false;
  } else if (dest !== 'original' || st.found[suitOf(card)] !== rankOf(card) - 1 || (st.spur?.suit === suitOf(card) && rankOf(card) >= st.spur.base)) return false;
  const r = rulesForState(st, rules);
  if (isPinned(st, card, r)) return false;
  const src = r.cellStack || r.maxEmpty ? sourceOf(st, card) : null;
  if (src?.kind === 'free' && !canLeaveCell(st, src.i, r)) return false;
  // The cap governs excavation; a checked foundation-only finish must remain possible.
  if (!preservesEmptyLimit(st, src, 1, null, r) && !canFinishWithFoundationOnly(st, compileRules({ ...r, maxEmpty: 0, _compiled: false }))) return false;
  if (r.colorSpread && Math.abs(suitHomeCount(st, 1) + suitHomeCount(st, 2) - suitHomeCount(st, 0) - suitHomeCount(st, 3) + (isRed(card) ? 1 : -1)) > r.colorSpread) return false;
  if (r.gate?.suit === suitOf(card) && cardsHome(st) - suitHomeCount(st, r.gate.suit) < r.gate.after) return false;
  if (!r.foundationSpread) return true;
  let lo = 13, hi = 0;
  for (let s = 0; s < 4; s++) {
    const n = s === suitOf(card) ? Math.max(foundationTop(st, s), rankOf(card)) : foundationTop(st, s);
    lo = Math.min(lo, n); hi = Math.max(hi, n);
  }
  return hi - lo <= r.foundationSpread;
}

export function canPlantSpur(st, card, rules) {
  if (!card || st.spur || rankOf(card) < st.found[suitOf(card)] + 2) return false;
  const r = rulesForState(st, rules), src = sourceOf(st, card);
  if (!src || isPinned(st, card, r) || (src.kind === 'free' && !canLeaveCell(st, src.i, r))) return false;
  if (r.gate?.suit === suitOf(card) && cardsHome(st) - suitHomeCount(st, r.gate.suit) < r.gate.after) return false;
  if (r.colorSpread && Math.abs(suitHomeCount(st, 1) + suitHomeCount(st, 2) - suitHomeCount(st, 0) - suitHomeCount(st, 3) + (isRed(card) ? 1 : -1)) > r.colorSpread) return false;
  const tops = st.found.map((n, s) => s === suitOf(card) ? rankOf(card) : n);
  if (r.foundationSpread && Math.max(...tops) - Math.min(...tops) > r.foundationSpread) return false;
  if (!preservesEmptyLimit(st, src, 1, null, r)) return false;
  return true;
}

registerCustomMove('voyage.spur', {
  apply(st, m, rules) {
    const card = m.src?.kind === 'free' ? st.free[m.src.i] : st.tableau[m.src?.i]?.at(-1);
    if ((m.card && card !== m.card) || !canPlantSpur(st, card, rules)) throw new Error('Illegal Suit Spur plant');
    m.card = card;
    if (m.src.kind === 'free') st.free[m.src.i] = 0;
    else st.tableau[m.src.i].pop();
    st.spur = { suit: suitOf(card), base: rankOf(card), top: rankOf(card) };
  },
  undo(st, m) {
    delete st.spur;
    if (m.src.kind === 'free') st.free[m.src.i] = m.card;
    else st.tableau[m.src.i].push(m.card);
  },
});

// Number of cards, counted from the top, that form a valid descending
// alternating-colour run.
export function runLength(column, rules) {
  const r = resolved(rules);
  let n = 1;
  for (let i = column.length - 1; i > 0; i--) {
    if (builds(column[i - 1], column[i], r)) n++;
    else break;
  }
  return n;
}

export function freeCapacity(st, rules) {
  const r = resolved(rules);
  let freeCells = 0;
  const active = activeFreeCells(st, r);
  for (let i = 0; i < active; i++) if (st.free[i] === 0 && !cellIsClosed(st, i, r)) freeCells++;
  let emptyCols = 0;
  for (const c of st.tableau) if (c.length <= r.shallowCols && (!r.emptyCure || cardsHome(st) >= r.emptyCure)) emptyCols++;
  return { freeCells, emptyCols };
}

function fullBonus(st, r) {
  if (!r.fullCellsBonus) return 0;
  const active = activeFreeCells(st, r);
  return r.fullCellsBonus && active > 0 && st.free.slice(0, active).every(Boolean) ? r.fullCellsBonus : 0;
}

// Classic FreeCell supermove capacity: (free cells + 1) * 2^(empty columns).
export function maxMoveSize(st, movingToEmpty, rules, cards) {
  const r = rulesForState(st, rules);
  if (cards?.length && (r.suitRunFree & (1 << suitOf(cards[0]))) && cards.every((id) => suitOf(id) === suitOf(cards[0]))) return Infinity;
  const { freeCells, emptyCols } = freeCapacity(st, r);
  let e = emptyCols - (movingToEmpty ? 1 : 0);
  if (e < 0) e = 0;
  if ((r.emptyCure && cardsHome(st) < r.emptyCure) || (!r.emptyAlwaysCounts && (r.emptyMinRank >= 2 || r.emptyMaxRank || r.emptyColors.some(Boolean)))) e = 0;
  return Math.max(1, (freeCells + 1) * (r.emptyFactor === 2 ? 1 << e : r.emptyFactor ** e) + r.moveBonus + fullBonus(st, r));
}

export function isSolved(st) {
  return cardsHome(st) === 52;
}

export function isValidSequence(column, count, rules) {
  const r = resolved(rules);
  if (count <= 1) return true;
  const start = column.length - count;
  for (let i = start; i < column.length - 1; i++) {
    if (!builds(column[i], column[i + 1], r)) return false;
  }
  return true;
}

// Index of the start of the maximal movable run ending at the top.
export function sequenceStart(column, rules) {
  return column.length - runLength(column, rules);
}

// ---------------------------------------------------------------------------
// Move application (descriptors shared by player engine and solver)
//   { t:'F', src:{kind:'col'|'free', i}, card }
//   { t:'C', fi, src:{kind:'col', i}, card }
//   { t:'T', src:{kind:'col'|'free', i}, count, to, card }
// ---------------------------------------------------------------------------

export function applyMove(st, m, rules) {
  if (st.sealed !== undefined) m.sealedBefore = st.sealed;
  if (m.t === 'X') {
    customHandler(m).apply(st, m, rules);
  } else if (m.t === 'R') {
    m.card = cardId(m.suit, m.from === 'spur' ? st.spur.top-- : st.found[m.suit]--);
    if (m.to.kind === 'free') st.free[m.to.i] = m.card;
    else st.tableau[m.to.i].push(m.card);
  } else if (m.t === 'F') {
    if (m.src.kind === 'free') {
      m.card = st.free[m.src.i];
      st.free[m.src.i] = 0;
    } else {
      m.card = st.tableau[m.src.i].pop();
    }
    if (m.dest === 'spur' || foundationDestination(st, m.card) === 'spur') { m.dest = 'spur'; st.spur.top = rankOf(m.card); }
    else st.found[suitOf(m.card)] = rankOf(m.card);
  } else if (m.t === 'C') {
    m.card = st.tableau[m.src.i].pop();
    st.free[m.fi] = m.card;
  } else if (m.t === 'T') {
    if (m.src.kind === 'free') {
      m.card = st.free[m.src.i];
      st.free[m.src.i] = 0;
      st.tableau[m.to].push(m.card);
    } else {
      const col = st.tableau[m.src.i];
      const cards = col.splice(col.length - m.count, m.count);
      m.cards = cards;
      for (const c of cards) st.tableau[m.to].push(c);
    }
  }
  if (st.sealed) for (let i = 0; i < st.tableau.length; i++) if (!st.tableau[i].length) st.sealed &= ~(1 << i);
}

export function undoMove(st, m, rules) {
  if (m.t === 'X') customHandler(m).undo(st, m, rules);
  else if (m.t === 'R') {
    if (m.to.kind === 'free') st.free[m.to.i] = 0;
    else st.tableau[m.to.i].pop();
    if (m.from === 'spur') st.spur.top++;
    else st.found[m.suit]++;
  } else if (m.t === 'F') {
    if (m.dest === 'spur') st.spur.top--;
    else st.found[suitOf(m.card)] = rankOf(m.card) - 1;
    if (m.src.kind === 'free') st.free[m.src.i] = m.card;
    else st.tableau[m.src.i].push(m.card);
  } else if (m.t === 'C') {
    st.free[m.fi] = 0;
    st.tableau[m.src.i].push(m.card);
  } else if (m.t === 'T') {
    const to = st.tableau[m.to];
    if (m.src.kind === 'free') {
      to.pop();
      st.free[m.src.i] = m.card;
    } else {
      const cards = to.splice(to.length - m.count, m.count);
      const from = st.tableau[m.src.i];
      for (const c of cards) from.push(c);
    }
  }
  if (m.sealedBefore !== undefined) st.sealed = m.sealedBefore;
}

// ---------------------------------------------------------------------------
// Move generation
// ---------------------------------------------------------------------------

export function generateMoves(st, opts = {}) {
  const r = rulesForState(st, opts.rules);
  const moves = [];
  const { freeCells, emptyCols } = freeCapacity(st, r);
  const emptyFree = [];
  const nFree = st.free.length;
  const nCols = st.tableau.length;
  for (let i = 0; i < nFree; i++) if (st.free[i] === 0 && cellIsOpen(st, i, r)) emptyFree.push(i);

  for (let fi = 0; fi < nFree; fi++) {
    const card = st.free[fi];
    if (!card) continue;
    if (!canLeaveCell(st, fi, r)) continue;
    if (foundationAccepts(st, card, r)) {
      moves.push({ t: 'F', src: { kind: 'free', i: fi }, card, score: 1200 + rankOf(card) });
    }
    for (let d = 0; d < nCols; d++) {
      if ((cardIsCleansed(card, r) || r.freeCards.includes(card) || !(r.oneWayCellRanks & (1 << rankOf(card)))) && canPlaceTableau(st, d, card, 1, r)) {
        const s = 800 + (st.tableau[d].length ? 40 : 0) + rankOf(card);
        moves.push({ t: 'T', src: { kind: 'free', i: fi }, count: 1, to: d, card, score: s });
      }
    }
  }

  for (let c = 0; c < nCols; c++) {
    const col = st.tableau[c];
    if (col.length === 0) continue;
    const top = col[col.length - 1];

    if (foundationAccepts(st, top, r)) {
      moves.push({ t: 'F', src: { kind: 'col', i: c }, card: top, score: 1100 + rankOf(top) });
    }

    if (emptyFree.length > 0 && !isPinned(st, top, r)) {
      const s = 250 + (col.length === 1 ? 120 : 0) + (col.length > 1 ? 10 : 0);
      // Cells with distinct locks are not interchangeable; retain one per lock class.
      const seen = new Set();
      for (const fi of emptyFree) {
        // Future thaw/close behaviour is index-dependent too, even while all cells are open.
        const cls = r.cellClose || r.cellThaw || r.cellStack || r.cellsNeedEmpty ? fi : `${r.cellColors[fi] || ''}:${r.cellLimits[fi]?.maxRank ?? ''}:${r.cellLimits[fi]?.minRank ?? ''}:${r.cellLimits[fi]?.suits ?? ''}`;
        if (seen.has(cls)) continue;
        if (!cellAccepts(st, fi, top, r)) continue;
        seen.add(cls);
        moves.push({ t: 'C', fi, src: { kind: 'col', i: c }, card: top, score: s });
      }
    }

    const run = runLength(col, r);
    const fullOnly = opts.fullOnly === true;
    for (let d = 0; d < nCols; d++) {
      if (d === c) continue;
      const destEmpty = st.tableau[d].length === 0;
      const e = (r.emptyCure && cardsHome(st) < r.emptyCure) || (!r.emptyAlwaysCounts && (r.emptyMinRank >= 2 || r.emptyMaxRank || r.emptyColors.some(Boolean))) ? 0 : Math.max(0, emptyCols - (st.tableau[d].length <= r.shallowCols ? 1 : 0));
      const cap = Math.max(1, (freeCells + 1) * (r.emptyFactor === 2 ? 1 << e : r.emptyFactor ** e) + r.moveBonus + fullBonus(st, r));
      let maxK = Math.min(run, Math.floor(cap));
      if (r.suitRunFree & (1 << suitOf(top))) {
        let sameSuit = 1;
        while (sameSuit < run && suitOf(col[col.length - sameSuit - 1]) === suitOf(top)) sameSuit++;
        maxK = Math.max(maxK, sameSuit);
      }
      const ks = fullOnly ? [...new Set([maxK > 1 ? maxK : 1, 1])] : Array.from({ length: maxK }, (_, i) => i + 1);
      for (const k of ks) {
        const card = col[col.length - k];
        if (r.pinned && col.slice(-k).some((id) => isPinned(st, id, r))) continue;
        if (!preservesEmptyLimit(st, { kind: 'col', i: c }, k, d, r) || (destEmpty && r.emptyColors[d] && (r.emptyColors[d] === 'red') !== isRed(card))) continue;
        if (r.suitRunFree && k > cap && k > maxMoveSize(st, st.tableau[d].length <= r.shallowCols, r, col.slice(-k))) continue;
        if (r.openCols || r.loneAccepts || r.emptyCure || r.noExitCols ? !canPlaceTableau(st, d, card, k, r, null, col.slice(-k))
          : (st.sealed & (1 << d)) || (r.maxHeight && st.tableau[d].length + k > r.maxHeight) || !canStackOn(st.tableau[d], card, r)) continue;
        if (destEmpty && k === col.length && !(st.sealed & (1 << c)) && r.emptyColors[c] === r.emptyColors[d] && !!(r.openCols & (1 << c)) === !!(r.openCols & (1 << d)) && !!(r.noExitCols & (1 << c)) === !!(r.noExitCols & (1 << d))) continue; // distinct slots and sealed sources gain capability when moved
        let score = 600 + k;
        if (destEmpty) score = 220 + k;
        if (k === col.length) score += 70; // frees a column
        // Reward exposing a low card, which is what unlocks progress.
        const revealed = col.length - k - 1 >= 0 ? col[col.length - k - 1] : 0;
        if (revealed) {
          const rr = rankOf(revealed);
          if (rr <= 4) score += (5 - rr) * 45;
          if (rr === 1) score += 160;
        }
        moves.push({ t: 'T', src: { kind: 'col', i: c }, count: k, to: d, card, score });
      }
    }
  }
  if (r.foundationReturn && opts.foundationReturns !== false) {
    for (let suit = 0; suit < 4; suit++) {
      if (!st.found[suit]) continue;
      const card = cardId(suit, st.found[suit]);
      for (let d = 0; d < nCols; d++) if (canReturnFoundation(st, suit, { kind: 'col', i: d }, opts.rules))
        moves.push({ t: 'R', suit, to: { kind: 'col', i: d }, card, score: 50 });
      for (const fi of emptyFree) if (canReturnFoundation(st, suit, { kind: 'free', i: fi }, opts.rules))
        moves.push({ t: 'R', suit, to: { kind: 'free', i: fi }, card, score: 40 });
    }
    if (st.spur && st.spur.top > st.spur.base) {
      const suit = st.spur.suit, card = cardId(suit, st.spur.top);
      for (let d = 0; d < nCols; d++) if (canReturnFoundation(st, suit, { kind: 'col', i: d }, opts.rules, null, 'spur'))
        moves.push({ t: 'R', suit, from: 'spur', to: { kind: 'col', i: d }, card, score: 50 });
      for (const fi of emptyFree) if (canReturnFoundation(st, suit, { kind: 'free', i: fi }, opts.rules, null, 'spur'))
        moves.push({ t: 'R', suit, from: 'spur', to: { kind: 'free', i: fi }, card, score: 40 });
    }
  }
  if (st.spur) for (const m of moves) if (m.t === 'F' && foundationDestination(st, m.card) === 'spur') m.dest = 'spur';
  return moves;
}

// ---------------------------------------------------------------------------
// Solver (DFS with safe auto-play, transposition table, heuristic ordering)
// ---------------------------------------------------------------------------

export function hashState(st) {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  const mix = (v) => {
    h1 = Math.imul(h1 ^ v, 16777619);
    h2 = Math.imul(h2 ^ v, 2246822519);
  };
  if (st.sealed !== undefined) { mix(251); mix(st.sealed); }
  if (st.spur) { mix(250); mix(st.spur.suit); mix(st.spur.base); mix(st.spur.top); }
  mix(255);
  for (let i = 0; i < st.free.length; i++) mix(st.free[i]);
  mix(254);
  for (let i = 0; i < 4; i++) mix(st.found[i]);
  for (let c = 0; c < st.tableau.length; c++) {
    mix(253);
    const col = st.tableau[c];
    for (let k = 0; k < col.length; k++) mix(col[k]);
    mix(252);
  }
  return (h1 >>> 0) * 2097152 + ((h2 >>> 0) & 0x1fffff);
}

export function safeToFoundation(st, card, rules, dest = foundationDestination(st, card)) {
  const r = resolved(rules);
  if (r.phase && (!safeToFoundation(st, card, { ...r, phase: null }, dest) || !safeToFoundation(st, card, r.phaseRules, dest))) return false;
  if (!foundationAccepts(st, card, r, dest)) return false;
  // Loose bases and full-cell bonuses can disappear when their card goes home.
  if (r.loneAccepts || (fullBonus(st, r) && st.free.includes(card))) return false;
  // Closing a cell removes parking space, so a foundation move cannot be forced by the search.
  if (r.cellClose?.at.length) return false;
  if (r.openCols && (r.emptyMinRank || r.emptyMaxRank || r.emptyColors.some(Boolean))) return false;
  // A colour balance cap can make the next opposite-colour home move necessary first.
  if (r.colorSpread) return false;
  if (st.spur || r.cellExitWild || r.wildCards.length || r.anchorCards.length || r.buildUp || r.suitBuildUp || r.suitBuild || r.twinStack || r.skipBuild || r.sameColorRanks || Object.keys(r.rankShift).length) {
    for (let child = 1; child <= 52; child++)
      if (child !== card && (r.cellExitWild ? canStackOn([card], child, r, { ignoreColour: true }) : builds(card, child, r)) && !cardIsHome(st, child)) return false;
    return true;
  }
  // Wild ranks add same-colour dependents. Every newly permitted child must be home.
  if (r.wildRanks & ((1 << rankOf(card)) | (1 << (rankOf(card) - 1)))) {
    for (let s = 0; s < 4; s++) if (st.found[s] < rankOf(card) - 1) return false;
    return true;
  }
  const rank = rankOf(card);
  if (rank <= 2) return true;
  const red = isRed(card);
  for (let s = 0; s < 4; s++) {
    if (RED[s] !== red && st.found[s] < rank - 1) return false;
  }
  return true;
}

// A single depth-first search pass.
function solveOnce(initial, opts) {
  const { nodeLimit, timeLimitMs, maxDepth, childCap, fullOnly, jitter, rules, rng } = opts;
  const startTime = Date.now();

  const st = cloneState(initial);
  const visited = new Set();
  const path = [];
  let nodes = 0;
  let aborted = false;
  let hitDepth = false;

  const dfs = (depth) => {
    nodes++;
    if (aborted) return false;
    if (nodes > nodeLimit) {
      aborted = true;
      return false;
    }
    if ((nodes & 1023) === 0 && Date.now() - startTime > timeLimitMs) {
      aborted = true;
      return false;
    }
    if (isSolved(st)) return true;
    if (depth >= maxDepth) {
      hitDepth = true;
      return false;
    }

    // Safe auto-play (monotonic, never reduces solvability).
    const autos = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (let fi = 0; fi < st.free.length; fi++) {
        const card = st.free[fi];
        if (card && safeToFoundation(st, card, rules)) {
          const m = { t: 'F', src: { kind: 'free', i: fi }, card };
          applyMove(st, m, rules);
          autos.push(m);
          changed = true;
        }
      }
      for (let c = 0; c < st.tableau.length; c++) {
        const col = st.tableau[c];
        if (!col.length) continue;
        const card = col[col.length - 1];
        if (safeToFoundation(st, card, rules)) {
          const m = { t: 'F', src: { kind: 'col', i: c }, card };
          applyMove(st, m, rules);
          autos.push(m);
          changed = true;
        }
      }
    }
    for (const m of autos) path.push(m);
    if (isSolved(st)) return true;

    const key = hashState(st);
    if (visited.has(key)) {
      for (let i = autos.length - 1; i >= 0; i--) {
        undoMove(st, autos[i], rules);
        path.pop();
      }
      return false;
    }
    visited.add(key);

    const moves = generateMoves(st, { fullOnly, rules, foundationReturns: false });
    if (jitter > 0) {
      for (const m of moves) m.score += (rng() - 0.5) * jitter;
    }
    moves.sort((a, b) => b.score - a.score);

    let expanded = 0;
    for (const m of moves) {
      if (childCap > 0 && expanded >= childCap) break;
      expanded++;
      applyMove(st, m, rules);
      path.push(m);
      if (dfs(depth + 1)) return true;
      path.pop();
      undoMove(st, m, rules);
      if (aborted) break;
    }

    for (let i = autos.length - 1; i >= 0; i--) {
      undoMove(st, autos[i], rules);
      path.pop();
    }
    return false;
  };

  const found = dfs(0);
  return { found, path, nodes, aborted, hitDepth };
}

// Options include rules, and optional rng/attemptLimit for deterministic bounded tools.
// Solvability search. Uses randomized-restart depth-first search: solvable
// positions are found quickly, while a `solvable: false` result is only
// returned when the search space was exhausted within the limits. Positions
// that cannot be decided are reported as `solvable: null` (unknown).
export function solve(initial, options = {}) {
  const rules = resolved(options.rules);
  const timeLimitMs = options.timeLimitMs ?? 8000;
  const perRunNodes = options.perRunNodes ?? 120000;
  const perRunMs = options.perRunMs ?? 250;
  const maxDepth = options.maxDepth ?? 260;
  const childCap = options.childCap ?? 0;
  const fullOnly = options.fullOnly !== false;
  const baseJitter = options.jitter ?? 900;
  const startTime = Date.now();

  let totalNodes = 0;
  let attempt = 0;

  while (Date.now() - startTime < timeLimitMs && attempt < (options.attemptLimit ?? Infinity)) {
    const jitter = attempt === 0 ? 0 : baseJitter * (1 + (attempt % 3) * 0.35);
    const r = solveOnce(initial, {
      nodeLimit: perRunNodes,
      timeLimitMs: perRunMs,
      maxDepth,
      childCap,
      fullOnly,
      jitter,
      rules,
      rng: options.rng ?? Math.random,
    });
    totalNodes += r.nodes;
    if (r.found) {
      return {
        solvable: true,
        confident: true,
        solution: r.path.map(cleanMove),
        nodes: totalNodes,
        attempts: attempt + 1,
        elapsedMs: Date.now() - startTime,
      };
    }
    if (!r.aborted && !r.hitDepth) {
      // The entire reachable state space was searched: provably unsolvable.
      return {
        solvable: rules.foundationReturn || (fullOnly && (!rules.classic || initial.spur)) ? null : false,
        confident: !rules.foundationReturn && (!fullOnly || (rules.classic && !initial.spur)),
        solution: null,
        nodes: totalNodes,
        attempts: attempt + 1,
        elapsedMs: Date.now() - startTime,
      };
    }
    attempt++;
  }

  return {
    solvable: null,
    confident: false,
    solution: null,
    nodes: totalNodes,
    attempts: attempt,
    elapsedMs: Date.now() - startTime,
  };
}

export function cleanMove(m) {
  if (m.t === 'X' || m.t === 'R' || m.override) return structuredClone(m);
  if (m.t === 'F') return { t: 'F', src: { kind: m.src.kind, i: m.src.i }, card: m.card, ...(m.dest ? { dest: m.dest } : {}) };
  if (m.t === 'C') return { t: 'C', fi: m.fi, src: { kind: 'col', i: m.src.i }, card: m.card };
  return { t: 'T', src: { kind: m.src.kind, i: m.src.i }, count: m.count, to: m.to, card: m.card };
}

// Moves to the foundations that can never hurt the player ("safe" auto-plays).
// A card must be the next one its own foundation needs, and nothing left on the table may still
// need it as a base: its rank is at most 2, or both opposite-colour foundations already hold a
// card of rank >= (rank - 1). Only column tops and free-cell cards are considered.
// Returns [{ src: {kind, i}, card }].
export function safeFoundationMoves(st, rules) {
  const r = resolved(rules), out = [];
  for (let c = 0; c < st.tableau.length; c++) {
    const col = st.tableau[c];
    if (col.length && safeToFoundation(st, col[col.length - 1], r)) out.push({ src: { kind: 'col', i: c }, card: col[col.length - 1] });
  }
  for (let f = 0; f < st.free.length; f++) if (st.free[f] && safeToFoundation(st, st.free[f], r)) out.push({ src: { kind: 'free', i: f }, card: st.free[f] });
  if (st.spur) for (const m of out) if (foundationDestination(st, m.card) === 'spur') m.dest = 'spur';
  return out;
}

// Every legal move to a foundation right now (column tops and free cells), lowest rank first.
export function legalFoundationMoves(st, rules) {
  const r = resolved(rules);
  const out = [];
  for (let c = 0; c < st.tableau.length; c++) {
    const col = st.tableau[c];
    if (col.length && foundationAccepts(st, col[col.length - 1], r)) out.push({ src: { kind: 'col', i: c }, card: col[col.length - 1] });
  }
  for (let f = 0; f < st.free.length; f++) {
    if (st.free[f] && foundationAccepts(st, st.free[f], r)) out.push({ src: { kind: 'free', i: f }, card: st.free[f] });
  }
  if (st.spur) for (const m of out) if (foundationDestination(st, m.card) === 'spur') m.dest = 'spur';
  return out.sort((a, b) => rankOf(a.card) - rankOf(b.card));
}

// True when foundation moves alone can clear the whole table. Playing a legal foundation move never
// makes another one illegal, so a greedy simulation decides this exactly, regardless of order.
export function canFinishWithFoundationOnly(st, rules) {
  const r = resolved(rules);
  const sim = cloneState(st);
  for (;;) {
    const moves = legalFoundationMoves(sim, r);
    if (!moves.length) break;
    for (const m of moves) {
      // Re-check: an earlier move in this batch may have changed the column we meant to pop.
      const col = m.src.kind === 'col' ? sim.tableau[m.src.i] : null;
      const card = m.src.kind === 'col' ? col[col.length - 1] : sim.free[m.src.i];
      if (card === m.card && foundationAccepts(sim, card, r)) applyMove(sim, { t: 'F', src: m.src, card });
    }
  }
  return sim.tableau.every((c) => c.length === 0) && sim.free.every((f) => !f);
}

// ---------------------------------------------------------------------------
// Player-facing game (tracks history for undo)
// ---------------------------------------------------------------------------

export class Game {
  constructor(dealNumber, { freeCells, rules } = {}) {
    this.rules = structuredClone({ ...RULE_DEFAULTS, ...rules, freeCells: freeCells ?? rules?.freeCells ?? 4 });
    // A caller may supply a search snapshot; live game rules must remain plain and mutable.
    for (const key of ['_compiled', 'classic', 'build', 'noCellLo', 'noCellHi', 'phaseRules']) delete this.rules[key];
    this.override = null;
    freeCells = this.rules.freeCells;
    this.dealNumber = dealNumber;
    this.freeCells = freeCells;
    this.state = deal(dealNumber, this.rules);
    this.history = [];
    this.initial = cloneState(this.state);
  }

  reset(dealNumber = this.dealNumber) {
    this.dealNumber = dealNumber;
    this.state = deal(dealNumber, this.rules);
    this.override = null;
    this.history = [];
    this.initial = cloneState(this.state);
  }

  get tableau() {
    return this.state.tableau;
  }
  get free() {
    return this.state.free;
  }
  get found() {
    return this.state.found;
  }

  isWon() {
    return isSolved(this.state);
  }

  // --- legality ---------------------------------------------------------

  canMoveSequenceStart(colIndex, startIndex) {
    const col = this.tableau[colIndex];
    if (startIndex < 0 || startIndex >= col.length) return false;
    if (this.rules.pinned && col.slice(startIndex).some((id) => isPinned(this.state, id, this.rules))) return false;
    return !!this.override?.anyCard || startIndex >= sequenceStart(col, this.rules);
  }

  canDropTableau(colIndex, card, count = 1, cards) {
    return !!canPlaceTableau(this.state, colIndex, card, count, this.rules, this.override, cards);
  }

  canDropFoundation(card, dest) {
    return foundationAccepts(this.state, card, this.rules, dest);
  }

  canDropFreeCell(freeIndex, card) {
    freeIndex = cellEntryIndex(this.state, freeIndex, this.rules);
    return card ? cellAccepts(this.state, freeIndex, card, this.rules, 0, this.override)
      : this.free[freeIndex] === 0 && cellIsOpen(this.state, freeIndex, this.rules);
  }

  canMoveFreeToTableau(fi, destCol) {
    const card = this.free[fi];
    const r = rulesForState(this.state, this.rules);
    return !!card && (cardIsCleansed(card, r) || r.freeCards.includes(card) || !(r.oneWayCellRanks & (1 << rankOf(card)))) && this.canDropTableau(destCol, card, 1);
  }

  canReturnFoundation(suit, to, from) {
    if (to?.kind === 'free') to = { ...to, i: cellEntryIndex(this.state, to.i, this.rules) };
    return !!canReturnFoundation(this.state, suit, to, this.rules, this.override, from);
  }

  // --- mutations --------------------------------------------------------

  moveToFoundation(src, dest) {
    const card = this._peek(src);
    if (!card || !foundationAccepts(this.state, card, this.rules, dest)) return null;
    const m = { t: 'F', src, card };
    if (foundationDestination(this.state, card) === 'spur') m.dest = 'spur';
    this._apply(m);
    this.history.push(m);
    return m;
  }

  moveToFreeCell(src, fi) {
    fi = cellEntryIndex(this.state, fi, this.rules);
    const card = this._peek(src);
    if (!card || !this.canDropFreeCell(fi, card)) return null;
    if (src.kind !== 'col') return null;
    const m = { t: 'C', fi, src, card };
    this._apply(m);
    this.history.push(m);
    return m;
  }

  moveSequenceToTableau(srcCol, startIndex, destCol) {
    const col = this.tableau[srcCol];
    if (srcCol === destCol || !this.canMoveSequenceStart(srcCol, startIndex)) return null;
    const count = col.length - startIndex;
    const card = col[startIndex];
    if (!this.canDropTableau(destCol, card, count, col.slice(startIndex))) return null;
    const m = { t: 'T', src: { kind: 'col', i: srcCol }, count, to: destCol, card };
    this._apply(m);
    this.history.push(m);
    return m;
  }

  moveFreeToTableau(fi, destCol) {
    const card = this.free[fi];
    if (!this.canMoveFreeToTableau(fi, destCol)) return null;
    const m = { t: 'T', src: { kind: 'free', i: fi }, count: 1, to: destCol, card };
    this._apply(m);
    this.history.push(m);
    return m;
  }

  moveFoundationReturn(suit, to, from) {
    if (to?.kind === 'free') to = { ...to, i: cellEntryIndex(this.state, to.i, this.rules) };
    if (!this.canReturnFoundation(suit, to, from)) return null;
    const m = { t: 'R', suit, to: { ...to } };
    if (from === 'spur') m.from = 'spur';
    this._apply(m);
    this.history.push(m);
    return m;
  }

  applyCharmMove(m) {
    if (m.t !== 'X') throw new Error('Expected custom X move');
    return this.applyDescriptor(m);
  }

  _apply(m) {
    const tableauDrop = m.t === 'T' || (m.t === 'R' && m.to.kind === 'col') || (m.t === 'X' && m.tableauDrop === true);
    const consumesOverride = tableauDrop || ((m.t === 'C' || (m.t === 'R' && m.to.kind === 'free')) && this.override?.ignoreRestrictions);
    if (consumesOverride && this.override) m.override = structuredClone(this.override);
    applyMove(this.state, m, this.rules);
    if (consumesOverride && m.override) this.override = null;
  }

  // Apply a descriptor produced by the solver (assumed legal).
  applyDescriptor(m) {
    const copy = cleanMove(m);
    this._apply(copy);
    this.history.push(copy);
    return copy;
  }

  undo() {
    const m = this.history.pop();
    if (!m) return null;
    undoMove(this.state, m, this.rules);
    if (m.override) this.override = { ...m.override };
    return m;
  }

  _peek(src) {
    if (src.kind === 'free') return this.free[src.i] || null;
    const col = this.tableau[src.i];
    return col.length ? col[col.length - 1] : null;
  }
}
