# Brief K1 — Voyage rules kernel (solver-visible charm rules)

You are building the **rules kernel** for Voyage charms in FreeCell Worlds (repo: this checkout).
Read first, in order:
1. `docs/voyage/charms-design.md` — the whole doc; your spec is **§1, §2 and §4**. Skim §5 to see how content will use your primitives.
2. `docs/voyage/boss-challenges.md` §0 (solver/dealer ground rules).
3. `js/rules.js`, `js/voyage/boardrules.js`, `js/voyage/dealer.js`, `js/voyage/dealer.worker.js`, `js/solver.worker.js`, `js/shortsolve.js`, `js/difficulty.js`, and the `dealGame` / drag-drop / auto-play / hint / `voyageCheckStuck` parts of `js/main.js`.

## Deliverables
- Every `BoardRules` field in §2.1, honoured consistently by move generation, the solver (incl. `hashState` where state is needed, e.g. sealed columns), `Game` legality, sequence/run detection, safe auto-play, hints, the dealer worker and the stuck check. Classic mode behaviour must be **byte-for-byte unchanged** (defaults are neutral; keep the solver fast — avoid per-move object allocation in hot paths; precompute masks).
- `game.rules`, `game.override` and custom `t:'X'` moves with `registerCustomMove` (§2.2). `Game` constructor takes `{ freeCells, rules }`.
- `foundationReturn` move type `'R'` end to end, including the player-side drag from a foundation pile in `main.js` (drag the top foundation card onto a column / free cell when the rule is on).
- `composeBoard` ctx with seeded `rng`, `seed`, `idx`; `dealShift`; full `rulesKey` (§2.3). Update `run.js` `boardPlan`/`upcomingPlans` minimally to pass `seed` and key on the full rules (coordinate: `run.js` is owned by K2 — make only those two small edits, re-reading the file immediately before each edit).
- Dealer verification loop and strength fallback (§2.4); `deal(n, rules)` with `startHome`.
- Table visuals in `js/table.js` (§2.6), driven from `game.rules` + state, refreshed after moves/undo.
- `tools/rules-check.mjs`: a Node test script (no browser) with focused assertions per primitive (legal/illegal move examples, apply/undo round-trips incl. sealed bits and 'R'/'X' moves, auto-play safety spot checks, classic solver results identical on ~30 deals vs. before your change — capture the "before" numbers first).
- `tools/charm-calibrate.mjs` + the measured ease table written into `docs/voyage/charms-design.md` §2.5 (keep the run under ~10 minutes; ~150 deals is fine).

## Ownership and coordination
You own exactly the files listed in §2 "Files owned". Another agent (K2, runtime kernel) is working **at the same time in the same checkout** on `js/voyage/charms.js`, `scoring.js`, `run.js`, `ui.js`, `card.js`, `css/voyage.css` and the Voyage section of `js/main.js`. In `js/main.js` you edit only the regions named in §2; re-read the region immediately before each edit, make small targeted edits, never reformat or rewrite the file. Do not touch `js/voyage/content/**` (content agents come later). Never run `git checkout/stash/reset/clean`, never commit. If you need something from K2's side, write it under "Requests to K2" at the bottom of `docs/voyage/charms-build-log.md` (create it if missing; append only).

If you need a server use port **8131** (`node serve.mjs 8131`). Headless Chrome is at `/usr/bin/google-chrome`; puppeteer-core is resolvable as in `tools/voyage-ui-check.mjs`.

## Done means
`node tools/rules-check.mjs` passes; classic play unchanged; a Voyage board with a hand-made rules object exercising each primitive deals, plays and undoes correctly in the browser (spot-check a few with screenshots in `/tmp/k1-shots`); the §2.5 table is filled in. Finish with a short summary appended to `docs/voyage/charms-build-log.md` under "K1": what was built, the exact API (field names, function signatures), known gaps.
