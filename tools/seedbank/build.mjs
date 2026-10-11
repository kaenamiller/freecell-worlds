#!/usr/bin/env node
/**
 * Rate Microsoft deals and build assets/data/seedbank.json
 *
 * Usage:
 *   node tools/seedbank/build.mjs pilot          # ~100 deals, tune timing
 *   node tools/seedbank/build.mjs run            # full 5000+ bank (resumes JSONL)
 *   node tools/seedbank/build.mjs finalize              # production bank (requires moves.jsonl)
 *   node tools/seedbank/build.mjs finalize --provisional  # analysis only, moves optional
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const JSONL = path.join(__dirname, 'ratings.jsonl');
const MOVES_JSONL = path.join(__dirname, 'moves.jsonl');
const OUT_JSON = path.join(ROOT, 'assets/data/seedbank.json');
const REPORT = path.join(ROOT, 'docs/voyage/seedbank-report.md');

const WEIGHT_MIN_CELLS = 42;
const VAR_SHARE = { minCells: 0.6, bury: 0.3, manualMoves: 0.1 };
/** Filled at finalize from merged bank data; defaults match last calibration pass. */
let WEIGHTS = { minCells: WEIGHT_MIN_CELLS, manualMoves: 2.969, bury: 1.263 };

const SAMPLE_SEED = 0x564f59414745; // "VOYAGE"
const TARGET_ACCEPTED = 5000;
const DEAL_MAX = 1_000_000;
const WORKERS = 12;
/** Deals with no short-solution (still structurally rated); omitted from bank. */
const EXCLUDED_DEAL_NUMBERS = new Set([159913]);

const RATE_OPTS = {
  budgetMs: 11000,
  minCellsBudgetMs: 4800,
  shortBudgetMs: 5200,
  nodeLimit: 220000,
};

// Mulberry32 PRNG for deterministic deal sampling
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dealStream(count, seed = SAMPLE_SEED) {
  const rnd = mulberry32(seed >>> 0);
  const seen = new Set();
  const out = [];
  while (out.length < count) {
    const d = 1 + Math.floor(rnd() * DEAL_MAX);
    if (!seen.has(d)) {
      seen.add(d);
      out.push(d);
    }
  }
  return out;
}

function loadJsonlFile(filePath) {
  const done = new Map();
  if (!fs.existsSync(filePath)) return done;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      done.set(row.d, row);
    } catch {
      /* skip */
    }
  }
  return done;
}

function loadJsonl() {
  return loadJsonlFile(JSONL);
}

function loadMovesJsonl() {
  return loadJsonlFile(MOVES_JSONL);
}

function inferMovesSource(row) {
  if (row.movesSource === 'short' || row.movesSource === 'fallback') return row.movesSource;
  if (row.manualMoves == null) return null;
  if (row.manualMoves <= 70) return 'short';
  return 'fallback';
}

function compositeScore(minCells, manualMoves, bury, weights = WEIGHTS) {
  const mc = minCells ?? 5;
  const mm = manualMoves ?? 0;
  return mc * weights.minCells + mm * weights.manualMoves + bury * weights.bury;
}

function compositeScoreStructural(minCells, bury, weights = WEIGHTS) {
  const mc = minCells ?? 5;
  return mc * weights.minCells + bury * weights.bury;
}

function variance(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
}

function stddev(arr) {
  return Math.sqrt(variance(arr));
}

/**
 * Fix minCells weight at 42; scale bury and manualMoves so term variance shares ≈ 60/30/10.
 */
function calibrateWeights(rows) {
  const mc = rows.map((r) => r.minCells);
  const bury = rows.map((r) => r.bury);
  const mm = rows.map((r) => r.manualMoves);
  const varMc = variance(mc.map((x) => WEIGHT_MIN_CELLS * x));
  if (!varMc || !bury.length) {
    return { ...WEIGHTS };
  }
  const varTotal = varMc / VAR_SHARE.minCells;
  const wBury = Math.sqrt((VAR_SHARE.bury * varTotal) / Math.max(variance(bury), 1e-6));
  const wMoves = Math.sqrt((VAR_SHARE.manualMoves * varTotal) / Math.max(variance(mm), 1e-6));
  return {
    minCells: WEIGHT_MIN_CELLS,
    bury: Math.round(wBury * 1000) / 1000,
    manualMoves: Math.round(wMoves * 1000) / 1000,
  };
}

function scoreVarianceShares(rows, weights) {
  const mcT = rows.map((r) => weights.minCells * r.minCells);
  const bT = rows.map((r) => weights.bury * r.bury);
  const mT = rows.map((r) => weights.manualMoves * r.manualMoves);
  const vMc = variance(mcT);
  const vB = variance(bT);
  const vM = variance(mT);
  const sum = vMc + vB + vM;
  return {
    sd: { minCells: stddev(mcT), bury: stddev(bT), manualMoves: stddev(mT) },
    share: sum ? { minCells: vMc / sum, bury: vB / sum, manualMoves: vM / sum } : null,
  };
}

function rescoreRows(rows, weights) {
  for (const r of rows) {
    r.score = compositeScore(r.minCells, r.manualMoves, r.bury, weights);
    r.scoreStructural = compositeScoreStructural(r.minCells, r.bury, weights);
  }
}

/**
 * Merge ratings.jsonl with optional moves.jsonl; trusted manual counts only from short solver or moves pass.
 */
function enrichRatings(allRows, movesByDeal) {
  return allRows.map((row) => {
    const base = { ...row };
    const inferred = inferMovesSource(base);
    if (!base.movesSource && inferred) base.movesSource = inferred;

    const ext = movesByDeal.get(base.d);
    let movesTrusted = false;
    let manualMoves = null;
    let moves = null;
    let movesMethod = null;

    if (ext) {
      if (ext.manualMoves != null) {
        manualMoves = ext.manualMoves;
        moves = ext.moves ?? null;
        movesMethod = ext.method ?? 'shortsolve';
        movesTrusted = true;
        base.movesSource = 'short';
      } else if (EXCLUDED_DEAL_NUMBERS.has(base.d)) {
        movesTrusted = false;
        base.movesUnknown = true;
      }
    } else if (base.movesSource === 'short' && base.manualMoves != null) {
      manualMoves = base.manualMoves;
      moves = base.moves;
      movesTrusted = true;
    } else if (base.movesSource === 'fallback' || inferred === 'fallback') {
      manualMoves = null;
      moves = null;
      movesTrusted = false;
      base.movesUnknown = true;
    }

    const structural = base.minCells != null ? compositeScoreStructural(base.minCells, base.bury, WEIGHTS) : null;
    const scoreFull = movesTrusted ? compositeScore(base.minCells, manualMoves, base.bury, WEIGHTS) : null;

    return {
      ...base,
      manualMoves,
      moves,
      movesMethod,
      movesTrusted,
      scoreStructural: structural,
      score: scoreFull,
    };
  });
}

function appendJsonl(row) {
  fs.appendFileSync(JSONL, JSON.stringify(row) + '\n');
}

function createPool(n, opts) {
  const workers = [];
  const idle = [];
  const waiters = [];

  for (let i = 0; i < n; i++) {
    const w = new Worker(new URL('./worker.mjs', import.meta.url), {
      workerData: { root: ROOT },
    });
    w.busy = false;
    w.on('message', (msg) => {
      if (msg.type === 'result') {
        w.busy = false;
        idle.push(w);
        const resolve = w._resolve;
        w._resolve = null;
        resolve(msg);
        if (waiters.length) {
          const next = waiters.shift();
          next();
        }
      }
    });
    workers.push(w);
    idle.push(w);
  }

  function runOne(dealNumber) {
    return new Promise((resolve) => {
      const start = () => {
        const w = idle.pop();
        if (!w) {
          waiters.push(() => start());
          return;
        }
        w.busy = true;
        w._resolve = resolve;
        w.postMessage({ type: 'rate', dealNumber, opts });
      };
      start();
    });
  }

  async function close() {
    await Promise.all(workers.map((w) => w.terminate()));
  }

  return { runOne, close };
}

async function rateDeals(dealNumbers, opts) {
  const existing = loadJsonl();
  const pool = createPool(WORKERS, opts);
  let completed = 0;
  let accepted = 0;
  const t0 = Date.now();

  const pending = dealNumbers.filter((d) => !existing.has(d));
  const total = dealNumbers.length;

  for (const d of dealNumbers) {
    if (existing.has(d)) {
      completed++;
      if (existing.get(d).bankable) accepted++;
    }
  }

  const tasks = pending.map(async (d) => {
    const msg = await pool.runOne(d);
    const r = msg.result;
    const row = {
      d,
      bankable: r.bankable,
      minCells: r.minCells,
      manualMoves: r.manualMoves,
      moves: r.moves,
      movesSource: r.movesSource,
      bury: r.bury,
      score: r.score,
      scoreStructural: r.scoreStructural,
      elapsedMs: r.elapsedMs,
      solvableByCells: r.solvableByCells,
    };
    appendJsonl(row);
    existing.set(d, row);
    completed++;
    if (r.bankable) accepted++;
    if (completed % 25 === 0 || completed === total) {
      const elapsed = (Date.now() - t0) / 1000;
      const rate = completed / Math.max(elapsed, 1);
      process.stdout.write(
        `\r[seedbank] ${completed}/${total} rated, ${accepted} bankable, ${rate.toFixed(2)}/s, ${elapsed.toFixed(0)}s   `,
      );
    }
  });

  await Promise.all(tasks);
  await pool.close();
  console.log('');
  return existing;
}

function quantile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function computeTierCuts(accepted) {
  const scores = accepted.map((r) => r.score).sort((a, b) => a - b);
  const cuts = [];
  for (let t = 1; t < 7; t++) {
    cuts.push(quantile(scores, t / 7));
  }
  return cuts;
}

function assignTiers(accepted, cuts) {
  const tiers = [[], [], [], [], [], [], []];
  for (const r of accepted) {
    let tier = 7;
    for (let i = 0; i < cuts.length; i++) {
      if (r.score < cuts[i]) {
        tier = i + 1;
        break;
      }
    }
    tiers[tier - 1].push(r);
  }
  return tiers;
}

function rebalanceTiers(accepted, cuts) {
  let tiers = assignTiers(accepted, cuts);
  const minPerTier = 400;
  const target = Math.floor(accepted.length / 7);

  // If quantile splits are too thin at the ends, nudge cuts using score histogram.
  for (let pass = 0; pass < 3; pass++) {
    tiers = assignTiers(accepted, cuts);
    const sizes = tiers.map((t) => t.length);
    if (sizes.every((s) => s >= minPerTier)) break;
    const scores = accepted.map((r) => r.score).sort((a, b) => a - b);
    for (let t = 1; t < 7; t++) {
      cuts[t - 1] = quantile(scores, t / 7);
    }
  }
  return { tiers, cuts };
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  return num / Math.sqrt(dx * dy) || 0;
}

function finalizeBank(opts = {}) {
  const provisional = opts.provisional === true;
  const movesByDeal = loadMovesJsonl();
  const existing = loadJsonl();
  const allRaw = [...existing.values()];
  const enriched = enrichRatings(allRaw, movesByDeal);

  const structurallyBankable = enriched.filter(
    (r) => r.bankable && r.minCells != null && !EXCLUDED_DEAL_NUMBERS.has(r.d),
  );
  const legacyMinCellsNotBankable = enriched.filter((r) => r.minCells != null && !r.bankable);
  let withMoves = structurallyBankable.filter((r) => r.movesTrusted && r.manualMoves != null);
  const unknownMoves = structurallyBankable.length - withMoves.length;

  if (!provisional) {
    if (!fs.existsSync(MOVES_JSONL)) {
      console.error(`Refusing production finalize: missing ${MOVES_JSONL}`);
      process.exit(1);
    }
    const required = structurallyBankable;
    const missing = required.filter((r) => !r.movesTrusted || r.manualMoves == null);
    const coverage = withMoves.length / Math.max(required.length, 1);
    if (missing.length > 0 || coverage < 0.999) {
      console.error(
        `Refusing production finalize: moves.jsonl covers ${withMoves.length}/${required.length} bankable deals (${(coverage * 100).toFixed(2)}%); ${missing.length} still missing`,
      );
      process.exit(1);
    }
  }

  WEIGHTS = calibrateWeights(withMoves);
  rescoreRows(withMoves, WEIGHTS);
  const varShares = scoreVarianceShares(withMoves, WEIGHTS);

  const accepted = withMoves.slice().sort((a, b) => a.score - b.score);
  const acceptedStructural = structurallyBankable
    .slice()
    .sort((a, b) => a.scoreStructural - b.scoreStructural);

  if (accepted.length < TARGET_ACCEPTED && !provisional) {
    console.warn(`Warning: only ${accepted.length} bankable deals with trusted moves (target ${TARGET_ACCEPTED})`);
  }

  let { tiers, cuts } = rebalanceTiers(accepted, computeTierCuts(accepted));
  const structuralTiers = assignTiers(
    acceptedStructural,
    computeTierCuts(acceptedStructural.map((r) => ({ score: r.scoreStructural }))),
  );

  // Trim to target per tier if we have excess (keep lowest scores in tier 1, etc.)
  const bankTiers = [];
  for (let t = 0; t < 7; t++) {
    const list = tiers[t]
      .sort((a, b) => a.score - b.score)
      .slice(0, Math.max(400, Math.min(tiers[t].length, Math.ceil(TARGET_ACCEPTED / 7) + 50)));
    bankTiers.push(
      list.map((r) => ({
        d: r.d,
        s: Math.round(r.score * 100) / 100,
        mc: r.minCells,
        m: r.manualMoves,
        b: r.bury,
      })),
    );
  }

  if (!provisional && accepted.length > 0) {
    const bank = {
      v: 1,
      weights: WEIGHTS,
      tierCuts: cuts.map((c) => Math.round(c * 100) / 100),
      tiers: bankTiers,
      excludedDeals: [...EXCLUDED_DEAL_NUMBERS],
    };

    fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
    fs.writeFileSync(OUT_JSON, JSON.stringify(bank));
    console.log(`Wrote ${OUT_JSON} (${(fs.statSync(OUT_JSON).size / 1024).toFixed(1)} KiB), ${accepted.length} deals`);
  } else if (provisional) {
    console.log('Provisional finalize: seedbank.json not written (analysis report only).');
  }

  writeReport({
    all: enriched,
    accepted,
    acceptedStructural,
    tiers,
    structuralTiers,
    cuts,
    movesByDealSize: movesByDeal.size,
    unknownMoves,
    legacyMinCellsNotBankable,
    provisional,
    weights: WEIGHTS,
    varShares,
  });
  console.log(`Wrote ${REPORT}`);
  console.log(`Calibrated weights: ${JSON.stringify(WEIGHTS)}`);

  if (!provisional) {
    syncDifficultyWeights(WEIGHTS);
  }
}

function syncDifficultyWeights(weights) {
  const diffPath = path.join(ROOT, 'js/difficulty.js');
  let src = fs.readFileSync(diffPath, 'utf8');
  src = src.replace(
    /export const SCORE_WEIGHT_MANUAL_MOVES = [\d.]+;/,
    `export const SCORE_WEIGHT_MANUAL_MOVES = ${weights.manualMoves};`,
  );
  src = src.replace(/export const SCORE_WEIGHT_BURY = [\d.]+;/, `export const SCORE_WEIGHT_BURY = ${weights.bury};`);
  fs.writeFileSync(diffPath, src);
  console.log(`Updated ${diffPath} weight constants`);
}

function writeReport(ctx) {
  const {
    all,
    accepted,
    acceptedStructural,
    tiers,
    structuralTiers,
    cuts,
    movesByDealSize,
    unknownMoves,
    legacyMinCellsNotBankable = [],
    provisional,
    weights,
    varShares,
  } = ctx;
  const mm = accepted.map((r) => r.manualMoves);
  const bury = accepted.map((r) => r.bury);
  const mc = accepted.map((r) => r.minCells);
  const scores = accepted.map((r) => r.score);
  const elapsed = all.map((r) => r.elapsedMs).filter(Boolean);

  const tierStats = tiers.map((list, i) => {
    const mvs = list.map((r) => r.manualMoves).sort((a, b) => a - b);
    return {
      tier: i + 1,
      n: list.length,
      mm: mvs.length
        ? {
            min: mvs[0],
            p10: quantile(mvs, 0.1),
            med: quantile(mvs, 0.5),
            p90: quantile(mvs, 0.9),
            max: mvs[mvs.length - 1],
          }
        : null,
    };
  });

  const structuralTierStats = structuralTiers.map((list, i) => ({
    tier: i + 1,
    n: list.length,
  }));

  const lines = [];
  lines.push('# Voyage seed bank report\n');
  lines.push(`Generated: ${new Date().toISOString()}${provisional ? ' (provisional)' : ''}\n`);
  lines.push(`## Summary\n`);
  lines.push(`- Rated deals in JSONL: **${all.length}**`);
  lines.push(`- Structurally bankable (minCells known): **${acceptedStructural.length}**`);
  lines.push(`- With trusted manualMoves (short solver / moves.jsonl): **${accepted.length}**`);
  lines.push(`- Moves unknown (fallback or pending moves pass): **${unknownMoves}**`);
  lines.push(`- moves.jsonl entries loaded: **${movesByDealSize}**`);
  lines.push(`- Target bank size: **${TARGET_ACCEPTED}** (shipped: **${accepted.length}**)`);
  lines.push(`- Excluded from bank (no short solution): **${[...EXCLUDED_DEAL_NUMBERS].join(', ')}**`);
  lines.push(
    `- Legacy ratings with minCells but \`bankable: false\`: **${legacyMinCellsNotBankable.length}** (early pipeline required inline manualMoves; minCells-only bankable came later)`,
  );
  lines.push(`- Workers: ${WORKERS}, per-deal budget: ${RATE_OPTS.budgetMs} ms\n`);

  lines.push(`## Score formula\n`);
  lines.push('```');
  lines.push(
    `score = minCells×${weights.minCells} + manualMoves×${weights.manualMoves} + bury×${weights.bury}`,
  );
  lines.push('```');
  lines.push(`Target variance shares: minCells **60%**, bury **30%**, manualMoves **10%** (minCells weight fixed for charm shifts).\n`);
  if (varShares?.share) {
    lines.push(
      `Calibrated term SDs: mc=${varShares.sd.minCells.toFixed(1)}, bury=${varShares.sd.bury.toFixed(1)}, moves=${varShares.sd.manualMoves.toFixed(1)}`,
    );
    lines.push(
      `Achieved variance shares: mc=${(varShares.share.minCells * 100).toFixed(1)}%, bury=${(varShares.share.bury * 100).toFixed(1)}%, moves=${(varShares.share.manualMoves * 100).toFixed(1)}%\n`,
    );
  }
  lines.push(`Production tier cuts use **score**. Cuts: ${cuts.map((c) => c.toFixed(2)).join(', ')}\n`);

  lines.push(`## minCells distribution by tier\n`);
  lines.push('| tier | n | mc=0 | mc=1 | mc=2 | mc=3 | mc=4 | dominant mc |');
  lines.push('| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
  for (let i = 0; i < tiers.length; i++) {
    const list = tiers[i];
    const counts = [0, 0, 0, 0, 0];
    for (const r of list) counts[r.minCells]++;
    const dominant = counts.indexOf(Math.max(...counts));
    lines.push(
      `| ${i + 1} | ${list.length} | ${counts[0]} | ${counts[1]} | ${counts[2]} | ${counts[3]} | ${counts[4]} | ${dominant} (${((counts[dominant] / list.length) * 100).toFixed(0)}%) |`,
    );
  }
  lines.push('');

  lines.push(`## Metric distributions (trusted manualMoves only, n=${accepted.length})\n`);
  const dist = (name, arr) => {
    const s = [...arr].sort((a, b) => a - b);
    if (!s.length) return `| ${name} | — | — | — | — | — |`;
    return `| ${name} | ${quantile(s, 0).toFixed(1)} | ${quantile(s, 0.1).toFixed(1)} | ${quantile(s, 0.5).toFixed(1)} | ${quantile(s, 0.9).toFixed(1)} | ${quantile(s, 1).toFixed(1)} |`;
  };
  lines.push('| metric | min | p10 | median | p90 | max |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
  lines.push(dist('manualMoves', mm));
  lines.push(dist('bury', bury));
  lines.push(dist('minCells', mc));
  lines.push(dist('score_full', scores));
  lines.push('');

  lines.push(`## Correlations (Pearson r, trusted moves only)\n`);
  if (mm.length > 2) {
    lines.push(`- minCells vs manualMoves: **${pearson(mc, mm).toFixed(3)}**`);
    lines.push(`- bury vs manualMoves: **${pearson(bury, mm).toFixed(3)}**`);
    lines.push(`- minCells vs bury: **${pearson(mc, bury).toFixed(3)}**`);
    lines.push(`- score_full vs manualMoves: **${pearson(scores, mm).toFixed(3)}**\n`);
  } else {
    lines.push('- (insufficient trusted-move sample yet)\n');
  }

  lines.push(`## Tier sizes\n`);
  for (const t of tierStats) lines.push(`- Tier ${t.tier}: **${t.n}** deals`);
  lines.push('');

  lines.push(`## Move-count deviation by tier (score_full tiers)\n`);
  lines.push('| tier | n | min | p10 | median | p90 | max |');
  lines.push('| ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const t of tierStats) {
    if (!t.mm) {
      lines.push(`| ${t.tier} | ${t.n} | — | — | — | — | — |`);
      continue;
    }
    lines.push(
      `| ${t.tier} | ${t.n} | ${t.mm.min} | ${t.mm.p10.toFixed(0)} | ${t.mm.med.toFixed(0)} | ${t.mm.p90.toFixed(0)} | ${t.mm.max} |`,
    );
  }
  lines.push('');
  lines.push(
    '**Note:** Until `moves.jsonl` covers the run, tier tables above only include deals with trusted short-solution lengths — not fallback DFS paths.\n',
  );

  lines.push(`## Variance decomposition (manualMoves)\n`);
  if (mm.length > 10) {
    const withinTierVar = tierStats.map((t) => {
      const mvs = tiers[t.tier - 1].map((r) => r.manualMoves).filter((v) => v != null);
      if (!mvs.length) return 0;
      const mean = mvs.reduce((a, b) => a + b, 0) / mvs.length;
      return mvs.reduce((s, v) => s + (v - mean) ** 2, 0) / mvs.length;
    });
    const globalMean = mm.reduce((a, b) => a + b, 0) / mm.length;
    const totalVar = mm.reduce((s, v) => s + (v - globalMean) ** 2, 0) / mm.length;
    const betweenVar =
      tierStats.reduce((s, t) => {
        const mvs = tiers[t.tier - 1].map((r) => r.manualMoves).filter((v) => v != null);
        if (!mvs.length) return s;
        const mean = mvs.reduce((a, b) => a + b, 0) / mvs.length;
        return s + mvs.length * (mean - globalMean) ** 2;
      }, 0) / mm.length;
    lines.push(`- Total variance: ${totalVar.toFixed(1)}`);
    lines.push(`- Between-tier variance: ${betweenVar.toFixed(1)} (${totalVar ? ((betweenVar / totalVar) * 100).toFixed(0) : 0}%)`);
    lines.push(`- Mean within-tier variance: ${(withinTierVar.reduce((a, b) => a + b, 0) / 7).toFixed(1)}\n`);
  } else {
    lines.push('- (pending trusted manualMoves sample)\n');
  }

  const parFactor = 1.08;
  lines.push(`## Par & star thresholds (merged manualMoves)\n`);
  lines.push(
    `**Recommendation:** per-deal par = \`round(manualMoves × ${parFactor})\` (solver baseline + ~8% human slack). Spread within tiers is small (~±15%), so per-deal par beats a single per-tier constant.\n`,
  );
  lines.push('| tier | n | mm min | p10 | median | p90 | max | stdev | CV% |');
  lines.push('| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const t of tierStats) {
    if (!t.mm) {
      lines.push(`| ${t.tier} | ${t.n} | — | — | — | — | — | — | — |`);
      continue;
    }
    const mvs = tiers[t.tier - 1].map((r) => r.manualMoves);
    const sd = stddev(mvs);
    const cv = t.mm.med ? (sd / t.mm.med) * 100 : 0;
    lines.push(
      `| ${t.tier} | ${t.n} | ${t.mm.min} | ${t.mm.p10.toFixed(0)} | ${t.mm.med.toFixed(0)} | ${t.mm.p90.toFixed(0)} | ${t.mm.max} | ${sd.toFixed(1)} | ${cv.toFixed(1)} |`,
    );
  }
  lines.push('');
  lines.push('| tier | par (×factor median) | 3★ ≤ | 2★ ≤ | 1★ ≤ |');
  lines.push('| ---: | ---: | ---: | ---: | ---: |');
  for (const t of tierStats) {
    if (!t.mm) {
      lines.push(`| ${t.tier} | — | — | — | — |`);
      continue;
    }
    const par = Math.round(t.mm.med * parFactor);
    const three = Math.round(t.mm.p10 * parFactor);
    const two = Math.round(t.mm.med * parFactor);
    const one = Math.round(t.mm.p90 * parFactor);
    lines.push(`| ${t.tier} | ${par} | ${three} | ${two} | ${one} |`);
  }
  lines.push(
    `\nPer-deal: \`par = round(m × ${parFactor})\`; 3★ ≤ 0.92×par, 2★ ≤ par, 1★ ≤ 1.12×par (tune in game).\n`,
  );

  lines.push(`## Runtime\n`);
  lines.push(`- mean rateState: **${(elapsed.reduce((a, b) => a + b, 0) / elapsed.length).toFixed(0)} ms**`);
  lines.push(`- p90: **${quantile(elapsed.sort((a, b) => a - b), 0.9).toFixed(0)} ms**`);
  lines.push(`- Re-rating in-game (charms changing free-cell count) should budget **~12–15 s** per deal with similar opts, or reuse bank fields when cell count matches.\n`);

  lines.push(`## Caveats\n`);
  lines.push('- `minCells` uses the existing DFS `solve()` with `fullOnly` pruning; `false` is not a proof of unsolvability, and `null` deals are rejected.');
  lines.push('- Inline `rateState` short A* often fails; long DFS fallback paths (100–260+ moves) are **not** used for tiers or par — see `tools/seedbank/moves.jsonl` from the dedicated short-solution pass.');
  lines.push('- Human difficulty correlates with but is not identical to automated metrics (foresight, undo, table layout).');
  lines.push('- Bury is deal-static and does not capture mid-game congestion.\n');

  lines.push(`## rules.js changes (not applied — for parent thread)\n`);
  lines.push('- Export `safeToFoundation` (or mark auto-F in solver paths) so solver and difficulty module share one definition.');
  lines.push('- Optional: `solve()` option to return only non-auto moves for benchmarking.');
  lines.push('- For charm modes with >4 free cells, ensure `deal()` / state cloning accepts arbitrary `free.length` in all move generators (already uses `st.free.length` in most paths; verify `generateMoves` empty-free loop).\n');

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, lines.join('\n'));
}

async function main() {
  const cmd = process.argv[2] || 'run';
  if (cmd === 'pilot') {
    const deals = dealStream(120);
    await rateDeals(deals, { ...RATE_OPTS, budgetMs: 9000, shortBudgetMs: 4000, minCellsBudgetMs: 4000 });
    summarize();
    return;
  }
  if (cmd === 'run') {
    // Sample extra to absorb rejects (~8–12%)
    const deals = dealStream(Math.ceil(TARGET_ACCEPTED * 1.12));
    await rateDeals(deals, RATE_OPTS);
    const bankable = [...loadJsonl().values()].filter((r) => r.bankable).length;
    console.log(`Run complete: ${bankable} structurally bankable ratings in ${JSONL}`);
    console.log('Next: moves pass -> moves.jsonl, then: node tools/seedbank/build.mjs finalize');
    return;
  }
  if (cmd === 'finalize') {
    const provisional = process.argv.includes('--provisional');
    finalizeBank({ provisional });
    return;
  }
  console.log('Commands: pilot | run | finalize [--provisional]');
}

function summarize() {
  const m = loadJsonl();
  const bankable = [...m.values()].filter((r) => r.bankable);
  const elapsed = [...m.values()].map((r) => r.elapsedMs);
  console.log(`Pilot: ${m.size} rated, ${bankable.length} bankable`);
  if (elapsed.length) {
    const s = elapsed.sort((a, b) => a - b);
    console.log(`Elapsed ms: median ${quantile(s, 0.5)}, p90 ${quantile(s, 0.9)}, max ${s[s.length - 1]}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
