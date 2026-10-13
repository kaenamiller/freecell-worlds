// Board rules — the solver-visible part of a board — and board composition. Extend the rules
// object (and teach rules.js and the dealer about the new field) when a charm needs a rule the
// solver must respect. See docs/voyage/charms-design.md §2 for the primitive list.
// dealRules(r, ctx) runs after rules/rulesAfter once a candidate deal exists; ctx adds read-only
// `state` (post startHome/dealSkew) and `deal`. Randomness: stream(seed, 'dealRules', idx, id).
import { VOYAGE } from './config.js';
import { CHARMS } from './registry.js';
import { RULE_DEFAULTS, deal } from '../rules.js';
import { stream } from './rng.js';
// The slim runtime extract of tools/boss-calibration.json (written by tools/boss-calibrate.mjs).
import calibration from './boss-yields.json' with { type: 'json' };

export const bossRng = (seed, id) => stream(seed, 'boss', id);

// No held boons in the finale budget: verification must stand on its own.
export function bossBudget({ boss, challenge, strength = 7, seed = 0, idx = 6, runMemo = {} }) {
  if (!CHARMS[boss] || !challenge) return { strength, budgeted: false };
  const requested = strength;
  for (;;) {
    const pair = composeBoard({ boss, challenge, strength, bossStrength: 7, seed, idx, runMemo });
    const measured = calibration.pairs?.[`${boss}|${challenge}|${strength}`];
    const totalEase = pair.ease - Math.max(0, VOYAGE.baseFreeCells - pair.rules.freeCells) * (calibration.cellTiers || 1.54);
    if (strength <= 4 || (totalEase >= -4.6 && (!measured || measured.yield >= .35))) break;
    strength--;
  }
  return { strength, budgeted: strength < requested };
}

export function boonRelation(bossId, boonId, { seed = 0, strength = 7, level = 1, boons = [boonId], stickers = {} } = {}) {
  const boss = CHARMS[bossId], boon = CHARMS[boonId];
  if (!boss || !boon || boon.kind !== 'boon') return null;
  const before = baseRules(), after = baseRules();
  const ctx = { id: boonId, seed, strength, level, boons: [...boons], stickers: { ...stickers }, family: (name) => boons.filter((id) => CHARMS[id]?.family === name).length,
    idx: 6, rng: stream(seed, 'rules', 6, boonId), runMemo: {} };
  boon.rules?.(after, ctx);
  boon.rulesAfter?.(after, ctx);
  const diff = new Set(Object.keys(after).filter((field) => JSON.stringify(canonical(after[field])) !== JSON.stringify(canonical(before[field]))));
  for (const field of diff) diff[field] = after[field];
  diff.ability = !!boon.ability; diff.kind = boon.kind;
  const value = boss.boonRelation?.(boonId, diff) ?? '~';
  return ['+', '~', '!'].includes(value) ? value : '~';
}

export const baseRules = () => ({ ...structuredClone(RULE_DEFAULTS), freeCells: VOYAGE.baseFreeCells });

// Canonical JSON including future fields; explicit neutral defaults share the classic key.
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  return v;
}
export function rulesKey(r = {}) {
  const extra = {};
  for (const k of Object.keys(r).sort()) {
    if (k === 'freeCells' || ['_compiled', 'classic', 'build', 'noCellLo', 'noCellHi', 'phaseRules'].includes(k)) continue;
    const v = ['noCellCards', 'sealedCols', 'wildCards', 'anchorCards', 'freeCards', 'barrenCards'].includes(k) ? [...new Set(r[k])].sort((a, b) => a - b) : r[k];
    if (JSON.stringify(canonical(v)) !== JSON.stringify(canonical(RULE_DEFAULTS[k]))) extra[k] = canonical(v);
  }
  return `fc${r.freeCells ?? RULE_DEFAULTS.freeCells}` + (Object.keys(extra).length ? '|' + JSON.stringify(extra) : '');
}

export function hasDealRules(active = []) {
  return active.some((a) => CHARMS[a.id]?.dealRules);
}

// Deal-dependent restrict hooks. `state` is the dealt tableau after startHome/dealSkew
// (read-only). Seeded from stream(seed, 'dealRules', idx, id). Clones `rules` when any
// active charm defines the hook so candidate verification cannot mutate the composed plan.
export function applyDealRules(rules, plan, n) {
  const active = plan.active || [];
  if (!hasDealRules(active)) return rules;
  const next = structuredClone(rules);
  delete next._compiled; delete next.build; delete next.classic; delete next.phaseRules;
  const boardBoons = active.filter((a) => a.kind === 'boon').map((a) => a.id);
  const stickers = { ...(plan.stickers || {}) };
  const family = (name) => boardBoons.filter((id) => CHARMS[id]?.family === name).length;
  const seed = plan.seed ?? 0, idx = plan.idx ?? 0;
  const state = deal(n, rules);
  for (const a of active) {
    const hook = CHARMS[a.id]?.dealRules;
    if (!hook) continue;
    hook(next, {
      id: a.id, strength: a.strength, level: a.level ?? 1, boons: [...boardBoons], stickers, family,
      rng: stream(seed, 'dealRules', idx, a.id), seed, idx, runMemo: plan.runMemo?.[a.id] || {},
      state, deal: n,
    });
  }
  return clampRules(next);
}

export function hasRestrictions(r) {
  return r.moveBonus < 0 || r.emptyFactor < 2 || !!(r.noCellRanks || r.noCellCards?.length ||
    r.barren || r.foundationSpread || r.emptyMinRank || r.sealedCols?.length || r.maxHeight ||
    r.cellColors?.some(Boolean) || r.oneWayCellRanks ||
    r.cellLimits?.slice(0, 4).some((v) => v && (v.minRank != null || v.maxRank != null || v.suits != null)) ||
    r.emptyCure || r.cellsNeedEmpty || r.sameColorRanks || r.noExitCols ||
    r.emptyMaxRank || r.cellClose || r.gate || r.dealSkew || r.phase ||
    r.cellStack || r.pinned || r.maxEmpty || r.colorSpread || r.emptyColors?.some(Boolean) || r.barrenCards?.length ||
    (r.cellThaw && (r.freeCells ?? 4) - r.cellThaw.frozen < 4));
}

export function clampRules(r) {
  r.freeCells = Math.max(VOYAGE.minFreeCells, Math.min(VOYAGE.maxFreeCells, r.freeCells));
  return r;
}

// Everything active on one board: the run's boons, the node's theme challenge and (final board)
// the boss. Returns the rules the deal is rated under and the summed unmodeled ease.
export function composeBoard({ boons = [], levels = {}, stickers = {}, challenge = null, extraChallenges = [], boss = null, strength = 1, challengeStrength = strength, boonStrength = strength, bossStrength = strength, seed = 0, idx = 0, runMemo = {} }) {
  const held = boons.filter((id) => CHARMS[id]?.kind === 'boon' && id !== 'voyage.stickers');
  const family = (name) => held.filter((id) => CHARMS[id]?.family === name).length;
  const confiscateCtx = { strength: bossStrength, level: levels[boss] || 1, levels: { ...levels }, boons: [...held], stickers: { ...stickers }, family,
    seed, idx, rng: stream(seed, 'rules', idx, boss), runMemo: runMemo[boss] || {} };
  const taken = CHARMS[boss]?.confiscate?.([...held], confiscateCtx) ?? null;
  const confiscated = held.includes(taken) ? taken : null;
  const boardBoons = held.filter((id) => id !== confiscated);
  if (Object.keys(stickers).length && CHARMS['voyage.stickers']) boardBoons.push('voyage.stickers');
  const active = [
    ...boardBoons.map((id) => ({ id, kind: 'boon', strength: boonStrength })),
    ...(challenge ? [{ id: challenge, kind: 'challenge', strength: challengeStrength }] : []),
    ...extraChallenges.map((a) => ({ ...(typeof a === 'string' ? { id: a } : a), kind: 'challenge', strength: typeof a === 'string' ? challengeStrength : a.strength ?? challengeStrength })),
    ...(boss ? [{ id: boss, kind: 'boss', strength: bossStrength }] : []),
  ].filter((a) => CHARMS[a.id]).map((a) => ({ ...a, level: a.id === 'voyage.stickers' ? 1 : levels[a.id] || 1 }));
  const rules = baseRules();
  let ease = 0;
  let dealShift = 0;
  const contexts = active.map((a) => ({ id: a.id, strength: a.strength, level: a.level, boons: [...boardBoons], stickers: { ...stickers },
    family: (name) => boardBoons.filter((id) => CHARMS[id]?.family === name).length,
    rng: stream(seed, 'rules', idx, a.id), seed, idx, runMemo: runMemo[a.id] || {} }));
  for (const [i, a] of active.entries()) {
    const c = CHARMS[a.id];
    const ctx = contexts[i];
    if (c.rules) c.rules(rules, ctx);
    if (c.ease) ease += typeof c.ease === 'function' ? c.ease(ctx) : c.ease;
    if (c.dealShift) dealShift += typeof c.dealShift === 'function' ? c.dealShift(ctx) : c.dealShift;
  }
  for (const [i, a] of active.entries()) CHARMS[a.id].rulesAfter?.(rules, contexts[i]);
  return { active, rules: clampRules(rules), ease, dealShift, confiscated };
}
