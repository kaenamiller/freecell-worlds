// Voyage analytics (docs/analytics-plan.md §5.3, §5.6). Builds event params from the run object
// and keeps the bookkeeping in run.analytics, which is saved with the run. A reload therefore
// never repeats a board start, a board end or a run end, and per-board tallies (ability uses,
// charm triggers) survive it. main.js calls these at the matching points in the run.
import { track, newId } from '../analytics.js';
import { CHARMS, challengeForTheme } from './charms.js';
import { economy } from './port.js';
import { totalScore, totalStars } from './run.js';
import { VOYAGE } from './config.js';

const TRIGGER_CAP = 20; // per charm per board

export const meta = (run) => (run.analytics ??= { id: newId(), picked: {} });
const runId = (run) => meta(run).id;
const visible = (id) => CHARMS[id] && !CHARMS[id].hidden;
const held = (run) => run.boons.filter(visible).map((id) => (run.levels?.[id] === 2 ? `${id}:2` : id));
const boardOf = (run, idx) => (meta(run).board?.idx === idx ? meta(run).board : null);
const playMinutes = (run) => Math.round(((run.results.reduce((s, r) => s + (r.time || 0), 0) + (run.status === 'board' || run.status === 'lost' ? run.current?.elapsed || 0 : 0)) / 60) * 10) / 10;

// --- run ------------------------------------------------------------------------------
export function runStart(run, { replaced = false, runsLifetime } = {}) {
  track('voyage_run_start', { run_id: runId(run), daily: !!run.daily, boss_id: run.boss || undefined, replaced_run: replaced, runs_lifetime: runsLifetime });
}

export function runResume(run) {
  track('voyage_run_resume', { run_id: runId(run), status: run.status, board_idx: run.current?.idx ?? run.results.length });
}

// outcome: won | stuck | abandoned | abandoned_for_new
export function runEnd(run, outcome, board = {}) {
  const m = meta(run);
  if (m.ended) return;
  const cur = run.current;
  if (cur && m.boardStarted === cur.idx && m.boardEnded !== cur.idx) {
    boardEnd(run, cur, { outcome: outcome === 'stuck' ? 'stuck' : 'abandoned', timeS: cur.elapsed, ...board });
  }
  m.ended = true;
  const eco = economy(run);
  const lost = outcome !== 'won';
  track('voyage_run_end', {
    run_id: m.id, outcome, daily: !!run.daily, boss_id: run.boss || undefined,
    boards_cleared: run.results.filter((r) => !r.conceded).length,
    total_score: totalScore(run), total_stars: totalStars(run),
    coins_earned: eco.coinsEarned, coins_spent: eco.coinsSpent, coins_left: run.coins,
    charms_held: run.boons.filter(visible).length, held: held(run),
    died_on_theme: lost ? cur?.theme : undefined, died_on_challenge: lost ? cur?.challenge || undefined : undefined,
    duration_min: playMinutes(run),
  });
}

// --- chart and boards -----------------------------------------------------------------
export function nodePick(run, { node, options = [], decideMs, prepWaitMs, inspected }) {
  const cur = run.current;
  track('voyage_node_pick', {
    run_id: runId(run), board_idx: cur.idx, theme_id: node.theme, challenge_id: cur.challenge || undefined,
    strength: cur.strength, storm: !!cur.storm, is_final: cur.idx >= VOYAGE.boards - 1,
    offered_themes: options.map((n) => n.theme), offered_challenges: options.map((n) => challengeForTheme(n.theme) || 'none'),
    decide_ms: decideMs, prep_wait_ms: prepWaitMs, inspected,
  });
}

export function boardStart(run, { freeCells } = {}) {
  const m = meta(run), cur = run.current;
  if (!cur || m.boardStarted === cur.idx) return;
  m.boardStarted = cur.idx;
  m.board = { idx: cur.idx, abilityUses: 0, triggers: {} };
  track('voyage_board_start', {
    run_id: m.id, board_idx: cur.idx, challenge_id: cur.challenge || undefined, extra_challenges: cur.extraChallenges,
    boss_id: cur.boss || undefined, tier: cur.tier, strength: cur.strength, deal: cur.deal, par: cur.par,
    deal_rating: cur.rating ?? undefined, relaxed: cur.relaxed, boss_relented: cur.bossRelented,
    free_cells: freeCells ?? cur.rules?.freeCells, undos_available: run.undos, charms_held: run.boons.filter(visible).length, held: held(run),
  });
}

// cur: run.current as it was during the board (winBoard clears it on the final board).
// outcome: cleared | conceded | stuck | abandoned
export function boardEnd(run, cur, { outcome, result = null, undosLeft = run.undos, cardsHome, moves, timeS, counters = {}, invalidBurst } = {}) {
  const m = meta(run);
  if (!cur || m.boardEnded === cur.idx) return;
  m.boardEnded = cur.idx;
  const lines = result?.score?.lines || [];
  const pts = (key) => lines.filter((l) => l.key === key).reduce((s, l) => s + l.pts, 0);
  const base = ['cards', 'efficiency', 'freecells', 'chains'].reduce((s, k) => s + pts(k), 0);
  const b = boardOf(run, cur.idx);
  track('voyage_board_end', {
    run_id: m.id, board_idx: cur.idx, challenge_id: cur.challenge || undefined, boss_id: cur.boss || undefined,
    tier: cur.tier, strength: cur.strength, deal_rating: cur.rating ?? undefined, held: held(run),
    outcome, stars: result?.stars ?? 0, score: result?.total, par: cur.par,
    moves: result?.moves ?? moves, moves_over_par: (result?.moves ?? moves) != null ? (result?.moves ?? moves) - cur.par : undefined,
    time_s: Math.round(result?.time ?? timeS ?? 0), undos_used: cur.undosUsed || 0, undos_left: undosLeft,
    coins_earned: result?.coins ?? 0, ability_uses: b?.abilityUses ?? 0,
    ...(result ? { score_cards: pts('cards'), score_efficiency: pts('efficiency'), score_freecells: pts('freecells'), score_chains: pts('chains'), score_charms: result.total - base, score_lines: { lines: lines.map((l) => [l.key, l.pts]), mults: (result.score.mults || []).map((x) => [x.label, x.x]), coins: (result.coinLines || []).map((l) => [l.key, l.coins]) } } : {}),
    cards_home: cardsHome, after_invalid_burst: invalidBurst,
    ...counters,
  });
  if (result) charmScores(run, cur, result);
  if (b) {
    for (const [charmId, whats] of Object.entries(b.triggers)) {
      for (const [what, n] of Object.entries(whats)) track('voyage_challenge_trigger', { run_id: m.id, board_idx: cur.idx, charm_id: charmId, what, n });
    }
  }
}

// What each active charm (boons, challenge, boss) added to the board's score and coins.
function charmScores(run, cur, result) {
  const per = {};
  for (const [id, d] of Object.entries(result.score?.charms || {})) per[id] = { points: d.points, coins: d.coins, mult: d.mult };
  const ids = new Set([...(cur.active || []).map((a) => a.id), ...run.boons]);
  for (const line of result.coinLines || []) {
    if (ids.has(line.key) && line.coins) (per[line.key] ??= { points: 0, coins: 0, mult: 1 }).coins += line.coins;
  }
  for (const [id, d] of Object.entries(per)) {
    track('voyage_charm_score', { run_id: runId(run), board_idx: cur.idx, charm_id: id, points: d.points, coins: d.coins, mult: d.mult === 1 ? undefined : d.mult });
  }
}

// --- in-board -------------------------------------------------------------------------
export function trigger(run, charmId, what, n = 1) {
  const b = run?.current && boardOf(run, run.current.idx);
  if (!b) return;
  const t = (b.triggers[charmId] ??= {});
  const total = Object.values(t).reduce((s, v) => s + v, 0);
  if (total >= TRIGGER_CAP) return;
  const key = String(what).slice(0, 40);
  t[key] = (t[key] || 0) + Math.max(1, Math.floor(Number(n) || 1));
}

export function abilityUse(run, idx, charmId, { usesLeft, whileStuck, cardsHome, movesSoFar }) {
  const b = boardOf(run, idx);
  if (b) b.abilityUses++;
  track('voyage_ability_use', { run_id: runId(run), board_idx: idx, charm_id: charmId, uses_left: usesLeft, consumed: true, while_stuck: !!whileStuck, cards_home: cardsHome, moves_so_far: movesSoFar });
}

export function abilityCancel(run, idx, charmId, stage = 'use') {
  track('voyage_ability_cancel', { run_id: runId(run), board_idx: idx, charm_id: charmId, stage });
}

export function stuckWarning(run, { kind, abilityAvailable }) {
  track('voyage_stuck_warning', { run_id: runId(run), board_idx: run.current?.idx, kind, undos_left: run.undos, ability_available: !!abilityAvailable });
}

export function lossSaved(run, idx, charmId) {
  track('voyage_loss_saved', { run_id: runId(run), board_idx: idx, charm_id: charmId || undefined, undos_left: run.undos });
}

export function undoCapHit(run, charmId) {
  track('voyage_undo_cap_hit', { run_id: runId(run), board_idx: run.current?.idx, charm_id: charmId });
}

export function undo(run) {
  track('voyage_undo', { run_id: runId(run), board_idx: run.current?.idx, undos_left: run.undos });
}

export function sonar(run, { steps, ms }) {
  track('voyage_sonar_result', { run_id: runId(run), board_idx: run.current?.idx, steps: steps ?? undefined, ms });
}

export function preview(run, { n, found }) {
  track('voyage_preview_used', { run_id: runId(run), board_idx: run.current?.idx, n, found });
}

export function earn(run, value, source) {
  if (value > 0) track('earn_virtual_currency', { virtual_currency_name: 'coins', value, source });
}

export function spend(run, value, itemName) {
  if (value > 0) track('spend_virtual_currency', { virtual_currency_name: 'coins', value, item_name: itemName });
}

// --- charm rewards --------------------------------------------------------------------
// Call once winBoard has put the run in 'reward'.
export function rewardOpen(run) {
  const m = meta(run), r = run.reward;
  if (!r || m.reward?.idx === r.idx) return;
  m.reward = { idx: r.idx, offered: [...r.offers], stars: r.stars, picks: r.picks, picked: [] };
}

function pickParams(run, id, offered, source, idx) {
  const c = CHARMS[id] || {};
  return { run_id: runId(run), board_idx: idx, charm_id: id, charm_theme: c.theme, charm_family: c.family, pick_slot: offered.indexOf(id) + 1 || undefined, offered, held_before: run.boons.filter(visible).length, source };
}

// Before pickCharm(run, id).
export function rewardPick(run, id) {
  const m = meta(run), r = m.reward;
  if (!r) return;
  track('voyage_charm_pick', pickParams(run, id, r.offered, 'reward', r.idx));
  r.picked.push(id);
  m.picked[id] = run.results.length;
}

// After pickCharm(run, id); sends the offer summary once the reward is settled.
export function rewardSettled(run) {
  const m = meta(run), r = m.reward;
  if (!r || run.status === 'reward') return;
  track('voyage_charm_offer', { run_id: m.id, board_idx: r.idx, stars: r.stars, picks_allowed: r.picks, offered: r.offered, picked: r.picked, offer_count: r.offered.length, source: 'reward' });
  m.reward = null;
}

// --- port -----------------------------------------------------------------------------
const stockOf = (port) => (port.kind === 'boons' ? port.boons.map((o) => o.id) : port.kind === 'stickers' ? port.stickers.map((o) => o.type) : []);

export function portEnter(run) {
  const m = meta(run), port = run.port;
  if (!port || m.port?.at === port.boardIdx) return;
  m.port = { at: port.boardIdx, coinsBefore: run.coins, items: 0, rerolls: 0, bought: [] };
  track('voyage_port_enter', { run_id: m.id, market_kind: port.kind || 'harbour', coins: run.coins, stock: stockOf(port) });
}

// kind: boon | sticker | upgrade | undo | sell | reroll | service. Call after a successful action.
export function portAction(run, kind, arg, { coinsBefore, stockBefore = [] }) {
  const m = meta(run), p = m.port, idx = run.results.length - 1;
  const delta = run.coins - coinsBefore;
  const item = { boon: `boon:${arg}`, sticker: `sticker:${stockBefore[arg] ?? ''}`, upgrade: `upgrade:${arg}`, undo: 'undo', sell: `sell:${arg}`, reroll: 'reroll', service: `service:${arg}` }[kind];
  if (delta < 0) spend(run, -delta, item);
  if (kind === 'boon') {
    track('voyage_charm_pick', { ...pickParams(run, arg, stockBefore, 'market', idx), held_before: run.boons.filter(visible).length - 1 });
    p?.bought.push(arg);
    m.picked[arg] = run.results.length;
  }
  if (kind === 'upgrade') track('voyage_charm_upgrade', { run_id: m.id, charm_id: arg, price: Math.max(0, -delta) });
  if (kind === 'sell') {
    earn(run, delta, 'sell');
    track('voyage_charm_sell', { run_id: m.id, charm_id: arg, price: Math.max(0, delta), held_boards: m.picked[arg] != null ? run.results.length - m.picked[arg] : undefined });
  }
  if (p && kind === 'reroll') p.rerolls++;
  if (p && kind !== 'reroll' && kind !== 'sell') p.items++;
}

// port: run.port before leavePort cleared it.
export function portLeave(run, port) {
  const m = meta(run), p = m.port;
  if (!port || !p) return;
  track('voyage_port_leave', { run_id: m.id, market_kind: port.kind || 'harbour', coins_before: p.coinsBefore, coins_after: run.coins, items_bought: p.items, rerolls: p.rerolls, held: held(run) });
  if (port.kind === 'boons') {
    const offered = port.boons.map((o) => o.id);
    track('voyage_charm_offer', { run_id: m.id, board_idx: port.boardIdx, offered, picked: p.bought, offer_count: offered.length, source: 'market' });
  }
  m.port = { at: p.at, done: true };
}
