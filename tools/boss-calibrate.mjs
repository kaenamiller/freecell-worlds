// Finale verification yields. Unknown searches are failures to verify, never proofs of loss.
import { readFileSync, writeFileSync } from 'node:fs';
import { CHARMS, bossIds, composeBoard } from '../js/voyage/charms.js';
import { rulesKey } from '../js/voyage/boardrules.js';
import { deal, solve } from '../js/rules.js';
import { stream } from '../js/voyage/rng.js';
const count = Number(process.env.BOSS_CALIBRATE_DEALS || 60);
const budgetMs = Number(process.env.BOSS_CALIBRATE_MS || 40);
const lowerCount = Math.min(count, Number(process.env.BOSS_CALIBRATE_LOWER || 16));
const seed = 'B1-boss-calibration-v1';
const bank = JSON.parse(readFileSync(new URL('../assets/data/seedbank.json', import.meta.url)));
const tiers = Array.isArray(bank.tiers) ? bank.tiers : Object.values(bank.tiers);
const rng = stream(seed, 'sample');
// The hardest three bank tiers bracket the adjusted board-7 candidate supply.
const deals = Array.from({ length: count }, (_, i) => rng.pick(tiers[tiers.length - 3 + i % 3]).d);
const started = Date.now();
const report = { version: 1, seed, count, lowerCount, budgetMs, deals, bosses: {}, pairs: {} };
const searches = new Map();
function measure(boss, challenge = null, strength = 7, sampleCount = count) {
  const composed = composeBoard({ boss, challenge, strength, bossStrength: 7, seed, idx: 6 });
  const outcomes = deals.slice(0, sampleCount).map((n) => {
    const key = `${rulesKey(composed.rules)}|${n}`;
    if (searches.has(key)) return searches.get(key);
    const result = solve(deal(n, composed.rules), { rules: composed.rules, fullOnly: false,
      rng: stream(n, 'boss-calibration-search'), timeLimitMs: budgetMs, perRunMs: 20,
      perRunNodes: 2000, attemptLimit: 3, maxDepth: 320 });
    const outcome = { deal: n, solvable: result.solvable, nodes: result.nodes };
    searches.set(key, outcome);
    return outcome;
  });
  const solved = outcomes.filter((r) => r.solvable === true);
  const nodes = solved.map((r) => r.nodes).sort((a, b) => a - b);
  return { boss, challenge, strength, count: sampleCount, yield: solved.length / sampleCount,
    unknown: outcomes.filter((r) => r.solvable == null).length / sampleCount,
    unsolvable: outcomes.filter((r) => r.solvable === false).length / sampleCount,
    ease: composed.ease, medianNodes: nodes[Math.floor(nodes.length / 2)] ?? null, outcomes };
}
for (const id of bossIds()) {
  if (CHARMS[id].placeholder) continue;
  report.bosses[id] = measure(id);
  const compatible = Object.values(CHARMS).filter((c) => c.kind === 'challenge' && !c.tags.some((tag) => CHARMS[id].tags.includes(tag)));
  for (const challenge of compatible) {
    let row = measure(id, challenge.id);
    report.pairs[`${id}|${challenge.id}|7`] = row;
    if (row.yield < .35 || row.ease < -4.6) for (let strength = 6; strength >= 4; strength--) {
      row = measure(id, challenge.id, strength, lowerCount);
      report.pairs[`${id}|${challenge.id}|${strength}`] = row;
      if (row.yield >= .35 && row.ease >= -4.6) break;
    }
  }
  report.elapsedMs = Date.now() - started; report.partial = true;
  writeFileSync(new URL('./boss-calibration.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(`${id}: ${(report.bosses[id].yield * 100).toFixed(1)}% alone; ${compatible.length} s7 pairs; ${((Date.now() - started) / 1000).toFixed(1)}s`);
}
report.elapsedMs = Date.now() - started;
report.partial = false; report.uniqueSearches = searches.size;
writeFileSync(new URL('./boss-calibration.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
const rows = Object.entries(report.bosses).map(([id, alone]) => {
  const pairs = Object.values(report.pairs).filter((r) => r.boss === id && r.strength === 7);
  const eased = pairs.filter((r) => r.yield < .35 || r.ease < -4.6).length;
  const values = pairs.map((r) => r.yield * 100);
  return `| ${CHARMS[id].name} | ${(alone.yield * 100).toFixed(1)}% | ${(alone.unknown * 100).toFixed(1)}% | ${pairs.length} | ${Math.min(...values).toFixed(1)}–${Math.max(...values).toFixed(1)}% | ${eased} |`;
});
const summary = `Measured ${count} reproducible bank deals from tiers 5–7 per boss and per compatible s7 theme challenge; ${budgetMs} ms/search, up to three 2,000-node restarts, full sequence generation. Lower-strength failing pairs use ${lowerCount} of the same deals, stopping when the yield reaches 35% and ease is at least −4.6, or at strength 4. Identical solver rules reuse the same per-deal outcomes (${report.uniqueSearches} unique searches). Runtime: ${(report.elapsedMs / 1000).toFixed(1)} s.\n\n| Boss | Alone verify yield | Alone unknown | Compatible s7 pairs | s7 pair yield range | Pairs eased |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${rows.join('\n')}\n\nUnknown means budget/depth exhaustion and counts as failure to verify, separately from proven unsolvability. These are conservative short-budget supply measurements, not human difficulty ratings. A pair still below budget at strength 4 stays at that floor and the dealer must find a verified candidate; it never deals an unverified board. Unmeasured pairs use the ease-sum fallback. Boss ease remains the kernel calibration estimate from §2.5 of charms-design.md; cell loss is already modeled by bank ratings. Runtime verification retains the full 6-second search budget. Raw outcomes and lookup: tools/boss-calibration.json. Re-run: node tools/boss-calibrate.mjs (BOSS_CALIBRATE_DEALS / BOSS_CALIBRATE_MS / BOSS_CALIBRATE_LOWER override defaults).\n`;
const doc = new URL('../docs/voyage/boss-build.md', import.meta.url);
const text = readFileSync(doc, 'utf8'), marker = '## 5. Calibration results';
writeFileSync(doc, text.slice(0, text.indexOf(marker)) + marker + '\n\n' + summary);
console.log('Wrote boss-calibration.json and boss-build.md §5');
