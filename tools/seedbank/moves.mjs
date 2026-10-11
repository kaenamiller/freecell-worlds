#!/usr/bin/env node
// Resumable par-count pass over the live Voyage ratings JSONL.
// Usage: node tools/seedbank/moves.mjs [--limit 50] [--workers 6]
//        [--budget-ms 8000] [--nodes 180000] [--beam 500] [--retry-failed] [--variant 1]
//        [--compare 30 --budget-ms 30000 --nodes 750000 --beam 1000 --improve]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { deal } from '../../js/rules.js';
import { shortSolve } from '../../js/shortsolve.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(HERE, 'ratings.jsonl');
const OUTPUT = path.join(HERE, 'moves.jsonl');

if (!isMainThread) {
  parentPort.on('message', ({ d, opts }) => {
    try {
      const started = Date.now();
      const result = shortSolve(deal(d), opts);
      parentPort.postMessage({ d, row: {
        d, moves: result?.moves ?? null, manualMoves: result?.manualMoves ?? null,
        method: result?.method ?? 'unsolved', elapsedMs: result?.elapsedMs ?? Date.now() - started,
      } });
    } catch (error) {
      parentPort.postMessage({ d, error: String(error?.stack ?? error) });
    }
  });
} else {
  function flag(name, fallback) {
    const i = process.argv.indexOf(name);
    if (i < 0) return fallback;
    const n = Number(process.argv[i + 1]);
    if (!Number.isFinite(n) || n < 1) throw new Error(`${name} requires a positive number`);
    return Math.floor(n);
  }
  function readRows(file) {
    if (!fs.existsSync(file)) return [];
    const rows = [];
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { rows.push(JSON.parse(line)); } catch { /* interrupted final line */ }
    }
    return rows;
  }
  const workers = flag('--workers', 6);
  const limit = flag('--limit', Number.MAX_SAFE_INTEGER);
  const compare = flag('--compare', 0);
  const opts = {
    budgetMs: flag('--budget-ms', 8000),
    nodeLimit: flag('--nodes', 180000),
    beamWidth: flag('--beam', 500),
    variantOffset: flag('--variant', 0),
  };
  if (process.argv.includes('--improve')) opts.improve = true;
  const retryFailed = process.argv.includes('--retry-failed');
  const bankable = [...new Set(readRows(INPUT).filter((r) => r.bankable === true && Number.isInteger(r.d)).map((r) => r.d))];
  const existing = new Map(readRows(OUTPUT).map((r) => [r.d, r]));
  // A killed process can leave a partial final line. Separate it from the
  // next checkpoint so all subsequent JSONL records remain readable.
  if (!compare && fs.existsSync(OUTPUT) && fs.statSync(OUTPUT).size > 0) {
    const fd = fs.openSync(OUTPUT, 'r');
    const last = Buffer.alloc(1);
    fs.readSync(fd, last, 0, 1, fs.statSync(OUTPUT).size - 1);
    fs.closeSync(fd);
    if (last[0] !== 10) fs.appendFileSync(OUTPUT, '\n');
  }
  const references = bankable.filter((d) => existing.get(d)?.moves !== null && existing.has(d));
  const todo = compare
    ? Array.from({ length: Math.min(compare, references.length) }, (_, i) => references[Math.floor(i * references.length / Math.min(compare, references.length))])
    : bankable.filter((d) => !existing.has(d) || retryFailed && existing.get(d).moves === null).slice(0, limit);
  console.log(`Bankable snapshot: ${bankable.length}; stored: ${existing.size}; ${compare ? 'reference sample' : 'pending'}: ${todo.length}; workers: ${workers}`);
  if (!todo.length) process.exit(0);
  const pool = [];
  let next = 0, completed = 0, solved = 0, stopping = false;
  const gaps = [];
  const started = Date.now();
  function done() {
    if (completed !== todo.length) return;
    for (const w of pool) w.terminate();
    if (retryFailed && !compare) {
      // Retried deals append a new checkpoint; collapse superseded records
      // only after every worker has finished, using an atomic replacement.
      const latest = new Map(readRows(OUTPUT).map((row) => [row.d, row]));
      const tmp = `${OUTPUT}.tmp`;
      fs.writeFileSync(tmp, [...latest.values()].map((row) => JSON.stringify(row)).join('\n') + '\n');
      fs.renameSync(tmp, OUTPUT);
    }
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\nComplete: ${solved}/${completed} solved, ${seconds}s wall time`);
    if (compare) {
      const sorted = gaps.sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      console.log(`Reference comparison: ${gaps.length} pairs; baseline minus long-search manual moves min ${sorted[0]}, median ${median}, max ${sorted.at(-1)}; improved ${gaps.filter((x) => x > 0).length}`);
    }
  }
  function dispatch(w) {
    if (stopping || next >= todo.length) return;
    const d = todo[next++];
    w.currentDeal = d;
    w.postMessage({ d, opts });
  }
  const count = Math.min(workers, todo.length);
  for (let i = 0; i < count; i++) {
    const w = new Worker(new URL(import.meta.url));
    pool.push(w);
    w.on('message', ({ d, row, error }) => {
      if (error) {
        console.error(`\nDeal ${d}: ${error}`);
        stopping = true;
        process.exitCode = 1;
        for (const worker of pool) worker.terminate();
        return;
      }
      if (compare) {
        if (row.moves !== null) gaps.push(existing.get(d).manualMoves - row.manualMoves);
      } else {
        fs.appendFileSync(OUTPUT, JSON.stringify(row) + '\n');
        existing.set(d, row);
      }
      completed++;
      if (row.moves !== null) solved++;
      if (completed % 25 === 0 || completed === todo.length) {
        process.stdout.write(`\r${completed}/${todo.length}, solved ${solved}, wall ${((Date.now() - started) / 1000).toFixed(1)}s  `);
      }
      dispatch(w);
      done();
    });
    w.on('error', (error) => {
      console.error(`\nWorker on deal ${w.currentDeal}:`, error);
      stopping = true;
      process.exitCode = 1;
      for (const worker of pool) worker.terminate();
    });
    w.on('exit', (code) => {
      if (!stopping && completed < todo.length && code !== 0) {
        console.error(`\nWorker exited ${code} on deal ${w.currentDeal}`);
        stopping = true;
        process.exitCode = 1;
        for (const worker of pool) worker.terminate();
      }
    });
    dispatch(w);
  }
}
