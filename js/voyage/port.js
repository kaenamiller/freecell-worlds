// Pure run-level economy. Stock, modifiers and purchase limits are JSON-saveable.
import { VOYAGE, marketForBoard } from './config.js';
import { CHARMS, charmContext } from './charms.js';
import { stream } from './rng.js';
import { STICKERS } from './stickers.js';

const count = (n) => Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : 0;
const copy = (value) => JSON.parse(JSON.stringify(value));
export const economy = (run) => (run.economy ??= { coinsEarned: 0, coinsSpent: 0, portVisits: 0, stickersBought: 0, upgrades: 0 });
export function recordCoinChange(run, before) {
  const delta = run.coins - before;
  if (delta > 0) economy(run).coinsEarned += delta;
  else if (delta < 0) economy(run).coinsSpent -= delta;
}

// Board-time spending is immediate and intentionally survives undo.
export function spendCoins(run, n) {
  if (run?.status !== 'board' || !Number.isInteger(n) || n < 0 || n > run.coins) return false;
  run.coins -= n; economy(run).coinsSpent += n; return true;
}

// Shared with reward picks and board-end hooks. Run-level grants are always uncapped.
export function runHookContext(run, id, { api = {}, port = run.port, boardIndex = run.current?.idx ?? Math.max(0, run.results.length - 1), memo = {} } = {}) {
  const scoped = {
    notify: () => {},
    ...api,
    addUndos: (n) => { run.undos += count(n); },
    spendUndos: (n) => {
      const spent = Math.min(run.undos, count(n)); run.undos -= spent; return spent;
    },
    addCoins: (n) => { run.coins = (run.coins || 0) + count(n); },
  };
  const ctx = charmContext({ id, kind: CHARMS[id]?.kind, strength: run.current?.idx === boardIndex ? run.current.strength : VOYAGE.strengthForBoard(boardIndex + 1), level: run.levels?.[id] || 1 }, {
    seed: run.seed, boardIndex, run, api: scoped, memo,
  });
  ctx.port = port;
  ctx.stickers ??= copy(run.stickers || {});
  ctx.boons ??= [...run.boons];
  ctx.family ??= (name) => run.boons.filter((boon) => CHARMS[boon]?.family === name && !CHARMS[boon]?.hidden).length;
  if (!('coins' in ctx)) Object.defineProperty(ctx, 'coins', { get: () => run.coins || 0 });
  return ctx;
}

export function heldBoonHooks(run, fn, options = {}) {
  for (const id of [...run.boons]) {
    const charm = CHARMS[id];
    if (charm?.kind === 'boon' && !charm.hidden) fn(charm, runHookContext(run, id, options));
  }
}

const stockBoons = (run, port, reroll) => {
  const rng = stream(run.seed, 'port', port.boardIdx, 'boons', reroll);
  const candidates = Object.values(CHARMS).filter((c) => c.kind === 'boon' && !c.hidden && !run.boons.includes(c.id));
  return rng.shuffle(candidates).slice(0, 3 + count(port.extraBoons)).map((c) => ({ id: c.id, sold: false }));
};

const stockStickers = (run, port, reroll) => {
  const rng = stream(run.seed, 'port', port.boardIdx, 'stickers', reroll);
  return Array.from({ length: 3 }, () => ({ type: rng.pick(Object.keys(STICKERS)), sold: false }));
};

export function createPort(run) {
  if (run.status !== 'port') throw new Error(`createPort in status ${run.status}`);
  const boardIdx = run.results.at(-1)?.idx ?? -1;
  if (boardIdx < 0 || boardIdx >= VOYAGE.boards - 1) throw new Error('Only cleared non-final boards can dock');
  if (run.port?.boardIdx === boardIdx) return run.port;
  const scheduled = marketForBoard(boardIdx);
  const port = { boardIdx, kind: scheduled?.kind || null, name: scheduled?.name || 'Harbour market', extraBoons: 0, discount: 0, freeReroll: false, boons: [], stickers: [], provisionsUsed: 0, rerollUsed: false };
  run.port = port;
  const before = run.coins;
  heldBoonHooks(run, (charm, ctx) => charm.onPort?.(run, ctx), { port, boardIndex: boardIdx });
  recordCoinChange(run, before);
  if (port.kind === 'boons') port.boons = stockBoons(run, port, 0);
  if (port.kind === 'stickers') port.stickers = stockStickers(run, port, 0);
  economy(run).portVisits++;
  return port;
}

// price hooks see { kind: 'boon'|'sticker'|'upgrade'|'undo'|'reroll'|'sell'|'service', id?, type? }.
// Discounts combine with hooks; round only the final payable price, never below zero.
export function portPrice(run, item, base) {
  let cost = item.kind === 'sell' ? base : base * (1 - Math.max(0, Math.min(1, Number(run.port?.discount) || 0)));
  heldBoonHooks(run, (charm, ctx) => {
    const next = charm.price?.(item, cost, ctx);
    if (typeof next === 'number' && Number.isFinite(next)) cost = next;
  });
  return Math.max(0, Math.ceil(cost));
}

const rarePrice = (run, id) => {
  const charm = CHARMS[id];
  const ease = typeof charm.ease === 'function' ? charm.ease(runHookContext(run, id)) : charm.ease;
  return charm.ability || ease >= .4 ? VOYAGE.prices.boonRare : VOYAGE.prices.boon;
};
const sellPrice = (run, id) => portPrice(run, { kind: 'sell', id }, VOYAGE.prices.sell);
const inPort = (run) => run.status === 'port' && !!run.port;
const pay = (run, price) => {
  if (run.coins < price) return false;
  run.coins -= price; economy(run).coinsSpent += price; return true;
};

export function buyBoon(run, id, api = {}) {
  if (!inPort(run) || run.port.kind !== 'boons') return false;
  const offer = run.port.boons.find((o) => o.id === id && !o.sold);
  const charm = CHARMS[id];
  if (!offer || !charm || charm.kind !== 'boon' || charm.hidden || run.boons.includes(id)) return false;
  if (!pay(run, portPrice(run, { kind: 'boon', id }, rarePrice(run, id)))) return false;
  offer.sold = true;
  run.boons.push(id);
  const before = run.coins;
  charm.onPick?.(run, runHookContext(run, id, { api }));
  recordCoinChange(run, before);
  return true;
}

export function buySticker(run, offerIdx, cardId) {
  if (!inPort(run) || run.port.kind !== 'stickers' || !Number.isInteger(offerIdx) || !Number.isInteger(cardId) || cardId < 1 || cardId > 52) return false;
  const offer = run.port.stickers[offerIdx];
  if (!offer || offer.sold || !STICKERS[offer.type]) return false;
  if (!pay(run, portPrice(run, { kind: 'sticker', type: offer.type }, VOYAGE.prices.sticker[offer.type]))) return false;
  (run.stickers ??= {})[cardId] = offer.type;
  offer.sold = true;
  economy(run).stickersBought++;
  return true;
}

export function upgradeBoon(run, id) {
  if (!inPort(run) || run.port.kind !== 'upgrades' || !run.boons.includes(id) || CHARMS[id]?.hidden || !CHARMS[id]?.upgrade || (run.levels?.[id] || 1) !== 1) return false;
  if (!pay(run, portPrice(run, { kind: 'upgrade', id }, VOYAGE.prices.upgrade))) return false;
  (run.levels ??= {})[id] = 2;
  const before = run.coins;
  CHARMS[id].onUpgrade?.(run, runHookContext(run, id));
  recordCoinChange(run, before);
  economy(run).upgrades++;
  return true;
}

export function buyUndo(run) {
  if (!inPort(run) || run.port.provisionsUsed >= VOYAGE.prices.undoMax) return false;
  if (!pay(run, portPrice(run, { kind: 'undo' }, VOYAGE.prices.undo))) return false;
  run.port.provisionsUsed++; run.undos++;
  return true;
}

export function sellBoon(run, id) {
  if (!inPort(run) || !run.boons.includes(id) || !CHARMS[id] || CHARMS[id].hidden) return false;
  const price = sellPrice(run, id);
  run.boons = run.boons.filter((boon) => boon !== id);
  delete (run.levels ??= {})[id];
  delete run.charmMemo?.[id];
  run.coins += price; economy(run).coinsEarned += price;
  return true;
}

export function rerollPort(run) {
  if (!inPort(run) || run.port.rerollUsed || (run.port.kind !== 'boons' && run.port.kind !== 'stickers')) return false;
  const price = run.port.freeReroll ? 0 : portPrice(run, { kind: 'reroll' }, VOYAGE.prices.reroll);
  if (!pay(run, price)) return false;
  run.port.rerollUsed = true;
  if (run.port.kind === 'boons') run.port.boons = stockBoons(run, run.port, 1);
  else run.port.stickers = stockStickers(run, run.port, 1);
  return true;
}

export function leavePort(run) {
  if (!inPort(run)) return false;
  run.port = null; run.status = 'map'; return true;
}

function serviceDefinitions(run) {
  const services = [];
  heldBoonHooks(run, (charm, ctx) => {
    for (const service of charm.portServices?.(ctx) || []) {
      if (typeof service.id !== 'string' || !service.id || typeof service.apply !== 'function' || services.some((s) => s.id === service.id)) continue;
      if (!Number.isFinite(service.price) || service.price < 0) continue;
      services.push(service);
    }
  });
  return services;
}

export function portService(run, serviceId, arg) {
  if (!inPort(run)) return false;
  // Execute custom content on a copy, so a declined target never spends coins or
  // leaves half an enhancement behind. Functions are re-derived, never serialized.
  const trial = copy(run);
  const service = serviceDefinitions(trial).find((s) => s.id === serviceId);
  if (!service) return false;
  if (service.needsCard && (!Number.isInteger(arg) || arg < 1 || arg > 52)) return false;
  if (service.needsBoon && !trial.boons.includes(arg)) return false;
  if (!pay(trial, portPrice(trial, { kind: 'service', id: serviceId }, service.price))) return false;
  const before = trial.coins;
  if (service.apply(trial, arg) === false) return false;
  recordCoinChange(trial, before);
  Object.assign(run, trial);
  return true;
}

export function portView(run, charmView) {
  if (!inPort(run)) return null;
  const port = run.port;
  const held = run.boons.filter((id) => CHARMS[id] && !CHARMS[id].hidden);
  return {
    coins: run.coins,
    kind: port.kind,
    name: port.name,
    boons: port.kind === 'boons' ? port.boons.filter((o) => CHARMS[o.id] && !CHARMS[o.id].hidden).map((o) => ({ charm: charmView(o.id), price: portPrice(run, { kind: 'boon', id: o.id }, rarePrice(run, o.id)), sold: !!o.sold })) : [],
    stickers: port.kind === 'stickers' ? port.stickers.map((o) => ({ type: o.type, ...STICKERS[o.type], price: portPrice(run, { kind: 'sticker', type: o.type }, VOYAGE.prices.sticker[o.type]), sold: !!o.sold })) : [],
    upgrades: port.kind === 'upgrades' ? held.filter((id) => CHARMS[id].upgrade && (run.levels?.[id] || 1) === 1).map((id) => ({ charm: charmView(id), price: portPrice(run, { kind: 'upgrade', id }, VOYAGE.prices.upgrade) })) : [],
    provisions: { price: portPrice(run, { kind: 'undo' }, VOYAGE.prices.undo), left: Math.max(0, VOYAGE.prices.undoMax - port.provisionsUsed) },
    sell: held.map((id) => ({ charm: charmView(id), price: sellPrice(run, id) })),
    reroll: { price: port.freeReroll ? 0 : portPrice(run, { kind: 'reroll' }, VOYAGE.prices.reroll), used: !!port.rerollUsed },
    services: serviceDefinitions(run).map((s) => ({ id: s.id, label: s.label, text: s.text, price: portPrice(run, { kind: 'service', id: s.id }, s.price), needsCard: !!s.needsCard, needsBoon: !!s.needsBoon })),
  };
}
