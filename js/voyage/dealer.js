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
import { rulesKey, hasRestrictions, composeBoard } from './boardrules.js';
import { deal, solve } from '../rules.js';

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

const bankAnswers = (rules) => !hasRestrictions(rules);

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
  return entry.s + VOYAGE.compensation * (target - entry.s) - (plan.dealShift || 0) * bank.tierWidth;
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
  const r = stream(seed, 'deal', plan.idx, plan.theme, rulesKey(plan.rules), plan.ease || 0, plan.dealShift || 0);
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
const verifiedBosses = new Map(); // charm-less rulesKey -> verified bank candidates
export const bossCacheInfo = () => [...verifiedBosses].map(([key, entries]) => ({ key, deals: [...entries.keys()] }));
export const planKey = (plan, seed, exclude = []) => `${seed}|${plan.idx}|${plan.theme}|${rulesKey(plan.rules)}|${plan.ease || 0}|${plan.dealShift || 0}|${exclude.join(',')}|${(plan.active || []).map((a) => `${a.id}:${a.strength}`).join(',')}`;

let worker = null;
let queue = [];
let running = false;
let jobSeq = 0;
const waiters = new Map();

function dutyCycle() {
  const cores = globalThis.navigator?.hardwareConcurrency || 4;
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
  // The same verification path is available to Node tests/calibration.
  if (typeof Worker === 'undefined') return Promise.resolve(solve(deal(job.deal, job.rules), { ...job.options, fullOnly: false, rules: job.rules }));
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

// Never cache or deliver an unverified restricted pick. Background and foreground
// share the entire candidate loop, including challenge-strength fallback.
async function resolvePlan(plan, { seed = plan.seed, exclude = [], candidates = 8, timeLimitMs = 6000, verifier = verify } = {}) {
  const original = plan;
  let current = plan;
  for (;;) {
    const used = [...exclude];
    const verifyRules = current.boss || (current.active?.some((a) => a.kind === 'boon') && current.challenge)
      ? composeBoard({ challenge: current.strength ? current.challenge : null, boss: current.boss,
        strength: current.strength, bossStrength: current.active?.find((a) => a.kind === 'boss')?.strength ?? 7,
        seed, idx: current.idx, runMemo: current.runMemo }).rules : current.rules;
    const bossKey = rulesKey(verifyRules);
    if (current.boss) {
      const band = bank.bands[Math.min(bank.bands.length - 1, current.tier - 1)];
      const ready = [...(verifiedBosses.get(bossKey)?.values() || [])].filter((entry) => {
        const score = blendedScore(entry, current);
        return !used.includes(entry.d) && score != null && score >= band[0] && score < band[1];
      }).sort((a, b) => a.d - b.d);
      if (ready.length) {
        const entry = stream(seed, 'boss-cache', current.theme, bossKey).pick(ready);
        console.info('[voyage] boss pre-solve cache hit', current.boss, current.theme, entry.d, bossKey);
        return { deal: entry.d, par: parFor(entry, SCORE.parFactor), score: blendedScore(entry, current),
          tier: current.tier, verified: true, preSolveCacheHit: true, rules: current.rules, strength: current.strength,
          active: current.active, ease: current.ease, dealShift: current.dealShift || 0, relaxed: current !== original, bossRelented: !!original.boss && !current.boss };
      }
    }
    for (let i = 0; i < candidates; i++) {
      let pick;
      try { pick = pickDeal(current, { seed, exclude: used }); }
      catch { break; }
      used.push(pick.deal);
      if (!pick.verified || current.boss) {
        const result = await verifier(pick.deal, verifyRules, { timeLimitMs });
        if (result.solvable !== true) continue;
        pick.verified = true;
        pick.solverNodes = result.nodes;
        pick.solverMoves = result.moves;
        if (current.boss) {
          if (!verifiedBosses.has(bossKey)) verifiedBosses.set(bossKey, new Map());
          const entry = bank.all.find((e) => e.d === pick.deal);
          verifiedBosses.get(bossKey).set(entry.d, entry);
          console.info('[voyage] boss pre-solve verified', current.boss, current.theme, entry.d, bossKey);
        }
      }
      return { ...pick, rules: current.rules, strength: current.strength, active: current.active,
        ease: current.ease, dealShift: current.dealShift || 0, relaxed: current !== original, bossRelented: !!original.boss && !current.boss };
    }
    // Fallback ladder. Normal boards ease the theme challenge to zero. The finale eases it to 4,
    // then (last resorts, so board 7 can always be dealt verified) drops it, then drops the boss.
    // At strength zero the theme hook is omitted; the boss stays active and must verify.
    let strength = current.strength;
    let boss = current.boss;
    if (current.challenge && strength > (boss ? 4 : 0)) strength--;
    else if (boss && current.challenge && strength > 0) strength = 0;
    else if (boss) boss = null;
    else throw new Error('No verified Voyage deal available under these rules');
    const boons = (original.active || []).filter((a) => a.kind === 'boon').map((a) => a.id);
    const composed = composeBoard({ boons, challenge: strength ? original.challenge : null,
      boss, strength, boonStrength: original.requestedStrength ?? original.strength, bossStrength: original.active?.find((a) => a.kind === 'boss')?.strength ?? 7, seed, idx: original.idx, runMemo: original.runMemo });
    current = { ...original, ...composed, strength, boss };
    if (original.boss && !boss) console.warn('[voyage] no verified finale deal under the boss; the boss relents', original.boss, original.theme);
  }
}

function cachedPlan(plan, options) {
  const seed = options.seed ?? plan.seed, exclude = options.exclude || [];
  const key = planKey(plan, seed, exclude);
  if (plan.boss && cache.has(key)) return cache.get(key).then((pick) => {
    console.info('[voyage] boss pre-solve cache hit', plan.boss, plan.theme, pick.deal, rulesKey(pick.rules));
    return { ...pick, preSolveCacheHit: true };
  });
  if (!cache.has(key)) {
    const pending = resolvePlan(plan, { ...options, seed, exclude }).catch((err) => { cache.delete(key); throw err; });
    cache.set(key, pending);
  }
  return cache.get(key);
}

export async function prepare(plans, options = {}) {
  await loadBank();
  // Enqueue all candidates without waiting for one plan to finish its six-second searches.
  await Promise.allSettled(plans.map((plan) => cachedPlan(plan, options)));
}

export async function dealFor(plan, options = {}) {
  await loadBank();
  // waitMs is intentionally not a verification escape hatch.
  return cachedPlan(plan, options);
}

export const bankInfo = () => (bank ? { size: bank.all.length, tiers: bank.tiers.map((t) => t.length), fallback: bank.fallback, tierWidth: bank.tierWidth } : null);
