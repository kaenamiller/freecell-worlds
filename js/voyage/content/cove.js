// cove: boons + challenge. Spec: docs/voyage/charms-design.md (theme `cove`).
import { defineCharm } from '../registry.js';
import { countHome, replay } from './kit.js';

defineCharm({
  id: 'cove.treasure',
  kind: 'boon',
  theme: 'cove',
  name: 'Buried Treasure',
  icon: '💰',
  family: 'coin',
  text: 'The deepest card of one column is treasure: 15 coins if it goes home before 30 cards are home.',
  upgrade: 'Two columns hold treasure; each pays 15 coins if it goes home before 30 cards are home.',
  setup(board, ctx) {
    const cols = board.state.tableau
      .map((col, i) => (col.length ? { i, card: col[0] } : null))
      .filter(Boolean);
    const count = ctx.level >= 2 ? 2 : 1;
    const picks = ctx.rng.shuffle(cols).slice(0, Math.min(count, cols.length));
    ctx.memo.treasure = picks.map((p) => p.card);
    ctx.api.mark(ctx.memo.treasure, 'gold');
  },
  score(sb, ctx) {
    const ids = ctx.memo.treasure || [];
    if (!ids.length) return;
    let homes = 0;
    let paid = 0;
    replay(sb, (m) => {
      if (m.t !== 'F') return;
      homes++;
      if (homes < 30 && ids.includes(m.card)) { paid++; sb.cardBonus?.('treasure', m.card, 15); }
    });
    if (paid) sb.addCoins('treasure', 'Buried treasure', paid * 15);
  },
});

defineCharm({
  id: 'cove.keg',
  kind: 'boon',
  theme: 'cove',
  name: 'Lucky Doubloon',
  icon: '🪙',
  family: 'undo',
  text: 'Once per board, take back your last move without spending an undo.',
  upgrade: 'Twice per board, take back your last move without spending an undo.',
  ease: 0,
  ability: {
    uses: (ctx) => ctx.level,
    label: 'Flip the doubloon',
    available: (ctx) => ctx.api.history.some((m) => !m.auto),
    use(ctx) {
      const h = ctx.api.history;
      let i = h.length - 1;
      while (i >= 0 && h[i].auto) i--;
      if (i < 0) return false;
      ctx.api.addUndos(1);
      if (!ctx.api.rewind(h.length - i)) {
        ctx.api.spendUndos(1);
        return false;
      }
      ctx.api.notify('Lucky Doubloon: move taken back for free');
      return true;
    },
  },
});

defineCharm({
  id: 'cove.parrot',
  kind: 'boon',
  theme: 'cove',
  name: 'Parrot',
  icon: '🦜',
  family: 'ability',
  text: 'Once per board, repeat yourself: your most recently used ability gets one more use.',
  upgrade: 'Twice per board, repeat yourself: your most recently used ability gets one more use.',
  ease: 0.15,
  on: {
    ability(ctx, { id }) {
      if (id !== 'cove.parrot') ctx.memo.lastAbility = id;
    },
  },
  ability: {
    uses: (ctx) => ctx.level,
    label: 'Parrot',
    available: (ctx) => !!ctx.memo.lastAbility,
    use(ctx) {
      const id = ctx.memo.lastAbility;
      if (!id) return false;
      return ctx.api.grantUse(id, 1) > 0;
    },
  },
});

defineCharm({
  id: 'cove.challenge',
  kind: 'challenge',
  theme: 'cove',
  name: 'Cursed Gold',
  icon: '🪙',
  tags: ['SCORE'],
  pressure: true,
  text: (s) => `${1 + s} cursed cards; each time one enters a free cell, lose 2 coins.`,
  ease: (ctx) => -0.05 * ctx.strength,
  setup(board, ctx) {
    const pool = [];
    for (const col of board.state.tableau) pool.push(...col);
    for (const card of board.state.free) if (card) pool.push(card);
    const n = 1 + ctx.strength;
    ctx.memo.cursed = ctx.rng.shuffle(pool).slice(0, n);
    ctx.api.mark(ctx.memo.cursed, 'curse');
  },
  score(sb, ctx) {
    const cursed = new Set(ctx.memo.cursed || []);
    let penalty = 0;
    replay(sb, (move, _state, _index, rules) => {
      if (rules.cleansedCards?.includes(move.card)) return;
      if (move.t === 'C' && cursed.has(move.card)) penalty += 2;
      if (move.t === 'R' && move.to?.kind === 'free' && cursed.has(move.card)) penalty += 2;
    });
    if (penalty) sb.addCoins('curse', 'Cursed gold', -penalty);
  },
});
