// safetypin: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `safetypin`).
import { cardId, isPinned } from '../../rules.js';
import { defineCharm } from '../registry.js';
import { ALL_RANKS, cardsOfRanks, liveMarks, rankOf, suitOf, suitName } from './kit.js';
const pinCount = (s) => 1 + Math.floor(s / 2);
const pinUntil = (s) => 6 + 2 * s;

defineCharm({
  id: 'safetypin.threechords',
  kind: 'boon',
  theme: 'safetypin',
  name: 'Three Chords',
  icon: '🎸',
  family: 'ability',
  text: 'Each time you use an ability, your next drop ignores colour.',
  upgrade: 'Each time you use an ability, your next drop ignores colour and rank.',
  ease: 0.2,
  on: {
    ability(ctx) {
      ctx.memo.pendingOverride = ctx.level === 2
        ? { ignoreColour: true, ignoreRank: true }
        : { ignoreColour: true };
    },
    move(ctx, { manual }) {
      if (!manual || !ctx.memo.pendingOverride) return;
      ctx.api.override(ctx.memo.pendingOverride);
      delete ctx.memo.pendingOverride;
    },
  },
});

defineCharm({
  id: 'safetypin.safetypin',
  kind: 'boon',
  theme: 'safetypin',
  name: 'Safety Pin',
  icon: '📌',
  family: 'foundation',
  text: 'Once per board, pin a suit: its next 3 cards home grant +1 undo each.',
  upgrade: 'Once per board, pin a suit: its next 5 cards home grant +1 undo each.',
  ease: 0.25,
  ability: {
    uses: 1,
    label: 'Pin a suit',
    async use(ctx) {
      const st = ctx.api.state;
      const suit = await ctx.api.choose({
        prompt: `Pin a suit: its next ${ctx.level === 2 ? 5 : 3} cards home grant +1 undo each.`,
        options: [0, 1, 2, 3].map((s) => {
          const left = 13 - st.found[s] - (st.spur?.suit === s ? st.spur.top - st.spur.base + 1 : 0);
          return { value: s, label: `${['♣', '♦', '♥', '♠'][s]} ${suitName(s)}`, detail: left ? `${left} still to go home` : 'All home', disabled: !st.tableau.some((col) => col.some((id) => suitOf(id) === s)) };
        }),
      });
      if (suit == null) return false;
      ctx.memo.pinSuit = suit;
      ctx.api.badge(suitName(suit));
      ctx.api.mark(cardsOfRanks(ALL_RANKS, [suit]), 'glow');
      return true;
    },
  },
  on: {
    foundation(ctx, { card }) {
      if (ctx.memo.pinSuit == null || suitOf(card) !== ctx.memo.pinSuit) return;
      const cap = ctx.level === 2 ? 5 : 3;
      const grants = ctx.memo.pinGrants || 0;
      if (grants >= cap) return;
      ctx.memo.pinGrants = grants + 1;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'safetypin.zine',
  kind: 'boon',
  theme: 'safetypin',
  name: 'Zine',
  icon: '📰',
  family: 'sticker',
  text: 'Ports offer a copier: copy one of your stickers onto another card for 10 coins.',
  upgrade: 'Ports offer a copier: copy one of your stickers onto another card, free once per visit.',
  portServices(ctx) {
    const free = ctx.level === 2;
    return [{
      id: 'safetypin.zine.copy',
      label: 'Copier',
      text: free
        ? 'Copy one of your stickers onto another card (free once per visit).'
        : 'Copy one of your stickers onto another card.',
      price: 10,
      needsCard: true,
      apply(run, dest) {
        const memo = (run.charmMemo['safetypin.zine'] ??= {});
        const key = `port-${run.port?.boardIdx}`;
        if (free && memo[key]) return false;
        const entries = Object.entries(run.stickers).filter(([c]) => Number(c) !== dest);
        if (!entries.length) return false;
        const [, type] = entries[0];
        run.stickers[dest] = type;
        if (free) memo[key] = true;
        return true;
      },
    }];
  },
});

defineCharm({
  id: 'safetypin.challenge',
  kind: 'challenge',
  theme: 'safetypin',
  name: 'Pinned',
  icon: '📌',
  tags: ['MOVE'],
  text: (s) => {
    const n = pinCount(s);
    const until = pinUntil(s);
    return `${n} buried card${n === 1 ? '' : 's'} stay pinned until ${until} cards are home.`;
  },
  ease: (ctx) => -0.08 * ctx.strength,
  rules(r, ctx) {
    r.pinned = { cards: [], until: pinUntil(ctx.strength) };
  },
  dealRules(r, ctx) {
    const n = pinCount(ctx.strength);
    const pool = ctx.state.tableau.flatMap((col) => col.slice(0, -1));
    const picks = [];
    for (let i = 0; i < n && pool.length; i++) picks.push(pool.splice(ctx.rng.int(pool.length), 1)[0]);
    if (!picks.length) return;
    r.pinned = { cards: picks, until: pinUntil(ctx.strength) };
  },
  setup(_board, ctx) { pinMarks(ctx); },
  on: { move(ctx) { pinMarks(ctx); }, undo(ctx) { pinMarks(ctx); } },
});
// Locks come off once the pins release (or Broken Seal frees a card) and return on undo.
function pinMarks(ctx) {
  const st = ctx.api.state, rules = ctx.api.rules;
  liveMarks(ctx, st ? (rules?.pinned?.cards || []).filter((card) => isPinned(st, card, rules)) : [], 'lock');
}
