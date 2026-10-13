// zen: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `zen`).
import { defineCharm } from '../registry.js';
import { ALL_RANKS, boardWon, cardsOfRanks } from './kit.js';

const ALL_CARDS = cardsOfRanks(ALL_RANKS);

defineCharm({
  id: 'zen.stillness',
  kind: 'boon',
  theme: 'zen',
  name: 'Stillness',
  icon: '🪷',
  family: 'cells',
  text: 'Any card may enter any open free cell, whatever the challenge or boss says.',
  upgrade: '…and one extra free cell.',
  rules(r, ctx) {
    r.freeCards = [...new Set([...(r.freeCards || []), ...ALL_CARDS])];
    if (ctx.level >= 2) r.freeCells += 1;
  },
});

defineCharm({
  id: 'zen.calm',
  kind: 'boon',
  theme: 'zen',
  name: 'Calm Waters',
  icon: '🎐',
  family: 'fortune',
  text: 'Every board is dealt half a tier gentler.',
  upgrade: 'A full tier gentler.',
  dealShift: (ctx) => (ctx.level >= 2 ? -1 : -0.5),
});

defineCharm({
  id: 'zen.koan',
  kind: 'boon',
  theme: 'zen',
  name: 'Koan',
  icon: '🍵',
  family: 'vision',
  text: 'Once per board, see the solver\'s next three moves; you play them yourself.',
  upgrade: 'Twice per board, five moves each.',
  ability: {
    uses: (ctx) => ctx.level,
    label: 'Preview line',
    available: ({ api }) => !boardWon(api.state),
    async use(ctx) {
      const n = ctx.level >= 2 ? 5 : 3;
      return !!(await ctx.api.preview(n));
    },
  },
});

defineCharm({
  id: 'zen.challenge',
  kind: 'challenge',
  theme: 'zen',
  name: 'Raked Sand',
  icon: '〰️',
  tags: ['SCORE'],
  pressure: true,
  text: (s) => `Every move over par costs ${4 + 2 * s} points.`,
  score(sb, ctx) {
    const over = sb.stat.moves - sb.par;
    if (over > 0) sb.add('raked', 'Raked Sand', -over * (4 + 2 * ctx.strength));
  },
});
