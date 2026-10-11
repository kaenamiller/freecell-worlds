// Voyage charms: boons (picked after a board, kept for the rest of the run), theme challenges
// (one per theme, active on that theme's board, scaled by `strength` 1..7) and boss challenges
// (added on top of the theme challenge on the final board).
//
// A charm is plain data plus optional hooks. The hooks fall into four groups:
//
//   rules(r, ctx)      Solver-visible rule changes, applied before the deal is chosen. `r` is a
//                      BoardRules object (see baseRules). The dealer rates deals under these rules,
//                      so anything here keeps the board both winnable and on the difficulty curve.
//   ease               Difficulty adjustment for effects the solver can't model, in tiers:
//                      +1 = this charm makes boards feel about one tier easier, -0.5 = half a tier
//                      harder. May be a number or a function (ctx) => number. The dealer offsets
//                      ease (see VOYAGE.compensation). Effects already expressed in `rules` should
//                      not repeat their impact here.
//   setup(board, ctx)  Deterministic per-board setup after dealing (e.g. which cards start hidden).
//                      Use ctx.rng — never Math.random — so a run replays from its seed. It runs
//                      again when a saved board is resumed, so it must not depend on play so far.
//   score(sb, ctx)     Adjust the board's score breakdown (see scoring.js): sb.add(), sb.mult().
//   on: { start, move, foundation, freecell, columnEmpty, undo, win }(ctx, ev)
//                      Board events. ctx.api lets a hook act: addUndos(n), notify(text).
//   onPick(run)        One-off effect when a boon is chosen (e.g. grant undos).
//
// Charm fields: id, kind ('boon'|'challenge'|'boss'), theme (themeId, boons/challenges only),
// name, icon (short glyph or emoji for the HUD tray), text (one-sentence tooltip; may be a
// function of strength), placeholder (true until real content replaces it).

import { THEMES, THEME_ORDER } from '../themes.js';
import { VOYAGE } from './config.js';
import { stream } from './rng.js';

export const CHARMS = {};

export function defineCharm(def) {
  if (CHARMS[def.id]) throw new Error(`Duplicate charm id ${def.id}`);
  CHARMS[def.id] = { on: {}, ...def };
  return CHARMS[def.id];
}

export const charm = (id) => CHARMS[id];
export const boonsForTheme = (themeId) => Object.values(CHARMS).filter((c) => c.kind === 'boon' && c.theme === themeId).map((c) => c.id);
export const challengeForTheme = (themeId) => Object.values(CHARMS).find((c) => c.kind === 'challenge' && c.theme === themeId)?.id || null;
export const bossIds = () => Object.values(CHARMS).filter((c) => c.kind === 'boss').map((c) => c.id);

// Tooltip text for a charm at a given strength.
export const charmText = (id, strength = 1) => {
  const c = CHARMS[id];
  return typeof c.text === 'function' ? c.text(strength) : c.text;
};

// ---------------------------------------------------------------------------
// Board rules — the solver-visible part of a board. Extend this object (and teach rules.js and
// difficulty.js about the new field) when a challenge needs a rule the solver must respect.
// ---------------------------------------------------------------------------
export const baseRules = () => ({ freeCells: VOYAGE.baseFreeCells });

export const rulesKey = (r) => `fc${r.freeCells}`;

function clampRules(r) {
  r.freeCells = Math.max(VOYAGE.minFreeCells, Math.min(VOYAGE.maxFreeCells, r.freeCells));
  return r;
}

// Everything active on one board: the run's boons, the node's theme challenge and (final board)
// the boss. Returns the rules the deal is rated under and the summed unmodeled ease.
export function composeBoard({ boons = [], challenge = null, boss = null, strength = 1 }) {
  const active = [
    ...boons.map((id) => ({ id, kind: 'boon', strength })),
    ...(challenge ? [{ id: challenge, kind: 'challenge', strength }] : []),
    ...(boss ? [{ id: boss, kind: 'boss', strength }] : []),
  ].filter((a) => CHARMS[a.id]);
  const rules = baseRules();
  let ease = 0;
  for (const a of active) {
    const c = CHARMS[a.id];
    const ctx = { strength: a.strength };
    if (c.rules) c.rules(rules, ctx);
    if (c.ease) ease += typeof c.ease === 'function' ? c.ease(ctx) : c.ease;
  }
  return { active, rules: clampRules(rules), ease };
}

// ---------------------------------------------------------------------------
// Runtime dispatch for one board.
// ---------------------------------------------------------------------------
export class BoardEffects {
  // `active` comes from composeBoard; `api` is supplied by the game (addUndos, notify, ...).
  // `memo` is an object saved with the board (run.current.memo) so per-board charm state survives
  // a reload; each charm gets memo[id].
  constructor(active, { seed, boardIndex, api, memo = {} }) {
    this.active = active;
    this.api = api;
    this.ctxs = active.map((a) => ({
      id: a.id,
      strength: a.strength,
      kind: a.kind,
      rng: stream(seed, 'charm', boardIndex, a.id),
      api,
      memo: (memo[a.id] ??= {}), // per-board scratch space for the charm
    }));
  }

  setup(board) {
    this.active.forEach((a, i) => CHARMS[a.id].setup?.(board, this.ctxs[i]));
  }

  emit(event, ev = {}) {
    this.active.forEach((a, i) => CHARMS[a.id].on?.[event]?.(this.ctxs[i], ev));
  }

  score(sb) {
    this.active.forEach((a, i) => CHARMS[a.id].score?.(sb, this.ctxs[i]));
  }
}

// ---------------------------------------------------------------------------
// Placeholder content. Real per-theme boons/challenges and bosses replace these; every theme
// needs exactly three boons and one challenge. Placeholders cover each hook family so the run
// loop, dealer and UI can be exercised end to end.
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
  for (const b of PLACEHOLDER_BOONS) {
    const { key, ...rest } = b;
    defineCharm({ ...rest, id: `${themeId}.${key}`, kind: 'boon', theme: themeId, placeholder: true, name: `${rest.name}` });
  }
  defineCharm({ ...PLACEHOLDER_CHALLENGE, id: `${themeId}.challenge`, kind: 'challenge', theme: themeId, placeholder: true, name: `${tname}: ${PLACEHOLDER_CHALLENGE.name}` });
}

defineCharm({
  id: 'boss.narrows',
  kind: 'boss',
  name: 'The Narrows',
  icon: '☠',
  text: 'One fewer free cell for the final board.',
  placeholder: true,
  rules: (r) => {
    r.freeCells -= 1;
  },
});
