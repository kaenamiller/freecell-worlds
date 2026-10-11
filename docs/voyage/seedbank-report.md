# Voyage seed bank report

Generated: 2026-10-11T07:11:20.680Z

## Summary

- Rated deals in JSONL: **5601**
- Structurally bankable (minCells known): **4523**
- With trusted manualMoves (short solver / moves.jsonl): **4523**
- Moves unknown (fallback or pending moves pass): **0**
- moves.jsonl entries loaded: **4524**
- Target bank size: **5000** (shipped: **4523**)
- Excluded from bank (no short solution): **159913**
- Legacy ratings with minCells but `bankable: false`: **156** (early pipeline required inline manualMoves; minCells-only bankable came later)
- Workers: 12, per-deal budget: 11000 ms

## Score formula

```
score = minCells×42 + manualMoves×2.985 + bury×1.273
```
Target variance shares: minCells **60%**, bury **30%**, manualMoves **10%** (minCells weight fixed for charm shifts).

Calibrated term SDs: mc=39.2, bury=27.7, moves=16.0
Achieved variance shares: mc=60.0%, bury=30.0%, moves=10.0%

Production tier cuts use **score**. Cuts: 283.21, 315.39, 339.84, 362.67, 387.92, 419.45

## minCells distribution by tier

| tier | n | mc=0 | mc=1 | mc=2 | mc=3 | mc=4 | dominant mc |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 646 | 4 | 335 | 294 | 13 | 0 | 1 (52%) |
| 2 | 646 | 0 | 98 | 483 | 64 | 1 | 2 (75%) |
| 3 | 646 | 0 | 35 | 389 | 212 | 10 | 2 (60%) |
| 4 | 646 | 0 | 8 | 266 | 346 | 26 | 3 (54%) |
| 5 | 646 | 0 | 3 | 121 | 391 | 131 | 3 (61%) |
| 6 | 646 | 0 | 0 | 37 | 325 | 284 | 3 (50%) |
| 7 | 647 | 0 | 0 | 2 | 130 | 515 | 4 (80%) |

## Metric distributions (trusted manualMoves only, n=4523)

| metric | min | p10 | median | p90 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| manualMoves | 21.0 | 31.0 | 38.0 | 45.0 | 61.0 |
| bury | 28.1 | 71.3 | 98.5 | 128.0 | 171.7 |
| minCells | 0.0 | 1.0 | 3.0 | 4.0 | 4.0 |
| score_full | 167.0 | 271.2 | 351.2 | 431.0 | 530.3 |

## Correlations (Pearson r, trusted moves only)

- minCells vs manualMoves: **0.247**
- bury vs manualMoves: **0.402**
- minCells vs bury: **0.222**
- score_full vs manualMoves: **0.605**

## Tier sizes

- Tier 1: **646** deals
- Tier 2: **646** deals
- Tier 3: **646** deals
- Tier 4: **646** deals
- Tier 5: **646** deals
- Tier 6: **646** deals
- Tier 7: **647** deals

## Move-count deviation by tier (score_full tiers)

| tier | n | min | p10 | median | p90 | max |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 646 | 21 | 27 | 33 | 38 | 46 |
| 2 | 646 | 24 | 30 | 35 | 41 | 46 |
| 3 | 646 | 26 | 32 | 37 | 43 | 51 |
| 4 | 646 | 25 | 33 | 38 | 43 | 53 |
| 5 | 646 | 27 | 34 | 39 | 45 | 58 |
| 6 | 646 | 30 | 35 | 40 | 46 | 57 |
| 7 | 647 | 31 | 37 | 43 | 49 | 61 |

## Variance decomposition (manualMoves)

- Total variance: 28.8
- Between-tier variance: 9.8 (34%)
- Mean within-tier variance: 19.0

## Par & star thresholds (merged manualMoves)

**Recommendation:** per-deal par = `round(manualMoves × 1.08)` (solver baseline + ~8% human slack). Spread within tiers is small (~±15%), so per-deal par beats a single per-tier constant.

| tier | n | mm min | p10 | median | p90 | max | stdev | CV% |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 646 | 21 | 27 | 33 | 38 | 46 | 4.3 | 12.9 |
| 2 | 646 | 24 | 30 | 35 | 41 | 46 | 4.0 | 11.6 |
| 3 | 646 | 26 | 32 | 37 | 43 | 51 | 4.2 | 11.4 |
| 4 | 646 | 25 | 33 | 38 | 43 | 53 | 4.2 | 11.2 |
| 5 | 646 | 27 | 34 | 39 | 45 | 58 | 4.3 | 11.1 |
| 6 | 646 | 30 | 35 | 40 | 46 | 57 | 4.6 | 11.5 |
| 7 | 647 | 31 | 37 | 43 | 49 | 61 | 4.7 | 11.0 |

| tier | par (×factor median) | 3★ ≤ | 2★ ≤ | 1★ ≤ |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 36 | 29 | 36 | 41 |
| 2 | 38 | 32 | 38 | 44 |
| 3 | 40 | 35 | 40 | 46 |
| 4 | 41 | 36 | 41 | 46 |
| 5 | 42 | 37 | 42 | 49 |
| 6 | 43 | 38 | 43 | 50 |
| 7 | 46 | 40 | 46 | 53 |

Per-deal: `par = round(m × 1.08)`; 3★ ≤ 0.92×par, 2★ ≤ par, 1★ ≤ 1.12×par (tune in game).

## Runtime

- mean rateState: **6715 ms**
- p90: **9602 ms**
- Re-rating in-game (charms changing free-cell count) should budget **~12–15 s** per deal with similar opts, or reuse bank fields when cell count matches.

## Caveats

- `minCells` uses the existing DFS `solve()` with `fullOnly` pruning; `false` is not a proof of unsolvability, and `null` deals are rejected.
- Inline `rateState` short A* often fails; long DFS fallback paths (100–260+ moves) are **not** used for tiers or par — see `tools/seedbank/moves.jsonl` from the dedicated short-solution pass.
- Human difficulty correlates with but is not identical to automated metrics (foresight, undo, table layout).
- Bury is deal-static and does not capture mid-game congestion.

## rules.js changes (not applied — for parent thread)

- Export `safeToFoundation` (or mark auto-F in solver paths) so solver and difficulty module share one definition.
- Optional: `solve()` option to return only non-auto moves for benchmarking.
- For charm modes with >4 free cells, ensure `deal()` / state cloning accepts arbitrary `free.length` in all move generators (already uses `st.free.length` in most paths; verify `generateMoves` empty-free loop).
