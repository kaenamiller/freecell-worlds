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
});

export function compileRules(r = RULE_DEFAULTS) {
  if (r._compiled) return r;
  const out = { ...RULE_DEFAULTS, ...r, _compiled: true, noCellLo: 0, noCellHi: 0 };
  for (const id of out.noCellCards) {
    if (id <= 32) out.noCellLo |= 1 << (id - 1);
    else out.noCellHi |= 1 << (id - 33);
  }
  // Only variant stacking pays for a lookup table; classic keeps its original predicate.
  if (out.wildRanks || out.suitBuild || out.barren) {
    out.build = new Uint8Array(53 * 53);
    for (let parent = 1; parent <= 52; parent++) for (let child = 1; child <= 52; child++) {
      const pr = rankOf(parent), cr = rankOf(child), ps = suitOf(parent);
      const barred = out.barren && (out.barren.suits & (1 << ps)) && (out.barren.ranks & (1 << pr));
      out.build[parent * 53 + child] = !barred && cr === pr - 1 && (
        colorOf(parent) !== colorOf(child) || (out.wildRanks & ((1 << pr) | (1 << cr))) ||
        ((out.suitBuild & (1 << ps)) && ps === suitOf(child))) ? 1 : 0;
    }
  }
  out.classic = Object.keys(RULE_DEFAULTS).every((k) => k === 'freeCells' || JSON.stringify(out[k]) === JSON.stringify(RULE_DEFAULTS[k]));
  return out;
}
const CLASSIC_RULES = compileRules();
const resolved = (r) => !r ? CLASSIC_RULES : r._compiled ? r : compileRules(r);

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
  const home = st.found[0] + st.found[1] + st.found[2] + st.found[3] + homeAdjustment;
  let frozen = Math.min(st.free.length, Math.max(0, thaw.frozen));
  for (let i = 0; i < thaw.frozen; i++) if (home >= (thaw.at[i] ?? Infinity)) frozen--;
  return st.free.length - Math.max(0, frozen);
}

export function cellAccepts(st, i, card, rules, homeAdjustment = 0) {
  const r = resolved(rules);
  if (!card || i < 0 || i >= st.free.length || st.free[i] || i >= activeFreeCells(st, r, homeAdjustment)) return false;
  if ((r.noCellRanks & (1 << rankOf(card))) || (card <= 32
    ? r.noCellLo & (1 << (card - 1)) : r.noCellHi & (1 << (card - 33)))) return false;
  const lock = r.cellColors[i];
  return !lock || (lock === 'red') === isRed(card);
}

export function canPlaceTableau(st, i, card, count = 1, rules, override) {
  const r = resolved(rules), col = st.tableau[i];
  if (!col || !card || (st.sealed & (1 << i)) || (r.maxHeight && col.length + count > r.maxHeight)) return false;
  if (!canStackOn(col, card, r, override)) return false;
  return count === 1 || override?.ignoreCap || count <= maxMoveSize(st, col.length === 0, r);
}

// R moves must remain legal after lowering the foundation (including re-freezing a cell).
export function canReturnFoundation(st, suit, to, rules, override) {
  const r = resolved(rules);
  if (!r.foundationReturn || !st.found[suit] || !to) return false;
  if (r.foundationSpread) {
    let lo = 13, hi = 0;
    for (let s = 0; s < 4; s++) {
      const n = st.found[s] - (s === suit ? 1 : 0);
      lo = Math.min(lo, n); hi = Math.max(hi, n);
    }
    if (hi - lo > r.foundationSpread) return false;
  }
  const card = cardId(suit, st.found[suit]);
  return to.kind === 'free' ? cellAccepts(st, to.i, card, r, -1)
    : to.kind === 'col' && !!canPlaceTableau(st, to.i, card, 1, r, override);
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
  const st = dealFromSequence(shuffleForDeal(dealNumber), r.freeCells ?? 4);
  const home = Math.max(0, Math.min(13, Math.floor(r.startHome || 0)));
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
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function canStackOn(column, card, rules, override) {
  const r = resolved(rules);
  if (column.length === 0) return !r.emptyMinRank || rankOf(card) >= r.emptyMinRank;
  const top = column[column.length - 1];
  if (!override) return builds(top, card, r);
  if (r.barren && (r.barren.suits & (1 << suitOf(top))) && (r.barren.ranks & (1 << rankOf(top)))) return false;
  if (!override.ignoreRank && rankOf(card) !== rankOf(top) - 1) return false;
  return override.ignoreColour || colorOf(card) !== colorOf(top) ||
    !!(r.wildRanks & ((1 << rankOf(card)) | (1 << rankOf(top)))) ||
    !!((r.suitBuild & (1 << suitOf(card))) && suitOf(card) === suitOf(top));
}

export function foundationAccepts(st, card, rules) {
  if (!card || st.found[suitOf(card)] !== rankOf(card) - 1) return false;
  const r = resolved(rules);
  if (!r.foundationSpread) return true;
  let lo = 13, hi = 0;
  for (let s = 0; s < 4; s++) {
    const n = s === suitOf(card) ? rankOf(card) : st.found[s];
    lo = Math.min(lo, n); hi = Math.max(hi, n);
  }
  return hi - lo <= r.foundationSpread;
}

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
  let freeCells = 0;
  const active = activeFreeCells(st, rules);
  for (let i = 0; i < active; i++) if (st.free[i] === 0) freeCells++;
  let emptyCols = 0;
  for (const c of st.tableau) if (c.length === 0) emptyCols++;
  return { freeCells, emptyCols };
}

// Classic FreeCell supermove capacity: (free cells + 1) * 2^(empty columns).
export function maxMoveSize(st, movingToEmpty, rules) {
  const r = resolved(rules);
  const { freeCells, emptyCols } = freeCapacity(st, r);
  let e = emptyCols - (movingToEmpty ? 1 : 0);
  if (e < 0) e = 0;
  if (r.emptyMinRank >= 2) e = 0;
  return Math.max(1, (freeCells + 1) * (r.emptyFactor === 2 ? 1 << e : r.emptyFactor ** e) + r.moveBonus);
}

export function isSolved(st) {
  return st.found[0] + st.found[1] + st.found[2] + st.found[3] === 52;
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
    m.card = cardId(m.suit, st.found[m.suit]);
    st.found[m.suit]--;
    if (m.to.kind === 'free') st.free[m.to.i] = m.card;
    else st.tableau[m.to.i].push(m.card);
  } else if (m.t === 'F') {
    if (m.src.kind === 'free') {
      m.card = st.free[m.src.i];
      st.free[m.src.i] = 0;
    } else {
      m.card = st.tableau[m.src.i].pop();
    }
    st.found[suitOf(m.card)] = rankOf(m.card);
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
    st.found[m.suit]++;
  } else if (m.t === 'F') {
    st.found[suitOf(m.card)] = rankOf(m.card) - 1;
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
  const r = resolved(opts.rules);
  const moves = [];
  const { freeCells, emptyCols } = freeCapacity(st, r);
  const emptyFree = [];
  const nFree = st.free.length;
  const nCols = st.tableau.length;
  for (let i = 0; i < nFree; i++) if (st.free[i] === 0 && i < activeFreeCells(st, r)) emptyFree.push(i);

  for (let fi = 0; fi < nFree; fi++) {
    const card = st.free[fi];
    if (!card) continue;
    if (foundationAccepts(st, card, r)) {
      moves.push({ t: 'F', src: { kind: 'free', i: fi }, card, score: 1200 + rankOf(card) });
    }
    for (let d = 0; d < nCols; d++) {
      if (!(r.oneWayCellRanks & (1 << rankOf(card))) && canPlaceTableau(st, d, card, 1, r)) {
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

    if (emptyFree.length > 0) {
      const s = 250 + (col.length === 1 ? 120 : 0) + (col.length > 1 ? 10 : 0);
      // Cells with distinct locks are not interchangeable; retain one per lock class.
      let seen = 0;
      for (const fi of emptyFree) {
        const cls = r.cellColors[fi] === 'red' ? 2 : r.cellColors[fi] === 'black' ? 4 : 1;
        if (seen & cls) continue;
        if (!cellAccepts(st, fi, top, r)) continue;
        seen |= cls;
        moves.push({ t: 'C', fi, src: { kind: 'col', i: c }, card: top, score: s });
      }
    }

    const run = runLength(col, r);
    const fullOnly = opts.fullOnly === true;
    for (let d = 0; d < nCols; d++) {
      if (d === c) continue;
      const destEmpty = st.tableau[d].length === 0;
      const e = r.emptyMinRank >= 2 ? 0 : Math.max(0, emptyCols - (destEmpty ? 1 : 0));
      const cap = Math.max(1, (freeCells + 1) * (r.emptyFactor === 2 ? 1 << e : r.emptyFactor ** e) + r.moveBonus);
      const maxK = Math.min(run, Math.floor(cap));
      const ks = fullOnly ? [...new Set([maxK > 1 ? maxK : 1, 1])] : Array.from({ length: maxK }, (_, i) => i + 1);
      for (const k of ks) {
        const card = col[col.length - k];
        if ((st.sealed & (1 << d)) || (r.maxHeight && st.tableau[d].length + k > r.maxHeight) || !canStackOn(st.tableau[d], card, r)) continue;
        if (destEmpty && k === col.length && !(st.sealed & (1 << c))) continue; // sealed sources gain capability when emptied
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
      for (let d = 0; d < nCols; d++) if (canReturnFoundation(st, suit, { kind: 'col', i: d }, r))
        moves.push({ t: 'R', suit, to: { kind: 'col', i: d }, card, score: 50 });
      for (const fi of emptyFree) if (canReturnFoundation(st, suit, { kind: 'free', i: fi }, r))
        moves.push({ t: 'R', suit, to: { kind: 'free', i: fi }, card, score: 40 });
    }
  }
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

export function safeToFoundation(st, card, rules) {
  const r = resolved(rules);
  if (!foundationAccepts(st, card, r)) return false;
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
        solvable: rules.foundationReturn || (fullOnly && !rules.classic) ? null : false,
        confident: !rules.foundationReturn && (!fullOnly || rules.classic),
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
  if (m.t === 'F') return { t: 'F', src: { kind: m.src.kind, i: m.src.i }, card: m.card };
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
    return !!this.override?.anyCard || startIndex >= sequenceStart(col, this.rules);
  }

  canDropTableau(colIndex, card, count = 1) {
    return !!canPlaceTableau(this.state, colIndex, card, count, this.rules, this.override);
  }

  canDropFoundation(card) {
    return foundationAccepts(this.state, card, this.rules);
  }

  canDropFreeCell(freeIndex, card) {
    return card ? cellAccepts(this.state, freeIndex, card, this.rules)
      : this.free[freeIndex] === 0 && freeIndex < activeFreeCells(this.state, this.rules);
  }

  canMoveFreeToTableau(fi, destCol) {
    const card = this.free[fi];
    return !!card && !(this.rules.oneWayCellRanks & (1 << rankOf(card))) && this.canDropTableau(destCol, card, 1);
  }

  canReturnFoundation(suit, to) {
    return !!canReturnFoundation(this.state, suit, to, this.rules, this.override);
  }

  // --- mutations --------------------------------------------------------

  moveToFoundation(src) {
    const card = this._peek(src);
    if (!card || !foundationAccepts(this.state, card, this.rules)) return null;
    const m = { t: 'F', src, card };
    this._apply(m);
    this.history.push(m);
    return m;
  }

  moveToFreeCell(src, fi) {
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
    if (!this.canDropTableau(destCol, card, count)) return null;
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

  moveFoundationReturn(suit, to) {
    if (!this.canReturnFoundation(suit, to)) return null;
    const m = { t: 'R', suit, to: { ...to } };
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
    if (tableauDrop && this.override) m.override = { ...this.override };
    applyMove(this.state, m, this.rules);
    if (tableauDrop && m.override) this.override = null;
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
