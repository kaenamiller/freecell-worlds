// jetset: boons + challenge. Spec: docs/voyage/overhaul/ROSTER.md (theme `jetset`).
import { defineCharm } from '../registry.js';
import { SCORE } from '../config.js';

const efficiencyPts = (moves, par) => Math.round(Math.max(0, SCORE.efficiencyMax * (2 - moves / par)));

defineCharm({
  id: 'jetset.priority',
  kind: 'boon',
  theme: 'jetset',
  name: 'Priority Boarding',
  icon: '🧳',
  family: 'fortune',
  text: 'Ports stock one extra boon, and your first reroll each visit is free.',
  upgrade: 'Two extra boons, and every reroll is free.',
  onPort(_run, ctx) {
    ctx.port.extraBoons += ctx.level === 2 ? 2 : 1;
    ctx.port.freeReroll = true;
  },
});

defineCharm({
  id: 'jetset.firstclass',
  kind: 'boon',
  theme: 'jetset',
  name: 'First Class',
  icon: '💺',
  family: 'cells',
  text: 'One extra free cell, but you gain 1 fewer undo after each board.',
  upgrade: 'One extra free cell, with no undo penalty after a 3★ board.',
  ease: 0.15,
  rules(r) { r.freeCells += 1; },
  boardUndos(grant, ctx) {
    if (ctx.level === 2 && ctx.stars >= 3) return grant;
    return grant - 1;
  },
});

defineCharm({
  id: 'jetset.flyer',
  kind: 'boon',
  theme: 'jetset',
  name: 'Frequent Flyer',
  icon: '✈️',
  family: 'coin',
  text: '+3 coins for each board cleared at or under par (+6 if also 3★).',
  upgrade: '+5 / +10.',
  coins(n, ctx) {
    if (ctx.sb.stat.moves > ctx.sb.par) return n;
    const base = ctx.level === 2 ? 5 : 3;
    const bonus = ctx.stars >= 3 ? base * 2 : base;
    return n + bonus;
  },
});

defineCharm({
  id: 'jetset.challenge',
  kind: 'challenge',
  theme: 'jetset',
  name: 'Layover',
  icon: '⏳',
  tags: ['SCORE'],
  pressure: true,
  text: (s) => `Finish within ${17 - s} minutes; each minute over costs 5% of the board score (up to 50%).`,
  score(sb, ctx) {
    const limit = (17 - ctx.strength) * 60;
    const overMin = Math.max(0, Math.ceil((sb.elapsed - limit) / 60));
    const pct = Math.min(0.5, overMin * 0.05);
    if (pct > 0) sb.add('layover', 'Layover delay', -Math.round(sb.subtotal * pct));
  },
});
