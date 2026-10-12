// Voyage tuning knobs. Everything a designer is likely to tweak lives here.
export const VOYAGE = {
  boards: 7,

  // Map: row 1 offers this many boards; each node then links to `branch` nodes in the next row.
  // The player can see the next `lookahead` rows.
  firstRowWidth: 3,
  rowWidth: 3,
  branch: 2,
  lookahead: 2,

  // Shared undo budget for the whole run.
  startUndos: 5,
  undosPerBoard: 3,
  finaleUndos: 2,

  // Free cells: the engine and layout support 1..6.
  baseFreeCells: 4,
  minFreeCells: 1,
  maxFreeCells: 6,

  // Board k is dealt from difficulty tier k; challenge strength is k too.
  tierForBoard: (k) => k,
  strengthForBoard: (k) => k,

  // How much of a charm's difficulty ease the dealer cancels by picking a harder deal.
  // 1 = charms are fully offset (difficulty stays on the curve), 0 = charms are pure power.
  compensation: 0.6,

  // Background rating: fraction of wall time the rating worker may be busy. The main thread
  // schedules jobs and rests between them, and pauses entirely while cards are moving.
  dutyCycle: { lowEnd: 0.35, normal: 0.6 },
  lowEndCores: 4,
};

// Scoring (see scoring.js). Moves are compared with the deal's par from the seed bank.
export const SCORE = {
  cardPoints: 10, // per card sent home (520 for a full board)
  efficiencyMax: 600, // at par; scales linearly to 0 at 2x par, and above 600 under par
  parFactor: 1.6, // par = the bank's near-best solver move count (~38 player moves) x this; tune by playtest
  freeCellBudget: 400, // starts here, loses `freeCellCost` per card placed in a free cell
  freeCellCost: 20,
  chainUnit: 8, // a chain of n cards home in a row scores chainUnit * n * (n - 1) / 2
  chainCap: 10, // longest chain length that counts (the endgame sweep would dominate otherwise)
  // Star thresholds as fractions of the score a "par game" earns (see scoring.parScore).
  stars: [0, 0.9, 1.15],
  bossStarScale: 0.92,
};
