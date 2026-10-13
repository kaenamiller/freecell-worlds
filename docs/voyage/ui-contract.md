# Voyage UI contract

The Voyage DOM layer lives in `js/voyage/ui.js` and exports one object, `voyageUI`. Like `js/ui.js`, it owns **no game state**. It renders view models produced by `runView(run)` in `js/voyage/run.js` and reports player intent through `handlers`. `main.js` drives it.

## File ownership
- **UI agent:** `js/voyage/ui.js`, `css/voyage.css` (linked from `index.html`), Voyage markup in `index.html`, `tools/voyage-ui-preview.html` (plus helpers next to it), `docs/voyage/ui-notes.md`.
- **Engine (parent thread):** `js/main.js`, `js/rules.js`, `js/table.js`, `js/voyage/{run,map,charms,scoring,config,rng,stats,dealer}.js`, `sw.js`.
- Do not edit `js/ui.js` or `css/style.css`. Reach title-screen and HUD elements by id from `js/voyage/ui.js`, and style them from `css/voyage.css`. If you truly need a hook in those files, describe it in `docs/voyage/ui-notes.md` and the engine owner will add it.

## Mode switch
`voyageUI.setMode('classic' | 'voyage')` sets `body.dataset.mode`. In Voyage mode, CSS hides the classic-only controls (`#btn-new`, `#btn-hint`, `#btn-check`, `#btn-solve`, `#btn-themes`, `.chip-deal`) and shows the Voyage HUD. Undo stays visible; its label shows the remaining run undos.

## API
```js
voyageUI.init(handlers)        // once, after ui.init(). handlers below.
voyageUI.setMode(mode)
voyageUI.refreshTitle(info)    // { run: RunView|null, daily: { key, result|null } }
                               // Title screen: "Voyage" button (Continue Voyage when run != null, with a one-line summary
                               // like "Board 3 of 7 · 2 charms"), plus "New Voyage" while a run is in progress
                               // (handlers.startVoyage({ daily: false }); the engine confirms before abandoning it),
                               // "Daily Voyage" button (badge New/Done).
voyageUI.showMap(view)         // full-screen overworld (opaque, over title or table). view: RunView with status 'map'.
voyageUI.hideMap()
voyageUI.setPreparing(bool)    // the dealer is still choosing a deal after a node pick: subtle "Charting course…" state
voyageUI.showBoardIntro(view) -> Promise<void>   // short banner when a board starts: "Board 3 of 7 · Zen Garden",
                               // challenge (+ boss on board 7), par, star thresholds. Resolves when the player continues.
voyageUI.setHud(view)          // Voyage HUD while a board is played: board k/7, undos left, run score,
                               // charm tray, challenge chip, boss chip. Called after every change.
voyageUI.setLiveScore({ total, stars, thresholds })  // current board's live score + star progress, called after every move
voyageUI.showResult(view) -> void  // after a win. view.status is 'reward' (pick a charm), 'map' (no offers), or 'won' (final board).
                               // Animate the score breakdown (view.results.at(-1).score.lines / mults / total), then the stars,
                               // then either the charm offers (view.reward.offers: 1..3 charm cards, choose → handlers.pickCharm(id)),
                               // a "Continue" button (→ handlers.continueToMap()), or, when 'won', → handlers.showRunEnd().
voyageUI.showRunEnd(view)      // victory or defeat summary: boards reached, per-board results (theme, stars, score, charm picked),
                               // total score/stars, charms collected, lostReason ('abandoned' | 'stuck'), daily label.
                               // Buttons: New Voyage (handlers.startVoyage({})) and Menu (handlers.toMenu()).
voyageUI.hideAll()             // close every Voyage overlay
voyageUI.confirm({ title, text, ok, cancel }) -> Promise<boolean>   // themed confirm dialog (abandon board / abandon run)
voyageUI.tutorial(step)        // first-run coach marks. Shown once each (persist with store.js `save('voyageTutorial', …)`).
                               // steps: 'map' (pick a table, see two rows ahead, challenge/boons on each node, boss shown from the start),
                               //        'board' (charm tray + tooltips, challenge chip, undos are shared across the run, no restarts),
                               //        'reward' (stars = number of charm choices; charms last the whole run).
voyageUI.renderStats(stats)    // Voyage section of the Statistics modal (the shape is in js/voyage/stats.js). Add a
                               // Classic | Voyage tab switch in the stats modal.
```

### handlers (supplied by main.js)
```js
{
  startVoyage({ daily }),  // new run (abandons a saved one after confirm, which main.js handles)
  continueVoyage(),        // resume saved run
  pickNode(nodeId),        // on the map
  pickCharm(charmId),      // on the reward screen
  continueToMap(),         // result screen with no offers
  showRunEnd(),            // after the final board's result
  abandonBoard(),          // HUD button (main.js confirms; abandoning loses the run)
  openMap(),               // HUD button: view the map mid-board (read-only; close returns to the board)
  toMenu(),
}
```

## View model: `RunView` (from `runView(run)` in `js/voyage/run.js`)
```js
{
  seed, daily /* 'YYYY-MM-DD' | null */, status /* 'map'|'board'|'reward'|'won'|'lost' */,
  board,      // 1-based board being played, else boards cleared
  boards,     // 7
  undos, score /* run total */, stars /* run total */,
  boons: [Charm],             // collected, in order
  boss: Charm | null,         // final-board boss: known from run start, show it on the map's final row
  map: [[Node]],              // generated rows only (row r+2 appears when row r is chosen)
  current: null | { idx, theme, deal, tier, par, freeCells, starThresholds: [1★, 2★, 3★], challenge: Charm, boss: Charm|null },
  reward: null | { stars, offers: [Charm], result: BoardResult },
  results: [BoardResult],
  lostReason: null | 'abandoned' | 'stuck',
}
Charm = { id, kind: 'boon'|'challenge'|'boss', name, icon /* glyph/emoji */, text /* tooltip sentence */, theme, placeholder }
Node  = { id, row, lane, theme, links: [nodeId] /* next-row nodes; empty until known */,
          state: 'available'|'current'|'visited'|'skipped'|'upcoming',
          challenge: Charm, boons: [Charm] /* the 3 boons this table can award */, final: bool }
BoardResult = { idx, theme, deal, tier, par, moves, time, undosUsed, total, stars, charm /* picked id|null */,
                score: { lines: [{ key, label, pts }], mults: [{ label, x }], subtotal, total } }
```
Theme art and names: `THEMES[id]` from `js/themes.js` (`name`, `tagline`, `art.thumb`, `art.hero`, `css` custom properties).

## Design notes
- The map is the centrepiece. It's a vertical route with 7 rows; on wide screens it can run horizontally. Each node is a theme thumbnail tile showing its challenge icon. Draw links between rows, and mark the path taken. Available nodes are prominent, upcoming ones dimmed, and the final row is visually distinct with the boss badge. Tapping or hovering a node shows a detail card (theme name, challenge text with strength, the 3 boons it can award) and an "Set sail" button for available nodes. It must work on a portrait phone (scrolls; the current row is in view) and on desktop.
- Tooltips: hovering (desktop) or tapping (touch) a charm icon anywhere (tray, map, offers) shows its name and text. Use one shared tooltip implementation, keyboard accessible (focusable icons, `aria-describedby`).
- The visual language must follow the active theme. The existing CSS uses theme custom properties (`--bg`, `--panel`, `--accent`, `--text`, etc.; see `css/style.css` and the `css` block of each theme in `js/themes.js`) and the `panel` / `btn` / `chip` classes. Reuse them. The map should look good under all 14 themes.
- Respect `settings.reducedMotion` (from `js/store.js`) in animations.
- Content is placeholder (`placeholder: true`). Don't hard-code charm names or ids.

## v2 — economy, ports, stickers and levels (K2a)

Run saves are version 3. `status` adds `'port'`; after picking a reward from a harbour table,
the flow is `reward → port → map`. A harbour with no available rewards also docks. The finale
never docks. `voyageUI.showPort(view)` renders a saved or newly opened port.

`RunView` adds `coins: number`, `stickers: [{ card: number, type: 'wild'|'gold'|'lucky'|'key'|'fool' }]`,
`port: PortView|null` (only non-null in port status), and `confiscated: Charm|null`.
Every `Charm` adds `level: 1|2`, `family: string|null`, `upgradeText: string|null`,
`pressure: boolean`, `hidden: boolean`. Its `text` already uses the held level.
Hidden charms are omitted from all boon lists/offers/trays. Every map node adds
`port: boolean` and `confiscated: Charm|null` (final-row confiscation preview).
`current` adds `undoGrants: number` (from `current.memo._undoGrants`),
`undoCap: number` (from config), and `confiscated: Charm|null`.
Each result adds `coins: number`, `coinLines: [{ key, label, coins: number }]`;
the lines sum to the earned coins, including boon adjustments and a zero-floor correction.
`result.score` also exposes its pre-formula `coinLines`/`coinTotal` for score hooks.

```js
PortView = {
  coins,
  kind: 'stickers' | 'boons' | 'upgrades' | null,
  name: string,
  boons: [{ charm: Charm, price, sold: boolean }],
  stickers: [{ type, name, text, price, sold: boolean }],
  upgrades: [{ charm: Charm, price }],
  provisions: { price, left },
  sell: [{ charm: Charm, price }],
  reroll: { price, used: boolean },
  services: [{ id, label, text, price, needsCard: boolean, needsBoon: boolean }],
}
```

Handlers: `portBuyBoon(id)`, `portBuySticker(offerIdx, cardId)`, `portUpgrade(id)`,
`portBuyUndo()`, `portSell(id)`, `portReroll()`, `portService(serviceId, arg)`, `portLeave()`.
The sticker offer index is zero-based; card ids are integers 1–52. Sticker selection/cancellation
belongs to the UI; only a completed purchase calls its handler. Purchases return success/failure,
save the run and re-render `showPort(vyView())`; Leave saves and renders the map.
Failed/insufficient-funds actions leave state untouched. Provisions allow three purchases total.
Reroll is once per visit and refreshes only that market's specialty: sticker offers, or charm
offers. The upgrade market keeps the control closed, because its list is the charms already held.
Sold offers stay sold until a reroll replaces that specialty's stock.
Menu/Continue resumes the same stock and limits. Until `showPort` is available, flow safely leaves
the port and renders the map. Result Continue also opens a port when no reward was available.

Content hooks: `onPort(run, ctx)` runs once per visit, with mutable `ctx.port` containing
`extraBoons` (additional offers), `discount` (fraction, clamped 0–1 for pricing) and `freeReroll`.
`price(item, cost, ctx)` receives an item `{ kind: 'boon'|'sticker'|'upgrade'|'undo'|'reroll'|'sell'|'service', id?, type? }`.
Discount precedes held-boon price hooks; the final cost is rounded up and floored at zero.
Selling starts at the config amount and applies held-boon price hooks before removing the sold boon;
the shop's fractional discount does not reduce the payout. Run-level hooks have `level`, `family`, `coins`, `stickers`,
`runMemo` and an uncapped `api.addUndos`/`api.addCoins`. Board-end `coins` and `boardUndos` hooks
also receive `sb`, `stars` and the scoring context. Statistics add `coinsEarned`, `coinsSpent`,
`portVisits`, `stickersBought`, and `upgrades`, synced once via a saved per-run watermark.

§4.8 additions: `reward.picks` is the **remaining** number of picks (initially 1–2, capped by
offered stock). After the first of two picks, the same result screen re-renders with the chosen
offer removed and `picks: 1`. `result.charm` retains the first selection for existing summary
renderers; `result.charms` records all selections. Only the final pick opens the port/map.
`port.services` renders content-defined extra stalls. `needsCard` requests a card id 1–52;
`needsBoon` requests a held boon id; no flag means the handler may omit `arg`.
Service functions are re-derived from held charms after resume and never stored in JSON;
prices use `price({ kind: 'service', id }, cost, ctx)`. A service returning `false` discards
all its trial changes and spends no coins. `onUpgrade` runs after level 2 is set, once per upgrade.
Held-boon `lookahead` adjusts revealed/visible map rows (clamp 1–4); `challengeStrength` adjusts
challenge strength in plans (clamp 1–7) while boon strength and final-boss strength remain unchanged.

Markets are scheduled, not rolled per island. Every node on boards 2, 4, and 6 has `port: true`
and a `market` descriptor. The chart also lists those stops in `view.markets`, drawn between the
tables. Board 2 sells stickers, board 4 sells charms, and board 6 sells upgrades. Selling, undos,
and the shared reroll stall are on every visit. Sell payout starts at the config amount.

Storm stretch: every map node adds `storm: boolean`, `stormChallenge: Charm|null`. On rows 1–5,
eligible non-harbour nodes have a seeded 1-in-6 storm chance; rows 0/6 and all harbours are excluded.
The secondary challenge has a different theme and disjoint tags from the table's own challenge.
`current` adds `storm`, `stormChallenge`, and `extraChallenges: [Charm]` for the extra challenge
chip/intro. `BoardResult.storm` marks the cleared storm. Storms pay double final earned coins
(the additional coins appear as a breakdown line) and reveal 3 available boon offers irrespective
of stars. Both challenges compose through `composeBoard({ extraChallenges: [id] })` and the dealer.

## Ability targeting (replaces the numbered `pickTargets` overlay)

The engine lights targets on the table itself, with the same visuals as the rest of the game:
legal cards get the rank-key blue, and legal empty cells or column ends pulse like drop targets.
The aimed target rises slightly, and earlier picks of the same ability stay lifted. The UI only
provides the banner and a small menu:

```js
voyageUI.showTargetPrompt({ ability, icon, name, text, avoidTop }, onCancel)
                               // non-modal one-row banner over the HUD stat chips; moves up, or to the
                               // bottom edge, if it would cover the table's top row (avoidTop, px).
                               // Marks the charm in the tray with .targeting; any tray charm click cancels.
voyageUI.updateTargetPrompt(label)   // the aimed target's name ("Column 3 · 2♥ on top"), or '' for the hint
voyageUI.nudgeTargetPrompt()         // a click that missed every target
voyageUI.clearTargetPrompt()
voyageUI.choose({ icon, name, text, options: [{ value, label, detail, disabled }], at }) -> value|null
                               // small menu anchored above a card (at = screen point) or centred;
                               // Esc / outside click cancels. Used for Glaze direction, Misprint sticker,
                               // Safety Pin suit, Broken Seal obstacle and sticker replacement.
voyageUI.cancelPick()          // closes either (board teardown, menu)
```

Input during a pick: click/tap a lit target, or Tab/arrows + Enter. Esc, right-click, Cancel, a
tray charm or any other control cancels, and nothing is spent. Game hotkeys wait until the pick ends.
Tests drive picks with `FreeCell.voyage.targeting()` / `FreeCell.voyage.pickTarget(value)`, or with
real clicks via `tools/charm-checks/_browser-pick.mjs`.

Card modifications from abilities are stacking top tabs (`mod-*` marks; see `js/card.js`):
purple diamond = ignores colour, black bars = anything may be placed on it, blue ▲/▼ + rank = Glaze.
