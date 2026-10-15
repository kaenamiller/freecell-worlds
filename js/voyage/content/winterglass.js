// winterglass: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `winterglass`).
import { defineCharm } from '../registry.js';
import { cardsOfRanks, rankMask } from './kit.js';

function frostColors(ctx) {
  const s = ctx.strength;
  if (s >= 5) return Array.from({ length: 8 }, (_, i) => (i % 2 ? 'black' : 'red'));
  const count = s <= 2 ? 2 : 4;
  const cols = ctx.rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, count);
  const colors = Array(8).fill(null);
  const pick = ctx.rng.int(2) ? 'red' : 'black';
  cols.forEach((c) => { colors[c] = pick; });
  return colors;
}

defineCharm({
  id: 'winterglass.prism',
  kind: 'boon',
  theme: 'winterglass',
  name: 'Prism',
  icon: '💎',
  family: 'wild',
  text: 'Queens are wild.',
  upgrade: 'Queens and Kings are wild.',
  ease: 0.25,
  rules(r, ctx) {
    const ranks = ctx.level === 2 ? [12, 13] : [12];
    r.wildRanks = (r.wildRanks || 0) | rankMask(...ranks);
  },
  setup(_board, ctx) {
    const ranks = ctx.level === 2 ? [12, 13] : [12];
    ctx.api.mark(cardsOfRanks(ranks), 'wild');
  },
});

defineCharm({
  id: 'winterglass.snowdrift',
  kind: 'boon',
  theme: 'winterglass',
  name: 'Snowdrift',
  icon: '❄️',
  family: 'columns',
  text: 'Empty columns always multiply your move capacity, even when a challenge limits what they accept.',
  upgrade: '…and empty columns triple it.',
  ease: 0.15,
  rules(r, ctx) {
    r.emptyAlwaysCounts = true;
    if (ctx.level === 2) r.emptyFactor = Math.max(r.emptyFactor || 2, 3);
  },
});

defineCharm({
  id: 'winterglass.challenge',
  kind: 'challenge',
  theme: 'winterglass',
  name: 'Frost Pattern',
  icon: '❄️',
  tags: ['COLUMN'],
  text: (s) => {
    const rest = 'only accepts a card (or run starting with one) of the colour marked on it. Empty columns don\'t raise your move capacity.';
    if (s <= 2) return `2 columns are frosted: once empty, each ${rest}`;
    if (s <= 4) return `4 columns are frosted: once empty, each ${rest}`;
    return `Every column is frosted, alternating red and black: once empty, each ${rest}`;
  },
  ease: (ctx) => -0.1 * ctx.strength,
  rules(r, ctx) {
    r.emptyColors = frostColors(ctx);
  },
});
