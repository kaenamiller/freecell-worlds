// Boss challenges (board 7). Spec: docs/voyage/boss-build.md §1.
import { cardId } from '../../rules.js';
import { defineCharm } from '../registry.js';
import { stream } from '../rng.js';
import { rankMask, suitMask, suitName } from './kit.js';

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

function mergeBarren(r, suit) {
  const prev = r.barren || { suits: 0, ranks: 0 };
  r.barren = { suits: prev.suits | suitMask(suit), ranks: prev.ranks | ALL_RANKS };
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
  text: 'Three free cells start frozen and thaw at 6, 14 and 24 cards home.',
  ease: -3.05,
  rules(r) {
    const t = r.cellThaw || { frozen: 0, at: [] };
    r.cellThaw = { frozen: t.frozen + 3, at: [...t.at, 6, 14, 24].sort((a, b) => a - b) };
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
  ease: -2.46,
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
    if (ctx?.seed == null) return 'Nothing can be built onto a random suit.';
    const suit = barrenSuit(ctx.seed, 'boss.barren');
    return `Nothing can be built onto ${SUIT_PIP[suit]} ${suitName(suit)}.`;
  },
  ease: -1.54,
  rules(r, ctx) {
    mergeBarren(r, barrenSuit(ctx.seed, 'boss.barren'));
  },
  setup(_board, ctx) {
    const suit = barrenSuit(ctx.seed, 'boss.barren');
    ctx.api.mark(suitCardIds(suit), 'thorn');
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
  ease: -1.3,
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
  ease: 0,
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
