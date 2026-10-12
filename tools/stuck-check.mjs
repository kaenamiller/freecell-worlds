// Voyage dead-end planning, plus a column ping-pong the solver can prove unwinnable.
import assert from 'node:assert/strict';
import { cardId, generateMoves, solve } from '../js/rules.js';
import { voyageShuffleTrap, voyageStuckPlan } from '../js/voyage/stuck.js';

const T = (n) => Array.from({ length: n }, () => ({ t: 'T' }));
const C = { t: 'C' };
const F = { t: 'F' };

assert.equal(voyageStuckPlan([], 2), 'warn');
assert.equal(voyageStuckPlan([], 0), 'lose');
assert.equal(voyageStuckPlan(T(1), 3), 'prove');
assert.equal(voyageStuckPlan([...T(3), C], 1), 'prove');
assert.equal(voyageStuckPlan(T(5), 1), 'idle');
assert.equal(voyageStuckPlan([F], 4), 'idle');
assert.equal(voyageStuckPlan([F, ...T(2)], 0), 'prove');
assert.equal(voyageShuffleTrap([F]), false);
assert.equal(voyageShuffleTrap(T(4)), true);

// Diamond 5 sits on the club 6 and can move only onto the spade 6, then back.
// Every other card is buried or has nowhere to go, so the reachable graph is that loop.
const id = (suit, rank) => cardId(suit, rank);
const pingpong = {
  free: [id(0, 13), id(1, 13), id(2, 13), id(3, 13)],
  found: [0, 0, 0, 0],
  tableau: [
    [id(0, 6), id(1, 5)],
    [id(3, 6)],
    [id(0, 5)],
    [id(3, 5)],
    [id(0, 9)],
    [id(1, 9)],
    [id(2, 9)],
    [id(3, 9)],
  ],
};

const moves = generateMoves(pingpong);
assert.equal(moves.length, 1, `expected a single shuffle, got ${moves.length}: ${JSON.stringify(moves)}`);
assert.equal(voyageStuckPlan(moves, 2), 'prove');
const proved = solve(pingpong, { timeLimitMs: 5000, fullOnly: false });
assert.equal(proved.solvable, false, `solver did not prove the ping-pong dead (${proved.solvable}, ${proved.nodes} nodes)`);

console.log(`PASS: stuck plan and ping-pong proof (${proved.nodes} nodes, ${proved.elapsedMs} ms)`);
