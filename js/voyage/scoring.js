// Board scoring for Voyage. The score is computed from the board's final move history (so undone
// moves never count for or against the player) and is presented as a breakdown of labelled lines
// plus multipliers, which charms can adjust through their `score` hook.
import { SCORE } from './config.js';

// Facts about a finished history: player moves, free-cell placements and foundation chains.
export function historyStats(history, initial = null) {
  let moves = 0;
  let freeCellPlacements = 0;
  const chains = [];
  let run = 0;
  for (const m of history) {
    if (!m.auto) moves++;
    if (m.t === 'C' || (m.t === 'R' && m.to?.kind === 'free')) freeCellPlacements++;
    if (m.t === 'F') run++;
    else {
      if (run) chains.push(run);
      run = 0;
    }
  }
  if (run) chains.push(run);
  const cards = (initial?.found?.reduce((n, r) => n + r, 0) || 0) + history.reduce((n, m) => n + (m.t === 'F' ? 1 : m.t === 'R' ? -1 : m.t === 'X' ? (m.homeCards?.length || 0) : 0), 0); // X: charm moves that send cards home (Dolphin Leap)
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
    this.coinLines = []; // { key, label, coins }; independent of score multipliers
  }
  add(key, label, pts, extra) {
    const line = { key, label, pts: Math.round(pts) };
    if (extra) Object.assign(line, extra);
    this.lines.push(line);
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
  addCoins(key, label, n) {
    this.coinLines.push({ key, label, coins: Number.isFinite(Number(n)) ? Math.round(Number(n)) : 0 });
    return this;
  }
  get coinTotal() {
    return this.coinLines.reduce((sum, line) => sum + line.coins, 0);
  }
  get subtotal() {
    return this.lines.reduce((s, l) => s + l.pts, 0);
  }
  get total() {
    return Math.max(0, Math.round(this.mults.reduce((s, m) => s * m.x, this.subtotal)));
  }
  toJSON() {
    return { lines: this.lines, mults: this.mults, subtotal: this.subtotal, total: this.total, coinLines: this.coinLines, coinTotal: this.coinTotal, ...(this.charmDeltas ? { charms: this.charmDeltas } : {}) };
  }
}

// `par` is the deal's par in player moves. `effects` is a BoardEffects (or null).
export function scoreBoard(history, par, effects = null, extra = {}) {
  const stat = historyStats(history, extra.initial);
  const sb = new ScoreBreakdown(stat);
  Object.assign(sb, { history, par, elapsed: 0, undosUsed: 0, undosLeft: 0, initial: null, rules: {}, boardIdx: 0 }, extra);
  sb.add('cards', `Cards home (${stat.cards})`, stat.cards * SCORE.cardPoints);
  sb.add('efficiency', `Moves ${stat.moves} vs par ${par}`, efficiencyPoints(stat.moves, par));
  const cellScale = extra.boss && (extra.rules?.freeCells ?? 4) < 4 ? 4 / Math.max(1, extra.rules.freeCells) : 1;
  sb.add('freecells', `Free cells used ×${stat.freeCellPlacements}${cellScale > 1 ? ` · finale cost ×${cellScale.toFixed(2)}` : ''}`, Math.max(0, SCORE.freeCellBudget - stat.freeCellPlacements * SCORE.freeCellCost * cellScale));
  if (extra.boss) sb.add('bossStars', `Finale star thresholds ×${SCORE.bossStarScale.toFixed(2)}`, 0);
  const chainPts = chainPoints(stat.chains);
  if (chainPts) sb.add('chains', `Chains (best ${Math.max(...stat.chains)})`, chainPts, { runs: stat.chains.slice() });
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

const roundPoints = (n) => Math.round(Number(n) || 0);
const money = (n) => roundPoints(n).toLocaleString();

// One succinct sentence for a result-sheet row. Base lines restate the formula with this board's numbers.
export function explainScoreLine(line = {}) {
  const label = String(line.label || '');
  if (line.x != null) return `Multiplies the sum of the lines above by ${Number(line.x).toFixed(2)}.`;
  if (line.key === 'cards') {
    const n = Number(label.match(/\((\d+)\)/)?.[1]);
    const base = Number.isFinite(n) ? n * SCORE.cardPoints : null;
    const adjusted = base != null && base !== roundPoints(line.pts) ? ` A charm changed this from ${money(base)} to ${money(line.pts)}.` : '';
    return `${SCORE.cardPoints} points for each card sent home${Number.isFinite(n) ? ` (${n} × ${SCORE.cardPoints})` : ''}.${adjusted}`;
  }
  if (line.key === 'efficiency') {
    const found = label.match(/Moves (\d+) vs par (\d+)/);
    if (!found) return `${SCORE.efficiencyMax} points at par. Fewer moves raise it, and it falls to 0 at twice par.`;
    const moves = Number(found[1]);
    const par = Number(found[2]);
    const base = roundPoints(Math.max(0, SCORE.efficiencyMax * (2 - moves / par)));
    const adjusted = base !== roundPoints(line.pts) ? ` A charm changed this from ${money(base)} to ${money(line.pts)}.` : '';
    return `${SCORE.efficiencyMax} × (2 − ${moves} ÷ ${par}) = ${money(base)}. Worth ${SCORE.efficiencyMax} at par, and 0 at ${par * 2} moves.${adjusted}`;
  }
  if (line.key === 'freecells') {
    const n = Number(label.match(/×(\d+)/)?.[1] ?? 0);
    const finale = label.match(/finale cost ×([\d.]+)/);
    const scale = finale ? Number(finale[1]) : 1;
    const each = SCORE.freeCellCost * scale;
    const eachText = Number.isInteger(each) ? String(each) : each.toFixed(2);
    const base = Math.max(0, roundPoints(SCORE.freeCellBudget - n * each));
    const adjusted = base !== roundPoints(line.pts) ? ` A charm changed this from ${money(base)} to ${money(line.pts)}.` : '';
    return `Starts at ${SCORE.freeCellBudget}, minus ${eachText} for each card placed in a free cell${finale ? ' (higher on the finale, with fewer than four cells)' : ''} (${n} × ${eachText}).${adjusted}`;
  }
  if (line.key === 'chains') {
    const raw = Array.isArray(line.runs) ? roundPoints(chainPoints(line.runs)) : null;
    const adjusted = raw != null && raw !== roundPoints(line.pts) ? ` A charm changed this from ${money(raw)} to ${money(line.pts)}.` : '';
    return `Each run of n cards sent home scores ${SCORE.chainUnit} × n × (n − 1) ÷ 2, counting at most ${SCORE.chainCap} cards. Every run is added up.${adjusted}`;
  }
  if (line.key === 'bossStars') return `Finale star thresholds are ${Math.round(SCORE.bossStarScale * 100)}% of normal. This line adds no points.`;
  return roundPoints(line.pts) < 0
    ? 'Taken off the board score by a charm or challenge, before any multipliers.'
    : 'Added to the board score by a charm or challenge, before any multipliers.';
}

// 1..3 stars for a cleared board (clearing it always earns at least one).
export function starsFor(total, par, effects = null, extra = {}) {
  const thresholds = starThresholds(par, effects, extra);
  let stars = 1;
  for (let s = 1; s < thresholds.length; s++) if (total >= thresholds[s]) stars = s + 1;
  return Math.min(stars, effects?.starCap(extra) ?? 3);
}

// The same adjusted thresholds feed live HUD, intro, and final stars.
export const starThresholds = (par, effects = null, extra = {}) => {
  const thresholds = SCORE.stars.map((f) => Math.round(parScore(par) * f * (extra.boss ? SCORE.bossStarScale : 1)));
  return effects?.thresholds(thresholds) ?? thresholds;
};
