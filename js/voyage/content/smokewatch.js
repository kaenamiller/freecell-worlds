// smokewatch: boons + challenge. Spec: docs/voyage/overhaul/ROSTER-52.md (theme `smokewatch`).
import { defineCharm } from '../registry.js';

defineCharm({
  id: 'smokewatch.report',
  kind: 'boon',
  theme: 'smokewatch',
  name: 'Smoke Report',
  icon: '📻',
  family: 'coin',
  text: 'Finish a board in under 6 minutes: +10 coins.',
  upgrade: 'Under 8 minutes.',
  score(sb, ctx) {
    const limit = ctx.level >= 2 ? 480 : 360;
    if (sb.elapsed < limit) sb.addCoins('report', 'Smoke Report', 10);
  },
});

defineCharm({
  id: 'smokewatch.sightline',
  kind: 'boon',
  theme: 'smokewatch',
  name: 'Sightline',
  icon: '🔭',
  family: 'columns',
  text: 'You can move 1 more card at once for each columns-family boon you hold (this one included).',
  upgrade: '2 more per boon.',
  ease: 0.15,
  rules(r, ctx) {
    const step = ctx.level >= 2 ? 2 : 1;
    r.moveBonus = (r.moveBonus || 0) + step * ctx.family('columns');
  },
});

defineCharm({
  id: 'smokewatch.relief',
  kind: 'boon',
  theme: 'smokewatch',
  name: 'Relief Pack',
  icon: '🎒',
  family: 'fortune',
  text: "You're offered one more charm after each board (up to 3).",
  upgrade: '…and ports stock one extra boon.',
  offers: (n) => n + 1,
  onPort(_run, ctx) {
    if (ctx.level >= 2) ctx.port.extraBoons = (ctx.port.extraBoons || 0) + 1;
  },
});

defineCharm({
  id: 'smokewatch.challenge',
  kind: 'challenge',
  theme: 'smokewatch',
  name: 'Fire Weather',
  icon: '🔥',
  tags: ['SCORE'],
  pressure: true,
  text: (s) => `Every 5 moves over par cost ${1 + Math.ceil(s / 2)} coins.`,
  score(sb, ctx) {
    const over = Math.max(0, sb.stat.moves - sb.par);
    const blocks = Math.floor(over / 5);
    const rate = 1 + Math.ceil(ctx.strength / 2);
    if (blocks) sb.addCoins('fireweather', 'Fire Weather', -blocks * rate);
  },
});
