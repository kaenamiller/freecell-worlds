// The Voyage run: a pure state machine with no DOM or three.js, so it can be tested in Node.
// main.js drives it, the UI renders `runView(run)`, and the whole object is saved as JSON after
// every change, so a run survives reloads.
//
// Status flow:
//   'map'     choose the next board (nextChoices)            → startBoard(nodeId, dealt)
//   'board'   playing run.current                             → winBoard(history, effects) | loseRun(reason)
//   'reward'  pick one of run.reward.offers (1..3, by stars)  → pickCharm(id) → 'map' | 'won'
//   'won' / 'lost'  finished; recorded in voyage stats
import { VOYAGE } from './config.js';
import { rulesKey, bossBudget, boonRelation } from './boardrules.js';
import { stream, randomSeed } from './rng.js';
import { createMap, chooseNode, nextChoices, findNode, mapView } from './map.js';
import { CHARMS, boonsForTheme, challengeForTheme, bossIds, composeBoard, charmText, BoardEffects } from './charms.js';
import { scoreBoard, starsFor, starThresholds } from './scoring.js';
import { Game, cloneState, maxMoveSize } from '../rules.js';
import { load, save } from '../store.js';

export const RUN_VERSION = 2; // 2: tree-shaped chart

const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function createRun({ seed = randomSeed(), daily = false } = {}) {
  if (daily) seed = `daily-${dateKey()}`;
  const bosses = bossIds();
  const boss = bosses.length ? stream(seed, 'boss').pick(bosses) : null;
  const run = {
    v: RUN_VERSION,
    seed,
    daily: daily ? dateKey() : null,
    startedAt: Date.now(),
    status: 'map',
    undos: VOYAGE.startUndos,
    boons: [],
    charmMemo: {},
    boss,
    map: null,
    current: null,
    reward: null,
    results: [],
    lostReason: null,
  };
  run.map = createMap(seed, { bannedTheme: bannedFinalTheme(run) });
  return run;
}

// A final-row theme is skipped when its challenge clashes with the boss (shared `tags`).
function bannedFinalTheme(run) {
  return (themeId, row) => {
    if (row !== VOYAGE.boards - 1 || !run.boss) return false;
    const bossTags = CHARMS[run.boss]?.tags || [];
    const ch = CHARMS[challengeForTheme(themeId)];
    return !!ch?.tags?.some((t) => bossTags.includes(t));
  };
}

export const boardIndex = (run) => run.results.length; // 0-based board being played / next
export const isFinalBoard = (run, idx = boardIndex(run)) => idx === VOYAGE.boards - 1;

// Everything needed to deal board `idx` on `themeId`, given a hypothetical boon list.
export function boardPlan(run, themeId, { idx = boardIndex(run), boons = run.boons } = {}) {
  const requestedStrength = VOYAGE.strengthForBoard(idx + 1);
  const challenge = challengeForTheme(themeId);
  const boss = isFinalBoard(run, idx) && CHARMS[run.boss] ? run.boss : null;
  const { strength, budgeted = false } = bossBudget({ boss, challenge, strength: requestedStrength, seed: run.seed, idx, runMemo: run.charmMemo });
  const { active, rules, ease, dealShift } = composeBoard({ boons, challenge, boss, strength, boonStrength: requestedStrength, bossStrength: 7, seed: run.seed, idx, runMemo: run.charmMemo });
  return { idx, theme: themeId, tier: VOYAGE.tierForBoard(idx + 1), strength, requestedStrength, budgeted, challenge, boss, active, rules, ease, dealShift, seed: run.seed, runMemo: run.charmMemo };
}

// Every plan the next board could need, so the dealer can prepare deals in the background while
// the current board is played: next nodes × the charm the player might pick.
export function upcomingPlans(run) {
  const plans = [];
  if ((run.status === 'board' || run.status === 'reward') && isFinalBoard(run, run.current?.idx ?? boardIndex(run))) return plans;
  const seen = new Set();
  const push = (p) => {
    const key = `${p.theme}|${rulesKey(p.rules)}|${p.ease}|${p.dealShift || 0}|${p.tier}`;
    if (!seen.has(key)) seen.add(key), plans.push(p);
  };
  // Final-row nodes appear two rows ahead: verify their charm-less boss plans now.
  for (const n of Object.values(run.map.nodes)) if (n.row === VOYAGE.boards - 1) {
    push({ ...boardPlan(run, n.theme, { idx: n.row, boons: [] }), preSolveBoss: true });
  }
  if (run.status === 'map') {
    for (const n of nextChoices(run.map)) push(boardPlan(run, n.theme));
  } else if (run.status === 'board' || run.status === 'reward') {
    if (isFinalBoard(run, run.current?.idx ?? boardIndex(run))) return plans;
    const node = findNode(run.map, run.current.nodeId);
    const offers = run.status === 'reward' ? run.reward.offers : run.current.offers;
    const nexts = node.links.map((id) => findNode(run.map, id)).filter(Boolean);
    for (const n of nexts) for (const o of offers) push(boardPlan(run, n.theme, { idx: run.current.idx + 1, boons: [...run.boons, o] }));
  }
  return plans;
}

// Start the board on `nodeId`. `dealt` is the dealer's pick: { deal, par, score }.
export function startBoard(run, nodeId, dealt) {
  if (run.status !== 'map') throw new Error(`startBoard in status ${run.status}`);
  const node = chooseNode(run.map, nodeId, { bannedTheme: bannedFinalTheme(run) });
  const plan = boardPlan(run, node.theme);
  // The dealer may have relaxed a restrict challenge to obtain a verified deal.
  for (const key of ['rules', 'strength', 'active', 'ease', 'dealShift']) if (dealt[key] !== undefined) plan[key] = dealt[key];
  if (dealt.bossRelented) plan.boss = null; // last-resort fallback: no verified deal existed under the boss
  // The theme's three boons are offered after this board, in a seeded order; stars decide how
  // many of them the player sees.
  const offers = stream(run.seed, 'offers', plan.idx).shuffle(boonsForTheme(node.theme).filter((id) => !run.boons.includes(id)));
  run.current = {
    nodeId,
    idx: plan.idx,
    theme: node.theme,
    tier: plan.tier,
    strength: plan.strength,
    challenge: plan.active.some((a) => a.id === plan.challenge) ? plan.challenge : null,
    boss: plan.boss,
    active: plan.active,
    rules: plan.rules,
    deal: dealt.deal,
    par: dealt.par,
    rating: dealt.score ?? null,
    preSolveCacheHit: !!dealt.preSolveCacheHit,
    relaxed: !!dealt.relaxed,
    bossRelented: !!dealt.bossRelented,
    budgeted: plan.budgeted,
    offers,
    history: [],
    elapsed: 0,
    undosUsed: 0,
    memo: {}, // charm scratch state for this board (see BoardEffects)
  };
  run.status = 'board';
  if (isFinalBoard(run, plan.idx) && !run.finaleGranted) {
    run.undos += VOYAGE.finaleUndos;
    run.finaleGranted = true;
    run.current.finaleStipend = VOYAGE.finaleUndos;
  }
  return run.current;
}

// Spend one undo; false when none are left.
export function spendUndo(run) {
  if (run.undos <= 0) return false;
  run.undos--;
  if (run.current) run.current.undosUsed++;
  return true;
}

export function scoringContext(run, { elapsed = run.current?.elapsed || 0, rules = run.current?.rules } = {}) {
  const cur = run.current;
  const initial = cur.initial || new Game(cur.deal, { rules: cur.rules, freeCells: cur.rules.freeCells }).state;
  return { elapsed, undosUsed: cur.undosUsed || 0, undosLeft: run.undos, initial: cloneState(initial), rules, initialRules: cur.rules, boardIdx: cur.idx, boss: !!CHARMS[cur.boss] };
}

export function winBoard(run, history, effects, { elapsed = 0, rules = run.current?.rules } = {}) {
  const cur = run.current;
  const extra = scoringContext(run, { elapsed, rules });
  const sb = scoreBoard(history, cur.par, effects, extra);
  const total = sb.total;
  const stars = starsFor(total, cur.par, effects, { ...extra, sb });
  const result = {
    idx: cur.idx,
    theme: cur.theme,
    deal: cur.deal,
    tier: cur.tier,
    par: cur.par,
    moves: sb.stat.moves,
    time: Math.round(elapsed),
    undosUsed: cur.undosUsed,
    score: sb.toJSON(),
    total,
    stars,
    charm: null,
  };
  run.results.push(result);
  run.undos += VOYAGE.undosPerBoard;
  const offers = cur.offers.slice(0, effects?.offers(stars) ?? stars);
  if (isFinalBoard(run, cur.idx) || !offers.length) {
    run.status = isFinalBoard(run, cur.idx) ? 'won' : 'map';
    run.current = null;
    run.reward = null;
  } else {
    run.status = 'reward';
    run.reward = { stars, offers, idx: cur.idx };
  }
  return result;
}

export function pickCharm(run, id, { api = {} } = {}) {
  if (run.status !== 'reward' || !run.reward.offers.includes(id)) throw new Error(`Cannot pick ${id}`);
  run.boons.push(id);
  const effects = new BoardEffects([{ id, kind: 'boon', strength: run.current?.strength || 1 }], {
    seed: run.seed, boardIndex: run.current?.idx ?? Math.max(0, boardIndex(run) - 1), run, memo: {},
    api: { addUndos: (n) => { run.undos += Math.max(0, Math.floor(n)); }, spendUndos: (n) => { run.undos = Math.max(0, run.undos - Math.max(0, Math.floor(n))); }, notify: () => {}, ...api },
  });
  CHARMS[id].onPick?.(run, effects.ctxs[0]);
  run.results[run.results.length - 1].charm = id;
  run.reward = null;
  run.current = null;
  run.status = 'map';
}

export function loseRun(run, reason) {
  run.status = 'lost';
  run.lostReason = reason; // 'abandoned' | 'stuck'
}

export const totalScore = (run) => run.results.reduce((s, r) => s + r.total, 0);
export const totalStars = (run) => run.results.reduce((s, r) => s + r.stars, 0);

// ---------------------------------------------------------------------------
// View model for the UI (see docs/voyage/ui-contract.md).
// ---------------------------------------------------------------------------
const BOSS_TELLS = {
  'boss.lockdown': 'sealed free-cell slots', 'boss.thaw': 'frozen cells and thaw milestones',
  'boss.decree': 'crown marks on court cards', 'boss.throne': 'King-only empty columns and move capacity',
  'boss.barren': 'thorn marks on the barren suit', 'boss.lockstep': 'the foundation ceiling band',
  'boss.tombs': 'chains across the sealed columns',
  'boss.fog': 'mist over buried cards and the remaining peek budget',
};
const charmView = (id, strength = 1, runtime = null, ability = null, seed = 0, boss = null) => {
  const c = CHARMS[id];
  return c ? { id, kind: c.kind, name: c.name, icon: c.icon, text: charmText(id, strength, { seed }), tell: c.tell || BOSS_TELLS[id] || null, relation: boonRelation(boss, id, { seed }), relationText: boss === 'boss.fog' && id === 'deepstorage.clearance' ? 'Nullifies Fog of War' : CHARMS[boss] ? ({ '+': `Helps against ${CHARMS[boss].name}`, '~': `Unaffected by ${CHARMS[boss].name}`, '!': `Weakened by ${CHARMS[boss].name}` })[boonRelation(boss, id, { seed })] : null, theme: c.theme || null, placeholder: !!c.placeholder, badge: runtime?.badge || null, ability } : null;
};

export function runView(run, effects = null) {
  const cur = run.current;
  let boardEffects = effects;
  if (!boardEffects && cur) {
    // Saved-title/preview views also need a real state for available(ctx) predicates.
    const previewGame = new Game(cur.deal, { rules: JSON.parse(JSON.stringify(cur.rules)), freeCells: cur.rules.freeCells });
    for (const move of cur.history || []) previewGame.applyDescriptor(move);
    if (cur.liveRules) previewGame.rules = JSON.parse(JSON.stringify(cur.liveRules));
    boardEffects = new BoardEffects(cur.active || [], {
      seed: run.seed, boardIndex: cur.idx, run, memo: cur.memo ??= {},
      api: { state: previewGame.state, rules: previewGame.rules, history: previewGame.history },
    });
  }
  const liveCharm = (id, strength = 1) => charmView(id, strength, cur?.memo?.[id]?._runtime, boardEffects?.abilityState(id), run.seed, run.boss);
  return {
    seed: run.seed,
    daily: run.daily,
    status: run.status,
    board: boardIndex(run) + (run.status === 'board' ? 1 : 0), // 1-based board being played, else boards cleared
    boards: VOYAGE.boards,
    undos: run.undos,
    score: totalScore(run),
    stars: totalStars(run),
    boons: run.boons.map((id) => liveCharm(id)),
    boss: run.boss ? charmView(run.boss, 7, null, null, run.seed) : null,
    map: mapView(run.map).map((row) =>
      row.map((n) => ({
        ...n,
        challenge: charmView(challengeForTheme(n.theme), n.row === VOYAGE.boards - 1 ? boardPlan(run, n.theme, { idx: n.row }).strength : VOYAGE.strengthForBoard(n.row + 1), null, null, run.seed),
        boons: boonsForTheme(n.theme).map((id) => liveCharm(id)),
        final: n.row === VOYAGE.boards - 1,
      }))
    ),
    current: cur
      ? {
          idx: cur.idx,
          theme: cur.theme,
          deal: cur.deal,
          tier: cur.tier,
          par: cur.par,
          freeCells: cur.liveRules?.freeCells ?? cur.rules.freeCells,
          moveCapacity: boardEffects?.ctxs[0]?.api.state && ((cur.liveRules || cur.rules).emptyFactor !== 2 || (cur.liveRules || cur.rules).emptyMinRank >= 2 || maxMoveSize(boardEffects.ctxs[0].api.state, false, cur.liveRules || cur.rules) !== maxMoveSize(boardEffects.ctxs[0].api.state, false)) ? maxMoveSize(boardEffects.ctxs[0].api.state, false, cur.liveRules || cur.rules) : null,
          starThresholds: starThresholds(cur.par, boardEffects, { boss: !!CHARMS[cur.boss] }),
          strength: cur.strength,
          relaxed: !!cur.relaxed,
          bossRelented: !!cur.bossRelented,
          budgeted: !!cur.budgeted,
          override: cur.override || null,
          challenge: cur.challenge ? liveCharm(cur.challenge, cur.strength) : null,
          boss: cur.boss ? liveCharm(cur.boss, 7) : null,
        }
      : null,
    reward: run.reward ? { stars: run.reward.stars, offers: run.reward.offers.map((id) => liveCharm(id)), result: run.results[run.results.length - 1] } : null,
    results: run.results,
    lostReason: run.lostReason,
  };
}

// ---------------------------------------------------------------------------
// Persistence.
// ---------------------------------------------------------------------------
export const loadRun = () => {
  const r = load('voyage', null);
  if (r && !CHARMS[r.boss]) { r.boss = null; if (r.current) { r.current.boss = null; r.current.active = (r.current.active || []).filter((a) => CHARMS[a.id]); } }
  if (r) { r.charmMemo ??= {}; if (r.current) { r.current.memo ??= {}; r.current.undosUsed ??= 0; } }
  return r && r.v === RUN_VERSION && (r.status === 'map' || r.status === 'board' || r.status === 'reward') ? r : null;
};
export const saveRun = (run) => save('voyage', run && (run.status === 'won' || run.status === 'lost') ? null : run);
