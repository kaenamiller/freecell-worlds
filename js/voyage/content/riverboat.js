// riverboat: boons + challenge. Spec: docs/voyage/charms-design.md (theme `riverboat`).
import { defineCharm } from '../registry.js';
import { chainsOf } from './kit.js';

defineCharm({
  id: 'riverboat.sleeve', kind: 'boon', theme: 'riverboat', name: 'Ace in the Sleeve', icon: '🂡',
  text: 'Aces start on the foundations.',
  ease: 0.35,
  rules(r) { r.startHome = Math.max(r.startHome || 0, 1); },
});

defineCharm({
  id: 'riverboat.dealer', kind: 'boon', theme: 'riverboat', name: 'Dealer\'s Choice', icon: '🎴',
  text: '2★ and 3★ thresholds are 8% lower.',
  thresholds: (arr) => arr.map((n, i) => (i ? Math.round(n * 0.92) : n)),
});

defineCharm({
  id: 'riverboat.edge', kind: 'boon', theme: 'riverboat', name: 'House Edge', icon: '🎲',
  text: 'Each board scores +5% per star you earned on the previous board.',
  score(sb, ctx) {
    const prev = ctx.run.boardIdx > 0 ? ctx.run.results[ctx.run.boardIdx - 1] : null;
    const stars = prev?.stars || 0;
    if (stars) sb.mult(`House edge (${stars}★ prior)`, 1 + 0.05 * stars);
  },
});

defineCharm({
  id: 'riverboat.challenge', kind: 'challenge', theme: 'riverboat', name: 'Ante', icon: '🪙',
  tags: ['SCORE'],
  text: (s) => `The board starts at −${30 * s} points; each chain of 5+ wins back ${15 * s} (twice at most).`,
  ease: (ctx) => -0.04 * ctx.strength,
  score(sb, ctx) {
    const s = ctx.strength;
    const rebates = Math.min(2, chainsOf(sb.history).filter((chain) => chain.length >= 5).length);
    sb.add('ante', 'Ante', -30 * s + rebates * 15 * s);
  },
});
