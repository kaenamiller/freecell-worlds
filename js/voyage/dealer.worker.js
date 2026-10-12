// Background solver checks for the Voyage dealer: is deal N winnable under these board rules?
import { deal, solve } from '../rules.js';

self.onmessage = (e) => {
  const { id, deal: n, rules, options } = e.data || {};
  try {
    const st = deal(n, rules);
    const r = solve(st, { timeLimitMs: 6000, fullOnly: false, ...options, rules });
    self.postMessage({ id, result: { solvable: r.solvable, elapsedMs: r.elapsedMs, nodes: r.nodes, moves: r.solution?.length } });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
