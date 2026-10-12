import { defineCharm } from '../../registry.js';
import { registerOverrideDrop, overrideTargets, useOverrideDrop } from './concrete.spraytag.js';

const flags = { ignoreCap: true };
registerOverrideDrop('canopy.zipline', flags);
defineCharm({
  id: 'canopy.zipline', kind: 'boon', theme: 'canopy', name: 'Zip Line', icon: '🪢', ease: 0.3,
  text: 'Once per board, move a valid sequence of any length in one go.',
  ability: {
    uses: 1, label: 'Zip a sequence',
    available: (ctx) => overrideTargets(ctx, flags, false, true).length > 0,
    use: (ctx) => useOverrideDrop(ctx, 'canopy.zipline', flags, false, true),
  },
});
