// canyon: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `canyon`).
import { defineCharm } from '../registry.js';
import { cardsOfRanks, paidUndo } from './kit.js';

function stickerRank(run, memo, rng) {
  const used = new Set(Object.values(memo.ranks || []));
  const pool = [];
  for (let rank = 4; rank <= 9; rank++) if (!used.has(rank)) pool.push(rank);
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}

function applyTurquoiseStickers(run, ctx, rank) {
  if (!rank) return;
  const cards = cardsOfRanks([rank]);
  for (const card of cards) ctx.api.addSticker(card, 'wild');
  (ctx.runMemo.ranks ??= []).push(rank);
}

defineCharm({
  id: 'canyon.turquoise',
  kind: 'boon',
  theme: 'canyon',
  name: 'Turquoise Inlay',
  icon: '💠',
  family: 'sticker',
  text: 'When you take this, all four cards of a random rank from 4 to 9 get Wild stickers.',
  upgrade: 'When upgraded, another rank gets them too.',
  onPick(run, ctx) {
    const rank = stickerRank(run, ctx.runMemo, ctx.rng);
    applyTurquoiseStickers(run, ctx, rank);
  },
  onUpgrade(run, ctx) {
    const rank = stickerRank(run, ctx.runMemo, ctx.rng);
    applyTurquoiseStickers(run, ctx, rank);
  },
});

defineCharm({
  id: 'canyon.bloom',
  kind: 'boon',
  theme: 'canyon',
  name: 'Desert Bloom',
  icon: '🌵',
  family: 'undo',
  text: '+2 undos when you clear a board at or under par.',
  upgrade: '+3.',
  on: {
    win(ctx, { result }) {
      if (result.moves <= result.par) ctx.api.addUndos(ctx.level >= 2 ? 3 : 2);
    },
  },
});

defineCharm({
  id: 'canyon.echo',
  kind: 'boon',
  theme: 'canyon',
  name: 'Echo Canyon',
  icon: '🔊',
  family: 'undo',
  text: 'Undoing a free-cell placement refunds the undo.',
  upgrade: '…undoing a move out of a free cell is refunded too.',
  on: {
    undo(ctx, ev) {
      if (!paidUndo(ev)) return;
      const fromCell = ev.move?.t === 'C' || (ctx.level >= 2 && ev.move?.t === 'R' && ev.move?.src?.kind === 'free');
      if (fromCell) ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'canyon.challenge',
  kind: 'challenge',
  theme: 'canyon',
  name: 'Two-Tone Strata',
  icon: '🏜️',
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
