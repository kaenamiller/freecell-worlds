// Offline / worker difficulty rating for Voyage seed bank.
// Pure ES module — imports rules engine only.

import {
  cloneState,
  applyMove,
  undoMove,
  generateMoves,
  isSolved,
  rankOf,
  suitOf,
  foundationAccepts,
  safeFoundationMoves,
  solve,
} from './rules.js';

// ---------------------------------------------------------------------------
// Tunable score weights (exported for game + bank metadata)
// ---------------------------------------------------------------------------

export const SCORE_WEIGHT_MIN_CELLS = 42;
/** Calibrated from seed bank (60/30/10 variance shares); charms shift score by ±SCORE_WEIGHT_MIN_CELLS per cell. */
export const SCORE_WEIGHT_MANUAL_MOVES = 2.985;
export const SCORE_WEIGHT_BURY = 1.273;

/** Default tier cut points on composite score (7 tiers = 6 interior cuts). Filled by seed bank build. */
export const TIER_CUTS = [0, 0, 0, 0, 0, 0];

// ---------------------------------------------------------------------------
// Burial (static deal features)
// ---------------------------------------------------------------------------

const ACE_IDS = [1, 14, 27, 40];
const TWO_IDS = [2, 15, 28, 41];

function cardsAboveInColumn(col, targetId) {
  const idx = col.indexOf(targetId);
  if (idx < 0) return 0;
  return col.length - idx - 1;
}

/** Cards sitting above each ace/two in the initial tableau, weighted. */
export function computeBury(state) {
  let bury = 0;
  for (const col of state.tableau) {
    for (const id of ACE_IDS) bury += cardsAboveInColumn(col, id) * 5;
    for (const id of TWO_IDS) bury += cardsAboveInColumn(col, id) * 2;
  }
  // Low cards deep in columns (rank <= 5) add a little pressure.
  for (const col of state.tableau) {
    for (let i = 0; i < col.length; i++) {
      const r = rankOf(col[i]);
      if (r <= 5) bury += (6 - r) * (col.length - i - 1) * 0.15;
    }
  }
  return Math.round(bury * 10) / 10;
}

// ---------------------------------------------------------------------------
// Move counting (game rules: supermove = 1; safe auto-F = not manual)
// ---------------------------------------------------------------------------

function isSafeFoundationMove(st, card) {
  return safeFoundationMoves(st).some((m) => m.card === card);
}

/** Apply all safe foundation moves; returns moves appended (for replay). */
function autoPlaySafeFoundations(st, out) {
  let changed = true;
  while (changed) {
    changed = false;
    const safes = safeFoundationMoves(st);
    for (const { src, card } of safes) {
      const m = { t: 'F', src, card, auto: true };
      applyMove(st, m);
      out.push(m);
      changed = true;
    }
  }
}

function countManualInPath(path) {
  let n = 0;
  for (const m of path) {
    if (m.t === 'F' && m.auto) continue;
    if (m.t === 'F' && m.safeAuto) continue;
    n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Short-solution search (weighted A* on manual moves + safe autoplay)
// ---------------------------------------------------------------------------

function hashState(st) {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  const mix = (v) => {
    h1 = Math.imul(h1 ^ v, 16777619);
    h2 = Math.imul(h2 ^ v, 2246822519);
  };
  mix(255);
  for (let i = 0; i < st.free.length; i++) mix(st.free[i]);
  mix(254);
  for (let i = 0; i < 4; i++) mix(st.found[i]);
  for (let c = 0; c < 8; c++) {
    mix(253);
    const col = st.tableau[c];
    for (let k = 0; k < col.length; k++) mix(col[k]);
    mix(252);
  }
  return (h1 >>> 0) * 2097152 + ((h2 >>> 0) & 0x1fffff);
}

function cardsNotHome(st) {
  let n = 0;
  for (const col of st.tableau) n += col.length;
  for (const f of st.free) if (f) n++;
  return n;
}

/** Admissible-ish lower bound: each manual move can send at most one card home indirectly. */
function heuristic(st) {
  const left = cardsNotHome(st);
  let h = left;
  // Penalize blocking low ranks still buried.
  for (const col of st.tableau) {
    for (let i = 0; i < col.length; i++) {
      const r = rankOf(col[i]);
      if (r <= 3) h += (col.length - i) * 0.35;
    }
  }
  return h;
}

function stateWithFreeCells(state, k) {
  const st = cloneState(state);
  st.free = new Array(k).fill(0);
  return st;
}

function annotateManualFlags(path, initial) {
  const st = cloneState(initial);
  for (const m of path) {
    if (m.t === 'F' && !m.auto) {
      m.safeAuto = isSafeFoundationMove(st, m.card);
    }
    applyMove(st, m);
  }
}

/**
 * Find a short solution path; returns { path, moves, manualMoves } or null.
 * Path includes safe auto-F moves with auto:true (not counted in manualMoves).
 */
export function shortSolve(initial, opts = {}) {
  const budgetMs = opts.budgetMs ?? 4000;
  const nodeLimit = opts.nodeLimit ?? 180000;
  const maxManual = opts.maxManual ?? 120;
  const start = Date.now();

  const st = cloneState(initial);
  const bootstrap = [];
  autoPlaySafeFoundations(st, bootstrap);
  if (isSolved(st)) {
    return { path: bootstrap, moves: bootstrap.length, manualMoves: 0 };
  }

  const open = [];
  const g0 = 0;
  const key0 = hashState(st);
  open.push({ st: cloneState(st), path: bootstrap.slice(), g: g0, f: g0 + heuristic(st), key: key0 });
  const bestG = new Map([[key0, g0]]);
  const closed = new Set();

  let nodes = 0;
  let best = null;
  let bestManual = Infinity;

  while (open.length && Date.now() - start < budgetMs && nodes < nodeLimit) {
    open.sort((a, b) => a.f - b.f || a.g - b.g);
    const cur = open.shift();
    nodes++;

    if (cur.g >= bestManual) continue;
    if (closed.has(cur.key)) continue;
    closed.add(cur.key);

    if (cur.g > maxManual) continue;

    const moves = generateMoves(cur.st, { fullOnly: true });
    moves.sort((a, b) => b.score - a.score);

    let expanded = 0;
    const childCap = opts.childCap ?? 28;
    for (const mv of moves) {
      if (expanded >= childCap) break;
      expanded++;

      const st2 = cloneState(cur.st);
      const path2 = cur.path.slice();
      const manualHere = mv.t === 'F' && !isSafeFoundationMove(st2, mv.card) ? 1 : mv.t === 'F' ? 0 : 1;
      const mCopy = { ...mv };
      if (mv.t === 'F' && manualHere === 0) mCopy.auto = true;

      applyMove(st2, mCopy);
      path2.push(mCopy);
      autoPlaySafeFoundations(st2, path2);

      if (isSolved(st2)) {
        const mm = countManualInPath(path2);
        if (mm < bestManual) {
          bestManual = mm;
          best = path2;
          if (mm <= (opts.targetManual ?? 55)) return { path: best, moves: best.length, manualMoves: mm, nodes, elapsedMs: Date.now() - start };
        }
        continue;
      }

      const g2 = cur.g + (manualHere || 0);
      if (g2 >= bestManual) continue;

      const key2 = hashState(st2);
      const prev = bestG.get(key2);
      if (prev !== undefined && prev <= g2) continue;
      bestG.set(key2, g2);

      const f2 = g2 + heuristic(st2);
      open.push({ st: st2, path: path2, g: g2, f: f2, key: key2 });
    }
  }

  if (best) {
    return { path: best, moves: best.length, manualMoves: bestManual, nodes, elapsedMs: Date.now() - start };
  }
  return null;
}

// ---------------------------------------------------------------------------
// minCells via existing DFS solver
// ---------------------------------------------------------------------------

function solvableWithCells(state, k, budgetMs) {
  const st = stateWithFreeCells(state, k);
  const r = solve(st, {
    timeLimitMs: budgetMs,
    perRunMs: Math.min(200, budgetMs / 4),
    perRunNodes: 80000,
    maxDepth: 280,
    fullOnly: true,
  });
  return r.solvable;
}

// ---------------------------------------------------------------------------
// Composite rating
// ---------------------------------------------------------------------------

export function compositeScore(minCells, manualMoves, bury) {
  const mc = minCells === null ? 5 : minCells;
  const mm = manualMoves ?? 0;
  return (
    mc * SCORE_WEIGHT_MIN_CELLS +
    mm * SCORE_WEIGHT_MANUAL_MOVES +
    bury * SCORE_WEIGHT_BURY
  );
}

/** Difficulty score without manual-move term (minCells + bury only). */
export function compositeScoreStructural(minCells, bury) {
  const mc = minCells === null ? 5 : minCells;
  return mc * SCORE_WEIGHT_MIN_CELLS + bury * SCORE_WEIGHT_BURY;
}

/** Heuristic: long DFS fallback paths are typically 100+ manual moves. */
export function inferMovesSource(row) {
  if (row.movesSource === 'short' || row.movesSource === 'fallback') return row.movesSource;
  if (row.manualMoves == null) return null;
  if (row.manualMoves <= 70) return 'short';
  return 'fallback';
}

export function tierOf(score, cuts = TIER_CUTS) {
  for (let t = 0; t < cuts.length; t++) {
    if (score < cuts[t]) return t + 1;
  }
  return cuts.length + 1;
}

/**
 * Rate a deal state for the seed bank.
 * @param {object} state — tableau + free + found (typically fresh deal, 4 free cells)
 * @param {object} opts — { budgetMs, minCellsBudgetMs, shortBudgetMs }
 */
export function rateState(state, opts = {}) {
  const totalBudget = opts.budgetMs ?? 12000;
  const t0 = Date.now();
  const bury = computeBury(state);

  const minCellsBudget = opts.minCellsBudgetMs ?? Math.min(5000, totalBudget * 0.45);
  const shortBudget = opts.shortBudgetMs ?? Math.min(6000, totalBudget * 0.45);

  const solvableByCells = { 0: null, 1: null, 2: null, 3: null, 4: null };
  let minCells = null;
  const perK = Math.max(400, (minCellsBudget / 5) | 0);

  for (let k = 0; k <= 4; k++) {
    if (Date.now() - t0 > totalBudget) break;
    const s = solvableWithCells(state, k, perK);
    solvableByCells[k] = s;
    if (s === true && minCells === null) minCells = k;
  }

  let moves = null;
  let manualMoves = null;
  let movesSource = null;
  if (minCells !== null) {
    const short = shortSolve(state, { budgetMs: shortBudget, nodeLimit: opts.nodeLimit ?? 200000 });
    if (short) {
      moves = short.moves;
      manualMoves = short.manualMoves;
      movesSource = 'short';
      annotateManualFlags(short.path, state);
    } else if (opts.allowFallbackMoves === true) {
      const st4 = cloneState(state);
      const r = solve(st4, { timeLimitMs: Math.min(4000, shortBudget), fullOnly: true });
      if (r.solvable && r.solution) {
        const path = [];
        const sim = cloneState(state);
        for (const m of r.solution) {
          applyMove(sim, m);
          path.push(m);
        }
        annotateManualFlags(path, state);
        moves = path.length;
        manualMoves = countManualInPath(path);
        movesSource = 'fallback';
      }
    }
  }

  const elapsedMs = Date.now() - t0;
  const bankable = minCells !== null;
  const scoreStructural = bankable ? compositeScoreStructural(minCells, bury) : null;
  const score =
    bankable && manualMoves != null && movesSource === 'short'
      ? compositeScore(minCells, manualMoves, bury)
      : null;

  return {
    minCells,
    solvableByCells,
    moves,
    manualMoves,
    movesSource,
    bury,
    score,
    scoreStructural,
    elapsedMs,
    bankable,
  };
}
