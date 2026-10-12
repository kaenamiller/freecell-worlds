// theater: boons + challenge. Spec: docs/voyage/charms-design.md (theme `theater`).
// Complex: theater.understudy in ./special/theater.understudy.js
import { defineCharm } from '../registry.js';
import { chainsOf, foundationSequence, suitOf } from './kit.js';

const SUIT_MARKS = ['♣', '♦', '♥', '♠'];

defineCharm({
  id: 'theater.curtain', kind: 'boon', theme: 'theater', name: 'Curtain Call', icon: '🎬',
  text: '+150 when a board ends with a chain of 13+ cards home.',
  score(sb) {
    if (chainsOf(sb.history).some((c) => c.length >= 13)) sb.add('curtain', 'Curtain call', 150);
  },
});

defineCharm({
  id: 'theater.encore', kind: 'boon', theme: 'theater', name: 'Encore', icon: '👏',
  text: 'After a 3★ board, the next board scores ×1.15.',
  score(sb, ctx) {
    const prev = ctx.run.results[ctx.run.boardIdx - 1];
    if (prev?.stars === 3) sb.mult('Encore', 1.15);
  },
});

defineCharm({
  id: 'theater.challenge', kind: 'challenge', theme: 'theater', name: 'Stage Directions', icon: '📜',
  tags: ['SCORE'],
  text: (s) => `Finish suits in the dealt order; each suit completed out of turn costs ${25 * s} points.`,
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
