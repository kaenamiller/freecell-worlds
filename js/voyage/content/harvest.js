// harvest: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `harvest`).
import { CHARMS, defineCharm } from '../registry.js';
import { chainsOf, rankOf, replay } from './kit.js';

function unusedAbilityUses(ctx) {
  const board = ctx.api.boardMemo;
  if (!board) return 0;
  let total = 0;
  for (const [id, entry] of Object.entries(board)) {
    if (id.startsWith('_') || !CHARMS[id]?.ability) continue;
    total += entry?._runtime?.abilityUses ?? 0;
  }
  return total;
}

defineCharm({
  id: 'harvest.cellar',
  kind: 'boon',
  theme: 'harvest',
  name: 'Root Cellar',
  icon: '🥔',
  family: 'ability',
  text: 'Ability uses you didn\'t spend when a board ends become +1 undo each (up to 2).',
  upgrade: 'Up to 3.',
  on: {
    win(ctx) {
      const cap = ctx.level >= 2 ? 3 : 2;
      const grant = Math.min(cap, unusedAbilityUses(ctx));
      if (grant) ctx.api.addUndos(grant);
    },
  },
});

defineCharm({
  id: 'harvest.hayride',
  kind: 'boon',
  theme: 'harvest',
  name: 'Hayride',
  icon: '🚜',
  family: 'fortune',
  text: 'Your next 2 boards are dealt a full tier gentler.',
  upgrade: 'The next 3 boards.',
  dealShift: (ctx) => (ctx.runMemo.boardsLeft > 0 ? -1 : 0),
  onPick(_run, ctx) {
    ctx.runMemo.boardsLeft = ctx.level >= 2 ? 3 : 2;
  },
  on: {
    start(ctx) {
      if (ctx.runMemo.boardsLeft > 0) ctx.runMemo.boardsLeft--;
    },
  },
});

defineCharm({
  id: 'harvest.gleaning',
  kind: 'boon',
  theme: 'harvest',
  name: 'Gleaning',
  icon: '🌾',
  family: 'coin',
  text: '+4 coins for every Ace you send home within your first 10 moves.',
  upgrade: '+6, and Twos count too.',
  score(sb, ctx) {
    const ranks = ctx.level >= 2 ? [1, 2] : [1];
    const per = ctx.level >= 2 ? 6 : 4;
    let moves = 0;
    let bonus = 0;
    replay(sb, (move) => {
      if (!move.auto) moves++;
      if (move.t === 'F' && moves <= 10 && ranks.includes(rankOf(move.card))) bonus++;
    });
    if (bonus) sb.addCoins('gleaning', 'Gleaning', bonus * per);
  },
});

defineCharm({
  id: 'harvest.challenge',
  kind: 'challenge',
  theme: 'harvest',
  name: 'Windfall Tax',
  icon: '🍏',
  tags: ['SCORE'],
  pressure: true,
  text: (s) => `Each card sent home on its own (not in a chain of 2+) costs ${2 + s} points.`,
  ease: (ctx) => -0.05 * ctx.strength,
  score(sb, ctx) {
    const solo = chainsOf(sb.history).filter((chain) => chain.length === 1).length;
    if (solo) sb.add('windfall', 'Windfall Tax', -solo * (2 + ctx.strength));
  },
});
