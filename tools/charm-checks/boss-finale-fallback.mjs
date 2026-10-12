// The finale must always deal a verified board: when no deal verifies under the boss, the dealer
// eases the theme challenge, drops it, and as a last resort lets the boss relent.
import { readFileSync } from 'node:fs';

export async function check({ assert }) {
  const root = new URL('../../', import.meta.url);
  const dealer = await import(new URL('js/voyage/dealer.js', root));
  const { createRun, boardPlan } = await import(new URL('js/voyage/run.js', root));
  dealer.setBank(JSON.parse(readFileSync(new URL('assets/data/seedbank.json', root))));
  const run = createRun({ seed: 'finale-fallback' });
  run.boss = 'boss.barren';
  let underBoss = 0;
  const failUnderBoss = async (deal, rules) => (rules.barren ? (underBoss++, { solvable: false }) : { solvable: true });
  const warn = console.warn;
  console.warn = () => {};
  try {
    const pick = await dealer.dealFor(boardPlan(run, 'aero', { idx: 6 }), { seed: run.seed, verifier: failUnderBoss, timeLimitMs: 1 });
    assert.equal(pick.bossRelented, true, 'boss relents when nothing verifies under it');
    assert.equal(pick.verified, true, 'relented finale is still verified');
    assert.ok(!pick.rules.barren, 'relented finale drops the boss rule');
    assert.ok(underBoss >= 16 && underBoss % 8 === 0, 'each rung under the boss tried 8 candidates');
    const kept = await dealer.dealFor(boardPlan(run, 'zen', { idx: 6 }), { seed: run.seed, verifier: async () => ({ solvable: true }), timeLimitMs: 1 });
    assert.equal(!!kept.bossRelented, false, 'boss stays when a deal verifies');
  } finally {
    console.warn = warn;
  }
}
