// broadcast: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `broadcast`).
import { cardId } from '../../rules.js';
import { defineCharm } from '../registry.js';
import { ALL_RANKS } from './kit.js';
import { stream } from '../rng.js';

const phaseAt = (s) => (s <= 2 ? 34 : s <= 5 ? 26 : 20);

defineCharm({
  id: 'broadcast.tuning',
  kind: 'boon',
  theme: 'broadcast',
  name: 'Tuning',
  icon: '📡',
  family: 'fortune',
  text: 'You can see one more row ahead on the chart.',
  upgrade: 'You can see two more rows ahead on the chart.',
  lookahead(n, ctx) {
    return n + (ctx.level === 2 ? 2 : 1);
  },
});

defineCharm({
  id: 'broadcast.bars',
  kind: 'boon',
  theme: 'broadcast',
  name: 'Color Bars',
  icon: '📺',
  family: 'wild',
  text: 'Each board, one random suit is wild: its cards ignore colour when stacking.',
  upgrade: 'Each board, two random suits are wild.',
  ease: 0.2,
  rules(r, ctx) {
    const n = ctx.level === 2 ? 2 : 1;
    const suits = ctx.rng.shuffle([0, 1, 2, 3]).slice(0, n);
    const ids = suits.flatMap((suit) => ALL_RANKS.map((rank) => cardId(suit, rank)));
    r.wildCards = [...new Set([...(r.wildCards || []), ...ids])];
  },
  setup(_board, ctx) {
    const n = ctx.level === 2 ? 2 : 1;
    const rng = stream(ctx.seed, 'rules', ctx.run.boardIdx, ctx.id);
    const suits = rng.shuffle([0, 1, 2, 3]).slice(0, n);
    const ids = suits.flatMap((suit) => ALL_RANKS.map((rank) => cardId(suit, rank)));
    ctx.api.mark(ids, 'wild');
    const pip = ['♣', '♦', '♥', '♠'];
    ctx.api.badge(suits.map((s) => pip[s]).join(' '));
  },
});

defineCharm({
  id: 'broadcast.signoff',
  kind: 'boon',
  theme: 'broadcast',
  name: 'Sign-off',
  icon: '🌙',
  family: 'coin',
  text: 'After a 3★ board, the next board\'s coin payout doubles if it\'s 3★ too.',
  upgrade: 'After a 3★ board, the next board\'s coin payout triples if it\'s 3★ too.',
  coins(n, ctx) {
    if (ctx.run.results.at(-1)?.stars !== 3 || ctx.stars !== 3) return n;
    const factor = ctx.level === 2 ? 3 : 2;
    return Math.round(n * factor);
  },
});

defineCharm({
  id: 'broadcast.challenge',
  kind: 'challenge',
  theme: 'broadcast',
  name: 'Prime Time',
  icon: '📻',
  tags: ['COLUMN'],
  text: (s) => {
    const at = phaseAt(s);
    return `Until ${at} cards are home, empty columns don't help you move sequences; after that they triple it but only take cards ranked 6 or lower.`;
  },
  ease: (ctx) => -0.1 * ctx.strength,
  rules(r, ctx) {
    r.phase = {
      at: phaseAt(ctx.strength),
      rules: { emptyFactor: 3, emptyMaxRank: 6 },
    };
    r.emptyFactor = 1;
  },
});
