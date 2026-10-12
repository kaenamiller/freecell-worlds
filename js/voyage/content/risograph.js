// risograph: boons + challenge. Spec: docs/voyage/charms-design.md (theme `risograph`).
import { cardId } from '../../rules.js';
import { defineCharm } from '../registry.js';
import { countHome, rankMask, rankName, suitMask, suitOf } from './kit.js';
import { stream } from '../rng.js';

function offRanks(s, rng) {
  const n = s <= 3 ? 1 : 2;
  const start = 2 + rng.int(13 - n);
  return Array.from({ length: n }, (_, i) => start + i);
}

defineCharm({
  id: 'risograph.misprint', kind: 'boon', theme: 'risograph', name: 'Misprint', icon: '🖨️',
  text: 'Twos are wild: they ignore colour when stacking.',
  ease: 0.15,
  rules(r) { r.wildRanks = (r.wildRanks || 0) | rankMask(2); },
  setup(_board, ctx) { ctx.api.mark([cardId(0, 2), cardId(1, 2), cardId(2, 2), cardId(3, 2)], 'wild'); },
});

defineCharm({
  id: 'risograph.ultramarine', kind: 'boon', theme: 'risograph', name: 'Ultramarine', icon: '🔵',
  text: '+12 points for every spade sent home.',
  score(sb) {
    const n = countHome(sb.history, (id) => suitOf(id) === 3);
    if (n) sb.add('ultramarine', 'Spades home', n * 12);
  },
});

defineCharm({
  id: 'risograph.edition', kind: 'boon', theme: 'risograph', name: 'Second Edition', icon: '🗞️',
  text: 'Each board scores +4% per board already cleared, up to +20%.',
  score(sb, ctx) {
    const bonus = Math.min(20, ctx.run.boardIdx * 4) / 100;
    if (bonus) sb.mult('Second Edition', 1 + bonus);
  },
});

defineCharm({
  id: 'risograph.challenge', kind: 'challenge', theme: 'risograph', name: 'Off Register', icon: '🟥',
  tags: ['STACK'],
  text: (s) => (s <= 3
    ? "Nothing can be placed on one suit's chosen rank, never an Ace."
    : "Nothing can be placed on one suit's two consecutive ranks, never Aces."),
  ease: (ctx) => -0.07 * ctx.strength,
  rules(r, ctx) {
    r.barren = { suits: suitMask(ctx.rng.int(4)), ranks: rankMask(...offRanks(ctx.strength, ctx.rng)) };
  },
  setup(_board, ctx) {
    const rng = stream(ctx.seed, 'rules', ctx.run.boardIdx, ctx.id);
    const suit = rng.int(4);
    const ranks = offRanks(ctx.strength, rng);
    ctx.api.mark(ranks.map((rank) => cardId(suit, rank)), 'bar');
    const pip = ['♣', '♦', '♥', '♠'][suit];
    ctx.api.badge(ranks.map((rank) => `${pip} ${rankName(rank)}`).join(' '));
  },
});
