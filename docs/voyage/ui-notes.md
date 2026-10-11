# Voyage UI integration notes

- Call `voyageUI.init(handlers)` once after `ui.init()`. Use `voyageUI.setMode('voyage')` on entering a run and `setMode('classic')` when returning to classic play. Pass `runView(run)` snapshots to every Voyage method. `showMap` treats `status: 'board'` as a read-only chart; its Return to board button closes the chart itself.
- After each board move or undo, call both `setHud(runView(run))` and `setLiveScore({ total, stars, thresholds })`. `thresholds` comes from `view.current.starThresholds`. The UI updates the existing Undo button's accessible label and remaining count. `setHud` also reads `settings.reducedMotion` after settings changes.
- After a node is chosen, call `setPreparing(true)` while the dealer works. `showBoardIntro` clears that state once the deal is ready. Await `showBoardIntro(view)` before accepting board input.
- Call `showResult(view)` for **every** board win, including the final board (`status: 'won'`) and a board with no offers (`status: 'map'`). Its actions dispatch `pickCharm`, `continueToMap`, or `showRunEnd`. For the final board the UI reads `view.results.at(-1)` because `run.current` is already cleared.
- `refreshTitle({ run, daily })` needs the saved run view and today's `{ key, result }`; `daily.result` can come from `dailyVoyageResult(key)`. Call it when the title appears and after run or daily state changes.
- The Statistics modal needs a fresh `voyageUI.renderStats(voyageStats)` on open and after reset. The current `main.js` wires this through `statsOpened` and resets Voyage stats alongside Classic stats. The tabs and Voyage panel are already in `index.html`.
- Call `tutorial('map' | 'board' | 'reward')` at the matching first encounter. The UI persists seen steps under `voyageTutorial` in `store.js`.

The standalone preview uses actual `createRun`, `startBoard`, `winBoard`, `pickCharm`, and `runView` snapshots. Its histories and deals are illustrative; the score and board flow there do not validate game balance.

## Branching chart follow-up

The chart now places each visible child under its own parent using `Node.parent` and `Node.links`. The preview generates the new route-encoded node ids from the engine; it has no lane-based fixtures.

`main.js` now looks up selected nodes with `findNode(r.map, nodeId)`, which matches the tree model. No additional engine hook is needed for the chart.

## Title mode follow-up

No new `main.js` hook is needed. Keep `voyageRefreshTitle()` after `ui.showTitle()`: `refreshTitle` uses the saved run view to open the Voyage tab when a run is in progress, update its continue summary, and show that run's table art. `settings.titleMode` records explicit tab choices; the in-progress override leaves that preference intact. The existing `statsOpened` handler still supplies Voyage stats when the shared Stats button opens the active mode's tab.
