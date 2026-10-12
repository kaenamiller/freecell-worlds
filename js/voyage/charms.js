// Voyage charm author reference (docs/voyage/charms-design.md §§1–3).
// Fields: id, kind (boon/challenge/boss), theme, name, icon, text or text(strength, {seed}),
// tags (challenge restriction families), placeholder, ease, dealShift, abilityBonus.
// rules(r, { strength, rng, seed, idx, runMemo }) mutates solver-visible BoardRules.
// ease / dealShift may be numbers or functions of that context. Boons only add help.
// setup({ state, initial, deal, restored }, ctx) runs on the INITIAL dealt state,
// including resume. Use saved memo and seeded ctx.rng; setup challenges precede boons.
// score(sb, ctx) computes points from final history (never score in events).
// sb: history, par, elapsed (seconds), undosUsed, undosLeft, initial, rules, boardIdx,
// stat; add(key,label,pts), scale(key,x), mult(label,x), lines, mults, total.
// on: start, move({move,manual}), foundation({card,move,src,auto}),
// freecell({card,move}), columnEmpty({col}), undo({move,moves}), win({result}),
// reveal({card}), stuck({}); handlers receive (ctx, ev). stuck returning true cancels loss.
// offers(n,ctx), thresholds(arr,ctx), starCap(ctx) affect choices/stars.
// onPick(run,ctx) is once per chosen boon; run is mutable here only.
// ability: { uses: number | (ctx)=>number, label, use(ctx): boolean | Promise<boolean>,
// available?(ctx): boolean (pure predicate) }. false/cancel consumes nothing. Uses reset each board.
// abilityBonus: number | (ctx)=>number grants extra uses to EVERY active ability.
// ctx: id, kind, strength, seed, rng, memo (board), runMemo (run.charmMemo[id]),
// run (read-only boardIdx [zero-based], results, boons [ids], undos), api.
// Reserved memo._runtime holds badge, marks, conceal/reveal state and abilityUses.
// api (scoped to this charm; effects saved automatically):
// addUndos(n), spendUndos(n), notify(text), badge(text), mark(cardIds,style),
// unmark(cardIds), conceal(cardIds), reveal(cardIds), hint(): Promise<boolean>,
// autoHome(): boolean, override(o): boolean, charmMove(op,data): descriptor | false,
// setFreeCells(n): boolean (gain only; inside X handlers mutate rules/state with undo),
// refresh(), pick({kind:'column'|'card'|'freecell',filter}): Promise<selection|null>.
// pick returns a column/cell INDEX or CARD ID; filter(value, state) sees that value.
// Read getters: abilityBonus, state, rules, history, concealed (card ids).
// Extra primitive: rewind(count): boolean undoes a batch for one run undo (bookmark).
// Marks: gold/star/glow/crack/frost/hot/curse/wanted/fragile/camera/crown/thorn/cap/
// lock (no free cell), bar (nothing stacks on), oneway (a cell exit goes home only), wild.
// X moves: registerCustomMove(op,{apply(st,m,rules),undo(st,m,rules)}) from rules.js;
// api.charmMove applies { ...data, t:'X', op }, then generically animates the board.
// An X move counts as a player move. Its module must restore state AND rules in undo.
// Automatic reveals remain visible after normal undo. An explicit conceal() can hide
// cards again (e.g. a visibility X undo). On resume saved visuals take precedence
// over repeated setup mark/unmark/badge/conceal calls.

import { THEMES, THEME_ORDER } from '../themes.js';
import * as Rules from '../rules.js';
import { stream } from './rng.js';
import { CHARMS, defineCharm } from './registry.js';
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
export { baseRules, rulesKey, clampRules, composeBoard } from './boardrules.js';

export const charm = (id) => CHARMS[id];
export const boonsForTheme = (themeId) => Object.values(CHARMS).filter((c) => c.kind === 'boon' && c.theme === themeId).map((c) => c.id);
export const challengeForTheme = (themeId) => Object.values(CHARMS).find((c) => c.kind === 'challenge' && c.theme === themeId)?.id || null;
export const bossIds = () => Object.values(CHARMS).filter((c) => c.kind === 'boss' && !c.placeholder).map((c) => c.id);

// Tooltip text for a charm at a given strength.
export const charmText = (id, strength = 1, ctx = {}) => {
  const c = CHARMS[id];
  return c ? (typeof c.text === 'function' ? c.text(strength, ctx) : c.text) : '';
};

// ---------------------------------------------------------------------------
// Runtime dispatch for one board.
// ---------------------------------------------------------------------------
const copy = (v) => JSON.parse(JSON.stringify(v));
const freeze = (v) => {
  if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); }
  return v;
};
const count = (n) => Math.max(0, Math.floor(Number(n) || 0));
const idsOf = (ids) => [...new Set(Array.isArray(ids) ? ids : [ids])].filter((id) => Number.isInteger(id) && id >= 1 && id <= 52);

export function charmContext(a, { seed, boardIndex = 0, run = null, api = {}, memo = {} }) {
  const ctx = {
    ...a, seed, rng: stream(seed, 'charm', boardIndex, a.id), api,
    memo: (memo[a.id] ??= {}), runMemo: run ? ((run.charmMemo ??= {})[a.id] ??= {}) : {},
  };
  Object.defineProperty(ctx, 'run', { get: () => freeze(copy({
    boardIdx: boardIndex, results: run?.results || [], boons: run?.boons || [], undos: run?.undos || 0,
  })) });
  return ctx;
}

export class BoardEffects {
  constructor(active, { seed, boardIndex, api = {}, memo = {}, run = null }) {
    this.active = active.filter((a) => CHARMS[a.id]);
    this.api = api;
    this.memo = memo;
    this.using = null;
    this.ctxs = this.active.map((a) => {
      const ctx = charmContext(a, { seed, boardIndex, run, api, memo });
      const saved = (ctx.memo._runtime ??= { marks: {}, concealed: [], revealed: [] });
      saved.marks ??= {}; saved.concealed ??= []; saved.revealed ??= [];
      const scoped = Object.create(api);
      scoped.badge = (text) => { if (this.restoring) return; saved.badge = String(text ?? ''); this.changed(); };
      scoped.mark = (ids, style = 'star') => {
        if (this.restoring) return;
        // Challenges run before boons. A card keeps that first mark, so a later
        // highlight cannot hide a restriction on the same card.
        const fresh = idsOf(ids).filter((id) => saved.marks[id] || !this.ctxs.some((other) => other !== ctx && other.memo._runtime.marks[id]));
        if (!fresh.length) return;
        for (const id of fresh) saved.marks[id] = style;
        api.mark?.(fresh, style); this.changed();
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
      Object.defineProperty(scoped, 'abilityBonus', { get: () => this.abilityBonus });
      Object.defineProperty(scoped, 'concealed', { get: () => [...new Set(this.ctxs.flatMap((c) => c.memo._runtime.concealed))] });
      ctx.api = scoped;
      return ctx;
    });
  }

  changed() { this.api.refresh?.(); }

  get abilityBonus() {
    return this.active.reduce((sum, a, i) => {
      const bonus = CHARMS[a.id].abilityBonus;
      return sum + count(typeof bonus === 'function' ? bonus(this.ctxs[i]) : bonus);
    }, 0);
  }

  setup(board) {
    // Pressure visibility challenges must run before a boon such as Clearance.
    const order = this.active.map((a, i) => i).sort((i, j) => (this.active[i].kind === 'boon') - (this.active[j].kind === 'boon'));
    this.restoring = !!board.restored && this.ctxs.every((ctx) => ctx.memo._runtime.initialized);
    this.restoreVisuals();
    for (const i of order) CHARMS[this.active[i].id].setup?.(board, this.ctxs[i]);
    this.restoring = false;
    this.active.forEach((a, i) => {
      this.ctxs[i].memo._runtime.initialized = true;
      const ab = CHARMS[a.id].ability;
      if (ab) this.ctxs[i].memo._runtime.abilityUses ??= count(typeof ab.uses === 'function' ? ab.uses(this.ctxs[i]) : ab.uses) + this.abilityBonus;
    });
    this.changed();
  }

  restoreVisuals() {
    this.api.clearMarks?.();
    for (const ctx of this.ctxs) {
      for (const [id, style] of Object.entries(ctx.memo._runtime.marks)) this.api.mark?.([Number(id)], style);
      this.api.conceal?.(ctx.memo._runtime.concealed);
    }
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
    this.active.forEach((a, i) => { if (CHARMS[a.id].on?.[event]?.(this.ctxs[i], ev) === true) cancelled = true; });
    return cancelled;
  }

  abilityState(id) {
    const i = this.active.findIndex((a) => a.id === id), c = CHARMS[id];
    if (i < 0 || !c?.ability) return null;
    const ctx = this.ctxs[i];
    const uses = ctx.memo._runtime.abilityUses ?? 0;
    return { label: c.ability.label || c.name, uses, available: uses > 0 && !this.using && (!c.ability.available || !!c.ability.available(ctx)) };
  }

  hasAvailableAbility() { return this.active.some((a) => this.abilityState(a.id)?.available); }

  async useAbility(id) {
    if (!this.abilityState(id)?.available) return false;
    const ctx = this.ctxs[this.active.findIndex((a) => a.id === id)];
    this.using = id;
    this.api.beginAbility?.(id, ctx.memo._runtime.abilityUses);
    this.changed();
    try {
      if (await CHARMS[id].ability.use(ctx) === false) return false;
      ctx.memo._runtime.abilityUses = Math.max(0, ctx.memo._runtime.abilityUses - 1);
      return true;
    } finally {
      this.using = null;
      this.api.endAbility?.();
      this.changed();
    }
  }

  refundAbility(meta) {
    const ctx = this.ctxs.find((c) => c.id === meta?.id);
    if (ctx) ctx.memo._runtime.abilityUses = meta.uses;
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

  score(sb) { this.active.forEach((a, i) => CHARMS[a.id].score?.(sb, this.ctxs[i])); }
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
