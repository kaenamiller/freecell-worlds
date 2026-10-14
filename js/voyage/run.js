// The Voyage run: a pure state machine with no DOM or three.js, so it can be tested in Node.
// main.js drives it, the UI renders `runView(run)`, and the whole object is saved as JSON after
// every change, so a run survives reloads.
//
// Status flow:
//   'map'     choose the next board (nextChoices)            → startBoard(nodeId, dealt)
//   'board'   playing run.current                             → winBoard(history, effects) | loseRun(reason)
//   'reward'  pick one of run.reward.offers (1..3, by stars)  → pickCharm(id) → 'port' | 'map'
//   'port'    shop after a harbour board                     → leavePort() → 'map'
//   'won' / 'lost'  finished; recorded in voyage stats
import { VOYAGE, marketForBoard } from './config.js';
import { rulesKey, bossBudget, boonRelation, applyDealRules } from './boardrules.js';
import { stream, randomSeed } from './rng.js';
import { createMap, chooseNode, nextChoices, findNode, mapView, revealMap } from './map.js';
import { CHARMS, boonsForTheme, challengeForTheme, bossIds, composeBoard, charmText, BoardEffects } from './charms.js';
import { scoreBoard, starsFor, starThresholds } from './scoring.js';
import { createPort, portView, runHookContext, heldBoonHooks, economy, recordCoinChange } from './port.js';
import { Game, cloneState, maxMoveSize } from '../rules.js';
import { load, save } from '../store.js';

export const RUN_VERSION = 4; // 4: scheduled markets (stickers, charms, upgrades)

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
    coins: 0,
    boons: [],
    levels: {},
    stickers: {},
    port: null,
    economy: { coinsEarned: 0, coinsSpent: 0, portVisits: 0, stickersBought: 0, upgrades: 0 },
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

function adjustHeld(run, hook, value, min, max, options = {}) {
  heldBoonHooks(run, (charm, ctx) => {
    const next = charm[hook]?.(value, ctx);
    if (Number.isFinite(next)) value = next;
  }, options);
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function refreshMap(run) {
  const lookahead = adjustHeld(run, 'lookahead', VOYAGE.lookahead, 1, 4, { boardIndex: boardIndex(run) });
  revealMap(run.map, { lookahead, bannedTheme: bannedFinalTheme(run) });
}

// Everything needed to deal board `idx` on `themeId`, given a hypothetical boon list.
export function boardPlan(run, themeId, { idx = boardIndex(run), boons = run.boons, nodeId = null, extraChallenges = null } = {}) {
  const candidates = Object.values(run.map.nodes).filter((n) => n.row === idx && n.theme === themeId);
  const node = candidates.find((n) => n.id === nodeId) || candidates.find((n) => n.id === run.map.path.at(-1)) || nextChoices(run.map).find((n) => n.row === idx && n.theme === themeId) || candidates[0];
  const storm = !!node?.storm && !isFinalBoard(run, idx);
  extraChallenges ??= storm && node.stormChallenge ? [node.stormChallenge] : [];
  const requestedStrength = VOYAGE.strengthForBoard(idx + 1);
  const challenge = challengeForTheme(themeId);
  const boss = isFinalBoard(run, idx) && CHARMS[run.boss] ? run.boss : null;
  const challengeStrength = adjustHeld({ ...run, boons }, 'challengeStrength', requestedStrength, 1, 7, { boardIndex: idx });
  const { strength, budgeted = false } = bossBudget({ boss, challenge, strength: challengeStrength, seed: run.seed, idx, runMemo: run.charmMemo });
  const levels = { ...run.levels }, stickers = { ...run.stickers };
  const { active, rules, ease, dealShift, confiscated = null } = composeBoard({ boons, levels, stickers, challenge, extraChallenges, boss, strength, boonStrength: requestedStrength, bossStrength: 7, seed: run.seed, idx, runMemo: run.charmMemo });
  return { idx, theme: themeId, tier: VOYAGE.tierForBoard(idx + 1), strength, requestedStrength, budgeted, challenge, extraChallenges, storm, boss, active, rules, ease, dealShift, confiscated, levels, stickers, seed: run.seed, runMemo: run.charmMemo };
}

// Every plan the next board could need, so the dealer can prepare deals in the background while
// the current board is played: next nodes × the charm the player might pick.
export function upcomingPlans(run) {
  refreshMap(run);
  const plans = [];
  if ((run.status === 'board' || run.status === 'reward') && isFinalBoard(run, run.current?.idx ?? boardIndex(run))) return plans;
  const seen = new Set();
  const push = (p) => {
    const key = `${p.theme}|${rulesKey(p.rules)}|${p.ease}|${p.dealShift || 0}|${p.tier}|${JSON.stringify(p.levels)}|${JSON.stringify(p.stickers)}|${p.active.map((a) => `${a.id}:${a.strength}:${a.level || 1}`).join(',')}`;
    if (!seen.has(key)) seen.add(key), plans.push(p);
  };
  // Final-row nodes appear two rows ahead: verify their charm-less boss plans now.
  for (const n of Object.values(run.map.nodes)) if (n.row === VOYAGE.boards - 1) {
    push({ ...boardPlan(run, n.theme, { idx: n.row, boons: [] }), preSolveBoss: true });
  }
  if (run.status === 'map' || run.status === 'port') {
    for (const n of nextChoices(run.map)) push(boardPlan(run, n.theme, { nodeId: n.id }));
  } else if (run.status === 'board' || run.status === 'reward') {
    if (isFinalBoard(run, run.current?.idx ?? boardIndex(run))) return plans;
    const node = findNode(run.map, run.current.nodeId);
    const offers = run.status === 'reward' ? run.reward.offers : run.current.offers;
    const picks = run.status === 'reward' ? run.reward.picks : adjustHeld(run, 'picks', 1, 1, 2);
    const nexts = node.links.map((id) => findNode(run.map, id)).filter(Boolean);
    for (const n of nexts) {
      if (!offers.length) push(boardPlan(run, n.theme, { nodeId: n.id, idx: run.current.idx + 1 }));
      for (const o of offers) if (!CHARMS[o]?.hidden) push(boardPlan(run, n.theme, { nodeId: n.id, idx: run.current.idx + 1, boons: [...run.boons, o] }));
      if (picks > 1) for (let i = 0; i < offers.length; i++) for (let j = i + 1; j < offers.length; j++) {
        if (!CHARMS[offers[i]]?.hidden && !CHARMS[offers[j]]?.hidden) push(boardPlan(run, n.theme, { nodeId: n.id, idx: run.current.idx + 1, boons: [...run.boons, offers[i], offers[j]] }));
      }
    }
  }
  return plans;
}

// Tables two steps ahead, with the charms held now. Their deals may still change
// with a later pick, but most candidate checks carry over, so this low-priority
// pass takes the long solves off the moment the player sets course.
export function laterPlans(run) {
  refreshMap(run);
  const from = run.status === 'map' || run.status === 'port' ? nextChoices(run.map)
    : (run.status === 'board' || run.status === 'reward') && run.current ? [findNode(run.map, run.current.nodeId)].filter(Boolean).flatMap((n) => n.links.map((id) => findNode(run.map, id))) : [];
  const seen = new Set(), plans = [];
  for (const n of from.filter(Boolean)) for (const id of n.links) {
    const child = findNode(run.map, id);
    if (!child || seen.has(id) || child.row >= VOYAGE.boards - 1) continue;
    seen.add(id);
    plans.push(boardPlan(run, child.theme, { idx: child.row, nodeId: child.id }));
  }
  return plans;
}

// Offer hooks run once at deal time; the saved seeded pool is cut by stars later.
export function boardOffers(run, theme, idx = boardIndex(run)) {
  const valid = (id) => CHARMS[id]?.kind === 'boon' && !CHARMS[id].hidden && !CHARMS[id].placeholder && !run.boons.includes(id);
  let offers = stream(run.seed, 'offers', idx).shuffle(boonsForTheme(theme).filter(valid));
  const size = offers.length;
  heldBoonHooks(run, (charm, ctx) => {
    if (!charm.offerPool) return;
    ctx.theme = theme;
    ctx.rng = stream(run.seed, 'offerPool', idx, charm.id);
    const next = charm.offerPool([...offers], ctx);
    if (Array.isArray(next)) offers = [...new Set(next)].filter(valid).slice(0, size);
  }, { boardIndex: idx });
  return offers;
}

// Start the board on `nodeId`. `dealt` is the dealer's pick: { deal, par, score }.
export function startBoard(run, nodeId, dealt) {
  if (run.status !== 'map') throw new Error(`startBoard in status ${run.status}`);
  refreshMap(run);
  const node = chooseNode(run.map, nodeId, { bannedTheme: bannedFinalTheme(run) });
  const plan = boardPlan(run, node.theme, { nodeId });
  // The dealer may have relaxed a restrict challenge to obtain a verified deal.
  for (const key of ['rules', 'strength', 'active', 'ease', 'dealShift', 'confiscated']) if (dealt[key] !== undefined) plan[key] = dealt[key];
  if (dealt.bossRelented) { plan.boss = null; plan.confiscated = null; } // last-resort fallback: no verified deal existed under the boss
  // Dealer returns deal-final rules. Tests that pass an explicit rules object keep it.
  // A deal-only pick still needs dealRules applied onto the composed plan.
  if (dealt.rules === undefined) plan.rules = applyDealRules(plan.rules, plan, dealt.deal);
  // The theme's three boons are offered after this board, in a seeded order; stars decide how
  // many of them the player sees.
  const offers = boardOffers(run, node.theme, plan.idx);
  run.current = {
    nodeId,
    idx: plan.idx,
    theme: node.theme,
    tier: plan.tier,
    strength: plan.strength,
    challenge: plan.active.some((a) => a.id === plan.challenge) ? plan.challenge : null,
    extraChallenges: plan.extraChallenges.filter((id) => plan.active.some((a) => a.id === id)),
    storm: plan.storm,
    boss: plan.boss,
    confiscated: plan.confiscated,
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

export function winBoard(run, history, effects, { elapsed = 0, rules = run.current?.rules, conceded = false } = {}) {
  if (run.status !== 'board' || !run.current) throw new Error(`winBoard in status ${run.status}`);
  const cur = run.current;
  if (conceded && isFinalBoard(run, cur.idx)) return false;
  const extra = scoringContext(run, { elapsed, rules });
  const sb = scoreBoard(history, cur.par, effects, extra);
  const total = sb.total;
  const stars = conceded ? 1 : starsFor(total, cur.par, effects, { ...extra, sb });
  const coinLines = [
    ...(!conceded ? [
    { key: 'base', label: 'Table cleared', coins: VOYAGE.coins.base },
    { key: 'stars', label: `Stars (${stars} × ${VOYAGE.coins.perStar})`, coins: VOYAGE.coins.perStar * stars },
    { key: 'points', label: `Score (${VOYAGE.coins.perPoints} points per coin)`, coins: Math.floor(total / VOYAGE.coins.perPoints) },
    ] : []),
    ...sb.coinLines.map((line) => ({ ...line })),
  ];
  let coins = coinLines.reduce((sum, line) => sum + line.coins, 0);
  let undoGrant = VOYAGE.undosPerBoard;
  heldBoonHooks(run, (charm, ctx) => {
    Object.assign(ctx, extra, { sb, stars, conceded });
    if (charm.coins) {
      const adjusted = charm.coins(coins, ctx);
      if (Number.isFinite(adjusted)) {
        coinLines.push({ key: charm.id, label: charm.name, coins: Math.round(adjusted) - coins });
        coins = Math.round(adjusted);
      }
    }
    if (charm.boardUndos) {
      const adjusted = charm.boardUndos(undoGrant, ctx);
      if (Number.isFinite(adjusted)) undoGrant = adjusted;
    }
  }, { memo: cur.memo, boardIndex: cur.idx, api: effects?.api || {} });
  if (cur.storm) {
    coinLines.push({ key: 'storm', label: 'Storm passage · double coins', coins });
    coins *= 2;
  }
  if (coins < 0) coinLines.push({ key: 'minimum', label: 'Minimum earned', coins: -coins });
  coins = Math.max(0, coins);
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
    storm: !!cur.storm,
    conceded,
    coins,
    coinLines,
    charm: null,
    charms: [],
  };
  run.results.push(result);
  run.coins += coins;
  economy(run).coinsEarned += coins;
  run.undos += Math.max(0, Math.floor(undoGrant));
  const offers = cur.offers.filter((id) => CHARMS[id]?.kind === 'boon' && !CHARMS[id].hidden && !CHARMS[id].placeholder && !run.boons.includes(id)).slice(0, conceded ? 1 : cur.storm ? 3 : effects?.offers(stars) ?? stars);
  // A concession promises one offer even when every boon from this stop is held.
  if (conceded && !offers.length) {
    const pool = Object.values(CHARMS).filter((c) => c.kind === 'boon' && !c.hidden && !c.placeholder && !run.boons.includes(c.id)).map((c) => c.id);
    if (pool.length) offers.push(stream(run.seed, 'concedeOffer', cur.idx).pick(pool));
  }
  if (isFinalBoard(run, cur.idx) || !offers.length) {
    if (isFinalBoard(run, cur.idx)) {
      run.status = 'won'; run.current = null; run.reward = null; run.port = null;
    } else finishReward(run);
  } else {
    run.status = 'reward';
    const picks = conceded ? 1 : Math.min(offers.length, adjustHeld(run, 'picks', 1, 1, 2, { memo: cur.memo, boardIndex: cur.idx }));
    run.reward = { stars, offers, picks, idx: cur.idx };
  }
  return result;
}

export function concedeBoard(run, history = [], effects = null, options = {}) {
  if (run?.status !== 'board' || !run.current || isFinalBoard(run, run.current.idx)) return false;
  return winBoard(run, history, effects, { ...options, conceded: true });
}

export function pickCharm(run, id, { api = {} } = {}) {
  if (run.status !== 'reward' || !run.reward.offers.includes(id) || !CHARMS[id] || CHARMS[id].hidden || run.boons.includes(id)) throw new Error(`Cannot pick ${id}`);
  run.boons.push(id);
  const before = run.coins;
  CHARMS[id].onPick?.(run, runHookContext(run, id, { api }));
  recordCoinChange(run, before);
  const result = run.results.at(-1);
  result.charm ??= id;
  (result.charms ??= []).push(id);
  run.reward.offers = run.reward.offers.filter((offer) => offer !== id);
  run.reward.picks = (run.reward.picks || 1) - 1;
  refreshMap(run);
  if (!run.reward.picks || !run.reward.offers.length) finishReward(run);
}

function finishReward(run) {
  const cur = run.current;
  const dock = cur && !isFinalBoard(run, cur.idx) && findNode(run.map, cur.nodeId)?.port;
  run.reward = null;
  run.current = null;
  run.status = dock ? 'port' : 'map';
  if (dock) createPort(run);
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
const charmView = (id, strength = 1, runtime = null, ability = null, seed = 0, boss = null, level = 1) => {
  const c = CHARMS[id];
  const relation = c ? boonRelation(boss, id, { seed, level }) : null;
  return c ? { id, kind: c.kind, name: c.name, icon: c.icon, text: charmText(id, strength, { seed, level }), level, family: c.family || null, upgradeText: c.upgrade ? charmText(id, strength, { seed, level: 2 }) : null, pressure: !!c.pressure, hidden: !!c.hidden, tell: (typeof c.tell === 'function' ? null : c.tell) || BOSS_TELLS[id] || null, relation, relationText: boss === 'boss.fog' && id === 'deepstorage.clearance' ? 'Nullifies Fog of War' : CHARMS[boss] ? ({ '+': `Helps against ${CHARMS[boss].name}`, '~': `Unaffected by ${CHARMS[boss].name}`, '!': `Weakened by ${CHARMS[boss].name}` })[relation] : null, theme: c.theme || null, placeholder: !!c.placeholder, badge: runtime?.badge || null, ability } : null;
};

// A boss may compute its tell from the run (The Mirror names the family it's watching).
function bossView(run) {
  const view = charmView(run.boss, 7, null, null, run.seed);
  const tell = CHARMS[run.boss]?.tell;
  if (typeof tell === 'function') view.tell = tell({ seed: run.seed, boons: run.boons.slice(), boardIdx: boardIndex(run) }) || view.tell;
  return view;
}

// 'upcoming' until its row is cleared, 'available' while docked but not yet
// entered, 'current' once you have left it (the boat waits there), then 'visited'.
function marketState(run, row) {
  const cleared = run.results.length;
  if (cleared <= row || (cleared === row + 1 && run.status === 'reward')) return 'upcoming';
  if (cleared === row + 1) return run.status === 'port' ? 'available' : run.status === 'map' ? 'current' : 'visited';
  return 'visited';
}

export function runView(run, effects = null) {
  refreshMap(run);
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
  const liveCharm = (id, strength = 1) => charmView(id, strength, cur?.memo?.[id]?._runtime, boardEffects?.abilityState(id), run.seed, run.boss, run.levels?.[id] || 1);
  return {
    seed: run.seed,
    daily: run.daily,
    status: run.status,
    board: boardIndex(run) + (run.status === 'board' ? 1 : 0), // 1-based board being played, else boards cleared
    boards: VOYAGE.boards,
    undos: run.undos,
    coins: run.coins,
    stickers: Object.entries(run.stickers || {}).map(([card, type]) => ({ card: Number(card), type })).sort((a, b) => a.card - b.card),
    port: portView(run, (id) => liveCharm(id, VOYAGE.strengthForBoard(Math.max(1, run.results.length)))),
    confiscated: cur?.confiscated ? liveCharm(cur.confiscated) : null,
    score: totalScore(run),
    stars: totalStars(run),
    boons: run.boons.filter((id) => CHARMS[id] && !CHARMS[id].hidden).map((id) => liveCharm(id)),
    boss: run.boss ? bossView(run) : null,
    map: mapView(run.map).map((row) =>
      row.map((n) => {
        // While docked, the market is the only stop you can sail to. The tables
        // beyond it stay on the chart, but open only once you leave the market.
        if (run.status === 'port' && n.state === 'available') n = { ...n, state: 'upcoming' };
        const final = n.row === VOYAGE.boards - 1;
        const stop = marketForBoard(n.row);
        const plan = boardPlan(run, n.theme, { idx: n.row, nodeId: n.id });
        return {
          ...n,
          port: !!n.port,
          market: stop ? { kind: stop.kind, name: stop.name, wares: stop.wares, afterBoard: stop.afterBoard } : null,
          storm: !!n.storm,
          stormChallenge: n.stormChallenge ? charmView(n.stormChallenge, plan.strength, null, null, run.seed) : null,
          challenge: charmView(challengeForTheme(n.theme), plan.strength, null, null, run.seed),
          boons: boonsForTheme(n.theme).filter((id) => !CHARMS[id]?.hidden).map((id) => liveCharm(id)),
          confiscated: plan.confiscated ? liveCharm(plan.confiscated) : null,
          final,
        };
      })
    ),
    current: cur
      ? {
          idx: cur.idx,
          theme: cur.theme,
          deal: cur.deal,
          tier: cur.tier,
          par: cur.par,
          undoGrants: cur.memo?._undoGrants || 0,
          undoCap: VOYAGE.charmUndoCap,
          confiscated: cur.confiscated ? liveCharm(cur.confiscated) : null,
          storm: !!cur.storm,
          stormChallenge: cur.extraChallenges?.[0] ? liveCharm(cur.extraChallenges[0], cur.strength) : null,
          extraChallenges: (cur.extraChallenges || []).map((id) => liveCharm(id, cur.strength)),
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
    markets: VOYAGE.markets.filter((market) => mapView(run.map).some((row) => row.some((node) => node.row === market.afterBoard - 1))).map((market) => ({
      id: `market:${market.kind}`,
      row: market.afterBoard - 1,
      afterBoard: market.afterBoard,
      kind: market.kind,
      name: market.name,
      wares: market.wares,
      state: marketState(run, market.afterBoard - 1),
    })),
    reward: run.reward ? { stars: run.reward.stars, picks: run.reward.picks || 1, offers: run.reward.offers.filter((id) => CHARMS[id] && !CHARMS[id].hidden).map((id) => liveCharm(id)), result: run.results[run.results.length - 1] } : null,
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
  return r && r.v === RUN_VERSION && ['map', 'board', 'reward', 'port'].includes(r.status) ? r : null;
};
export const saveRun = (run) => save('voyage', run && (run.status === 'won' || run.status === 'lost') ? null : run);
