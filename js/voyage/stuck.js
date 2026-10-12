// When a Voyage board should be checked for a dead end.
// A shuffle is a handful of tableau or free-cell moves and no foundation play: the card can
// be moved, but only in a loop. Wider positions are left until the player has been still.

export const VOYAGE_STUCK_SETTLE_MS = 900;
export const VOYAGE_STUCK_PROOF_MS = 5000;
export const VOYAGE_STUCK_IDLE_MS = 8000;
export const VOYAGE_STUCK_SHUFFLE_MAX = 4;

export function voyageShuffleTrap(moves) {
  return moves.length > 0
    && moves.length <= VOYAGE_STUCK_SHUFFLE_MAX
    && moves.every((m) => m.t === 'T' || m.t === 'C');
}

// 'warn' — no legal move, undos remain, tell the player.
// 'lose' — no legal move and no undos, end the run.
// 'idle' — moves remain and the position is still open; prove only after the player sits still.
// 'prove' — closed shuffle, or no undos left; ask the solver now.
export function voyageStuckPlan(moves, undos) {
  if (!moves.length) return undos > 0 ? 'warn' : 'lose';
  if (undos > 0 && !voyageShuffleTrap(moves)) return 'idle';
  return 'prove';
}
