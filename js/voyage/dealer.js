// The Voyage dealer: picks a deal from the pre-rated seed bank (assets/data/seedbank.json, built
// by tools/seedbank/build.mjs) for a board plan { tier, rules, ease }.
//
// Difficulty under charms. The bank stores, per deal, the fewest free cells it needs (mc), the
// solver's manual move count (m) and a burial measure (b); score s = composite(mc, m, b). A board's
// rules change what a deal is worth:
//   - free cells: a deal needing mc cells, played with F cells, rates as if it needed mc - (F - 4).
//     Deals needing more cells than F are unwinnable and skipped. This is exact from bank data.
//   - unmodeled charm effects: `ease` in tiers (+1 = one tier easier) shifts the score by
//     ease x (average tier width).
// The dealer then chooses a deal whose blended score lands in the board's tier band:
//   blended = s + compensation x (effective - s)
// compensation = 1 keeps the board exactly on the difficulty curve; 0 ignores charms.
//
// Rule changes the bank can't answer (anything beyond free cells, once challenges add them) are
// verified with the solver in a background worker before use; see prepare() / verify().
import { VOYAGE, SCORE } from './config.js';
import { stream } from './rng.js';

const BANK_URL = new URL('../../assets/data/seedbank.json', import.meta.url);

let bank = null;
let bankPromise = null;

export function loadBank() {
  if (bankPromise) return bankPromise;
  bankPromise = fetch(BANK_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`seed bank ${r.status}`))))
    .then((b) => (bank = normaliseBank(b)))
    .catch((err) => {
      console.warn('[voyage] seed bank unavailable, using unrated fallback deals:', err.message);
      return (bank = normaliseBank(fallbackBank()));
    });
  return bankPromise;
}

// Lets tests / Node inject a bank directly.
export function setBank(b) {
  bank = normaliseBank(b);
  bankPromise = Promise.resolve(bank);
  return bank;
}

function normaliseBank(b) {
  const tiers = Array.isArray(b.tiers) ? b.tiers : Object.keys(b.tiers).sort((x, y) => x - y).map((k) => b.tiers[k]);
  const all = tiers.flat();
  const scores = all.map((e) => e.s).sort((x, y) => x - y);
  const lo = scores[0] ?? 0;
  const hi = scores[scores.length - 1] ?? 1;
  const cuts = b.tierCuts || b.cuts || [];
  // Tier bands: [floor, ceil) on the composite score. Outer tiers are open-ended.
  const bands = tiers.map((_, i) => [i === 0 ? -Infinity : cuts[i - 1], i === tiers.length - 1 ? Infinity : cuts[i]]);
  const inner = cuts.length > 1 ? (cuts[cuts.length - 1] - cuts[0]) / (cuts.length - 1) : (hi - lo) / 7;
  return { v: b.v, weights: b.weights || { minCells: 42, manualMoves: 1.15, bury: 2.4 }, tiers, all, bands, tierWidth: inner || 1, fallback: !!b.fallback };
}

function fallbackBank() {
  // Unrated: random deals spread evenly. Only used when the bank file is missing (dev).
  const r = stream('fallback-bank');
  const tiers = Array.from({ length: 7 }, (_, t) => Array.from({ length: 60 }, () => ({ d: 1 + r.int(1000000), s: t * 50 + r() * 50, mc: 3, m: 38, b: 50 })));
  return { v: 0, weights: { minCells: 42, manualMoves: 1.15, bury: 2.4 }, tiers, tierCuts: [50, 100, 150, 200, 250, 300], fallback: true };
}

const bankAnswers = (rules) => Object.keys(rules).every((k) => k === 'freeCells');

// Effective composite score of a bank entry under `rules`, or null when it can't be won.
export function effectiveScore(entry, rules) {
  const F = rules.freeCells ?? 4;
  if (entry.mc > F) return null;
  // Shift relative to the deal's own score so any constant or extra terms in the bank's formula
  // carry over unchanged: each free cell beyond 4 counts as one cell less needed.
  return entry.s - bank.weights.minCells * (F - 4);
}

export function blendedScore(entry, plan) {
  const eff = effectiveScore(entry, plan.rules);
  if (eff == null) return null;
  const target = eff - (plan.ease || 0) * bank.tierWidth;
  return entry.s + VOYAGE.compensation * (target - entry.s);
}

export const parFor = (entry, factor) => Math.max(20, Math.round(entry.m * factor));

// Choose a deal for `plan` (from run.boardPlan). Deterministic in (seed, plan, exclude), so the
// background pick and the final pick agree and Daily Voyages match for everyone on the same path.
// Returns { deal, par, score, tier, effective, verified }.
export function pickDeal(plan, { seed, exclude = [], parFactor = SCORE.parFactor } = {}) {
  if (!bank) throw new Error('seed bank not loaded');
  const used = new Set(exclude);
  const band = bank.bands[Math.max(0, Math.min(bank.bands.length - 1, plan.tier - 1))];
  const mid = Number.isFinite(band[0]) && Number.isFinite(band[1]) ? (band[0] + band[1]) / 2 : Number.isFinite(band[0]) ? band[0] + bank.tierWidth / 2 : band[1] - bank.tierWidth / 2;
  const inBand = [];
  let best = null;
  let bestDist = Infinity;
  for (const e of bank.all) {
    if (used.has(e.d)) continue;
    const s = blendedScore(e, plan);
    if (s == null) continue;
    if (s >= band[0] && s < band[1]) inBand.push(e);
    const dist = Math.abs(s - mid);
    if (dist < bestDist) (bestDist = dist), (best = e);
  }
  // Stable order before the seeded pick, so the choice doesn't depend on bank file order.
  inBand.sort((a, b) => a.d - b.d);
  const r = stream(seed, 'deal', plan.idx, plan.theme, plan.rules.freeCells, (plan.ease || 0).toFixed(2));
  const e = inBand.length ? inBand[r.int(inBand.length)] : best;
  if (!e) throw new Error('no deal available for plan');
  return {
    deal: e.d,
    par: parFor(e, parFactor),
    score: Math.round(blendedScore(e, plan) * 100) / 100,
    tier: plan.tier,
    effective: effectiveScore(e, plan.rules),
    verified: bankAnswers(plan.rules) && !bank.fallback,
  };
}

// ---------------------------------------------------------------------------
// Background preparation. While a board is played, main.js calls prepare(upcomingPlans(run)).
// Picks are cheap (bank lookups); plans whose rules the bank can't answer get their pick verified
// by the solver in a worker, one job at a time, resting between jobs (duty cycle) and pausing
// while `isBusy()` reports the table is animating.
// ---------------------------------------------------------------------------
const cache = new Map(); // planKey -> pick
const planKey = (plan, seed, exclude) => `${seed}|${plan.idx}|${plan.theme}|${JSON.stringify(plan.rules)}|${(plan.ease || 0).toFixed(2)}|${exclude.join(',')}`;

let worker = null;
let queue = [];
let running = false;
let jobSeq = 0;
const waiters = new Map();

function dutyCycle() {
  const cores = navigator.hardwareConcurrency || 4;
  return cores <= VOYAGE.lowEndCores ? VOYAGE.dutyCycle.lowEnd : VOYAGE.dutyCycle.normal;
}

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./dealer.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const { id, result, error } = e.data || {};
    const w = waiters.get(id);
    if (!w) return;
    waiters.delete(id);
    error ? w.reject(new Error(error)) : w.resolve(result);
  };
  return worker;
}

function runJob(job) {
  const id = ++jobSeq;
  return new Promise((resolve, reject) => {
    waiters.set(id, { resolve, reject });
    ensureWorker().postMessage({ id, ...job });
  });
}

let isBusy = () => false;
export function setBusyProbe(fn) {
  isBusy = fn;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pump() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      while (isBusy()) await sleep(250);
      const job = queue.shift();
      const t0 = performance.now();
      try {
        job.done(await runJob(job.msg));
      } catch (err) {
        job.done({ solvable: null, error: err.message });
      }
      const spent = performance.now() - t0;
      const d = dutyCycle();
      await sleep((spent * (1 - d)) / d);
    }
  } finally {
    running = false;
  }
}

// Solver check of one deal under `rules`. Resolves { solvable: true|false|null }.
export function verify(deal, rules, { timeLimitMs = 6000 } = {}) {
  return new Promise((done) => {
    queue.push({ msg: { deal, rules, options: { timeLimitMs } }, done });
    pump();
  });
}

// Pick (and if needed verify) a deal for every plan the next board might need.
export async function prepare(plans, { seed, exclude = [] } = {}) {
  await loadBank();
  for (const plan of plans) {
    const key = planKey(plan, seed, exclude);
    if (cache.has(key)) continue;
    const pick = pickDeal(plan, { seed, exclude });
    cache.set(key, pick);
    if (!pick.verified) {
      pick.pending = verify(pick.deal, plan.rules).then((r) => {
        pick.verified = r.solvable === true;
        pick.pending = null;
        if (r.solvable === false) cache.delete(key); // re-pick next time (exclude it)
        return pick;
      });
    }
  }
}

// The deal for a plan: the prepared pick when available, otherwise picked now. A pick still being
// verified is awaited for at most `waitMs`; the bank's own data is the fallback.
export async function dealFor(plan, { seed, exclude = [], waitMs = 1500 } = {}) {
  await loadBank();
  const key = planKey(plan, seed, exclude);
  let pick = cache.get(key) || pickDeal(plan, { seed, exclude });
  if (pick.pending) await Promise.race([pick.pending, sleep(waitMs)]);
  cache.set(key, pick);
  return pick;
}

export const bankInfo = () => (bank ? { size: bank.all.length, tiers: bank.tiers.map((t) => t.length), fallback: bank.fallback, tierWidth: bank.tierWidth } : null);
