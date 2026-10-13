// Boss challenges (board 7). Spec: docs/voyage/boss-build.md §1.
import { cardId, cardsHome } from '../../rules.js';
import { CHARMS, defineCharm } from '../registry.js';
import { stream } from '../rng.js';
import { liveMarks, rankMask, suitMask, suitName } from './kit.js';

const SUIT_PIP = ['♣', '♦', '♥', '♠'];
const ALL_RANKS = rankMask(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13);
const COURT_RANKS = rankMask(11, 12, 13);

const bossRng = (seed, id) => stream(seed, 'boss', id);

function pickNonAdjacentCols(rng, count, taken = []) {
  const blocked = new Set(taken);
  for (const col of taken) blocked.add(col - 1), blocked.add(col + 1);
  const picked = [...taken];
  for (const col of rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7])) {
    if (blocked.has(col) || picked.some((p) => Math.abs(p - col) === 1)) continue;
    picked.push(col);
    blocked.add(col - 1); blocked.add(col + 1);
    if (picked.length - taken.length >= count) break;
  }
  return picked.sort((a, b) => a - b);
}

function barrenSuit(seed, id) {
  if (seed == null) return 0;
  return bossRng(seed, id).pick([0, 1, 2, 3]);
}

// Sevens through Kings: the whole suit (1 of 12 finale deals verified) starved the dealer.
const BARREN_RANKS = ALL_RANKS & ~((1 << 7) - 1);
function mergeBarren(r, suit) {
  const prev = r.barren || { suits: 0, ranks: 0 };
  r.barren = { suits: prev.suits | suitMask(suit), ranks: prev.ranks | BARREN_RANKS };
}

// Courts wear the crown only while Eclipse's first phase bars them from the cells.
function eclipseMarks(ctx) {
  const st = ctx.api.state;
  liveMarks(ctx, st && cardsHome(st) < 26 ? courtCardIds() : [], 'crown');
}

function courtCardIds() {
  const ids = [];
  for (let suit = 0; suit < 4; suit++) for (const rank of [11, 12, 13]) ids.push(cardId(suit, rank));
  return ids;
}

function suitCardIds(suit) {
  const ids = [];
  for (let rank = 1; rank <= 13; rank++) ids.push(cardId(suit, rank));
  return ids;
}

function raisesEmptyFactor(diff) {
  return diff.emptyFactor != null && diff.emptyFactor > 2;
}

function helpsFreeCells(diff) {
  return diff.freeCells != null || diff.cellThaw != null;
}

defineCharm({
  id: 'boss.lockdown',
  kind: 'boss',
  name: 'Lockdown',
  icon: '🔒',
  tags: ['CELLS'],
  text: 'Two of your free cells are sealed.',
  tell: 'Two sealed cells',
  ease: 0,
  rules(r) {
    r.freeCells -= 2;
  },
  boonRelation(boonId, diff) {
    if (helpsFreeCells(diff) || boonId === 'cyber.ghost') return '+';
    return '~';
  },
});

defineCharm({
  id: 'boss.thaw',
  kind: 'boss',
  name: 'Thaw',
  icon: '🧊',
  tags: ['CELLS'],
  text: 'Two free cells start frozen and thaw at 6 and 16 cards home.',
  tell: 'Thaw at 6 / 16',
  // Three frozen cells (thaw 6/14/24) left 9 of 12 tier-7 finale deals unwinnable; two keeps the
  // frozen opening without starving the dealer of verifiable deals.
  ease: -3.05,
  rules(r) {
    const t = r.cellThaw || { frozen: 0, at: [] };
    r.cellThaw = { frozen: t.frozen + 2, at: [...t.at, 6, 16].sort((a, b) => a - b) };
  },
  boonRelation(boonId, diff) {
    if (diff.freeCells != null || boonId === 'cyber.ghost') return '+';
    if (diff.startHome != null) return '+';
    if (diff.cellThaw != null) return '~';
    return '~';
  },
});

defineCharm({
  id: 'boss.decree',
  kind: 'boss',
  name: 'Royal Decree',
  icon: '👑',
  tags: ['CELLS'],
  text: 'Jacks, Queens and Kings can\'t enter free cells.',
  tell: 'Courts cannot park',
  ease: -2.46, // K1 measured −1.91; the older −2.46 verified 5/8 finale deals vs 2/8.
  rules(r) {
    r.noCellRanks = (r.noCellRanks || 0) | COURT_RANKS;
  },
  setup(_board, ctx) {
    ctx.api.mark(courtCardIds(), 'crown');
  },
  boonRelation(boonId, diff) {
    if (boonId === 'cyber.ghost') return '~';
    if (diff.wildRanks != null) return '+';
    if (diff.moveBonus != null) return '+';
    if (diff.noCellRanks != null) return '~';
    return '~';
  },
});

defineCharm({
  id: 'boss.throne',
  kind: 'boss',
  name: 'Kings\' Throne',
  icon: '🪑',
  tags: ['COLUMN', 'MOVE'],
  text: 'Empty columns accept only Kings, and don\'t help you move sequences.',
  tell: 'Kings claim empty columns',
  ease: -2.29,
  rules(r) {
    r.emptyMinRank = Math.max(r.emptyMinRank || 0, 13);
  },
  boonRelation(_boonId, diff) {
    if (raisesEmptyFactor(diff)) return '!';
    if (diff.moveBonus != null) return '+';
    return '~';
  },
});

defineCharm({
  id: 'boss.barren',
  kind: 'boss',
  name: 'Barren Suit',
  icon: '🥀',
  tags: ['STACK'],
  text: (_s, ctx) => {
    if (ctx?.seed == null) return 'Nothing can be built onto the 7s through Kings of a random suit.';
    const suit = barrenSuit(ctx.seed, 'boss.barren');
    return `Nothing can be built onto the 7s through Kings of ${SUIT_PIP[suit]} ${suitName(suit)}.`;
  },
  ease: -2.33,
  tell: "One suit's 7–K are barren",
  rules(r, ctx) {
    mergeBarren(r, barrenSuit(ctx.seed, 'boss.barren'));
  },
  setup(_board, ctx) {
    const suit = barrenSuit(ctx.seed, 'boss.barren');
    ctx.api.mark(suitCardIds(suit).filter((id) => BARREN_RANKS & (1 << (((id - 1) % 13) + 1))), 'thorn');
  },
  boonRelation(_boonId, diff) {
    if (diff.barren != null) return '!';
    if (diff.suitBuild != null) return '~';
    if (diff.wildRanks != null || diff.moveBonus != null) return '+';
    return '~';
  },
});

defineCharm({
  id: 'boss.lockstep',
  kind: 'boss',
  name: 'Lockstep',
  icon: '⛓️',
  tags: ['FOUND'],
  text: 'No foundation may climb more than 3 above the lowest.',
  tell: 'Foundation ceiling: lowest +3',
  ease: -1.3, // K1 measured −0.16; −1.3 verified 6/8 finale deals vs 4/8.
  rules(r) {
    r.foundationSpread = r.foundationSpread ? Math.min(r.foundationSpread, 3) : 3;
  },
  boonRelation(_boonId, diff) {
    if (diff.foundationSpread != null && diff.foundationSpread > 3) return '!';
    if (diff.foundationReturn || diff.startHome != null) return '+';
    return '~';
  },
});

defineCharm({
  id: 'boss.tombs',
  kind: 'boss',
  name: 'Twin Tombs',
  icon: '⚱️',
  tags: ['COLUMN'],
  text: 'Two columns are sealed until emptied.',
  tell: 'Empty both tombs',
  ease: -0.24,
  rules(r, ctx) {
    const extra = pickNonAdjacentCols(bossRng(ctx.seed, 'boss.tombs'), 2, r.sealedCols || []);
    r.sealedCols = [...new Set([...(r.sealedCols || []), ...extra])].sort((a, b) => a - b);
  },
  boonRelation(_boonId, diff) {
    if (diff.sealedCols != null) return '!';
    if (diff.moveBonus != null) return '+';
    return '~';
  },
});

defineCharm({
  id: 'boss.eclipse', kind: 'boss', name: 'Eclipse', icon: '🌘', tags: ['CELLS', 'FOUND'],
  text: 'Before 26 cards are home, courts cannot enter cells; afterward, foundations stay within 3 of the lowest.',
  tell: 'At 26 home: courts yield to lockstep', ease: -3.05,
  rules(r) {
    const noCellRanks = r.noCellRanks || 0;
    r.noCellRanks = noCellRanks | COURT_RANKS;
    r.phase = { at: 26, rules: { noCellRanks, foundationSpread: r.foundationSpread ? Math.min(r.foundationSpread, 3) : 3 } };
  },
  setup(_board, ctx) { eclipseMarks(ctx); },
  on: { move(ctx) { eclipseMarks(ctx); }, undo(ctx) { eclipseMarks(ctx); } },
  boonRelation(_id, diff) {
    if (diff.freeCards != null || diff.wildRanks != null || diff.wildCards != null || diff.moveBonus != null || diff.startHome != null) return '+';
    if (diff.foundationSpread != null && diff.foundationSpread > 3) return '!';
    return '~';
  },
});

defineCharm({
  id: 'boss.auditor', kind: 'boss', name: 'The Auditor', icon: '🧾', tags: ['CELLS'],
  text: 'Your strongest boon is confiscated for the finale, and one more free cell is sealed.',
  tell: 'Strongest boon confiscated · one sealed cell', ease: 0,
  confiscate(boonIds, ctx) {
    let chosen = null, best = -Infinity;
    for (const id of boonIds) {
      const boon = CHARMS[id];
      const boonCtx = { ...ctx, level: ctx.levels?.[id] || 1, runMemo: {}, rng: stream(ctx.seed, 'rules', ctx.idx, id) };
      const ease = typeof boon.ease === 'function' ? boon.ease(boonCtx) : boon.ease || 0;
      const value = boon.ability ? Math.max(.4, ease) : ease;
      if (value >= best) { best = value; chosen = id; }
    }
    return chosen;
  },
  rules(r) { r.freeCells--; },
  boonRelation(_id, diff) { return diff.ability ? '!' : helpsFreeCells(diff) ? '+' : '~'; },
});

defineCharm({
  id: 'boss.hightide', kind: 'boss', name: 'High Tide', icon: '🌊', tags: ['CELLS'],
  text: 'One more empty free cell closes at 16, 28 and 40 cards home.',
  tell: 'Cells close at 16 / 28 / 40', ease: -1.5,
  rules(r) { r.cellClose = { at: [...(r.cellClose?.at || []), 16, 28, 40].sort((a, b) => a - b) }; },
  boonRelation(_id, diff) {
    if (helpsFreeCells(diff) || diff.moveBonus != null || diff.suitRunFree != null) return '+';
    return '~';
  },
});
