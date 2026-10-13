import { defineCharm } from '../../registry.js';
import { registerOverrideDrop, overrideTargets, useOverrideDrop } from './concrete.spraytag.js';

const flags = { ignoreCap: true };
registerOverrideDrop('deepsea.current', flags);
defineCharm({
  id: 'deepsea.current', kind: 'boon', theme: 'deepsea', name: 'Current', icon: '🌊', ease: 0.3,
  family: 'ability',
  upgrade: 'Twice per board, move a valid sequence of any length in one go.',
  text: 'Once per board, move a valid sequence of any length in one go.',
  ability: {
    uses: ({ level }) => level === 2 ? 2 : 1, label: 'Ride the current',
    available: (ctx) => overrideTargets(ctx, flags, false, true).length > 0,
    use: (ctx) => useOverrideDrop(ctx, 'deepsea.current', flags, false, true),
  },
});
