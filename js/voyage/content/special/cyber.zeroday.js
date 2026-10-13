import { defineCharm } from '../../registry.js';
import { cellAccepts } from '../../../rules.js';
import { overrideTargets } from './concrete.spraytag.js';

const flags = { ignoreRestrictions: true };
const available = (ctx) => overrideTargets(ctx, flags).length > 0 || !!ctx.api.state?.tableau?.some((col) => {
  const card = col.at(-1);
  return card && !(ctx.api.concealed || []).includes(card) && ctx.api.state.free.some((_, i) => cellAccepts(ctx.api.state, i, card, ctx.api.rules, 0, flags));
});

defineCharm({
  id: 'cyber.zeroday', kind: 'boon', theme: 'cyber', name: 'Zero-Day', icon: '🔓', family: 'ability', ease: 0.3,
  text: 'Once per board, your next placement ignores every challenge and boss restriction, while rank and colour still apply.',
  upgrade: 'Twice per board, your next placement ignores every challenge and boss restriction, while rank and colour still apply.',
  ability: {
    uses: (ctx) => ctx.level >= 2 ? 2 : 1, label: 'Unlock the next placement', available,
    use(ctx) {
      if (!ctx.api.override(flags)) return false;
      ctx.api.notify('Zero-Day armed: your next placement ignores restrictions.');
      return true;
    },
  },
});
