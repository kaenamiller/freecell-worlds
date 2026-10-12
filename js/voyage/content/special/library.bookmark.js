import { defineCharm } from '../../registry.js';
import { registerCustomMove, generateMoves } from '../../../rules.js';

const op = 'library.bookmark';
registerCustomMove(op, {
  apply(st, m) {
    if (!Number.isInteger(m.token) || m.token < 1) throw new Error('Invalid bookmark');
  },
  undo() {},
});
const anchorIndex = ({ api, memo }) => memo.anchor == null ? -1 : api.history.findIndex((m) => m.t === 'X' && m.op === op && m.token === memo.anchor);

defineCharm({
  id: op, kind: 'boon', theme: 'library', name: 'Bookmark', icon: '🔖', ease: 0,
  text: 'Once per board, set a bookmark, then rewind every move since it for a single undo.',
  ability: {
    uses: 1, label: 'Set / rewind bookmark',
    available(ctx) {
      if (ctx.run.undos <= 0) return false;
      const at = anchorIndex(ctx);
      return at < 0 ? generateMoves(ctx.api.state, { rules: ctx.api.rules }).length > 0
        : ctx.api.history.length > at + 1;
    },
    use(ctx) {
      const { api, memo } = ctx;
      const at = anchorIndex(ctx);
      if (at < 0) {
        const token = (memo.serial || 0) + 1;
        if (!api.charmMove(op, { token })) return false;
        memo.serial = token; memo.anchor = token;
        api.badge('SET'); api.notify('Bookmark set — tap again after playing to rewind');
        // Setting arms the same use; only the later rewind spends it.
        return false;
      }
      const count = api.history.length - at - 1;
      if (!count || !api.rewind(count)) return false;
      memo.anchor = null; api.badge('');
      api.notify(`Bookmark: rewound ${count} ${count === 1 ? 'move' : 'moves'} for one undo`);
      return true;
    },
  },
  on: {
    undo(ctx) {
      if (ctx.memo.anchor != null && anchorIndex(ctx) < 0) { ctx.memo.anchor = null; ctx.api.badge(''); }
    },
  },
});
