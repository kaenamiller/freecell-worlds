import { defineCharm } from '../../registry.js';
import { overrideTargets } from './concrete.spraytag.js';

const flags = { rankGap: 2 };
defineCharm({
  id: 'winterglass.icicle', kind: 'boon', theme: 'winterglass', name: 'Icicle', icon: '🧊', family: 'ability', ease: 0.2,
  text: 'Once per board, your next drop may land on a card two ranks higher, while the colour rule still applies.',
  upgrade: 'Twice per board, your next drop may land on a card two ranks higher, while the colour rule still applies.',
  ability: {
    uses: (ctx) => ctx.level >= 2 ? 2 : 1, label: 'Arm a two-rank drop',
    available: (ctx) => overrideTargets(ctx, flags).length > 0,
    use(ctx) {
      if (!ctx.api.override(flags)) return false;
      ctx.api.notify('Icicle armed: your next drop may bridge two ranks.');
      return true;
    },
  },
});
