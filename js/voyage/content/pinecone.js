// pinecone: boons + challenge. Spec: docs/voyage/charms-design.md (theme `pinecone`).
import { defineCharm } from '../registry.js';
import { applyMove, cloneState } from '../../rules.js';

defineCharm({
  id: 'pinecone.badge',
  kind: 'boon',
  theme: 'pinecone',
  name: 'Merit Badge',
  icon: '🎖️',
  text: '+120 on any board where you place 3 or fewer cards in free cells.',
  score(sb) {
    if (sb.stat.freeCellPlacements <= 3) sb.add('badge', 'Merit badge', 120);
  },
});

defineCharm({
  id: 'pinecone.compass',
  kind: 'boon',
  theme: 'pinecone',
  name: 'Pocket Compass',
  icon: '🧭',
  text: 'Once per board, show the best next move.',
  ability: {
    uses: 1,
    label: 'Compass hint',
    use: (ctx) => ctx.api.hint(),
  },
});

defineCharm({
  id: 'pinecone.campfire',
  kind: 'boon',
  theme: 'pinecone',
  name: 'Campfire',
  icon: '🏕️',
  text: 'At the start of each board, +1 undo if you hold fewer than 3.',
  on: {
    start(ctx) {
      if (ctx.run.undos >= 3) return;
      ctx.api.addUndos(1);
    },
  },
});

defineCharm({
  id: 'pinecone.challenge',
  kind: 'challenge',
  theme: 'pinecone',
  name: 'Leave No Trace',
  icon: '🍂',
  tags: ['SCORE'],
  text: (s) => `Each move that fills your last empty free cell costs ${8 * s} points.`,
  score(sb, ctx) {
    const cost = 8 * ctx.strength;
    const state = cloneState(sb.initial);
    const rules = JSON.parse(JSON.stringify(sb.initialRules || sb.rules || {}));
    let penalty = 0;
    for (const move of sb.history) {
      if (move.auto) {
        applyMove(state, move, rules);
        continue;
      }
      const emptyBefore = state.free.filter((c) => !c).length;
      const toCell = move.t === 'C' || (move.t === 'R' && move.to?.kind === 'free');
      applyMove(state, move, rules);
      if (toCell && emptyBefore === 1) penalty += cost;
    }
    if (penalty) sb.add('trace', 'Leave No Trace', -penalty);
  },
});
