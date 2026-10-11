// Deterministic, bounded short-solution search for the game's move model.
// Pure ES module: suitable for the main thread or a browser Web Worker.
import {
  applyMove, canFinishWithFoundationOnly, cloneState, generateMoves,
  isSolved, legalFoundationMoves, maxMoveSize, rankOf, safeFoundationMoves,
  suitOf, colorOf, foundationAccepts, isValidSequence,
} from './rules.js';

function autoPlay(st) {
  const moves = [];
  for (;;) {
    const safe = safeFoundationMoves(st);
    if (!safe.length) return moves;
    // Recompute after each card so every recorded auto move was safe when made.
    const m = { t: 'F', src: safe[0].src, card: safe[0].card, auto: true };
    applyMove(st, m);
    moves.push(m);
  }
}

// Free-cell positions and tableau column positions are interchangeable for
// search purposes. Keep the actual state, and canonicalize only its key.
function stateKey(st) {
  const cols = st.tableau.map((col) => String.fromCharCode(...col)).sort();
  const free = st.free.filter(Boolean).sort((a, b) => a - b);
  // 0xff is outside the card-id range 1..52, so column boundaries cannot
  // collide with a card character in the canonical representation.
  return String.fromCharCode(...st.found) + '|' + String.fromCharCode(...free) + '|' + cols.join('\u00ff');
}

function quality(st, variant) {
  const found = st.found[0] + st.found[1] + st.found[2] + st.found[3];
  let breaks = 0, buried = 0, runs = 0, empty = 0, freeUsed = 0;
  for (const col of st.tableau) {
    if (!col.length) { empty++; continue; }
    runs++;
    for (let i = 0; i < col.length - 1; i++) {
      const lower = col[i], upper = col[i + 1];
      if (rankOf(lower) !== rankOf(upper) + 1 || colorOf(lower) === colorOf(upper)) breaks++;
      // Low cards buried under other cards are expensive to expose. The same
      // ordering is also useful for higher cards when their suit is lagging.
      const r = rankOf(lower);
      if (r <= 8 && r > st.found[suitOf(lower)]) buried += (9 - r) * Math.min(4, col.length - i - 1) / 8;
    }
  }
  for (const c of st.free) if (c) freeUsed++;
  const weights = [
    [2.0, 1.4, 0.38, 1.5, 1.4],
    [1.8, 1.9, 0.55, 2.2, 1.8],
    [2.3, 1.1, 0.25, 1.0, 1.0],
    [1.7, 1.5, 0.8, 2.4, 2.0],
  ][variant % 4];
  return (52 - found) * weights[0] + breaks * weights[1] + buried * weights[2]
    + freeUsed * weights[3] - empty * weights[4] + runs * 0.05;
}

function clean(m) {
  if (m.t === 'F') return { t: 'F', src: { ...m.src }, card: m.card, ...(m.auto ? { auto: true } : {}) };
  if (m.t === 'C') return { t: 'C', fi: m.fi, src: { ...m.src }, card: m.card };
  return { t: 'T', src: { ...m.src }, count: m.count, to: m.to, card: m.card };
}

function buildPath(node, tail = []) {
  const groups = [];
  while (node) { if (node.moves.length) groups.push(node.moves); node = node.parent; }
  const path = [];
  for (let i = groups.length - 1; i >= 0; i--) path.push(...groups[i]);
  path.push(...tail);
  return path.map(clean);
}

function sameMove(a, b) {
  return a.t === b.t && a.src.kind === b.src.kind && a.src.i === b.src.i
    && (a.t !== 'C' || a.fi === b.fi)
    && (a.t !== 'T' || (a.to === b.to && a.count === b.count));
}

// Independent replay with the public rules. applyMove itself is intentionally
// unchecked, so legality must be tested before applying each descriptor.
function validate(initial, path) {
  const st = cloneState(initial);
  let manual = 0;
  for (const m of path) {
    const safe = safeFoundationMoves(st);
    if (safe.length && !m.auto) throw new Error('missing mandatory safe auto-play');
    if (m.auto) {
      if (m.t !== 'F' || !safe.some((s) => s.card === m.card && s.src.kind === m.src.kind && s.src.i === m.src.i))
        throw new Error('invalid safe auto-play');
    } else {
      if (!generateMoves(st).some((candidate) => sameMove(candidate, m))) throw new Error('illegal manual move');
      manual++;
    }
    if (m.t === 'F') {
      const card = m.src.kind === 'col' ? st.tableau[m.src.i].at(-1) : st.free[m.src.i];
      if (card !== m.card || !foundationAccepts(st, card)) throw new Error('invalid foundation move');
    } else if (m.t === 'C') {
      if (st.free[m.fi] || st.tableau[m.src.i].at(-1) !== m.card) throw new Error('invalid free-cell move');
    } else if (m.t === 'T') {
      const src = m.src.kind === 'col' ? st.tableau[m.src.i] : [st.free[m.src.i]];
      if (src[src.length - m.count] !== m.card || !isValidSequence(src, m.count)
          || m.count > maxMoveSize(st, st.tableau[m.to].length === 0)) throw new Error('invalid supermove');
    }
    applyMove(st, { ...m });
  }
  if (!isSolved(st)) throw new Error('path did not win');
  return { moves: path.length, manualMoves: manual };
}

function finishTail(st) {
  if (!canFinishWithFoundationOnly(st)) return null;
  const sim = cloneState(st), tail = [];
  while (!isSolved(sim)) {
    const autos = autoPlay(sim);
    tail.push(...autos);
    if (isSolved(sim)) break;
    const legal = legalFoundationMoves(sim);
    if (!legal.length) return null;
    const m = { t: 'F', src: legal[0].src, card: legal[0].card };
    applyMove(sim, m);
    tail.push(m);
  }
  return tail;
}

/**
 * Return a checked solution, or null when the deterministic search budget is
 * exhausted. nodeLimit controls reproducible work; budgetMs is a hard guard.
 */
export function shortSolve(initial, opts = {}) {
  const started = Date.now();
  const budgetMs = opts.budgetMs ?? 8000;
  const nodeLimit = opts.nodeLimit ?? 180000;
  const beamWidth = opts.beamWidth ?? 500;
  const passes = opts.passes ?? 4;
  const variantOffset = opts.variantOffset ?? 0;
  const maxManual = opts.maxManual ?? 115;
  const seed = cloneState(initial);
  const startMoves = autoPlay(seed);
  if (isSolved(seed)) {
    const path = startMoves.map(clean);
    return { ...validate(initial, path), path, method: 'beam', elapsedMs: Date.now() - started };
  }
  let expanded = 0, best = null;
  const budgetPerPass = Math.max(1, Math.floor(nodeLimit / passes));
  for (let variant = 0; variant < passes; variant++) {
    // Later passes widen the beam as well as changing the ordering. A narrow
    // beam is fast on ordinary deals; difficult layouts need more diversity.
    const width = variant === 0 ? beamWidth : beamWidth * 2;
    const root = { st: seed, parent: null, moves: startMoves, g: 0, key: stateKey(seed), q: quality(seed, variant + variantOffset) };
    let frontier = [root];
    const seen = new Map([[root.key, 0]]);
    const passLimit = Math.min(nodeLimit, (variant + 1) * budgetPerPass);
    for (let depth = 0; frontier.length && depth < maxManual && expanded < passLimit; depth++) {
      if ((expanded & 63) === 0 && Date.now() - started >= budgetMs) break;
      const candidates = new Map();
      for (const node of frontier) {
        if (expanded >= passLimit || (expanded & 63) === 0 && Date.now() - started >= budgetMs) break;
        expanded++;
        // Cheap endgame test only after substantial progress.
        if (node.st.found.reduce((a, b) => a + b, 0) >= 32) {
          const tail = finishTail(node.st);
          if (tail) {
            const path = buildPath(node, tail);
            const counts = validate(initial, path);
            if (!best || counts.manualMoves < best.manualMoves)
              best = { ...counts, path, method: 'beam', elapsedMs: Date.now() - started };
            // First solved layer is the shortest for this beam pass. Give other
            // passes a chance to improve only if the caller requests it.
            if (!opts.improve) return best;
            break;
          }
        }
        const moves = generateMoves(node.st);
        let firstEmpty = -1;
        for (let i = 0; i < 8; i++) if (!node.st.tableau[i].length) { firstEmpty = i; break; }
        for (const mv of moves) {
          if (mv.t === 'T' && !node.st.tableau[mv.to].length && mv.to !== firstEmpty) continue;
          // Auto moves are applied in closure, so a safe F is never manual.
          const next = cloneState(node.st), m = clean(mv);
          applyMove(next, m);
          const autos = autoPlay(next);
          const key = stateKey(next), g = node.g + 1;
          if (seen.has(key) && seen.get(key) <= g) continue;
          const q = quality(next, variant + variantOffset);
          const child = { st: next, parent: node, moves: [m, ...autos], g, key, q };
          const old = candidates.get(key);
          if (!old || child.q < old.q) candidates.set(key, child);
          if (isSolved(next)) {
            const path = buildPath(child);
            const counts = validate(initial, path);
            if (!best || counts.manualMoves < best.manualMoves)
              best = { ...counts, path, method: 'beam', elapsedMs: Date.now() - started };
            if (!opts.improve) return best;
          }
        }
      }
      if (best && !opts.improve) return best;
      const ordered = [...candidates.values()];
      ordered.sort((a, b) => a.q - b.q || a.key.localeCompare(b.key));
      frontier = ordered.slice(0, width);
      for (const node of frontier) seen.set(node.key, node.g);
    }
    if (Date.now() - started >= budgetMs || expanded >= nodeLimit) break;
  }
  if (best) best.elapsedMs = Date.now() - started;
  return best;
}
