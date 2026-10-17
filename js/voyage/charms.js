// Voyage charm author reference (docs/voyage/charms-design.md §§1–3).
// Fields: id, kind (boon/challenge/boss), theme, name, icon, text/upgrade or
// text/upgrade(strength, {seed,level}), family, hidden, pressure, undoCapExempt,
// tags (challenge restriction families), placeholder, ease, dealShift, abilityBonus.
// rules(r, { strength, rng, seed, idx, runMemo }) mutates solver-visible BoardRules.
// ease / dealShift may be numbers or functions of that context. Boons only add help.
// setup({ state, initial, deal, restored }, ctx) runs on the INITIAL dealt state,
// including resume. Use saved memo and seeded ctx.rng; setup challenges precede boons.
// score(sb, ctx) computes points from final history (never score in events).
// sb: history, par, elapsed (seconds), undosUsed, undosLeft, initial, rules, boardIdx,
// stat; add(key,label,pts), scale(key,x), mult(label,x), lines, mults, total.
// on: start, resume, move({move,manual}), foundation({card,move,src,auto}),
// freecell({card,move}), columnEmpty({col}), undo({move,moves,free,reset}), win({result}),
// reveal({card}), stuck({}), ability({id}); handlers receive (ctx, ev).
// stuck returning true cancels loss. Spend-based undo hooks ignore free/reset.
// offerPool(offers,ctx) replaces the seeded board reward pool before stars cut it.
// offers(n,ctx), thresholds(arr,ctx), starCap(ctx) affect choices/stars.
// onPick(run,ctx) is once per chosen boon; run is mutable here only.
// ability: { uses: number | (ctx)=>number, label, use(ctx): boolean | Promise<boolean>,
// available?(ctx): boolean (pure predicate), when?:'start', stuck?: 'hold'|'rescue'|'none'
// or (ctx)=>that }. false/cancel consumes nothing. when:'start' closes permanently on the first
// manual move, including X. stuck says what an unused charge does to dead-end detection:
// 'hold' (default) pauses it, since the charge may change the position; 'rescue' lets the
// warning show but keeps the run alive (it only pulls back, e.g. a free rewind); 'none' ignores it.
// abilityBonus: number | (ctx)=>number grants extra uses to EVERY active ability.
// ctx: id, kind, strength, level (1|2), family(name), coins (read), seed, rng,
// stickers (fixed board snapshot), memo (board), runMemo (run.charmMemo[id]),
// run (read-only boardIdx [zero-based], results, boons [ids], undos, coins), api.
// Reserved charm memo._runtime holds badge, marks, visibility, abilityUses/grants.
// Board memo reserves _undoGrants, _undoWindow/Used, _manualPlayed and _stickers.
// sonar(): Promise<{steps, entries}|{steps:null}|null> finds the nearest earlier winnable position
// (steps = player moves back, entries = history entries to rewind); rewind(n,{free:true}) is undo-free.
// api (scoped to this charm; effects saved automatically):
// addUndos(n), spendUndos(n), notify(text), badge(text), mark(cardIds,style), track(what, n=1)
// (counts a moment worth analysing, e.g. a thaw milestone; notify and spendUndos are counted
// automatically; see js/voyage/analytics.js),
// unmark(cardIds), conceal(cardIds), reveal(cardIds), hint(): Promise<boolean>,
// preview(n=3): Promise<Move[]|null>, solvable(): Promise<boolean|null>,
// resetBoard(): boolean, openUndoWindow(): boolean, grantUse(id|'*',n=1): number,
// concedeBoard(): boolean (1★ clear, never finale), spendCoins(n): boolean (no undo refund),
// addCoins(n) (run hooks only), addSticker(cardId,type): boolean (next board),
// autoHome(): boolean, override(o): boolean, charmMove(op,data): descriptor | false,
// setFreeCells(n): boolean (gain only; inside X handlers mutate rules/state with undo),
// refresh(), pick({kind:'column'|'card'|'freecell',filter,prompt,cards,group}): Promise<selection|null>.
// pick returns a column/cell INDEX or CARD ID; filter(value, state) sees that value.
// The board lights each legal target the way a held rank key does: cards glow, and
// empty cells / column ends pulse like drop targets. prompt is the instruction shown
// while choosing. cards(value, st) names the card ids to light for a column/cell
// (default: none, so the column end or the cell pulses); group(value, st) names the
// ids that brighten under the pointer (default: the card, or the whole column).
// Earlier picks of the same ability stay lifted until it finishes.
// choose({prompt, options:[{value,label,detail?,disabled?}], card?}): Promise<value|null>
// opens a small menu (anchored to card) for choices that are not places on the table.
// markText(cardId, style, ctx) on a charm describes its mod-* tab in the card tooltip.
// Read getters: abilityBonus, state, rules, history, concealed (card ids),
// negativeCards (card ids with harmful stamps), stickers (copy of run stickers),
// undoGrants, undoCap, undoWindowUsed;
// abilityUses(): frozen snapshot of all active abilities' remaining charges.
// Extra primitive: rewind(count): boolean undoes a batch for one run undo (bookmark).
// Marks: gold/star/glow/crack/frost/hot/curse/wanted/fragile/camera/crown/thorn/cap/
// lock (no free cell), bar (nothing stacks on), oneway (a cell exit goes home only), wild.
// Ability modifications use stacking top tabs instead: mod-wild, mod-anchor and
// mod-rank-up-<r> / mod-rank-down-<r> (r = the rank the card now stacks as).
// X moves: registerCustomMove(op,{apply(st,m,rules),undo(st,m,rules)}) from rules.js;
// api.charmMove applies { ...data, t:'X', op }, then generically animates the board.
// An X move counts as a player move. Its module must restore state AND rules in undo.
// Automatic reveals remain visible after normal undo. An explicit conceal() can hide
// cards again (e.g. a visibility X undo). On resume saved visuals take precedence
// over repeated setup mark/unmark/badge/conceal calls.

import { THEMES, THEME_ORDER } from '../themes.js';
import * as Rules from '../rules.js';
import { stream } from './rng.js';
import { CHARMS, defineCharm, familyCount } from './registry.js';
import { VOYAGE } from './config.js';
import './content/index.js';

// A direct cell gain is itself undoable. Content X handlers can instead mutate their
// state/rules argument and save the prior values in their own descriptor.
export function registerRuntimeMoves() {
  if (!Rules.registerCustomMove) return false;
  Rules.registerCustomMove('voyage.cells', {
    apply(st, m, rules) {
      m.before ??= { count: st.free.length, freeCells: rules.freeCells };
      while (st.free.length < m.count) st.free.push(0);
      rules.freeCells = st.free.length;
    },
    undo(st, m, rules) {
      if (st.free.slice(m.before.count).some(Boolean)) throw new Error('Cannot remove an occupied charm cell');
      st.free.length = m.before.count;
      rules.freeCells = m.before.freeCells;
    },
  });
  return true;
}
registerRuntimeMoves();

export { CHARMS, defineCharm };
export { baseRules, rulesKey, clampRules, composeBoard, hasDealRules, applyDealRules } from './boardrules.js';

export const charm = (id) => CHARMS[id];
export const boonsForTheme = (themeId) => Object.values(CHARMS).filter((c) => c.kind === 'boon' && c.theme === themeId && !c.hidden).map((c) => c.id);
export const challengeForTheme = (themeId) => Object.values(CHARMS).find((c) => c.kind === 'challenge' && c.theme === themeId)?.id || null;
export const bossIds = () => Object.values(CHARMS).filter((c) => c.kind === 'boss' && !c.placeholder).map((c) => c.id);

// Tooltip text for a charm at a given strength.
export const charmText = (id, strength = 1, ctx = {}) => {
  const c = CHARMS[id];
  const text = ctx.level === 2 && c?.upgrade ? c.upgrade : c?.text;
  return typeof text === 'function' ? text(strength, ctx) : text || '';
};

// ---------------------------------------------------------------------------
// Runtime dispatch for one board.
// ---------------------------------------------------------------------------
const copy = (v) => JSON.parse(JSON.stringify(v));
const freeze = (v) => {
  if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); }
  return v;
};
const count = (n) => Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : 0;
const idsOf = (ids) => [...new Set(Array.isArray(ids) ? ids : [ids])].filter((id) => Number.isInteger(id) && id >= 1 && id <= 52);

export function charmContext(a, { seed, boardIndex = 0, run = null, api = {}, memo = {} }) {
  const ctx = {
    ...a, level: a.level === 2 ? 2 : 1, seed, rng: stream(seed, 'charm', boardIndex, a.id), api,
    family: (name) => familyCount(run?.boons || [], name),
    stickers: freeze(copy(memo._stickers || run?.stickers || {})),
    memo: (memo[a.id] ??= {}), runMemo: run ? ((run.charmMemo ??= {})[a.id] ??= {}) : {},
  };
  Object.defineProperty(ctx, 'run', { enumerable: true, get: () => freeze(copy({
    boardIdx: boardIndex, results: run?.results || [], boons: run?.boons || [], undos: run?.undos || 0, coins: run?.coins || 0,
  })) });
  Object.defineProperty(ctx, 'coins', { enumerable: true, get: () => run?.coins || 0 });
  return ctx;
}

// Harmful upper-right stamps; boon marks, stickers and modification tabs survive cleansing.
const NEGATIVE_STAMPS = new Set(['lock', 'bar', 'oneway', 'crack', 'hot', 'curse', 'fragile', 'fragile-used', 'crown', 'thorn', 'noexit']);
const negativeStamp = (style) => NEGATIVE_STAMPS.has(style);

export class BoardEffects {
  constructor(active, { seed, boardIndex, api = {}, memo = {}, run = null }) {
    this.active = active.filter((a) => CHARMS[a.id]);
    this.api = api;
    this.memo = memo;
    if (run?.status === 'board') memo._stickers ??= copy(run.stickers || {});
    this.run = run;
    this.events = [];
    this.eventPayloads = [];
    this.using = null;
    this.ctxs = this.active.map((a) => {
      const ctx = charmContext(a, { seed, boardIndex, run, api, memo });
      const saved = (ctx.memo._runtime ??= { marks: {}, concealed: [], revealed: [] });
      saved.marks ??= {}; saved.concealed ??= []; saved.revealed ??= [];
      const scoped = Object.create(api);
      scoped.addUndos = (n) => this.addUndos(n, ctx);
      // Analytics: tally visible moments per charm (js/voyage/analytics.js). Replayed setup on
      // resume is not a new moment, so it isn't counted.
      scoped.track = (what, n = 1) => { if (!this.restoring) api.charmTrack?.(ctx.id, what, n); };
      scoped.notify = (text) => { scoped.track('notify'); return api.notify?.(text); };
      scoped.spendUndos = (n) => {
        const spent = api.spendUndos?.(n);
        if (spent) scoped.track('spend_undos', spent);
        return spent;
      };
      scoped.grantUse = (id = '*', n = 1) => this.grantUse(id, n);
      scoped.abilityUses = () => this.abilityUses();
      scoped.addCoins = (n) => {
        if (run?.status === 'board' && !this.events.includes('win')) throw new Error('Board coins must come from sb.addCoins');
        return api.addCoins?.(count(n));
      };
      Object.defineProperty(scoped, 'undoGrants', { get: () => count(memo._undoGrants) });
      Object.defineProperty(scoped, 'undoCap', { get: () => VOYAGE.charmUndoCap });
      Object.defineProperty(scoped, 'undoWindowUsed', { get: () => !!memo._undoWindowUsed });
      scoped.badge = (text) => { if (this.restoring) return; saved.badge = String(text ?? ''); this.changed(); };
      scoped.mark = (ids, style = 'star') => {
        if (this.restoring) return;
        // Preserve the first mark in each channel: a sticker uses the opposite
        // corner and must coexist with a challenge/boon mark on the same card.
        // Ability modifications (mod-*) are tabs that stack, so every one shows.
        const sticker = String(style).startsWith('sticker-');
        const fresh = String(style).startsWith('mod-') ? idsOf(ids) : idsOf(ids).filter((id) => saved.marks[id] || !this.ctxs.some((other) => {
          const mark = other.memo._runtime.marks[id];
          return other !== ctx && mark && !String(mark).startsWith('mod-') && String(mark).startsWith('sticker-') === sticker;
        }));
        if (!fresh.length) return;
        for (const id of fresh) saved.marks[id] = style;
        api.mark?.(fresh.filter((id) => !negativeStamp(style) || !Rules.cardIsCleansed(id, api.rules)), style); this.changed();
      };
      scoped.unmark = (ids) => {
        if (this.restoring) return;
        for (const id of idsOf(ids)) delete saved.marks[id];
        this.restoreVisuals(); this.changed();
      };
      scoped.conceal = (ids) => {
        if (this.restoring) return;
        const cards = idsOf(ids);
        for (const other of this.ctxs) other.memo._runtime.revealed = other.memo._runtime.revealed.filter((id) => !cards.includes(id));
        saved.concealed = [...new Set([...saved.concealed, ...cards])];
        api.conceal?.(cards); this.changed();
      };
      scoped.reveal = (ids) => this.reveal(ids);
      Object.defineProperty(scoped, 'negativeCards', { get: () => {
        const cards = this.ctxs.flatMap((c) => Object.entries(c.memo._runtime.marks)
          .filter(([, style]) => negativeStamp(style)).map(([id]) => Number(id)));
        return [...new Set(cards)].filter((id) => !Rules.cardIsCleansed(id, api.rules));
      } });
      Object.defineProperty(scoped, 'abilityBonus', { get: () => this.abilityBonus });
      Object.defineProperty(scoped, 'concealed', { get: () => [...new Set(this.ctxs.flatMap((c) => c.memo._runtime.concealed))] });
      ctx.api = scoped;
      return ctx;
    });
  }

  changed() { this.api.refresh?.(); }

  addUndos(n, ctx) {
    n = count(n);
    if (this.run?.status === 'board' && !CHARMS[ctx.id].undoCapExempt && !this.events.includes('stuck')) {
      const granted = count(this.memo._undoGrants);
      const allowed = Math.min(n, Math.max(0, VOYAGE.charmUndoCap - granted));
      this.memo._undoGrants = granted + allowed;
      if (allowed < n) { this.api.notify?.('undo cap reached'); this.api.undoCapHit?.(ctx.id); }
      n = allowed;
    }
    if (n) {
      this.api.addUndos?.(n);
      const event = this.events.at(-1), payload = this.eventPayloads.at(-1);
      const card = payload?.card || payload?.move?.card;
      if (card && ['foundation', 'freecell', 'reveal', 'move'].includes(event)) {
        this.api.cardBonus?.({ card, amount: n, unit: 'undos', label: ctx.id === 'voyage.stickers' ? 'Lucky sticker' : CHARMS[ctx.id].name });
      }
    }
    return n;
  }

  grantUse(id = '*', n = 1) {
    let total = 0;
    for (const ctx of this.ctxs) {
      if ((id !== '*' && id !== ctx.id) || !CHARMS[ctx.id].ability) continue;
      const saved = ctx.memo._runtime;
      const extra = Math.min(count(n), Math.max(0, 2 - count(saved.abilityGrants)));
      saved.abilityGrants = count(saved.abilityGrants) + extra;
      // A setup hook may grant before this ability's initial uses are resolved.
      if (saved.abilityUses != null) saved.abilityUses += extra;
      total += extra;
    }
    if (total) this.changed();
    return total;
  }

  get abilityBonus() {
    return this.active.reduce((sum, a, i) => {
      const bonus = CHARMS[a.id].abilityBonus;
      return sum + count(typeof bonus === 'function' ? bonus(this.ctxs[i]) : bonus);
    }, 0);
  }

  setup(board) {
    this.memo._manualPlayed ||= !!this.api.history?.some((move) => !move.auto);
    // Pressure visibility challenges must run before a boon such as Clearance.
    const order = this.active.map((a, i) => i).sort((i, j) => (this.active[i].kind === 'boon') - (this.active[j].kind === 'boon'));
    this.restoring = !!board.restored && this.ctxs.every((ctx) => ctx.memo._runtime.initialized);
    this.restoreVisuals();
    for (const i of order) CHARMS[this.active[i].id].setup?.(board, this.ctxs[i]);
    this.restoring = false;
    this.active.forEach((a, i) => {
      this.ctxs[i].memo._runtime.initialized = true;
      const ab = CHARMS[a.id].ability;
      if (ab) this.ctxs[i].memo._runtime.abilityUses ??= count(typeof ab.uses === 'function' ? ab.uses(this.ctxs[i]) : ab.uses) + this.abilityBonus + count(this.ctxs[i].memo._runtime.abilityGrants);
    });
    this.changed();
  }

  restoreVisuals() {
    this.api.clearMarks?.();
    for (const ctx of this.ctxs) {
      for (const [id, style] of Object.entries(ctx.memo._runtime.marks)) {
        if (!negativeStamp(style) || !Rules.cardIsCleansed(Number(id), this.api.rules)) this.api.mark?.([Number(id)], style);
      }
      this.api.conceal?.(ctx.memo._runtime.concealed);
    }
  }

  // Charm that painted the upper-right seal on this card, if it has one.
  markTip(cardId, style = null) {
    const id = Number(cardId);
    if (Rules.cardIsCleansed(id, this.api.rules) && negativeStamp(style)) return null;
    let fallback = null;
    for (const ctx of this.ctxs) {
      const mark = ctx.memo._runtime?.marks?.[id];
      if (!mark || (negativeStamp(mark) && Rules.cardIsCleansed(id, this.api.rules)) || String(mark).startsWith('sticker-') || String(mark).startsWith('mod-')) continue;
      const name = CHARMS[ctx.id]?.name;
      const text = CHARMS[ctx.id]?.markText?.(id, mark, ctx) || charmText(ctx.id, ctx.strength ?? 1, { seed: ctx.seed, level: ctx.level });
      if (!name || !text) continue;
      const tip = { style: mark, name, text };
      if (!style || mark === style) return tip;
      fallback ??= tip;
    }
    return fallback;
  }

  // Ability modification tabs on this card: one { name, text } per charm. A charm's
  // markText(cardId, style, ctx) can describe that card exactly (Glaze: "stacks as 9").
  modTip(cardId) {
    const id = Number(cardId), tips = [];
    for (const ctx of this.ctxs) {
      const mark = ctx.memo._runtime?.marks?.[id];
      if (!String(mark ?? '').startsWith('mod-')) continue;
      const c = CHARMS[ctx.id];
      const text = c?.markText?.(id, mark, ctx) || charmText(ctx.id, ctx.strength ?? 1, { seed: ctx.seed, level: ctx.level });
      if (c?.name && text) tips.push({ name: c.name, text });
    }
    return tips.length ? { name: tips.map((t) => t.name).join(' + '), text: tips.map((t) => t.text).join(' ') } : null;
  }

  reveal(ids) {
    const hidden = new Set(this.ctxs.flatMap((c) => c.memo._runtime.concealed));
    const cards = idsOf(ids).filter((id) => hidden.has(id));
    for (const ctx of this.ctxs) {
      const s = ctx.memo._runtime;
      s.concealed = s.concealed.filter((id) => !cards.includes(id));
      s.revealed = [...new Set([...s.revealed, ...cards])];
    }
    this.api.reveal?.(cards);
    for (const card of cards) this.emit('reveal', { card });
    if (cards.length) this.changed();
    return cards;
  }

  emit(event, ev = {}) {
    let cancelled = false;
    if ((event === 'undo' && ev.moves?.some((m) => m.op === 'bloodmoon.seal' && m.action === 'cleanse')) ||
        (event === 'move' && ev.move?.op === 'bloodmoon.seal' && ev.move.action === 'cleanse')) this.restoreVisuals();
    if (event === 'move' && ev.manual) this.memo._manualPlayed = true;
    this.events.push(event);
    this.eventPayloads.push(ev);
    try {
      this.active.forEach((a, i) => {
        // Compatibility while these content hooks migrate to checking ev.free/reset.
        // Other undo hooks still run to restore visibility, anchors and X effects.
        if (event === 'undo' && (ev.free || ev.reset) && ['cyber.cache', 'canyon.echo', 'deepstorage.redundancy', 'cyber.challenge'].includes(a.id)) return;
        const handler = CHARMS[a.id].on?.[event];
        if (!handler) return;
        if (event === 'stuck') this.stuckHandledBy = a.id;
        if (handler(this.ctxs[i], ev) === true) { cancelled = true; if (event === 'stuck') this.stuckCancelledBy = a.id; }
      });
    } finally { this.events.pop(); this.eventPayloads.pop(); }
    return cancelled;
  }

  abilityState(id) {
    const i = this.active.findIndex((a) => a.id === id), c = CHARMS[id];
    if (i < 0 || !c?.ability) return null;
    const ctx = this.ctxs[i];
    const uses = ctx.memo._runtime.abilityUses ?? 0;
    const atStart = c.ability.when !== 'start' || (!this.memo._manualPlayed && !ctx.api.history?.some((move) => !move.auto));
    return { label: c.ability.label || c.name, uses, available: uses > 0 && !this.using && atStart && (!c.ability.available || !!c.ability.available(ctx)) };
  }

  // purpose 'lose': could an unused charge still save a dead end? 'warn': should it hold the warning?
  hasAvailableAbility(purpose = 'lose') {
    return this.active.some((a, i) => {
      if (!this.abilityState(a.id)?.available) return false;
      const { stuck = 'hold' } = CHARMS[a.id].ability;
      const role = typeof stuck === 'function' ? stuck(this.ctxs[i]) : stuck;
      return role === 'hold' || (role === 'rescue' && purpose === 'lose');
    });
  }

  abilityUses() {
    return Object.freeze(Object.fromEntries(this.ctxs.filter((ctx) => CHARMS[ctx.id].ability).map((ctx) => [ctx.id, count(ctx.memo._runtime.abilityUses)])));
  }

  async useAbility(id) {
    if (!this.abilityState(id)?.available) return false;
    const ctx = this.ctxs[this.active.findIndex((a) => a.id === id)];
    this.using = id;
    this.api.beginAbility?.(id, ctx.memo._runtime.abilityUses);
    // Charge before use so a winning move's on.win sees the remaining uses.
    ctx.memo._runtime.abilityUses--;
    this.changed();
    let consumed = false;
    try {
      if (await CHARMS[id].ability.use(ctx) === false) return false;
      consumed = true;
      if (id === 'bloodmoon.seal') this.restoreVisuals();
      this.emit('ability', { id });
      return true;
    } finally {
      if (!consumed) ctx.memo._runtime.abilityUses++;
      this.using = null;
      this.api.endAbility?.();
      this.changed();
    }
  }

  refundAbility(meta) {
    const ctx = this.ctxs.find((c) => c.id === meta?.id);
    if (ctx) ctx.memo._runtime.abilityUses = meta.uses + Math.max(0, count(ctx.memo._runtime.abilityGrants) - count(meta.grants));
  }

  offers(n) {
    this.active.forEach((a, i) => { if (a.kind === 'boon' && CHARMS[a.id].offers) n = CHARMS[a.id].offers(n, this.ctxs[i]); });
    return Math.max(1, Math.min(3, Math.floor(n)));
  }

  thresholds(arr) {
    this.active.forEach((a, i) => { if (CHARMS[a.id].thresholds) arr = CHARMS[a.id].thresholds(arr.slice(), this.ctxs[i]) ?? arr; });
    return arr;
  }

  starCap(extra = {}) {
    let cap = 3;
    this.active.forEach((a, i) => {
      if (a.kind !== 'boon' && CHARMS[a.id].starCap) cap = Math.min(cap, CHARMS[a.id].starCap({ ...this.ctxs[i], ...extra }));
    });
    return Math.max(1, Math.min(3, Math.floor(cap)));
  }

  // Each charm's share of the score is kept on sb.charmDeltas for analytics (voyage_charm_score).
  score(sb) {
    sb.charmDeltas = null;
    this.active.forEach((a, i) => {
      const fn = CHARMS[a.id].score;
      if (!fn) return;
      const pts = sb.subtotal, coins = sb.coinTotal, mults = sb.mults.length;
      fn(sb, this.ctxs[i]);
      const d = { points: sb.subtotal - pts, coins: sb.coinTotal - coins, mult: sb.mults.slice(mults).reduce((m, x) => m * x.x, 1) };
      if (d.points || d.coins || d.mult !== 1) (sb.charmDeltas ??= {})[a.id] = d;
    });
  }
}

// ---------------------------------------------------------------------------
// Placeholder content. Real per-theme content lives in js/voyage/content/<theme>.js (and
// content/special/ for the complex charms); every theme needs exactly three boons and one
// challenge. Placeholders only fill the gaps a theme's content hasn't covered yet, so the run
// loop, dealer and UI keep working while content is being built.
// ---------------------------------------------------------------------------
const PLACEHOLDER_BOONS = [
  {
    key: 'cell',
    name: 'Spare Cell',
    icon: '▣',
    text: 'One extra free cell on every board.',
    rules: (r) => {
      r.freeCells += 1;
    },
  },
  {
    key: 'undo',
    name: 'Second Thoughts',
    icon: '↶',
    text: 'Gain 3 undos now, and 1 more each time you empty a column.',
    ease: 0.2,
    onPick: (run) => {
      run.undos += 3;
    },
    on: {
      columnEmpty: (ctx) => {
        if (ctx.memo.used) return;
        ctx.memo.used = true; // once per board
        ctx.api.addUndos(1);
        ctx.api.notify('Second Thoughts: +1 undo');
      },
    },
  },
  {
    key: 'chain',
    name: 'Golden Chain',
    icon: '⛓',
    text: 'Chain points are multiplied by 1.5.',
    score: (sb) => {
      sb.scale('chains', 1.5);
    },
  },
];

const PLACEHOLDER_CHALLENGE = {
  tags: ['SCORE'],
  name: 'Heavy Toll',
  icon: '⚖',
  text: (s) => `Each card placed in a free cell costs ${2 + s} extra points.`,
  ease: (ctx) => -0.08 * ctx.strength,
  score: (sb, ctx) => {
    sb.add('challenge', 'Heavy Toll', -sb.stat.freeCellPlacements * (2 + ctx.strength));
  },
};

for (const themeId of THEME_ORDER) {
  const tname = THEMES[themeId].name;
  const missing = 3 - boonsForTheme(themeId).length;
  for (const b of PLACEHOLDER_BOONS.slice(0, Math.max(0, missing))) {
    const { key, ...rest } = b;
    defineCharm({ ...rest, id: `${themeId}.${key}`, kind: 'boon', theme: themeId, placeholder: true, name: `${rest.name}` });
  }
  if (!challengeForTheme(themeId)) {
    defineCharm({ ...PLACEHOLDER_CHALLENGE, id: `${themeId}.challenge`, kind: 'challenge', theme: themeId, placeholder: true, name: `${tname}: ${PLACEHOLDER_CHALLENGE.name}` });
  }
}
