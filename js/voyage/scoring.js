// Board scoring for Voyage. The score is computed from the board's final move history (so undone
// moves never count for or against the player) and is presented as a breakdown of labelled lines
// plus multipliers, which charms can adjust through their `score` hook.
import { SCORE } from './config.js';

// Facts about a finished history: player moves, free-cell placements and foundation chains.
export function historyStats(history) {
  let moves = 0;
  let freeCellPlacements = 0;
  const chains = [];
  let run = 0;
  for (const m of history) {
    if (!m.auto) moves++;
    if (m.t === 'C') freeCellPlacements++;
    if (m.t === 'F') run++;
    else {
      if (run) chains.push(run);
      run = 0;
    }
  }
  if (run) chains.push(run);
  const cards = history.reduce((n, m) => n + (m.t === 'F' ? 1 : 0), 0);
  return { moves, freeCellPlacements, chains, cards };
}

const chainPoints = (chains) =>
  chains.reduce((sum, n) => {
    const k = Math.min(n, SCORE.chainCap);
    return sum + (SCORE.chainUnit * k * (k - 1)) / 2;
  }, 0);

const efficiencyPoints = (moves, par) => Math.round(Math.max(0, SCORE.efficiencyMax * (2 - moves / par)));

// A breakdown that charms can edit. Lines are grouped by key so a charm can scale one group.
export class ScoreBreakdown {
  constructor(stat) {
    this.stat = stat;
    this.lines = []; // { key, label, pts }
    this.mults = []; // { label, x }
  }
  add(key, label, pts) {
    this.lines.push({ key, label, pts: Math.round(pts) });
    return this;
  }
  // Scale every line in a group (e.g. 'chains') in place.
  scale(key, x) {
    for (const l of this.lines) if (l.key === key) l.pts = Math.round(l.pts * x);
    return this;
  }
  mult(label, x) {
    this.mults.push({ label, x });
    return this;
  }
  get subtotal() {
    return this.lines.reduce((s, l) => s + l.pts, 0);
  }
  get total() {
    return Math.max(0, Math.round(this.mults.reduce((s, m) => s * m.x, this.subtotal)));
  }
  toJSON() {
    return { lines: this.lines, mults: this.mults, subtotal: this.subtotal, total: this.total };
  }
}

// `par` is the deal's par in player moves. `effects` is a BoardEffects (or null).
export function scoreBoard(history, par, effects = null) {
  const stat = historyStats(history);
  const sb = new ScoreBreakdown(stat);
  sb.add('cards', `Cards home (${stat.cards})`, stat.cards * SCORE.cardPoints);
  sb.add('efficiency', `Moves ${stat.moves} vs par ${par}`, efficiencyPoints(stat.moves, par));
  sb.add('freecells', `Free cells used ×${stat.freeCellPlacements}`, Math.max(0, SCORE.freeCellBudget - stat.freeCellPlacements * SCORE.freeCellCost));
  const chainPts = chainPoints(stat.chains);
  if (chainPts) sb.add('chains', `Chains (best ${Math.max(...stat.chains)})`, chainPts);
  effects?.score(sb);
  return sb;
}

// What a solid "par game" earns before charms: par moves, light free-cell use, typical chains.
export function parScore(par) {
  const typicalFreeCells = Math.round(par * 0.15);
  const typicalChains = [8, 5, 4, 3, 3];
  return (
    52 * SCORE.cardPoints +
    SCORE.efficiencyMax +
    Math.max(0, SCORE.freeCellBudget - typicalFreeCells * SCORE.freeCellCost) +
    chainPoints(typicalChains)
  );
}

// 1..3 stars for a cleared board (clearing it always earns at least one).
export function starsFor(total, par) {
  const ps = parScore(par);
  let stars = 1;
  for (let s = 1; s < SCORE.stars.length; s++) if (total >= ps * SCORE.stars[s]) stars = s + 1;
  return stars;
}

// Thresholds to show the player before/during a board.
export const starThresholds = (par) => SCORE.stars.map((f) => Math.round(parScore(par) * f));
