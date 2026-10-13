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


## Voyage overhaul v2 (K2b)

`voyageUI.showPort(view)` renders the visit's specialty stall plus Provisions, Sell, and Reroll, then optional charm-defined `view.port.services`, and a purse. `view.port.kind` is `stickers`, `boons`, or `upgrades`; `view.port.name` is the heading. The upgrade market shows Reroll disabled. Every action goes to a supplied handler; the UI never changes run state:

- `portBuyBoon(id)`, `portUpgrade(id)`, `portBuyUndo()`, `portReroll()`, `portLeave()`.
- `portBuySticker(offerIdx, cardId)`, after the 52-card picker. IDs are **1–52 in clubs, diamonds, hearts, spades order**, 13 ranks each. Existing stickers are shown. Esc cancels without dispatching. Arrow keys move across/by suit; Tab stays in the topmost dialog; focus returns to the opener.
- `portSell(id)` runs only after the existing `voyageUI.confirm(...)` resolves true. Cancel/Esc keep the boon.
- `portService(serviceId, arg)` receives an integer card ID when `needsCard`, a held boon ID when `needsBoon`, and no argument when neither is set. Price/affordability and missing held boons disable actions. A custom service requiring another argument shape needs a corresponding picker contract; none is specified by the current descriptor.

Call `showPort(runView(run))` when entering or resuming `status: 'port'` and after each mutation. It preserves stall scroll and restores the action's focus when possible. `hideAll()` closes the port and both service/sticker pickers. Base handlers and service dispatch have now landed in K2a's `main.js` flow.

`showResult(view)` reads `view.reward.picks` as **remaining** selections (default 1); it shows **Choose 2 boons** for two. After `pickCharm(id)`, re-render `showResult` if another pick remains, or advance normally. `showRunEnd` lists every `result.charms` entry, with `result.charm` as the older fallback, and lists every `{ card, type }` in `view.stickers`.

HUD/map purses read `view.coins`; results read `result.coins` and `{ label, coins }` coin lines. Result animation order is score → stars → coins → choices, with reduced-motion support. Charm rendering uses `family`, `level`, `upgradeText`, `pressure`, and `hidden`. Confiscation uses `view.current.confiscated`/`view.confiscated` during the board and each final node's `confiscated` on the map; predicted map confiscation never disables a boon on an earlier board. `current.undoGrants > 0` shows `charm undos n/current.undoCap` next to Undo.

### Card renderer hooks still needed in main.js (K2a/K3 ownership)

`js/card.js` exports **`setCardSticker(group, type = null)`**, where type is `wild`, `fool`, `key`, `gold`, `lucky`, or its `sticker-` spelling. It owns `group.userData.sticker` and `stickerMesh`, independently of `mark`/`markMesh`. Null clears only this slot. `setCardMark(group, 'sticker-wild')` and the other new styles forward to it for compatibility with existing `api.mark(ids, style)` calls. Both slots survive `applyCardStyle(group, style)` and are hidden/restored together by `setCardConcealed(group, concealed)`.

- Import `setCardSticker` alongside `setCardMark` in `main.js`.
- In `voyageRuntimeAPI.clearMarks()`, clear **both** slots for each group: `setCardMark(g, null); setCardSticker(g, null);`. Charm setup can then repaint sticker marks through existing `api.mark(ids, 'sticker-'+type)`. Do the same wherever mode/reset cleanup clears Voyage marks. Clearing one charm mark deliberately keeps the card's sticker.
- In `disposeCard(g)`, also dispose `g.userData.stickerMesh?.material.dispose()`. Geometry and cached mark textures are shared, so do not dispose those per card.
- To paint a saved run explicitly, use `setCardSticker(cardGroups.get(cardId), type)` for each `run.stickers` entry after groups exist. The built-in sticker charm's setup already works through the compatible `setCardMark` route.

Preview/check: `node serve.mjs 8144`, then `node tools/voyage-ui-check.mjs`. The checker defaults to `http://localhost:8144`, writes `/tmp/k2b-shots/`, asserts console/network errors and unintended horizontal overflow, and covers keyboard/touch interactions at 1024×768 and 390×844. Set `VOYAGE_TEST_URL`/`VOYAGE_SHOTS` to override. A case name limits snapshots; `interactions` runs the interaction checks alone. V2 port/service views are explicit fixtures alongside real run snapshots; they do not validate economy balance.


### Storm route addendum

Map nodes with `storm: true` get a distinct lightning badge and accessible/title text explaining double coins and three charm choices. `node.stormChallenge` is shown alongside the normal theme challenge in node detail. The HUD and board intro draw every `current.extraChallenges` entry (falling back to `current.stormChallenge` when the array is absent/empty), preserving each challenge's Rule/Curse label. `current.storm` adds a storm label; `result.storm` adds a reward note and marks the corresponding summary row. Coin doubling and three offers come from the model; the UI reads the supplied coins/offers. No additional main.js hook is required.
