// deco: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `deco`).
import { cardsHome } from '../../rules.js';
import { CHARM_FAMILIES, defineCharm } from '../registry.js';
import { cardsOfRanks, replay } from './kit.js';

const goldCards = (stickers = {}) => Object.entries(stickers)
  .filter(([, type]) => type === 'gold')
  .map(([card]) => Number(card));

defineCharm({
  id: 'deco.champagne',
  kind: 'boon',
  theme: 'deco',
  name: 'Champagne Tower',
  icon: '🥂',
  family: 'coin',
  text: 'While your boons span 4 or more families, every board\'s coin payout is +25%.',
  upgrade: '3 families, +40%.',
  coins(n, ctx) {
    const families = CHARM_FAMILIES.filter((name) => ctx.family(name) > 0).length;
    const need = ctx.level >= 2 ? 3 : 4;
    const bonus = ctx.level >= 2 ? 0.4 : 0.25;
    return families >= need ? Math.round(n * (1 + bonus)) : n;
  },
});

defineCharm({
  id: 'deco.velvet',
  kind: 'boon',
  theme: 'deco',
  name: 'Velvet Rope',
  icon: '🪩',
  family: 'cells',
  text: 'One extra free cell that only takes Jacks, Queens and Kings.',
  upgrade: '…takes cards ranked 8 and up.',
  rules(r, ctx) {
    const slot = r.freeCells;
    r.freeCells += 1;
    r.cellLimits = [...(r.cellLimits || [])];
    while (r.cellLimits.length < r.freeCells) r.cellLimits.push(null);
    r.cellLimits[slot] = { minRank: ctx.level >= 2 ? 8 : 11 };
  },
});

defineCharm({
  id: 'deco.gilded',
  kind: 'boon',
  theme: 'deco',
  name: 'Gilded Age',
  icon: '🎺',
  family: 'sticker',
  text: 'When you take this, a random Jack, Queen or King gets a Gold sticker; your Gold-stickered cards are also wild.',
  upgrade: '…and Gold stickers pay double.',
  rules(r, ctx) {
    const gold = goldCards(ctx.stickers);
    if (gold.length) r.wildCards = [...new Set([...(r.wildCards || []), ...gold])];
  },
  setup(_board, ctx) {
    const gold = goldCards(ctx.stickers);
    if (gold.length) ctx.api.mark(gold, 'gold');
  },
  onPick(run, ctx) {
    const pool = cardsOfRanks([11, 12, 13]);
    const card = pool[Math.floor(ctx.rng() * pool.length)];
    ctx.api.addSticker(card, 'gold');
  },
  score(sb, ctx) {
    if (ctx.level < 2) return;
    const gold = new Set(goldCards(ctx.stickers));
    if (!gold.size || !sb.initial) return;
    const paid = new Set();
    replay(sb, (move, state) => {
      if (move.t !== 'F' || !gold.has(move.card) || paid.has(move.card)) return;
      if (52 - cardsHome(state) >= 13) {
        paid.add(move.card);
        sb.addCoins(`gilded.${move.card}`, 'Gilded Age · gold', 5, move.card);
      }
    });
  },
});

defineCharm({
  id: 'deco.challenge',
  kind: 'challenge',
  theme: 'deco',
  name: 'Dress Code',
  icon: '🎩',
  tags: ['COLUMN'],
  text: (s) => {
    const min = 6 + s;
    if (min >= 13) return 'Only a King (or a run starting with one) can go into an empty column. Empty columns don\'t raise your move capacity.';
    const names = ['', 'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];
    return `Only a ${names[min]} or higher (or a run starting with one) can go into an empty column. Empty columns don't raise your move capacity.`;
  },
  ease: (ctx) => -0.12 * ctx.strength,
  rules(r, ctx) {
    r.emptyMinRank = 6 + ctx.strength;
  },
});
