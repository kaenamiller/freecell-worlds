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
