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
import { stream, randomSeed } from './rng.js';
import { createMap, chooseNode, nextChoices, findNode, mapView } from './map.js';
import { CHARMS, boonsForTheme, challengeForTheme, bossIds, composeBoard, charmText } from './charms.js';
import { scoreBoard, starsFor, starThresholds } from './scoring.js';
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
  const strength = VOYAGE.strengthForBoard(idx + 1);
  const challenge = challengeForTheme(themeId);
  const boss = isFinalBoard(run, idx) ? run.boss : null;
  const { active, rules, ease } = composeBoard({ boons, challenge, boss, strength });
  return { idx, theme: themeId, tier: VOYAGE.tierForBoard(idx + 1), strength, challenge, boss, active, rules, ease };
}

// Every plan the next board could need, so the dealer can prepare deals in the background while
// the current board is played: next nodes × the charm the player might pick.
export function upcomingPlans(run) {
  const plans = [];
  const seen = new Set();
  const push = (p) => {
    const key = `${p.theme}|${p.rules.freeCells}|${p.ease.toFixed(2)}|${p.tier}`;
    if (!seen.has(key)) seen.add(key), plans.push(p);
  };
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
  // The theme's three boons are offered after this board, in a seeded order; stars decide how
  // many of them the player sees.
  const offers = stream(run.seed, 'offers', plan.idx).shuffle(boonsForTheme(node.theme).filter((id) => !run.boons.includes(id)));
  run.current = {
    nodeId,
    idx: plan.idx,
    theme: node.theme,
    tier: plan.tier,
    strength: plan.strength,
    challenge: plan.challenge,
    boss: plan.boss,
    active: plan.active,
    rules: plan.rules,
    deal: dealt.deal,
    par: dealt.par,
    rating: dealt.score ?? null,
    offers,
    history: [],
    elapsed: 0,
    undosUsed: 0,
    memo: {}, // charm scratch state for this board (see BoardEffects)
  };
  run.status = 'board';
  return run.current;
}

// Spend one undo; false when none are left.
export function spendUndo(run) {
  if (run.undos <= 0) return false;
  run.undos--;
  if (run.current) run.current.undosUsed++;
  return true;
}

export function winBoard(run, history, effects, { elapsed = 0 } = {}) {
  const cur = run.current;
  const sb = scoreBoard(history, cur.par, effects);
  const total = sb.total;
  const stars = starsFor(total, cur.par);
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
  const offers = cur.offers.slice(0, stars);
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

export function pickCharm(run, id) {
  if (run.status !== 'reward' || !run.reward.offers.includes(id)) throw new Error(`Cannot pick ${id}`);
  run.boons.push(id);
  CHARMS[id].onPick?.(run);
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
const charmView = (id, strength = 1) => {
  const c = CHARMS[id];
  return c ? { id, kind: c.kind, name: c.name, icon: c.icon, text: charmText(id, strength), theme: c.theme || null, placeholder: !!c.placeholder } : null;
};

export function runView(run) {
  const cur = run.current;
  return {
    seed: run.seed,
    daily: run.daily,
    status: run.status,
    board: boardIndex(run) + (run.status === 'board' ? 1 : 0), // 1-based board being played, else boards cleared
    boards: VOYAGE.boards,
    undos: run.undos,
    score: totalScore(run),
    stars: totalStars(run),
    boons: run.boons.map((id) => charmView(id)),
    boss: run.boss ? charmView(run.boss, VOYAGE.strengthForBoard(VOYAGE.boards)) : null,
    map: mapView(run.map).map((row) =>
      row.map((n) => ({
        ...n,
        challenge: charmView(challengeForTheme(n.theme), VOYAGE.strengthForBoard(n.row + 1)),
        boons: boonsForTheme(n.theme).map((id) => charmView(id)),
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
          freeCells: cur.rules.freeCells,
          starThresholds: starThresholds(cur.par),
          challenge: cur.challenge ? charmView(cur.challenge, cur.strength) : null,
          boss: cur.boss ? charmView(cur.boss, cur.strength) : null,
        }
      : null,
    reward: run.reward ? { stars: run.reward.stars, offers: run.reward.offers.map((id) => charmView(id)), result: run.results[run.results.length - 1] } : null,
    results: run.results,
    lostReason: run.lostReason,
  };
}

// ---------------------------------------------------------------------------
// Persistence.
// ---------------------------------------------------------------------------
export const loadRun = () => {
  const r = load('voyage', null);
  return r && r.v === RUN_VERSION && (r.status === 'map' || r.status === 'board' || r.status === 'reward') ? r : null;
};
export const saveRun = (run) => save('voyage', run && (run.status === 'won' || run.status === 'lost') ? null : run);
