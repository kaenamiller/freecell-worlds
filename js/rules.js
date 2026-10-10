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

export function dealFromSequence(sequence) {
  const tableau = [[], [], [], [], [], [], [], []];
  for (let k = 0; k < 52; k++) tableau[k % 8].push(sequence[k]);
  return { tableau, free: [0, 0, 0, 0], found: [0, 0, 0, 0] };
}

export function deal(dealNumber) {
  return dealFromSequence(shuffleForDeal(dealNumber));
}

export function randomDealNumber() {
  return 1 + Math.floor(Math.random() * 32000);
}

export function cloneState(st) {
  return {
    tableau: st.tableau.map((c) => c.slice()),
    free: st.free.slice(),
    found: st.found.slice(),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function canStackOn(column, card) {
  if (column.length === 0) return true;
  const top = column[column.length - 1];
  return rankOf(card) === rankOf(top) - 1 && colorOf(card) !== colorOf(top);
}

export function foundationAccepts(st, card) {
  return st.found[suitOf(card)] === rankOf(card) - 1;
}

// Number of cards, counted from the top, that form a valid descending
// alternating-colour run.
export function runLength(column) {
  let n = 1;
  for (let i = column.length - 1; i > 0; i--) {
    if (rankOf(column[i - 1]) === rankOf(column[i]) + 1 && colorOf(column[i - 1]) !== colorOf(column[i])) n++;
    else break;
  }
  return n;
}

export function freeCapacity(st) {
  let freeCells = 0;
  for (const f of st.free) if (f === 0) freeCells++;
  let emptyCols = 0;
  for (const c of st.tableau) if (c.length === 0) emptyCols++;
  return { freeCells, emptyCols };
}

// Classic FreeCell supermove capacity: (free cells + 1) * 2^(empty columns).
export function maxMoveSize(st, movingToEmpty) {
  const { freeCells, emptyCols } = freeCapacity(st);
  let e = emptyCols - (movingToEmpty ? 1 : 0);
  if (e < 0) e = 0;
  return (freeCells + 1) * (1 << e);
}

export function isSolved(st) {
  return st.found[0] + st.found[1] + st.found[2] + st.found[3] === 52;
}

export function isValidSequence(column, count) {
  if (count <= 1) return true;
  const start = column.length - count;
  for (let i = start; i < column.length - 1; i++) {
    if (rankOf(column[i]) !== rankOf(column[i + 1]) + 1) return false;
    if (colorOf(column[i]) === colorOf(column[i + 1])) return false;
  }
  return true;
}

// Index of the start of the maximal movable run ending at the top.
export function sequenceStart(column) {
  return column.length - runLength(column);
}

// ---------------------------------------------------------------------------
// Move application (descriptors shared by player engine and solver)
//   { t:'F', src:{kind:'col'|'free', i}, card }
//   { t:'C', fi, src:{kind:'col', i}, card }
//   { t:'T', src:{kind:'col'|'free', i}, count, to, card }
// ---------------------------------------------------------------------------

export function applyMove(st, m) {
  if (m.t === 'F') {
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
}

export function undoMove(st, m) {
  if (m.t === 'F') {
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
}

// ---------------------------------------------------------------------------
// Move generation
// ---------------------------------------------------------------------------

export function generateMoves(st, opts = {}) {
  const moves = [];
  const { freeCells, emptyCols } = freeCapacity(st);
  const emptyFree = [];
  for (let i = 0; i < 4; i++) if (st.free[i] === 0) emptyFree.push(i);

  for (let fi = 0; fi < 4; fi++) {
    const card = st.free[fi];
    if (!card) continue;
    if (foundationAccepts(st, card)) {
      moves.push({ t: 'F', src: { kind: 'free', i: fi }, card, score: 1200 + rankOf(card) });
    }
    for (let d = 0; d < 8; d++) {
      if (canStackOn(st.tableau[d], card)) {
        const s = 800 + (st.tableau[d].length ? 40 : 0) + rankOf(card);
        moves.push({ t: 'T', src: { kind: 'free', i: fi }, count: 1, to: d, card, score: s });
      }
    }
  }

  for (let c = 0; c < 8; c++) {
    const col = st.tableau[c];
    if (col.length === 0) continue;
    const top = col[col.length - 1];

    if (foundationAccepts(st, top)) {
      moves.push({ t: 'F', src: { kind: 'col', i: c }, card: top, score: 1100 + rankOf(top) });
    }

    if (emptyFree.length > 0) {
      const s = 250 + (col.length === 1 ? 120 : 0) + (col.length > 1 ? 10 : 0);
      moves.push({ t: 'C', fi: emptyFree[0], src: { kind: 'col', i: c }, card: top, score: s });
    }

    const run = runLength(col);
    const fullOnly = opts.fullOnly === true;
    for (let d = 0; d < 8; d++) {
      if (d === c) continue;
      const destEmpty = st.tableau[d].length === 0;
      const cap = destEmpty
        ? (freeCells + 1) * (1 << Math.max(0, emptyCols - 1))
        : (freeCells + 1) * (1 << emptyCols);
      const maxK = Math.min(run, cap);
      const ks = fullOnly ? [...new Set([maxK > 1 ? maxK : 1, 1])] : Array.from({ length: maxK }, (_, i) => i + 1);
      for (const k of ks) {
        const card = col[col.length - k];
        if (!canStackOn(st.tableau[d], card)) continue;
        if (destEmpty && k === col.length) continue; // moving a whole column nowhere useful
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
  return moves;
}

// ---------------------------------------------------------------------------
// Solver (DFS with safe auto-play, transposition table, heuristic ordering)
// ---------------------------------------------------------------------------

function hashState(st) {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  const mix = (v) => {
    h1 = Math.imul(h1 ^ v, 16777619);
    h2 = Math.imul(h2 ^ v, 2246822519);
  };
  mix(255);
  for (let i = 0; i < 4; i++) mix(st.free[i]);
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

function safeToFoundation(st, card) {
  if (!foundationAccepts(st, card)) return false;
  const r = rankOf(card);
  if (r <= 2) return true;
  const red = isRed(card);
  for (let s = 0; s < 4; s++) {
    if (RED[s] !== red && st.found[s] < r - 1) return false;
  }
  return true;
}

// A single depth-first search pass.
function solveOnce(initial, opts) {
  const { nodeLimit, timeLimitMs, maxDepth, childCap, fullOnly, jitter } = opts;
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
      for (let fi = 0; fi < 4; fi++) {
        const card = st.free[fi];
        if (card && safeToFoundation(st, card)) {
          const m = { t: 'F', src: { kind: 'free', i: fi }, card };
          applyMove(st, m);
          autos.push(m);
          changed = true;
        }
      }
      for (let c = 0; c < 8; c++) {
        const col = st.tableau[c];
        if (!col.length) continue;
        const card = col[col.length - 1];
        if (safeToFoundation(st, card)) {
          const m = { t: 'F', src: { kind: 'col', i: c }, card };
          applyMove(st, m);
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
        undoMove(st, autos[i]);
        path.pop();
      }
      return false;
    }
    visited.add(key);

    const moves = generateMoves(st, { fullOnly });
    if (jitter > 0) {
      for (const m of moves) m.score += (Math.random() - 0.5) * jitter;
    }
    moves.sort((a, b) => b.score - a.score);

    let expanded = 0;
    for (const m of moves) {
      if (childCap > 0 && expanded >= childCap) break;
      expanded++;
      applyMove(st, m);
      path.push(m);
      if (dfs(depth + 1)) return true;
      path.pop();
      undoMove(st, m);
      if (aborted) break;
    }

    for (let i = autos.length - 1; i >= 0; i--) {
      undoMove(st, autos[i]);
      path.pop();
    }
    return false;
  };

  const found = dfs(0);
  return { found, path, nodes, aborted, hitDepth };
}

// Solvability search. Uses randomized-restart depth-first search: solvable
// positions are found quickly, while a `solvable: false` result is only
// returned when the search space was exhausted within the limits. Positions
// that cannot be decided are reported as `solvable: null` (unknown).
export function solve(initial, options = {}) {
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

  while (Date.now() - startTime < timeLimitMs) {
    const jitter = attempt === 0 ? 0 : baseJitter * (1 + (attempt % 3) * 0.35);
    const r = solveOnce(initial, {
      nodeLimit: perRunNodes,
      timeLimitMs: perRunMs,
      maxDepth,
      childCap,
      fullOnly,
      jitter,
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
        solvable: false,
        confident: true,
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

function cleanMove(m) {
  if (m.t === 'F') return { t: 'F', src: { kind: m.src.kind, i: m.src.i }, card: m.card };
  if (m.t === 'C') return { t: 'C', fi: m.fi, src: { kind: 'col', i: m.src.i }, card: m.card };
  return { t: 'T', src: { kind: m.src.kind, i: m.src.i }, count: m.count, to: m.to, card: m.card };
}

// Moves to the foundations that can never hurt the player ("safe" auto-plays).
// A card must be the next one its own foundation needs, and nothing left on the table may still
// need it as a base: its rank is at most 2, or both opposite-colour foundations already hold a
// card of rank >= (rank - 1). Only column tops and free-cell cards are considered.
// Returns [{ src: {kind, i}, card }].
export function safeFoundationMoves(st) {
  const out = [];
  const consider = (card, src) => {
    if (!card || !foundationAccepts(st, card)) return;
    const r = rankOf(card);
    const opp = RED[suitOf(card)] ? [0, 3] : [1, 2];
    if (r <= 2 || (st.found[opp[0]] >= r - 1 && st.found[opp[1]] >= r - 1)) out.push({ src, card });
  };
  for (let c = 0; c < st.tableau.length; c++) {
    const col = st.tableau[c];
    if (col.length) consider(col[col.length - 1], { kind: 'col', i: c });
  }
  for (let f = 0; f < st.free.length; f++) consider(st.free[f], { kind: 'free', i: f });
  return out;
}

// Every legal move to a foundation right now (column tops and free cells), lowest rank first.
export function legalFoundationMoves(st) {
  const out = [];
  for (let c = 0; c < st.tableau.length; c++) {
    const col = st.tableau[c];
    if (col.length && foundationAccepts(st, col[col.length - 1])) out.push({ src: { kind: 'col', i: c }, card: col[col.length - 1] });
  }
  for (let f = 0; f < st.free.length; f++) {
    if (st.free[f] && foundationAccepts(st, st.free[f])) out.push({ src: { kind: 'free', i: f }, card: st.free[f] });
  }
  return out.sort((a, b) => rankOf(a.card) - rankOf(b.card));
}

// True when foundation moves alone can clear the whole table. Playing a legal foundation move never
// makes another one illegal, so a greedy simulation decides this exactly, regardless of order.
export function canFinishWithFoundationOnly(st) {
  const sim = cloneState(st);
  for (;;) {
    const moves = legalFoundationMoves(sim);
    if (!moves.length) break;
    for (const m of moves) {
      // Re-check: an earlier move in this batch may have changed the column we meant to pop.
      const col = m.src.kind === 'col' ? sim.tableau[m.src.i] : null;
      const card = m.src.kind === 'col' ? col[col.length - 1] : sim.free[m.src.i];
      if (card === m.card && foundationAccepts(sim, card)) applyMove(sim, { t: 'F', src: m.src, card });
    }
  }
  return sim.tableau.every((c) => c.length === 0) && sim.free.every((f) => !f);
}

// ---------------------------------------------------------------------------
// Player-facing game (tracks history for undo)
// ---------------------------------------------------------------------------

export class Game {
  constructor(dealNumber) {
    this.dealNumber = dealNumber;
    this.state = deal(dealNumber);
    this.history = [];
    this.initial = cloneState(this.state);
  }

  reset(dealNumber = this.dealNumber) {
    this.dealNumber = dealNumber;
    this.state = deal(dealNumber);
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
    return startIndex >= sequenceStart(col);
  }

  canDropTableau(colIndex, card, count) {
    if (canStackOn(this.tableau[colIndex], card) === false) return false;
    const destEmpty = this.tableau[colIndex].length === 0;
    return count <= maxMoveSize(this.state, destEmpty);
  }

  canDropFoundation(card) {
    return foundationAccepts(this.state, card);
  }

  canDropFreeCell(freeIndex) {
    return this.free[freeIndex] === 0;
  }

  // --- mutations --------------------------------------------------------

  moveToFoundation(src) {
    const card = this._peek(src);
    if (!card || !foundationAccepts(this.state, card)) return null;
    const m = { t: 'F', src, card };
    applyMove(this.state, m);
    this.history.push(m);
    return m;
  }

  moveToFreeCell(src, fi) {
    const card = this._peek(src);
    if (!card || this.free[fi] !== 0) return null;
    if (src.kind !== 'col') return null;
    const m = { t: 'C', fi, src, card };
    applyMove(this.state, m);
    this.history.push(m);
    return m;
  }

  moveSequenceToTableau(srcCol, startIndex, destCol) {
    const col = this.tableau[srcCol];
    if (!this.canMoveSequenceStart(srcCol, startIndex)) return null;
    const count = col.length - startIndex;
    const card = col[startIndex];
    if (!this.canDropTableau(destCol, card, count)) return null;
    const m = { t: 'T', src: { kind: 'col', i: srcCol }, count, to: destCol, card };
    applyMove(this.state, m);
    this.history.push(m);
    return m;
  }

  moveFreeToTableau(fi, destCol) {
    const card = this.free[fi];
    if (!card || !canStackOn(this.tableau[destCol], card)) return null;
    const m = { t: 'T', src: { kind: 'free', i: fi }, count: 1, to: destCol, card };
    applyMove(this.state, m);
    this.history.push(m);
    return m;
  }

  // Apply a descriptor produced by the solver (assumed legal).
  applyDescriptor(m) {
    const copy = cleanMove(m);
    applyMove(this.state, copy);
    this.history.push(copy);
    return copy;
  }

  undo() {
    const m = this.history.pop();
    if (!m) return null;
    undoMove(this.state, m);
    return m;
  }

  _peek(src) {
    if (src.kind === 'free') return this.free[src.i] || null;
    const col = this.tableau[src.i];
    return col.length ? col[col.length - 1] : null;
  }
}
