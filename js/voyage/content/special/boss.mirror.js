import { CHARMS, CHARM_FAMILIES, defineCharm } from '../../registry.js';
import { stream } from '../../rng.js';
import { cardId } from '../../../rules.js';

// Composition calls confiscate synchronously before rules/ease, with a reduced
// boon list afterward; match that exact list so another build cannot reuse it.
let lastPick = null;
const boonKey = (boons) => JSON.stringify([...boons].sort());
export function mirrorFamily(ctx) {
  const boons = ctx.heldBoons || ctx.run?.boons || ctx.boons;
  const count = (family) => Array.isArray(boons) ? boons.filter((id) => CHARMS[id]?.family === family).length : ctx.family?.(family) || 0;
  const counts = CHARM_FAMILIES.map(count), most = Math.max(...counts);
  const tied = CHARM_FAMILIES.filter((_, i) => counts[i] === most);
  return stream(ctx.seed, 'boss', 'boss.mirror', 'family').pick(tied);
}
const selectedFamily = (ctx) => {
  if (ctx.memo?.family) return ctx.memo.family;
  if (ctx.run?.boons) return mirrorFamily(ctx);
  if (lastPick && lastPick.seed === ctx.seed && lastPick.idx === ctx.idx &&
      Array.isArray(ctx.boons) && lastPick.boons === boonKey(ctx.boons)) return lastPick.family;
  return mirrorFamily(ctx);
};
const fog = (family) => ['undo', 'coin', 'fortune', 'sticker', 'vision'].includes(family);
const barrenKings = [cardId(2, 13), cardId(3, 13)];
// boss-calibrate: 32 shared tier-5–7 deals, 400 ms, six 6,000-node restarts;
// base/columns/spread-2/barren-Kings yields: 46.9/37.5/28.1/34.4%.
// Cell loss is bank-modeled; confiscation removes the stolen boon's own ease.
const EASE = { columns: -.50, foundation: -1.01, suit: -.71 };

defineCharm({
  id: 'boss.mirror', kind: 'boss', name: 'The Mirror', icon: '🪞',
  // Its own tag: listing every family it can hit would ban nearly every final-table theme.
  tags: ['MIRROR'],
  text: 'Your most-held boon family turns against you: fewer cells, King-only empty columns, confiscated wild or suit boons, foundations within 2, taxed abilities, or fewer cells with buried-card fog.',
  // From board 5 the chart names the family it's watching, so the last picks can play around it.
  tell: ({ seed, boons, boardIdx } = {}) => boardIdx >= 4 && boons?.length
    ? `The Mirror watches your ${mirrorFamily({ seed, boons })} boons`
    : 'The Mirror watches your most-held family',
  ease: (ctx) => EASE[selectedFamily(ctx)] || 0,
  confiscate(boonIds, ctx) {
    const family = mirrorFamily({ ...ctx, boons: boonIds });
    // Kernel confiscate returns one id. Take the oldest matching wild/suit boon.
    const taken = ['wild', 'suit'].includes(family) ? boonIds.find((id) => CHARMS[id]?.family === family) : null;
    lastPick = {seed:ctx.seed,idx:ctx.idx,family,boons:boonKey(boonIds.filter((id) => id !== taken))};
    if (ctx.runMemo) ctx.runMemo.family = family;
    return taken;
  },
  rules(r, ctx) {
    const family = selectedFamily(ctx);
    if (family === 'cells') r.freeCells = Math.max(1, r.freeCells - 2);
    else if (family === 'columns') r.emptyMinRank = Math.max(r.emptyMinRank || 0, 13);
    else if (family === 'suit') r.barrenCards = [...new Set([...(r.barrenCards || []), ...barrenKings])];
    else if (family === 'foundation') r.foundationSpread = r.foundationSpread ? Math.min(r.foundationSpread, 2) : 2;
    else if (fog(family)) r.freeCells = Math.max(1, r.freeCells - 1);
  },
  setup(board, ctx) {
    const family = ctx.memo.family ??= mirrorFamily(ctx);
    ctx.api.badge(family);
    if (family === 'suit') ctx.api.mark(barrenKings, 'thorn');
    if (fog(family)) ctx.api.conceal(board.state.tableau.flatMap((col) => col.slice(0, -1)));
  },
  on: {
    ability(ctx) {
      if (selectedFamily(ctx) !== 'ability' || ctx.memo.taxed) return;
      ctx.memo.taxed = true;
      ctx.api.spendUndos(1);
      ctx.api.notify('The Mirror: your first ability costs 1 undo.');
    },
  },
  boonRelation(id, diff) {
    if (['wild', 'suit', 'ability'].includes(CHARMS[id]?.family)) return '!';
    if (diff.freeCells != null || diff.moveBonus != null || diff.emptyAlwaysCounts || id === 'deepstorage.clearance') return '+';
    return '~';
  },
});
