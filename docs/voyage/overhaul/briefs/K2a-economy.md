# K2a — Run economy: coins, harbours, ports, stickers, levels (model + flow)

You are the run-systems engineer for the Voyage charm overhaul of FreeCell Worlds (static three.js FreeCell, plain ES modules, no build step). Several agents work **in the same checkout at the same time**; follow the ownership rules exactly.

## Read first
1. `docs/voyage/overhaul/SPEC.md` — §1, §3.3 (hooks you must call), §4 (your scope), §5.
2. `docs/voyage/ui-contract.md` (how `runView` feeds `js/voyage/ui.js`).
3. `js/voyage/run.js`, `js/voyage/map.js`, `js/voyage/scoring.js`, `js/voyage/config.js` (the v2 constants are already added at the bottom), `js/voyage/stats.js`, `js/voyage/charms.js`, `js/voyage/boardrules.js`, and the Voyage section of `js/main.js` (from `// Voyage mode` down to `voyageHandlers`).

## Files you own
`js/voyage/run.js`, `js/voyage/map.js`, `js/voyage/scoring.js`, `js/voyage/config.js`, `js/voyage/stats.js`, new `js/voyage/port.js`, new `js/voyage/stickers.js` (and its import from `js/voyage/content/index.js` — add one import line at the end, nothing else), new `tools/economy-check.mjs`, `docs/voyage/overhaul/K2a-report.md`.
In `js/main.js` you own **only the Voyage flow functions**: `voyageWin`, `voyagePickCharm`, `voyageShowMap`, `voyageContinue`, `voyageStart`, `voyagePersist`, `voyagePrepareAhead`, `vyView`, `voyageHandlers`, plus any new `voyagePort*` functions you add next to them. K3 owns `voyageRuntimeAPI`, `doHint`, `doUndo`, `voyageUndone`, `voyageAfterMove`; K1 owns `dealGame`, drag/drop legality and auto-play. Re-read `main.js` right before every edit; keep edits surgical.
Another agent (K2b) builds the UI (`js/voyage/ui.js`, `css/voyage.css`, `js/card.js`) **in parallel** against the view-model contract below. Do not edit those files; put any extra contract detail you settle on in your report and in `docs/voyage/ui-contract.md` (append a "v2" section — you own that section).

## Tasks
1. **Coins** (SPEC §4.1): `ScoreBreakdown.addCoins(key, label, n)` / `coinLines` / `coinTotal`; board-end coin formula from config; boon `coins(n, ctx)` hook; `result.coins` + `result.coinLines`; `run.coins`. Bump `RUN_VERSION` to 3.
2. **Harbour nodes** (SPEC §4.2) in `map.js`, deterministic in the seed and node id, with the guarantees listed. `mapView` rows carry `port`.
3. **Port** (SPEC §4.3) in a pure `port.js`: `createPort(run)`, `buyBoon(run, id, api)`, `buySticker(run, offerIdx, cardId)`, `upgradeBoon(run, id)`, `buyUndo(run)`, `sellBoon(run, id)`, `rerollPort(run)`, `leavePort(run)`. Seeded with `stream(run.seed, 'port', boardIdx, reroll)`. Apply `onPort`, `price` hooks (§3.3) — call them through small helpers so content can rely on them. Buying a boon calls `onPick` with a ctx (reuse the pattern in `pickCharm`). Status flow: reward → (harbour) `'port'` → `'map'`. Final board never docks.
4. **Stickers** (SPEC §4.4) in `stickers.js`: define the `voyage.stickers` pseudo-boon with `defineCharm` (kind `boon`, `hidden: true`, `family: 'sticker'`), its `rules` (wildCards / anchorCards / freeCards from `ctx.stickers`), `setup` marks (mark styles `sticker-<type>`; K2b renders them), `score` for gold (`sb.addCoins`), and `on.foundation` for lucky. Make sure hidden charms never appear in offers, ports, the tray or `boonsForTheme` (add the filter where needed in your files; if a filter is needed in `charms.js`, describe it in your report — K3 owns that file).
5. **Levels** (SPEC §4.5): `run.levels`; `boardPlan` passes `levels: run.levels, stickers: run.stickers` to `composeBoard` (K1 is adding those params — pass them now; unknown params are harmless). `upcomingPlans` / dealer plan keys must include levels and stickers (they change rules).
6. **Board-undo hook**: apply boon `boardUndos(n, ctx)` to the `VOYAGE.undosPerBoard` grant in `winBoard`.
7. **View model v2** — extend `runView` exactly like this (K2b codes against it):
   - top level: `coins`, `stickers: [{ card, type }]`, `port` (when status `'port'`, else null), `confiscated` (charm view or null).
   - every charm view gains `level`, `family`, `upgradeText`, `pressure` (bool), `hidden` (bool).
   - map nodes gain `port` (bool).
   - `current` gains `undoGrants`, `undoCap` (read them from the board memo key K3 uses — coordinate via `cur.memo._undoGrants`; K3 writes it), `confiscated`.
   - `results[i]` gain `coins`, `coinLines`.
   - `port` shape: `{ coins, boons: [{ charm, price, sold: bool }], stickers: [{ type, name, text, price, sold }], upgrades: [{ charm, price }], provisions: { price, left }, sell: [{ charm, price }], reroll: { price, used } }`.
   - New handlers you add to `voyageHandlers` (K2b calls them): `portBuyBoon(id)`, `portBuySticker(offerIdx, cardId)`, `portUpgrade(id)`, `portBuyUndo()`, `portSell(id)`, `portReroll()`, `portLeave()`. Each mutates the run via `port.js`, saves, and re-renders with `voyageUI.showPort(vyView())`.
   - When status becomes `'port'`, main.js calls `voyageUI.showPort(vyView())` (K2b implements it); `voyageContinue` must resume a saved port.
8. **Stats**: record coins earned/spent, port visits, stickers bought, upgrades.
9. **Tests**: `tools/economy-check.mjs` (pure Node): coin formula, harbour guarantees across 200 seeds, every port action (including insufficient coins, selling, upgrading, sticker replace, reroll once), save/resume round-trip of a port, stickers changing `composeBoard` rules, level passing.

## Acceptance
- `node tools/economy-check.mjs`, `node tools/rules-check.mjs`, `node tools/charm-content-check.mjs` pass.
- A full scripted run in Node (create → board → win → reward → port → map …) works without the UI (add it to economy-check).
- Browser smoke on port 8142: a Voyage run reaches a port screen (or, if K2b hasn't landed yet, the flow calls `voyageUI.showPort` without throwing — guard with `voyageUI.showPort?.()` and fall back to the map).
- `docs/voyage/overhaul/K2a-report.md`: what you built, the exact view-model and handler contract you shipped, anything deferred.

When done, reply with a short summary and the report path.
