import { defineCharm } from '../../registry.js';
import { registerOverrideDrop, overrideTargets, useOverrideDrop } from './concrete.spraytag.js';

const flags = { ignoreRank: true, ignoreColour: true };
registerOverrideDrop('theater.understudy', flags, true);
defineCharm({
  id: 'theater.understudy', kind: 'boon', theme: 'theater', name: 'Understudy', icon: '🎭', ease: 0.3,
  text: 'Once per board, place a free-cell card on any column, ignoring rank and colour.',
  ability: {
    uses: 1, label: 'Cast a free-cell card',
    available: (ctx) => overrideTargets(ctx, flags, true).length > 0,
    use: (ctx) => useOverrideDrop(ctx, 'theater.understudy', flags, true),
  },
});
