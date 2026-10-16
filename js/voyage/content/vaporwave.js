// Vaporwave — skipped ranks, a paid wish and seeded cross-theme rewards.
import { THEME_ORDER } from '../../themes.js';
import { registerCustomMove } from '../../rules.js';
import { CHARMS, defineCharm } from '../registry.js';
import { cardsOfRanks, rankMask } from './kit.js';

function wishMarks(ctx) {
  const ids = cardsOfRanks((ctx.memo.ranks || []).filter((rank) => ctx.api.rules.wildRanks & rankMask(rank)));
  ctx.api.unmark((ctx.memo.marked || []).filter((id) => !ids.includes(id)));
  ctx.api.mark(ids, 'mod-wild'); ctx.memo.marked = ids;
}
registerCustomMove('vaporwave.fountain', {
  apply(_st, m, rules) {
    if (!Array.isArray(m.ranks) || !m.ranks.length || m.ranks.some((rank) => !Number.isInteger(rank) || rank < 3 || rank > 12)) throw new Error('Wish ranks must be 3 through Queen');
    m.previous = rules.wildRanks || 0; rules.wildRanks = m.previous | rankMask(m.ranks);
  },
  undo(_st, m, rules) { rules.wildRanks = m.previous; },
});

defineCharm({
  id: 'vaporwave.checkerboard', kind: 'boon', theme: 'vaporwave', name: 'Checkerboard Floor', icon: '🏁', family: 'wild', ease: .3,
  text: 'A card may also be placed on a card of the same colour two ranks higher.',
  upgrade: 'A card may also be placed on a card of any colour two ranks higher.',
  rules(r, ctx) { r.skipBuild = Math.max(r.skipBuild || 0, ctx.level === 2 ? 2 : 1); },
});
defineCharm({
  id: 'vaporwave.fountain', kind: 'boon', theme: 'vaporwave', name: 'Wishing Fountain', icon: '⛲', family: 'coin', ease: .25,
  text: 'Before your first move, spend 5 coins to make a random rank from 3 through Queen wild for this board.',
  upgrade: 'Before your first move, spend 5 coins to make two random ranks from 3 through Queen wild for this board.',
  setup(_board, ctx) { wishMarks(ctx); },
  on: { undo(ctx) { wishMarks(ctx); } },
  ability: {
    uses: 1, when: 'start', label: 'Toss 5 coins', available: (ctx) => ctx.coins >= 5,
    use(ctx) {
      if (!ctx.api.spendCoins(5)) return false;
      ctx.memo.ranks ??= ctx.rng.shuffle([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).slice(0, ctx.level === 2 ? 2 : 1);
      if (!ctx.api.charmMove('vaporwave.fountain', { ranks: [...ctx.memo.ranks] })) return false;
      wishMarks(ctx); return true;
    },
  },
});
defineCharm({
  id: 'vaporwave.shuffle', kind: 'boon', theme: 'vaporwave', name: 'Shuffle Play', icon: '📼', family: 'fortune',
  text: 'After each board, one offered charm comes from a random other theme.',
  upgrade: 'After each board, two offered charms come from random other themes.',
  offerPool(offers, ctx) {
    const themes = [...new Set(Object.values(CHARMS).filter((c) => c.kind === 'boon' && THEME_ORDER.includes(c.theme) && c.theme !== ctx.theme && !c.hidden && !c.placeholder && !ctx.run.boons.includes(c.id) && !offers.includes(c.id)).map((c) => c.theme))].sort();
    const pool = [...offers];
    for (let i = 0; i < Math.min(pool.length, ctx.level === 2 ? 2 : 1) && themes.length; i++) {
      const theme = themes.splice(Math.floor(ctx.rng() * themes.length), 1)[0];
      const candidates = Object.values(CHARMS).filter((c) => c.kind === 'boon' && c.theme === theme && !c.hidden && !c.placeholder && !ctx.run.boons.includes(c.id) && !pool.includes(c.id));
      pool[i] = ctx.rng.pick(candidates).id;
    }
    return pool;
  },
});
defineCharm({
  id: 'vaporwave.challenge', kind: 'challenge', theme: 'vaporwave', name: 'After Hours', icon: '🛍️', tags: ['CELLS'],
  text: (s) => `Your last ${s <= 3 ? 'free cell is' : 'two free cells are'} shuttered and can't be used unless you have an empty column.`,
  // Measured −1.37 (one shutter) and a noisy −0.31 (two); kept monotonic so stronger never deals harder.
  ease: (ctx) => ctx.strength <= 3 ? -1.37 : -1.6,
  rules(r, ctx) { r.cellsNeedEmpty = Math.max(r.cellsNeedEmpty || 0, ctx.strength <= 3 ? 1 : 2); },
});
