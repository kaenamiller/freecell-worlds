// theater: boons + challenge. Spec: docs/voyage/charms-design.md (theme `theater`).
// Complex: theater.understudy in ./special/theater.understudy.js
import { defineCharm } from '../registry.js';
import { foundationSequence, suitOf } from './kit.js';

const SUIT_MARKS = ['♣', '♦', '♥', '♠'];

defineCharm({
  id: 'theater.curtain',
  kind: 'boon',
  theme: 'theater',
  name: 'Curtain Call',
  icon: '🎬',
  family: 'ability',
  text: "The first ability you use each board doesn't spend its use.",
  upgrade: "The first two abilities you use each board don't spend their uses.",
  on: {
    ability(ctx, { id }) {
      const budget = ctx.level >= 2 ? 2 : 1;
      const used = ctx.memo.curtainFree || 0;
      if (used >= budget) return;
      ctx.memo.curtainFree = used + 1;
      ctx.api.grantUse(id, 1);
    },
  },
});

defineCharm({
  id: 'theater.encore',
  kind: 'boon',
  theme: 'theater',
  name: 'Encore',
  icon: '👏',
  family: 'fortune',
  text: "After a 3★ board, the next table's challenge is one strength lower.",
  upgrade: "After a 3★ board, the next table's challenge is two strengths lower.",
  challengeStrength(s, ctx) {
    const idx = ctx.boardIndex ?? ctx.run?.boardIdx ?? 0;
    const prev = ctx.run?.results?.[idx - 1];
    if (!prev || prev.stars !== 3) return s;
    return s - (ctx.level >= 2 ? 2 : 1);
  },
});

defineCharm({
  id: 'theater.challenge',
  kind: 'challenge',
  theme: 'theater',
  name: 'Stage Directions',
  icon: '📜',
  tags: ['SCORE'],
  pressure: true,
  text: (s) => `Complete the suits in the order shown on the badge; each suit you complete out of order costs ${25 * s} points.`,
  setup(board, ctx) {
    ctx.memo.order ??= ctx.rng.shuffle([0, 1, 2, 3]);
    ctx.api.badge(ctx.memo.order.map((s) => SUIT_MARKS[s]).join('→'));
  },
  score(sb, ctx) {
    const order = ctx.memo.order || [0, 1, 2, 3];
    const found = [0, 0, 0, 0];
    let expect = 0;
    let penalty = 0;
    for (const card of foundationSequence(sb.history)) {
      const suit = suitOf(card);
      found[suit]++;
      if (found[suit] === 13) {
        if (suit !== order[expect]) penalty += 25 * ctx.strength;
        else expect++;
      }
    }
    if (penalty) sb.add('stage', 'Out-of-order finales', -penalty);
  },
});
