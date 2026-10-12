// Board rules — the solver-visible part of a board — and board composition. Extend the rules
// object (and teach rules.js and the dealer about the new field) when a charm needs a rule the
// solver must respect. See docs/voyage/charms-design.md §2 for the primitive list.
import { VOYAGE } from './config.js';
import { CHARMS } from './registry.js';
import { RULE_DEFAULTS } from '../rules.js';
import { stream } from './rng.js';
import calibration from '../../tools/boss-calibration.json' with { type: 'json' };

export const bossRng = (seed, id) => stream(seed, 'boss', id);

// No held boons in the finale budget: verification must stand on its own.
export function bossBudget({ boss, challenge, strength = 7, seed = 0, idx = 6, runMemo = {} }) {
  if (!CHARMS[boss] || !challenge) return { strength, budgeted: false };
  const requested = strength;
  for (;;) {
    const pair = composeBoard({ boss, challenge, strength, bossStrength: 7, seed, idx, runMemo });
    const measured = calibration.pairs?.[`${boss}|${challenge}|${strength}`];
    if (strength <= 4 || (pair.ease >= -4.6 && (!measured || measured.yield >= .35))) break;
    strength--;
  }
  return { strength, budgeted: strength < requested };
}

export function boonRelation(bossId, boonId, { seed = 0, strength = 7 } = {}) {
  const boss = CHARMS[bossId], boon = CHARMS[boonId];
  if (!boss || !boon || boon.kind !== 'boon') return null;
  const before = baseRules(), after = baseRules();
  boon.rules?.(after, { seed, strength, idx: 6, rng: stream(seed, 'rules', 6, boonId), runMemo: {} });
  const diff = new Set(Object.keys(after).filter((field) => JSON.stringify(canonical(after[field])) !== JSON.stringify(canonical(before[field]))));
  for (const field of diff) diff[field] = after[field];
  diff.ability = !!boon.ability; diff.kind = boon.kind;
  const value = boss.boonRelation?.(boonId, diff) ?? '~';
  return ['+', '~', '!'].includes(value) ? value : '~';
}

export const baseRules = () => ({ ...RULE_DEFAULTS, freeCells: VOYAGE.baseFreeCells, noCellCards: [], sealedCols: [], cellColors: [] });

// Canonical JSON including future fields; explicit neutral defaults share the classic key.
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  return v;
}
export function rulesKey(r = {}) {
  const extra = {};
  for (const k of Object.keys(r).sort()) {
    if (k === 'freeCells') continue;
    const v = k === 'noCellCards' || k === 'sealedCols' ? [...new Set(r[k])].sort((a, b) => a - b) : r[k];
    if (JSON.stringify(canonical(v)) !== JSON.stringify(canonical(RULE_DEFAULTS[k]))) extra[k] = canonical(v);
  }
  return `fc${r.freeCells ?? RULE_DEFAULTS.freeCells}` + (Object.keys(extra).length ? '|' + JSON.stringify(extra) : '');
}

export function hasRestrictions(r) {
  return r.moveBonus < 0 || r.emptyFactor < 2 || !!(r.noCellRanks || r.noCellCards?.length ||
    r.barren || r.foundationSpread || r.emptyMinRank || r.sealedCols?.length || r.maxHeight ||
    r.cellColors?.some(Boolean) || r.oneWayCellRanks ||
    (r.cellThaw && (r.freeCells ?? 4) - r.cellThaw.frozen < 4));
}

export function clampRules(r) {
  r.freeCells = Math.max(VOYAGE.minFreeCells, Math.min(VOYAGE.maxFreeCells, r.freeCells));
  return r;
}

// Everything active on one board: the run's boons, the node's theme challenge and (final board)
// the boss. Returns the rules the deal is rated under and the summed unmodeled ease.
export function composeBoard({ boons = [], challenge = null, boss = null, strength = 1, boonStrength = strength, bossStrength = strength, seed = 0, idx = 0, runMemo = {} }) {
  const active = [
    ...boons.map((id) => ({ id, kind: 'boon', strength: boonStrength })),
    ...(challenge ? [{ id: challenge, kind: 'challenge', strength }] : []),
    ...(boss ? [{ id: boss, kind: 'boss', strength: bossStrength }] : []),
  ].filter((a) => CHARMS[a.id]);
  const rules = baseRules();
  let ease = 0;
  let dealShift = 0;
  for (const a of active) {
    const c = CHARMS[a.id];
    const ctx = { strength: a.strength, rng: stream(seed, 'rules', idx, a.id), seed, idx, runMemo: runMemo[a.id] || {} };
    if (c.rules) c.rules(rules, ctx);
    if (c.ease) ease += typeof c.ease === 'function' ? c.ease(ctx) : c.ease;
    if (c.dealShift) dealShift += typeof c.dealShift === 'function' ? c.dealShift(ctx) : c.dealShift;
  }
  return { active, rules: clampRules(rules), ease, dealShift };
}
