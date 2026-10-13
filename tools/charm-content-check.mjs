#!/usr/bin/env node
// Content author check harness. Extensions export check(helpers) (or default).
// Importing this file only exports helpers; running it loads content and extensions.
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import * as Rules from '../js/rules.js';
import { CHARMS, BoardEffects, charmContext, baseRules, clampRules, boonsForTheme, challengeForTheme } from '../js/voyage/charms.js';
import { THEME_ORDER } from '../js/themes.js';
import { stream } from '../js/voyage/rng.js';
import { scoreBoard, starsFor, starThresholds } from '../js/voyage/scoring.js';
import * as kit from '../js/voyage/content/kit.js';
import { concedeBoard } from '../js/voyage/run.js';
import { spendCoins } from '../js/voyage/port.js';
import { CHARM_FAMILIES } from '../js/voyage/registry.js';

export { assert, Rules, CHARMS, BoardEffects, charmContext, baseRules, clampRules, scoreBoard, kit, stream };
export const clone = (value) => JSON.parse(JSON.stringify(value));
export function fakeBoard(rules = baseRules()) {
  const game = new Rules.Game(1, { freeCells: rules.freeCells, rules: clone(rules) });
  const initial = Rules.cloneState(game.state);
  const first = Rules.generateMoves(game.state, { rules: game.rules });
  const discarded = game.applyDescriptor(first.find((m) => m.t === 'C') || first[0]);
  assert(discarded); assert(game.undo()); assert.deepEqual(game.state, initial);
  const next = Rules.generateMoves(game.state, { rules: game.rules });
  game.applyDescriptor(next.find((m) => m.t === 'C') || next[0]);
  for (let i = 0; i < 8; i++) {
    const mv = Rules.generateMoves(game.state, { rules: game.rules }).find((m) => m.t === 'F') || Rules.generateMoves(game.state, { rules: game.rules })[0];
    if (mv) game.applyDescriptor(mv);
  }
  return { game, initial, history: game.history, undone: discarded, board: { state: Rules.cloneState(initial), initial, deal: 1, restored: false } };
}

export function stubAPI(game, { picks = [], run = null, memo = {}, solveResult = true } = {}) {
  const calls = [], marks = {}, stickerMarks = {}, concealed = new Set();
  const stickers = run?.stickers || {};
  const api = {
    calls, marks, stickerMarks, get concealed() { return [...concealed]; },
    get state() { return game.state; }, get rules() { return game.rules || {}; }, get history() { return game.history; },
    addUndos(n) { calls.push(['addUndos', n]); }, spendUndos(n) { calls.push(['spendUndos', n]); return n; },
    addCoins(n) { calls.push(['addCoins', n]); if (run) run.coins = (run.coins || 0) + n; },
    concedeBoard() {
      const result = run?.current ? concedeBoard(run, game.history, null, { rules: game.rules }) : false;
      if (result) calls.push(['concedeBoard']); return !!result;
    },
    spendCoins(n) { const paid = spendCoins(run, n); if (paid) calls.push(['spendCoins', n]); return paid; },
    get stickers() { return { ...stickers }; },
    addSticker(cardId, type) {
      if (!Number.isInteger(cardId) || cardId < 1 || cardId > 52 || !['wild', 'fool', 'key', 'gold', 'lucky'].includes(type)) return false;
      stickers[cardId] = type; if (run) run.stickers = stickers;
      calls.push(['addSticker', cardId, type]); return true;
    },
    async preview(n = 3) { calls.push(['preview', n]); const moves = Rules.generateMoves(game.state, { rules: game.rules }); return moves.length ? clone(moves.slice(0, n)) : null; },
    async solvable() { calls.push(['solvable']); return solveResult; },
    abilityUses() { return Object.freeze(Object.fromEntries(Object.entries(memo).filter(([id]) => CHARMS[id]?.ability).map(([id, value]) => [id, value._runtime?.abilityUses || 0]))); },
    resetBoard() {
      if (!kit.canUndoBoard({ api })) return false;
      calls.push(['resetBoard']); while (game.history.length) game.undo(); game.override = null; return true;
    },
    get undoWindowUsed() { return !!memo._undoWindowUsed; },
    openUndoWindow() {
      if (!kit.canUndoBoard({ api }) || memo._undoWindowUsed) return false;
      memo._undoWindow = true; memo._undoWindowUsed = true; calls.push(['openUndoWindow']); return true;
    },
    notify(text) { calls.push(['notify', text]); }, refresh() { calls.push(['refresh']); },
    mark(ids, style) { ids.forEach((id) => { (style.startsWith('sticker-') ? stickerMarks : marks)[id] = style; }); },
    unmark(ids) { ids.forEach((id) => { delete marks[id]; }); }, clearMarks() { for (const channel of [marks, stickerMarks]) Object.keys(channel).forEach((id) => delete channel[id]); },
    conceal(ids) { ids.forEach((id) => concealed.add(id)); }, reveal(ids) { ids.forEach((id) => concealed.delete(id)); },
    async hint() { calls.push(['hint']); return true; }, autoHome() { calls.push(['autoHome']); return true; },
    override(o) { game.override = clone(o); calls.push(['override', o]); return true; },
    charmMove(op, data) { calls.push(['charmMove', op, data]); return game.applyCharmMove?.({ ...data, t: 'X', op }) || false; },
    setFreeCells(n) { while (game.state.free.length < n) game.state.free.push(0); if (game.rules) game.rules.freeCells = n; return true; },
    async pick({ kind, filter = () => true }) {
      const value = picks.shift() ?? null;
      if (value != null) assert(filter(value, game.state), `Invalid ${kind} fixture target`);
      return value;
    },
    // Menu choices share the fixture queue with picks, in the order the charm asks.
    async choose({ options = [] }) {
      const value = picks.shift() ?? null;
      if (value != null) assert(options.some((o) => o.value === value && !o.disabled), `Invalid choice fixture ${value}`);
      return value;
    },
    rewind(n) { while (n-- && game.history.length) game.undo(); return true; },
  };
  return api;
}

const v2Warnings = new Set();
const v2Issue = (message) => {
  if (process.env.STRICT_V2 === '1') assert.fail(message);
  v2Warnings.add(message);
};

export function checkV2Definitions(charms) {
  const texts = new Map();
  for (const c of charms) {
    if (c.kind === 'boon' && !c.placeholder && !c.hidden) {
      if (!CHARM_FAMILIES.includes(c.family)) v2Issue(`${c.id}: family must be one of ${CHARM_FAMILIES.join(', ')}`);
      if (!(typeof c.upgrade === 'string' && c.upgrade.trim()) && typeof c.upgrade !== 'function') v2Issue(`${c.id}: missing upgrade text`);
      for (let strength = 1; strength <= 7; strength++) {
        if (typeof c.upgrade === 'function') {
          const upgrade = c.upgrade(strength, {seed:'content-check',level:2});
          if (typeof upgrade !== 'string' || !upgrade.trim()) v2Issue(`${c.id}: empty upgrade text`);
        }
        const text = typeof c.text === 'function' ? c.text(strength, { seed: 'content-check', level: 1 }) : c.text;
        const owner = texts.get(text);
        if (owner && owner !== c.id) v2Issue(`${c.id} and ${owner}: identical boon text`);
        else texts.set(text, c.id);
      }
    }
    if (c.kind === 'challenge' && c.pressure !== true && typeof c.rules !== 'function') v2Issue(`${c.id}: challenge needs pressure: true or rules`);
  }
}

// Reject writes (including array mutators), API effects and random draws inside
// available(). Proxying instead of invoking on the live ctx keeps warnings safe.
export function assertAvailablePure(c, ctx) {
  if (!c.ability?.available) return;
  const proxies = new WeakMap();
  const fail = () => { throw new Error(`${c.id}: available must be pure`); };
  const random = new Proxy(fail, { get: () => fail, apply: fail });
  const readonly = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    if (proxies.has(value)) return proxies.get(value);
    const proxy = new Proxy(value, {
      get(target, key, receiver) {
        const item = Reflect.get(target, key, receiver);
        if (target === ctx && key === 'rng') return random;
        if (target === ctx.api && typeof item === 'function' && key !== 'abilityUses') return fail;
        return readonly(item);
      },
      set: fail, deleteProperty: fail, defineProperty: fail, setPrototypeOf: fail,
    });
    proxies.set(value, proxy); return proxy;
  };
  const pure = readonly(ctx);
  const before = JSON.stringify({ memo: ctx.memo, runMemo: ctx.runMemo, state: ctx.api.state, rules: ctx.api.rules, history: ctx.api.history });
  const first = c.ability.available(pure), second = c.ability.available(pure);
  assert.equal(typeof first, 'boolean', `${c.id}: available must return a boolean`);
  assert.equal(second, first, `${c.id}: available must be deterministic`);
  assert.equal(JSON.stringify({ memo: ctx.memo, runMemo: ctx.runMemo, state: ctx.api.state, rules: ctx.api.rules, history: ctx.api.history }), before, `${c.id}: available mutated context`);
}

const assertFinite = (v, path = '') => {
  if (typeof v === 'number') assert(Number.isFinite(v), `Nonfinite ${path}`);
  else if (v && typeof v === 'object') for (const [key, value] of Object.entries(v)) assertFinite(value, `${path}.${key}`);
};

export function validateRules(r) {
  const integer = (key, min, max) => { if (r[key] !== undefined) assert(Number.isInteger(r[key]) && r[key] >= min && r[key] <= max, `Invalid rules.${key}`); };
  integer('freeCells', 1, 6); integer('moveBonus', -52, 52); integer('emptyFactor', 1, 52);
  for (const key of ['wildRanks', 'noCellRanks', 'oneWayCellRanks']) integer(key, 0, 16382);
  integer('suitBuild', 0, 15); integer('startHome', 0, 13); integer('foundationSpread', 0, 13); integer('emptyMinRank', 0, 13);
  if (r.maxHeight) integer('maxHeight', 7, 52);
  assert(typeof r.foundationReturn === 'boolean', 'Invalid rules.foundationReturn');
  for (const [key, max] of [['noCellCards', 52], ['sealedCols', 7]]) assert(Array.isArray(r[key]) && r[key].every((n) => Number.isInteger(n) && n >= (key === 'noCellCards' ? 1 : 0) && n <= max), `Invalid rules.${key}`);
  assert(Array.isArray(r.cellColors) && r.cellColors.every((color) => color == null || color === 'red' || color === 'black'), 'Invalid rules.cellColors');
  if (r.barren) assert(Number.isInteger(r.barren.suits) && r.barren.suits >= 0 && r.barren.suits <= 15 && Number.isInteger(r.barren.ranks) && r.barren.ranks >= 0 && r.barren.ranks <= 16382, 'Invalid rules.barren');
  if (r.cellThaw) assert(Number.isInteger(r.cellThaw.frozen) && r.cellThaw.frozen >= 0 && r.cellThaw.frozen <= r.freeCells && Array.isArray(r.cellThaw.at) && r.cellThaw.at.length >= r.cellThaw.frozen && r.cellThaw.at.every((n) => Number.isInteger(n) && n >= 0 && n <= 52), 'Invalid rules.cellThaw');
}

export async function checkCharm(c, strength, level = 1) {
  for (const key of ['id', 'kind', 'name', 'icon']) assert(typeof c[key] === 'string' && c[key].trim(), `${c.id}: missing/invalid ${key}`);
  assert(typeof c.text === 'string' || typeof c.text === 'function', `${c.id}: invalid text`);
  assert(['boon', 'challenge', 'boss'].includes(c.kind), `${c.id}: invalid kind`);
  if (c.kind !== 'boss' && !c.hidden) assert(c.theme && (THEME_ORDER.includes(c.theme)), `${c.id}: invalid theme`);
  const text = typeof c.text === 'function' ? c.text(strength, { seed: 'content-check', level }) : c.text;
  assert(typeof text === 'string' && text.trim(), `${c.id}: text(${strength}) is empty`);
  if (c.ability) {
    assert(typeof c.ability.use === 'function' && typeof c.ability.label === 'string' && c.ability.label.trim(), `${c.id}: invalid ability`);
    assert(typeof c.ability.uses === 'number' || typeof c.ability.uses === 'function', `${c.id}: invalid ability uses`);
  }
  if (c.kind === 'challenge') {
    assert(Array.isArray(c.tags) && c.tags.length, `${c.id}: missing challenge tags`);
    assert(c.tags.every((t) => ['CELLS', 'STACK', 'FOUND', 'COLUMN', 'MOVE', 'VIS', 'SCORE'].includes(t)), `${c.id}: invalid tags`);
  }
  const rules = baseRules();
  c.rules?.(rules, { strength, level, boons: [c.id], stickers: {}, family: (name) => +(c.family === name), rng: stream('content-check', 'rules', strength, c.id), seed: 'content-check', idx: strength - 1, runMemo: {} });
  const valid = clampRules(rules);
  assertFinite(valid, `${c.id}.rules`);
  validateRules(valid);
  const fixture = fakeBoard(valid);
  const run = { seed: 'content-check', current: { idx: strength - 1 }, results: [], boons: [], undos: 5, charmMemo: {} };
  const memo = {};
  const api = stubAPI(fixture.game, { run, memo });
  const effects = new BoardEffects([{ id: c.id, kind: c.kind, strength, level }], { seed: run.seed, boardIndex: strength - 1, api, memo, run });
  c.onPick?.(run, effects.ctxs[0]);
  effects.setup(fixture.board);
  try { assertAvailablePure(c, effects.ctxs[0]); } catch (error) { v2Issue(error.message); }
  if (c.ability?.available) {
    const atDeal = new Rules.Game(1, {rules: clone(valid)});
    const fresh = new BoardEffects(effects.active, {seed:run.seed, boardIndex:strength-1, api:stubAPI(atDeal), memo:clone(memo), run:clone(run)});
    try { assertAvailablePure(c, fresh.ctxs[0]); } catch (error) { v2Issue(error.message); }
  }
  assertFinite(memo, `${c.id}.memo`);
  const extra = { initial: fixture.initial, rules: fixture.game.rules || baseRules(), boardIdx: strength - 1, elapsed: 1200, undosUsed: 2, undosLeft: run.undos };
  const sb = scoreBoard(fixture.history, 60, effects, extra);
  assertFinite(sb.toJSON(), `${c.id}.score`);
  assertFinite(effects.thresholds(starThresholds(60)));
  assertFinite(effects.offers(1)); assertFinite(effects.starCap({ ...extra, sb }));
  const events = {
    start: {}, move: { move: fixture.history[0], manual: true },
    foundation: { move: { t: 'F', card: 1, src: { kind: 'col', i: 0 } }, card: 1, src: { kind: 'col', i: 0 }, auto: false },
    freecell: { card: fixture.history[0].card, move: fixture.history[0] }, columnEmpty: { col: 0 },
    undo: { move: fixture.undone, moves: [fixture.undone] }, reveal: { card: 1 },
    win: { result: { stars: 3, moves: 40, par: 60, undosUsed: 2, time: 1200, total: sb.total, score: sb.toJSON() } }, stuck: {},
  };
  for (const [event, ev] of Object.entries(events)) effects.emit(event, ev);
  if (c.ability) { effects.abilityState(c.id); await effects.useAbility(c.id); }
  // Simulated saved/resumed setup must be safe with persisted memo/runMemo.
  const restored = new BoardEffects(effects.active, { seed: run.seed, boardIndex: strength - 1, api, memo: clone(memo), run: clone(run) });
  restored.setup({ ...fixture.board, restored: true });
  assertFinite(scoreBoard(fixture.history, 60, restored, extra).toJSON());
}

export async function main({ strict = process.argv.includes('--strict') } = {}) {
  const warnings = [];
  for (const theme of THEME_ORDER) {
    assert.equal(boonsForTheme(theme).length, 3, `${theme}: needs exactly three boons`);
    assert.equal(Object.values(CHARMS).filter((c) => c.theme === theme && c.kind === 'challenge').length, 1, `${theme}: needs exactly one challenge`);
    if ([...boonsForTheme(theme), challengeForTheme(theme)].some((id) => CHARMS[id].placeholder)) warnings.push(theme);
  }
  if (warnings.length) console.warn(`WARNING: themes with placeholders (${warnings.length}): ${warnings.join(', ')}`);
  // Import dev examples only after the production theme counts have been checked.
  await import('../js/voyage/content/_examples.js');
  checkV2Definitions(Object.values(CHARMS));
  let checked = 0;
  for (const c of Object.values(CHARMS)) for (let s = 1; s <= 7; s++) for (const level of c.kind === 'boon' ? [1, 2] : [1]) {
    try { await checkCharm(c, s, level); checked++; }
    catch (error) { throw new Error(`${c.id} strength ${s} level ${level}: ${error.message}`, { cause: error }); }
  }
  const helpers = { assert, Rules, CHARMS, BoardEffects, charmContext, baseRules, clampRules, scoreBoard, starsFor, starThresholds, kit, stream, clone, fakeBoard, stubAPI, checkCharm, validateRules, assertAvailablePure, checkV2Definitions };
  for (const file of (await readdir(new URL('./charm-checks/', import.meta.url))).filter((name) => name.endsWith('.mjs') && !name.endsWith('-browser.mjs')).sort()) {
    // *-browser.mjs files are standalone puppeteer scripts (run them against `node serve.mjs <port>`).
    const mod = await import(new URL(`./charm-checks/${file}`, import.meta.url));
    await (mod.check || mod.default)(helpers);
    console.log(`Extension OK: ${file}`);
  }
  if (strict) assert.equal(warnings.length, 0, 'Strict mode rejects placeholder themes');
  if (v2Warnings.size) console.warn(`WARNING: v2 content migration (${v2Warnings.size}):\n${[...v2Warnings].join('\n')}`);
  console.log(`OK: ${checked} charm/strength checks, ${THEME_ORDER.length} themes (3 boons + 1 challenge each)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
