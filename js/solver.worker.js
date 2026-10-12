// Web Worker wrapper around the FreeCell solvability search.
import { solve } from './rules.js';

self.onmessage = (e) => {
  const { id, state, options, rules } = e.data || {};
  if (!state) return;
  try {
    const result = solve(state, { ...options, rules: rules ?? options?.rules });
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) });
  }
};
