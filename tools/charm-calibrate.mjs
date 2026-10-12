// Short, reproducible calibration: same stratified bank deals, budgets and RNG per ruleset.
// Unknown is reported separately from proof of unsolvability. Never use these rates as proofs.
import { readFileSync, writeFileSync } from 'node:fs';
import { deal, solve } from '../js/rules.js';
import { baseRules } from '../js/voyage/boardrules.js';
import { stream } from '../js/voyage/rng.js';
const count = Number(process.env.CALIBRATE_DEALS || 150);
const budget = Number(process.env.CALIBRATE_MS || 100);
const bank = JSON.parse(readFileSync(new URL('../assets/data/seedbank.json', import.meta.url)));
const tiers = Array.isArray(bank.tiers) ? bank.tiers : Object.values(bank.tiers);
const random = stream('K1-calibration-v1');
const deals = Array.from({ length: count }, (_, i) => random.pick(tiers[i % tiers.length]).d);
const bits = (...ranks) => ranks.reduce((m, r) => m | (1 << r), 0);
const rows = [
  ['Base (4 cells)', {}], ['Base minus one cell', { freeCells: 3 }],
  ['moveBonus −1', { moveBonus: -1 }], ['moveBonus −2', { moveBonus: -2 }],
  ['emptyFactor 1', { emptyFactor: 1 }], ['emptyFactor 1.5', { emptyFactor: 1.5 }],
  ['noCellRanks K', { noCellRanks: bits(13) }], ['noCellRanks J Q K', { noCellRanks: bits(11, 12, 13) }],
  ['noCellCards 2', { noCellCards: [10, 24] }], ['noCellCards 8', { noCellCards: [6, 7, 8, 9, 10, 11, 12, 13] }],
  ['barren ♣ K', { barren: { suits: 1, ranks: bits(13) } }], ['barren ♣ 8–K', { barren: { suits: 1, ranks: bits(8, 9, 10, 11, 12, 13) } }],
  ['foundationSpread 7', { foundationSpread: 7 }], ['foundationSpread 3', { foundationSpread: 3 }], ['foundationSpread 1', { foundationSpread: 1 }],
  ['emptyMinRank 7', { emptyMinRank: 7 }], ['emptyMinRank 13', { emptyMinRank: 13 }],
  ['cellThaw 1 @8', { cellThaw: { frozen: 1, at: [8] } }], ['cellThaw 2 @8,20', { cellThaw: { frozen: 2, at: [8, 20] } }], ['cellThaw 3 @8,20,34', { cellThaw: { frozen: 3, at: [8, 20, 34] } }],
  ['sealedCols 1', { sealedCols: [0] }], ['sealedCols 2', { sealedCols: [0, 2] }],
  ['maxHeight 12', { maxHeight: 12 }], ['maxHeight 7', { maxHeight: 7 }],
  ['cellColors 1 red', { cellColors: ['red'] }], ['cellColors 2 red +2 black', { cellColors: ['red', 'black', 'red', 'black'] }],
  ['oneWayCellRanks K', { oneWayCellRanks: bits(13) }], ['oneWayCellRanks 8–K', { oneWayCellRanks: bits(8, 9, 10, 11, 12, 13) }],
];
const median = (a) => a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null;
const previous = process.env.CALIBRATE_ONLY ? JSON.parse(readFileSync(new URL('./charm-calibration.json', import.meta.url))) : null;
if (previous && (previous.count !== count || previous.budgetMs !== budget)) throw new Error('partial calibration must use the same sample and budget');
const started = Date.now(), measurements = [];
for (const [name, variant] of rows) {
  if (previous && !name.includes(process.env.CALIBRATE_ONLY)) {
    measurements.push(previous.measurements.find((r) => r.name === name));
    continue;
  }
  const outcomes = [];
  for (const n of deals) {
    const rules = { ...baseRules(), ...variant };
    const r = solve(deal(n, rules), { rules, rng: stream(n, 'calibrate-search'), fullOnly: false,
      timeLimitMs: budget, perRunMs: 20, perRunNodes: 2000, attemptLimit: 6, maxDepth: 320 });
    outcomes.push({ deal: n, solvable: r.solvable, nodes: r.nodes });
  }
  const solved = outcomes.filter((r) => r.solvable === true);
  const falseRate = outcomes.filter((r) => r.solvable === false).length / count;
  const unknownRate = outcomes.filter((r) => r.solvable === null).length / count;
  const result = { name, rules: variant, falseRate, unknownRate, solved: solved.length, medianNodes: median(solved.map((r) => r.nodes)), medianAllNodes: median(outcomes.map((r) => r.nodes)), outcomes };
  measurements.push(result);
  console.log(`${name}: solved ${result.solved}/${count}, false ${(falseRate * 100).toFixed(1)}%, unknown ${(unknownRate * 100).toFixed(1)}%, solved median ${result.medianNodes}; ${((Date.now() - started) / 1000).toFixed(1)}s`);
}
const base = measurements[0], cell = measurements[1];
const pressure = (row) => row.falseRate + row.unknownRate + .1 * Math.log10((row.medianNodes || 12000) / (base.medianNodes || 12000));
const anchor = Math.max(.05, pressure(cell) - pressure(base));
const cuts = bank.tierCuts || bank.cuts;
const tierWidth = (cuts.at(-1) - cuts[0]) / (cuts.length - 1);
const cellTiers = (bank.weights?.minCells || 42) / tierWidth;
for (const row of measurements) {
  row.nodesVsBase = row.medianNodes && base.medianNodes ? row.medianNodes / base.medianNodes : null;
  row.nodesVsMinusCell = row.medianNodes && cell.medianNodes ? row.medianNodes / cell.medianNodes : null;
  row.ease = -Math.min(2, Math.max(0, (pressure(row) - pressure(base)) / anchor)) * cellTiers;
}
const report = { count, budgetMs: budget, elapsedMs: (previous?.elapsedMs || 0) + Date.now() - started, cellTiers, tierWidth, deals, measurements };
writeFileSync(new URL('./charm-calibration.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
const table = [
  `Measured on ${count} seeded, tier-stratified bank deals (K1-calibration-v1); ${budget} ms/deal guard, 6 × 2,000-node restarts, full sequence generation, maxDepth 320. Run time: ${(report.elapsedMs / 1000).toFixed(1)} s. Each ruleset uses the same seeded search stream.`,
  '',
  '“Unsolvable” counts only exhausted searches; “unknown” counts budget/depth exhaustion. Median nodes uses solved deals only, so ratios have survivor bias. Ease is a preliminary tier estimate from (failure-to-verify rate + 0.1 × log₁₀ median-node ratio), interpolated between base and base minus one cell, capped at 2 cell-equivalents. One cell equals ' + cellTiers.toFixed(2) + ' bank tiers. These short-budget estimates guide content tuning; the dealer still verifies each restricted board with its full six-second budget.',
  '',
  '| Primitive / parameter | Unsolvable | Unknown | Median solved nodes | × base | × minus cell | Suggested ease (tiers) |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...measurements.map((r) => `| ${r.name} | ${(r.falseRate * 100).toFixed(1)}% | ${(r.unknownRate * 100).toFixed(1)}% | ${r.medianNodes ?? '—'} | ${r.nodesVsBase?.toFixed(2) ?? '—'} | ${r.nodesVsMinusCell?.toFixed(2) ?? '—'} | ${r.ease.toFixed(2)} |`),
  '',
  'Raw per-deal outcomes: `tools/charm-calibration.json`. Re-run: `node tools/charm-calibrate.mjs` (`CALIBRATE_DEALS` / `CALIBRATE_MS` override the sample/budget). Free-cell count is already modeled exactly by the bank; do not add ease for a cell boon or challenge. Restriction estimates that round to zero were indistinguishable from base at this budget; this does not prove they have no human cost.',
];
const doc = new URL('../docs/voyage/charms-design.md', import.meta.url);
const text = readFileSync(doc, 'utf8');
const marker = '### 2.5 Calibration (short)';
const a = text.indexOf(marker), b = text.indexOf('### 2.6 Visuals', a);
if (a < 0 || b < 0) throw new Error('calibration section not found');
writeFileSync(doc, text.slice(0, a) + marker + '\n\n' + table.join('\n') + '\n\n' + text.slice(b));
console.log('wrote §2.5 and tools/charm-calibration.json');
