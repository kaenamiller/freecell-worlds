// honeyhouse: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `honeyhouse`).
import { cardId } from '../../rules.js';
import { defineCharm } from '../registry.js';
import { replay, suitMask } from './kit.js';

function cellCloseAt(s) {
  if (s <= 1) return [39];
  if (s <= 3) return [26];
  if (s <= 5) return [20, 34];
  return [14, 26, 38];
}

defineCharm({
  id: 'honeyhouse.forager',
  kind: 'boon',
  theme: 'honeyhouse',
  name: 'Forager',
  icon: '🐝',
  family: 'coin',
  text: '+1 coin for each card sent home while all four foundations are within 2 ranks of each other.',
  upgrade: '+1 coin for each card sent home while all four foundations are within 3 ranks of each other.',
  score(sb, ctx) {
    const span = ctx.level === 2 ? 3 : 2;
    let coins = 0;
    replay(sb, (move, state) => {
      if (move.t !== 'F') return;
      const tops = state.found;
      if (Math.max(...tops) - Math.min(...tops) <= span) coins++;
    });
    if (coins) sb.addCoins('forager', 'Forager', coins);
  },
});

defineCharm({
  id: 'honeyhouse.nectar',
  kind: 'boon',
  theme: 'honeyhouse',
  name: 'Nectar',
  icon: '🍯',
  family: 'cells',
  text: 'One extra free cell that only takes Hearts.',
  upgrade: 'One extra free cell that only takes Hearts or Diamonds.',
  ease: 0.2,
  rules(r, ctx) {
    r.freeCells = (r.freeCells || 4) + 1;
    const i = r.freeCells - 1;
    while (r.cellLimits.length < i) r.cellLimits.push(null);
    r.cellLimits[i] = { suits: ctx.level === 2 ? suitMask(1, 2) : suitMask(2) };
  },
});

defineCharm({
  id: 'honeyhouse.royaljelly',
  kind: 'boon',
  theme: 'honeyhouse',
  name: 'Royal Jelly',
  icon: '👑',
  family: 'sticker',
  text: 'When you take this, the four Queens get Lucky stickers.',
  upgrade: 'When upgraded, the Kings get Lucky stickers too.',
  onPick(_run, ctx) {
    for (let suit = 0; suit < 4; suit++) ctx.api.addSticker(cardId(suit, 12), 'lucky');
  },
  onUpgrade(_run, ctx) {
    for (let suit = 0; suit < 4; suit++) ctx.api.addSticker(cardId(suit, 13), 'lucky');
  },
});

defineCharm({
  id: 'honeyhouse.challenge',
  kind: 'challenge',
  theme: 'honeyhouse',
  name: 'Wax Caps',
  icon: '🍯',
  tags: ['CELLS'],
  text: (s) => {
    const at = cellCloseAt(s);
    if (at.length === 1) return `Empty free cells close once ${at[0]} cards are home.`;
    const list = at.slice(0, -1).join(', ') + ' and ' + at.at(-1);
    return `Empty free cells close at ${list} cards home.`;
  },
  ease: (ctx) => -0.08 * ctx.strength,
  rules(r, ctx) {
    r.cellClose = { at: cellCloseAt(ctx.strength) };
  },
});
