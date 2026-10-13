import { defineCharm } from '../../registry.js';
import { overrideTargets, registerOverrideDrop, useOverrideDrop } from './concrete.spraytag.js';

const flags = { ignoreRank: true };
registerOverrideDrop('toybox.jackinbox', flags);
defineCharm({
  id: 'toybox.jackinbox', kind: 'boon', theme: 'toybox', name: 'Jack-in-the-Box', icon: '🎁', ease: 0.3,
  family: 'ability',
  upgrade: 'Twice per board, your next drop ignores rank while the colour rule still applies.',
  text: 'Once per board, your next drop ignores rank while the colour rule still applies.',
  ability: {
    uses: ({ level }) => level === 2 ? 2 : 1, label: 'Pop a drop',
    available: (ctx) => overrideTargets(ctx, flags).length > 0,
    use: (ctx) => useOverrideDrop(ctx, 'toybox.jackinbox', flags, false, false, 'Jack-in-the-Box'),
  },
});
