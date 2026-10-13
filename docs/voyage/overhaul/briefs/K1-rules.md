# K1 — Rules kernel v2 (solver-visible)

You are the rules-kernel engineer for the Voyage charm overhaul of FreeCell Worlds (a static three.js FreeCell game, plain ES modules, no build step). Several other agents are working **in the same checkout at the same time** on other files, so follow the ownership rules exactly.

## Read first
1. `docs/voyage/overhaul/SPEC.md` — especially §2 and §2.1 (your scope) and §5 (verification + shared-checkout rules).
2. `docs/voyage/charms-design.md` §2 (the existing kernel you are extending) and `docs/voyage/boss-challenges.md` §0.
3. `js/rules.js`, `js/voyage/boardrules.js`, `js/voyage/dealer.js`, `js/voyage/dealer.worker.js`, `js/solver.worker.js`, `js/shortsolve.js`, `js/difficulty.js`, `js/table.js`, `tools/rules-check.mjs`, `tools/boss-calibrate.mjs`, `tools/charm-calibrate.mjs`, `js/voyage/content/bosses.js`.

## Files you own
`js/rules.js`, `js/shortsolve.js`, `js/difficulty.js`, `js/solver.worker.js`, `js/voyage/boardrules.js`, `js/voyage/dealer.js`, `js/voyage/dealer.worker.js`, `js/table.js` (rule visuals only), `js/voyage/content/bosses.js` (ease values + the three new bosses below), `tools/rules-check.mjs`, `tools/boss-calibrate.mjs`, `tools/charm-calibrate.mjs` and their JSON outputs, `docs/voyage/overhaul/K1-report.md`.
In `js/main.js` you may edit **only**: `dealGame` construction, drag/drop legality helpers (around `canDropTableau` / `canStackOn` / `moveToFreeCell` / `tryDrop`), auto-play (`safeFoundationMoves` and related), and the solver call sites (`requestSolve`). Another agent (K3) owns `voyageRuntimeAPI` and `doHint`; another (K2) owns the Voyage flow functions. Re-read `main.js` right before every edit and keep edits surgical.

Do not edit anything else. Never run `git checkout/stash/reset/clean/commit`.

## Tasks
1. Implement every field in SPEC §2's table with neutral defaults, in all the places listed there. Pay special attention to: the build table in `compileRules` (wildCards, anchorCards, buildUp, rankShift), cell acceptance (`freeCards`, `cellLimits`, `cellClose`), `foundationAccepts` (`gate`, `phase`), `canStackOn` for empty columns (`emptyMaxRank`, `phase`), `maxMoveSize` (`emptyMaxRank`, `cellClose`, `suitRunFree`), `deal(n, rules)` (`dealSkew`), `hashState` (only if a field adds state; none should), `rulesKey`, `hasRestrictions`, safe auto-play under `phase`.
2. The two new override flags `ignoreRestrictions` and `rankGap` (SPEC §2 notes), honoured by `Game.canDropTableau` / `moveFreeToTableau` / `moveSequenceToTableau` / `moveToFreeCell` and the drag/drop path in main.js. Descriptors record the override so undo restores it, exactly like the existing overrides.
3. `composeBoard` changes from SPEC §2.1: `levels`, `stickers`, the `voyage.stickers` pseudo-boon, the richer `rules` ctx (`level`, `boons`, `stickers`, `family(name)`), `rulesAfter`, boss `confiscate` (return `confiscated`), and keep `bossBudget` / `boonRelation` working. `boardPlan` lives in `run.js` (K2 owns it); K2 will pass `levels` and `stickers` — make composeBoard accept them with defaults so nothing breaks before K2 lands.
4. Table visuals (theme-neutral, subtle, like the existing ones): closed cells (`cellClose`) look like a cell with a tide line/lid that appears when it closes; `cellLimits` cells show a small "≤5" style glyph; `gate` shows a small lock on that suit's foundation slot with the remaining count; `emptyMaxRank` shows a rank glyph with "≤" in empty columns. Keep everything driven from `game.rules` + state, like the existing `layer.setRules`.
5. Bosses (`js/voyage/content/bosses.js`):
   - Put all bosses on one difficulty axis: measure each existing boss with `tools/boss-calibrate.mjs` (extend it if needed) and set `ease` so finale deals land on the tier-7 curve. Lockdown and Twin Tombs currently have ease 0 while Thaw is about −3 — check whether that is actually wrong given the bank models free cells exactly (`dealer.js` `effectiveScore`), and fix whatever is actually inconsistent. Write the table and reasoning to `docs/voyage/overhaul/K1-report.md`.
   - Add three bosses (ids, names, icons, one-sentence text, tags, tell, `boonRelation`):
     - `boss.eclipse` — **Eclipse**: two phases. Before 26 cards are home, Jacks/Queens/Kings can't enter free cells; from 26 on, no foundation may climb more than 3 above the lowest. Uses `phase`. Tags `CELLS`, `FOUND`.
     - `boss.auditor` — **The Auditor**: confiscates your strongest boon for the finale (highest `ease`; ties → the most recently picked; ability charms count as ease 0.4 if lower) and also bans one more free cell (`freeCells −1`). Tags `CELLS`. If you hold no boons it confiscates nothing.
     - `boss.hightide` — **High Tide**: free cells close as the foundations fill: at 16, 28 and 40 cards home, one more empty cell closes (`cellClose`). Tags `CELLS`.
   - Run the calibration for the new bosses too and record yields; adjust ease. The boss draw must still exclude tag clashes with the final theme challenge.
6. Extend `tools/rules-check.mjs`: generator/player agreement and undo over rulesets that include each new field; `deal` with `dealSkew`; `cellClose` capacity; `phase` switching both ways under undo; `gate`; override flags round-trip; and a solver verification of a handful of restricted deals for each new restrict field. Add the new primitives to `tools/charm-calibrate.mjs` and run it at a modest budget; put the measured ease suggestions for the new restrict fields in your report (content agents will use them).
7. Stretch, only once 1–6 are green: Suit Spur (parked spec). If you skip it, say so in the report.

## Acceptance
- `node tools/rules-check.mjs` passes, including your new checks; classic baseline unchanged (exact verdict/nodes/path).
- `node tools/charm-content-check.mjs` passes.
- `node -e "import('./js/voyage/charms.js')"` loads.
- Classic mode behaviour is byte-for-byte unchanged when no new field is set (the classic fast path in `compileRules` must stay).
- A browser smoke test of a Voyage board on your port (8141) with no console errors.
- `docs/voyage/overhaul/K1-report.md` written: what you built, the boss ease table, the calibration numbers for the new restrict fields, anything you deferred, and any interface detail other agents must know (exact field semantics you settled on).

When done, reply with a short summary and the path to your report.
