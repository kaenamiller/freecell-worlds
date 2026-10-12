// canyon: boons + challenge. Spec: docs/voyage/charms-design.md (theme `canyon`).
import { defineCharm } from '../registry.js';
import { cardsOfRanks, rankMask } from './kit.js';

defineCharm({
  id: 'canyon.turquoise', kind: 'boon', theme: 'canyon', name: 'Turquoise Inlay', icon: '💠',
  text: 'Sixes are wild: they ignore colour when stacking.',
  ease: 0.2,
  rules(r) {
    r.wildRanks = (r.wildRanks || 0) | rankMask(6);
  },
  setup(_board, ctx) { ctx.api.mark(cardsOfRanks([6]), 'wild'); },
});

defineCharm({
  id: 'canyon.bloom', kind: 'boon', theme: 'canyon', name: 'Desert Bloom', icon: '🌵',
  text: '+2 undos when you clear a board at or under par without using an undo.',
  on: {
    win(ctx, { result }) {
      if (result.moves <= result.par && result.undosUsed === 0) ctx.api.addUndos(2);
    },
  },
});

defineCharm({
  id: 'canyon.echo', kind: 'boon', theme: 'canyon', name: 'Echo Canyon', icon: '🔊',
  text: 'Undoing a free-cell placement refunds the undo.',
  on: {
    undo(ctx, { move }) {
      if (move?.t === 'C') ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'canyon.challenge', kind: 'challenge', theme: 'canyon', name: 'Two-Tone Strata', icon: '🏜️',
  tags: ['CELLS'],
  text: (s) => (s <= 2
    ? 'One free cell accepts only red cards.'
    : s <= 4
      ? 'One free cell is red-only and one is black-only.'
      : 'Two free cells are red-only and two are black-only.'),
  ease: (ctx) => {
    const s = ctx.strength;
    if (s <= 2) return -0.04 * s;
    if (s <= 4) return -0.07 * s;
    return -0.1 * s;
  },
  rules(r, ctx) {
    const locks = ctx.strength <= 2 ? ['red'] : ctx.strength <= 4 ? ['red', 'black'] : ['red', 'red', 'black', 'black'];
    const colors = [null, null, null, null];
    const slots = ctx.rng.shuffle([0, 1, 2, 3]);
    locks.forEach((color, i) => { colors[slots[i]] = color; });
    r.cellColors = colors;
  },
});
