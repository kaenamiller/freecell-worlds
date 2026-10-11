// Background solver checks for the Voyage dealer: is deal N winnable under these board rules?
import { deal, solve } from '../rules.js';

self.onmessage = (e) => {
  const { id, deal: n, rules, options } = e.data || {};
  try {
    const st = deal(n, rules?.freeCells ?? 4);
    const r = solve(st, { timeLimitMs: 6000, ...options });
    self.postMessage({ id, result: { solvable: r.solvable, elapsedMs: r.elapsedMs } });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
