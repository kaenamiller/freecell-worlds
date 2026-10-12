// deco: boons + challenge. Spec: docs/voyage/charms-design.md (theme `deco`).
import { defineCharm } from '../registry.js';
import { countHome, isCourt } from './kit.js';

defineCharm({
  id: 'deco.champagne',
  kind: 'boon',
  theme: 'deco',
  name: 'Champagne Tower',
  icon: '🥂',
  text: 'Chain points ×1.6.',
  score(sb) {
    sb.scale('chains', 1.6);
  },
});

defineCharm({
  id: 'deco.highroller',
  kind: 'boon',
  theme: 'deco',
  name: 'High Roller',
  icon: '🎰',
  text: 'Lose 2 undos now; every board scores ×1.2.',
  onPick(run) {
    run.undos = Math.max(0, run.undos - 2);
  },
  score(sb) {
    sb.mult('High Roller', 1.2);
  },
});

defineCharm({
  id: 'deco.gilded',
  kind: 'boon',
  theme: 'deco',
  name: 'Gilded Age',
  icon: '🎺',
  text: '+15 for every Jack, Queen and King sent home.',
  score(sb) {
    const courts = countHome(sb.history, isCourt);
    if (courts) sb.add('gilded', 'Gilded Age', courts * 15);
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
    if (min >= 13) return 'Empty columns only accept sequences headed by a King.';
    const names = ['', 'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];
    return `Empty columns only accept sequences headed by ${names[min]} or higher.`;
  },
  ease: (ctx) => -0.12 * ctx.strength,
  rules(r, ctx) {
    r.emptyMinRank = 6 + ctx.strength;
  },
});
