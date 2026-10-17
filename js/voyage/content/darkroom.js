// darkroom: boons + challenge. Spec: docs/voyage/overhaul/ROSTER-52.md (theme `darkroom`).
import { defineCharm } from '../registry.js';
import { foundationSequence, rankOf, suitOf } from './kit.js';

const SUIT_BADGE = ['♣', '♦', '♥', '♠'];

defineCharm({
  id: 'darkroom.sheet',
  kind: 'boon',
  theme: 'darkroom',
  name: 'Spare Sheet',
  icon: '📄',
  family: 'undo',
  text: '+4 undos now.',
  upgrade: '+3 more when upgraded.',
  onPick(run) {
    run.undos += 4;
  },
  onUpgrade(run) {
    run.undos += 3;
  },
});

defineCharm({
  id: 'darkroom.closet',
  kind: 'boon',
  theme: 'darkroom',
  name: 'Supply Closet',
  icon: '🧴',
  family: 'coin',
  text: 'Port prices are 20% lower.',
  upgrade: '35% lower, and selling a boon pays 30 coins.',
  price(item, cost, ctx) {
    const rate = ctx.level === 2 ? 0.35 : 0.20;
    if (item.kind === 'sell') return cost + (ctx.level === 2 ? 30 : 0);
    return cost * (1 - rate);
  },
});

defineCharm({
  id: 'darkroom.keeper',
  kind: 'boon',
  theme: 'darkroom',
  name: 'The Keeper',
  icon: '🎞️',
  family: 'coin',
  text: 'Each board names a suit; send its King home before any other King to win 12 coins.',
  upgrade: '20 coins.',
  setup(board, ctx) {
    if (ctx.memo.suit == null) ctx.memo.suit = ctx.rng.int(4);
    ctx.api.badge(SUIT_BADGE[ctx.memo.suit]);
  },
  score(sb, ctx) {
    const suit = ctx.memo.suit;
    if (suit == null) return;
    const pay = ctx.level === 2 ? 20 : 12;
    let sawOtherKing = false;
    let won = false;
    for (const card of foundationSequence(sb.history)) {
      if (rankOf(card) !== 13) continue;
      if (suitOf(card) === suit) {
        if (!sawOtherKing) won = true;
        break;
      }
      sawOtherKing = true;
    }
    if (won) sb.addCoins('keeper', 'The Keeper', pay, suit * 13 + 13);
  },
});

defineCharm({
  id: 'darkroom.challenge',
  kind: 'challenge',
  theme: 'darkroom',
  name: 'In the Tray',
  icon: '🧪',
  tags: ['VIS'],
  pressure: true,
  text: (s) => `Only the top ${Math.max(2, 7 - s)} cards of each column start face-up.`,
  ease: (ctx) => -0.05 * ctx.strength,
  setup(board, ctx) {
    const visible = Math.max(2, 7 - ctx.strength);
    const hidden = board.state.tableau.flatMap((col) => col.slice(0, Math.max(0, col.length - visible)));
    if (hidden.length) ctx.api.conceal(hidden);
  },
});
