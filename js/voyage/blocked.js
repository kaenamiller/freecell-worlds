// Explains a rejected voyage move. A move counts as "blocked by" a challenge or boss when
// it fails under the live rules but passes once that charm's own rule contribution is taken
// back out (boons, runtime X changes and the other charms stay in place).
import { CHARMS } from './registry.js';
import { baseRules } from './boardrules.js';
import { stream } from './rng.js';
import { charmText } from './charms.js';
import { deal, rankOf, suitOf } from '../rules.js';

const SUIT = ['♣', '♦', '♥', '♠'];
const RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const card = (id) => `${RANK[rankOf(id)]}${SUIT[suitOf(id)]}`;
const ranks = (mask) => (mask & 0x3ffe) === 0x3ffe ? 'Every card' : RANK.filter((_, r) => r && mask & (1 << r)).join(', ');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// One line per restrictive rule field, phrased for the player.
const REASONS = {
  noCellRanks: (r) => `${ranks(r.noCellRanks)} can't go in a free cell.`,
  noCellCards: (r, m) => `${m.card ? card(m.card) : 'That card'} can't go in a free cell.`,
  cellColors: (r, m) => m.cell != null && r.cellColors[m.cell] ? `That free cell only takes ${r.cellColors[m.cell]} cards.` : 'That free cell only takes one colour.',
  cellLimits: () => 'That free cell only takes certain cards.',
  cellThaw: () => 'That free cell is still frozen.',
  cellClose: () => 'That free cell has closed.',
  cellsNeedEmpty: () => 'Some free cells only open while a column is empty.',
  cellStack: () => 'Those free cells fill and empty in order.',
  oneWayCellRanks: (r) => `${ranks(r.oneWayCellRanks)} can only leave a free cell for the foundation.`,
  emptyMinRank: (r) => r.emptyMinRank === 13 ? 'Only a King can fill an empty column.' : `Empty columns only take ${RANK[r.emptyMinRank]} or higher.`,
  emptyMaxRank: (r) => `Empty columns only take ${RANK[r.emptyMaxRank]} or lower${r.emptyKings ? ' (or a King)' : ''}.`,
  emptyColors: (r, m) => m.col != null && r.emptyColors[m.col] ? `That empty column only takes ${r.emptyColors[m.col]} cards.` : 'That empty column only takes one colour.',
  emptyCure: (r) => `Empty columns stay closed until ${plural(r.emptyCure, 'card')} are home.`,
  sealedCols: () => 'That column is sealed.',
  maxHeight: (r) => `Columns can't grow past ${plural(r.maxHeight, 'card')}.`,
  barren: () => 'Nothing can stack on that card.',
  barrenCards: () => 'Nothing can stack on that card.',
  sameColorRanks: (r) => `${ranks(r.sameColorRanks)} must build on the same colour.`,
  moveBonus: () => 'That run is too long to move at once.',
  emptyFactor: () => 'That run is too long to move at once.',
  foundationSpread: (r) => `Foundations can't get more than ${plural(r.foundationSpread, 'rank')} apart.`,
  colorSpread: (r) => `Red and black foundations must stay within ${plural(r.colorSpread, 'card')}.`,
  gate: (r) => `The ${SUIT[r.gate.suit]} foundation opens after ${plural(r.gate.after, 'other card')} are home.`,
  pinned: (r) => `That card is pinned until ${plural(r.pinned.until, 'card')} are home.`,
  maxEmpty: (r) => `No more than ${plural(r.maxEmpty, 'empty column')} at once.`,
  noExitCols: () => 'The last card can\'t leave that column.',
};

const isMask = (k) => /Ranks$|Cols$|^suitBuild|^buildUp|^suitBuildUp/.test(k) && !Array.isArray(baseRules()[k]);
const ADDITIVE = new Set(['moveBonus', 'emptyFactor']);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Fields (with their solo values) one charm writes, rated on clean board rules.
function contribution(entry, plan, dealNumber) {
  const c = CHARMS[entry.id], base = baseRules(), solo = baseRules();
  const boons = (plan.active || []).filter((a) => a.kind === 'boon').map((a) => a.id);
  const ctx = { id: entry.id, strength: entry.strength, level: entry.level || 1, boons, stickers: { ...(plan.stickers || {}) },
    levels: { ...(plan.levels || {}) }, family: (name) => boons.filter((id) => CHARMS[id]?.family === name).length,
    seed: plan.seed ?? 0, idx: plan.idx ?? 0, runMemo: plan.runMemo?.[entry.id] || {} };
  try {
    c.rules?.(solo, { ...ctx, rng: stream(ctx.seed, 'rules', ctx.idx, entry.id) });
    c.rulesAfter?.(solo, { ...ctx, rng: stream(ctx.seed, 'rules', ctx.idx, entry.id) });
    c.dealRules?.(solo, { ...ctx, rng: stream(ctx.seed, 'dealRules', ctx.idx, entry.id), state: deal(dealNumber, plan.rules), deal: dealNumber });
  } catch { /* a hook that needs the full composition simply contributes nothing here */ }
  return Object.keys(solo).filter((k) => k !== 'freeCells' && !same(solo[k], base[k])).map((k) => ({ key: k, solo: solo[k], base: base[k] }));
}

// Live rules with one charm's contribution subtracted.
function without(rules, fields) {
  const next = structuredClone(rules);
  for (const { key, solo, base } of fields) {
    const cur = next[key];
    if (Array.isArray(cur) && Array.isArray(solo)) {
      const b = Array.isArray(base) ? base : [];
      if (key === 'cellColors' || key === 'emptyColors' || key === 'cellLimits') next[key] = cur.map((v, i) => solo[i] && !b[i] ? null : v);
      else next[key] = cur.filter((v) => !solo.includes(v) || b.includes(v));
    } else if (isMask(key) && typeof cur === 'number') next[key] = cur & ~(solo & ~base);
    else if (ADDITIVE.has(key) && typeof cur === 'number') next[key] = cur - (solo - base);
    else next[key] = structuredClone(base);
  }
  return next;
}

// game: the live Game. attempt(probe) re-runs the failed move on a Game-shaped probe.
// meta: { cell, col } names the targeted slot for slot-specific reasons.
export function explainBlocked(game, plan, attempt, meta = {}) {
  if (!game || !plan) return null;
  const probe = (rules) => {
    const state = { ...game.state };
    if (state.sealed && !rules.sealedCols?.length) delete state.sealed;
    else if (state.sealed) state.sealed &= rules.sealedCols.reduce((m, i) => m | (1 << i), 0);
    const p = Object.assign(Object.create(Object.getPrototypeOf(game)), game, { rules, state });
    try { return !!attempt(p); } catch { return false; }
  };
  if (probe(game.rules)) return null;
  const suspects = (plan.active || []).filter((a) => a.kind !== 'boon' && CHARMS[a.id])
    .map((a) => ({ a, fields: contribution(a, plan, game.dealNumber) })).filter((s) => s.fields.length);
  for (const { a, fields } of suspects) {
    if (!probe(without(game.rules, fields))) continue;
    // Name the specific rule: the smallest field set that frees the move.
    let reason = null;
    for (const f of fields) {
      if (!probe(without(game.rules, [f]))) continue;
      const rules = f.key === 'phase' && game.rules.phase ? { ...game.rules, ...game.rules.phase.rules } : game.rules;
      const keys = f.key === 'phase' ? Object.keys(game.rules.phase?.rules || {}) : [f.key];
      for (const k of keys) {
        try { reason = REASONS[k]?.(rules, meta); } catch { reason = null; }
        if (reason) break;
      }
      if (reason) break;
    }
    const c = CHARMS[a.id];
    return { id: a.id, name: c.name, icon: c.icon || '✦', kind: a.kind, reason: reason || charmText(a.id, a.strength, { level: a.level }) };
  }
  return null;
}
