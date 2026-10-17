import { explainBlocked } from '../../js/voyage/blocked.js';
import { composeBoard } from '../../js/voyage/boardrules.js';

const plan = (fields) => ({ ...composeBoard(fields), seed: fields.seed ?? 0, idx: 0, levels: {}, stickers: {}, runMemo: {} });

export async function check({ assert, Rules }) {
  // Royal Decree: a court card can't take an open free cell.
  const decree = plan({ boss: 'boss.decree', strength: 7 });
  let game, col = -1;
  for (let n = 1; col < 0; n++) {
    game = new Rules.Game(n, { rules: decree.rules });
    col = game.tableau.findIndex((c) => Rules.rankOf(c.at(-1)) >= 11);
  }
  const card = game.tableau[col].at(-1);
  assert.equal(game.canDropFreeCell(0, card), false, 'decree blocks the court card');
  const hit = explainBlocked(game, decree, (p) => p.canDropFreeCell(0, card), { card, cell: 0 });
  assert.equal(hit?.id, 'boss.decree');
  assert.match(hit.reason, /free cell/);
  assert.match(hit.reason, /J, Q, K/);

  // A move that classic rules forbid too is not blamed on anything.
  const bad = game.tableau.findIndex((c, i) => i !== col && !Rules.canBuildOn(c.at(-1), card));
  assert.ok(bad >= 0);
  assert.equal(explainBlocked(game, decree, (p) => p.canDropTableau(bad, card, 1), { card, col: bad }), null, 'ordinary illegal move');

  // Classic boards and legal moves never explain.
  const free = game.tableau.findIndex((c) => Rules.rankOf(c.at(-1)) < 11);
  const ok = game.tableau[free].at(-1);
  assert.equal(explainBlocked(game, decree, (p) => p.canDropFreeCell(0, ok)), null, 'legal move');

  // Eclipse: the pre-phase court lock is named, not the later foundation spread.
  const eclipse = plan({ boss: 'boss.eclipse', strength: 7 });
  const eg = new Rules.Game(game.dealNumber, { rules: eclipse.rules });
  const eHit = explainBlocked(eg, eclipse, (p) => p.canDropFreeCell(0, card), { card, cell: 0 });
  assert.equal(eHit?.id, 'boss.eclipse');
  assert.match(eHit.reason, /free cell/);

  // Every challenge and boss explains without throwing on its own board.
  const { CHARMS } = await import('../../js/voyage/registry.js');
  for (const c of Object.values(CHARMS).filter((c) => c.kind !== 'boon' && !c.placeholder)) {
    const p = plan(c.kind === 'boss' ? { boss: c.id, strength: 7 } : { challenge: c.id, strength: 7 });
    const g = new Rules.Game(1, { rules: p.rules });
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const top = g.tableau[i].at(-1);
      if (!top) continue;
      const hit = explainBlocked(g, p, (q) => (i === j ? q.canDropFreeCell(0, top) : q.canDropTableau(j, top, 1)), { card: top, col: j, cell: 0 });
      if (hit) assert.ok(hit.reason && hit.name, `${c.id}: explanation has text`);
    }
  }
}
