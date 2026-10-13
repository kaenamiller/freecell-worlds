// pinecone: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `pinecone`).
import { defineCharm } from '../registry.js';
import { applyMove, cloneState } from '../../rules.js';
import { canUndoBoard, rankOf, replay, suitOf } from './kit.js';

const BOUNTY_TEXT = [
  'Empty two columns before 20 cards are home.',
  'Complete a suit before 20 cards are home.',
  'Three chains of 4+ before 40 cards are home.',
  'Finish at or under par.',
  'Send an Ace home from a free cell.',
  'Never fill your last free cell.',
];

function pickBounties(ctx) {
  if (ctx.memo.bounties) return ctx.memo.bounties;
  const pool = BOUNTY_TEXT.map((_, i) => i);
  const n = ctx.level === 2 ? 2 : 1;
  return (ctx.memo.bounties = ctx.rng.shuffle(pool).slice(0, n));
}

function bountyMet(id, sb, ctx) {
  switch (id) {
    case 0: {
      let home = 0;
      let emptied = 0;
      let met = false;
      const lengths = sb.initial.tableau.map((col) => col.length);
      replay(sb, (move, state) => {
        if (move.t === 'F') home++;
        for (let c = 0; c < 8; c++) {
          const len = state.tableau[c].length;
          if (lengths[c] > 0 && len === 0) {
            emptied++;
            if (emptied >= 2 && home < 20) met = true;
          }
          lengths[c] = len;
        }
      });
      return met;
    }
    case 1: {
      const suits = [0, 0, 0, 0];
      let home = 0;
      let done = false;
      replay(sb, (move) => {
        if (move.t !== 'F') return;
        home++;
        suits[suitOf(move.card)]++;
        if (home <= 20 && suits.some((n) => n === 13)) done = true;
      });
      return done;
    }
    case 2: {
      let home = 0;
      let run = 0;
      let chains = 0;
      replay(sb, (move) => {
        if (move.t === 'F') {
          run++;
          home++;
          return;
        }
        if (run >= 4 && home - run < 40) chains++;
        run = 0;
      });
      if (run >= 4 && home - run < 40) chains++;
      return chains >= 3;
    }
    case 3:
      return sb.stat.moves <= sb.par;
    case 4:
      return sb.history.some((m) => m.t === 'F' && rankOf(m.card) === 1 && m.src?.kind === 'free');
    case 5: {
      const state = cloneState(sb.initial);
      const rules = JSON.parse(JSON.stringify(sb.initialRules || sb.rules || {}));
      for (const move of sb.history) {
        if (move.auto) {
          applyMove(state, move, rules);
          continue;
        }
        const emptyBefore = state.free.filter((c) => !c).length;
        const toCell = move.t === 'C' || (move.t === 'R' && move.to?.kind === 'free');
        applyMove(state, move, rules);
        if (toCell && emptyBefore === 1) return false;
      }
      return true;
    }
    default:
      return false;
  }
}

defineCharm({
  id: 'pinecone.bounty',
  kind: 'boon',
  theme: 'pinecone',
  name: 'Merit Badge',
  icon: '🎖️',
  family: 'coin',
  text: 'Each board posts a bounty; complete it for 12 coins.',
  upgrade: 'Two bounties each board.',
  setup(_board, ctx) {
    const ids = pickBounties(ctx);
    ctx.api.badge(ids.length > 1 ? `${ids.length}×` : '★');
  },
  score(sb, ctx) {
    const ids = pickBounties(ctx);
    const pay = 12;
    let coins = 0;
    for (const id of ids) if (bountyMet(id, sb, ctx)) coins += pay;
    if (coins) sb.addCoins('bounty', 'Merit badge', coins);
  },
});

defineCharm({
  id: 'pinecone.trailhead',
  kind: 'boon',
  theme: 'pinecone',
  name: 'Trailhead',
  icon: '🧭',
  family: 'undo',
  text: 'Once per board, put every card back where it was dealt, without spending an undo.',
  upgrade: 'Twice per board.',
  ability: {
    uses: (ctx) => (ctx.level === 2 ? 2 : 1),
    label: 'Return to the deal',
    available: canUndoBoard,
    use: (ctx) => ctx.api.resetBoard(),
  },
});

defineCharm({
  id: 'pinecone.campfire',
  kind: 'boon',
  theme: 'pinecone',
  name: 'Campfire',
  icon: '🏕️',
  family: 'undo',
  text: 'At the start of each board, +1 undo if you hold fewer than 3.',
  upgrade: '+2 if you hold fewer than 3.',
  on: {
    start(ctx) {
      const gain = ctx.level === 2 ? 2 : 1;
      const room = Math.max(0, 3 - ctx.run.undos);
      if (room) ctx.api.addUndos(Math.min(gain, room));
    },
  },
});

defineCharm({
  id: 'pinecone.challenge',
  kind: 'challenge',
  theme: 'pinecone',
  name: 'Leave No Trace',
  icon: '🍂',
  tags: ['SCORE'],
  pressure: true,
  text: (s) => `After your ${10 - s}th free-cell placement, each one costs 2 coins.`,
  score(sb, ctx) {
    const allowance = 10 - ctx.strength;
    let placed = 0;
    let coins = 0;
    replay(sb, (move) => {
      const toCell = move.t === 'C' || (move.t === 'R' && move.to?.kind === 'free');
      if (!toCell) return;
      placed++;
      if (placed > allowance) coins -= 2;
    });
    if (coins) sb.addCoins('trace', 'Leave No Trace', coins);
  },
});
