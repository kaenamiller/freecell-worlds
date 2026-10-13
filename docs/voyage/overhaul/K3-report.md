# K3 — Charm runtime v2

Implemented the runtime brief, all API addenda and the requested sticker cleanup hooks. Changes stay within K3-owned files and helpers in `main.js`, plus the explicitly authorized sticker material cleanup in `disposeCard`; theme and special content modules were not edited.

## Context and definitions

- `ctx.level`: `1` or `2`, taken from the active entry; defaults to `1`.
- `ctx.family(name)`: number of held boon IDs declaring that family, including a boon confiscated for this board because it is still held.
- `ctx.coins`: read-only, live run purse. `ctx.run` remains a deeply frozen copy and now includes `coins`.
- `ctx.stickers`: frozen copy of this board's stickers. Saved as `cur.memo._stickers`, so a sticker added during play does not become active after resuming this board. `ctx.api.stickers` is a fresh copy of the current run sticker map.
- `charmText(id, strength = 1, {seed, level} = {})`: chooses `upgrade` at level 2 when present, otherwise `text`. Either field may be a string or `(strength, context) => string`.
- Hidden boons are excluded by `boonsForTheme`, which feeds reward offers. Hidden runtime pseudo-boons still receive hooks.
- Exported `CHARM_FAMILIES` includes `cells`, `columns`, `wild`, `suit`, `foundation`, `ability`, `undo`, `coin`, `vision`, `sticker`, **`fortune`**.

## Shipped API

| Signature | Semantics |
| --- | --- |
| `hint(): Promise<boolean>` | Searches under current `game.rules` for 3 seconds, plays its first solution move or the highest-scored legal fallback, and returns whether it played. Voyage charm calls bypass the dev guard. Exactly one history entry; no automatic follow-on plays and no classic hint count. The classic button/shortcut remains blocked in Voyage. The played move carries an ability refund marker, including across resume. |
| `preview(n = 3): Promise<Move[] \| null>` | Searches current state/rules for 5 seconds and returns copied `solution.slice(0, n)` descriptors. No greedy preview fallback. Applies nothing. Shows an ordered line, white source/destination glows using the existing selection texture, and source badges 2/3. Clears on any move (including auto-play), undo attempt, successful ability start, replacement preview, new board or leaving the board. Stale results are discarded. Preview is transient and never saved or scored. |
| `solvable(): Promise<true \| false \| null>` | Searches current state/rules for 5 seconds, plays nothing, and produces no status or highlight UI. Returns the solver's boolean verdict, or `null` for timeout, unknown, errors, a busy solver or a stale board. The charm owns any notification. |
| `resetBoard(): boolean` | Available on an unwon live board with a manual history entry. Calls `game.undo()` for every descriptor, restoring custom X state and rules. Clears pending overrides, animates with the generic relayout, and emits one `on.undo` batch with `reset: true`. Spends no run undo and does not increment `undosUsed`. Refunds move-bound ability uses, except the resetting ability's own use. Same deal and initial state; no new shuffle. |
| `openUndoWindow(): boolean` | Arms free step-by-step undo when an unwon board has a manual move, including at zero run undos. Each press removes trailing automatic plays plus one manual move and emits `on.undo` with `free: true`. Remains open at the deal. The next manual forward move closes it permanently for this board. Saved `_undoWindow` and `_undoWindowUsed` flags survive resume. `undoWindowUsed` is also readable for pure availability guards. |
| `addUndos(n): number` | Scoped charm call returns the amount granted. During `run.status === 'board'`, grants share `VOYAGE.charmUndoCap` (3), tracked in `cur.memo._undoGrants`. Drops excess and toasts `undo cap reached`. `on.stuck` calls and charms with `undoCapExempt: true` bypass and do not consume the cap. Reward picks, ports and other non-board calls are uncapped. Grants/cap are exposed as `api.undoGrants` and `api.undoCap`. |
| `grantUse(charmId \| '*', n = 1): number` | Adds uses to one active ability or all active abilities, returning the total granted. Each charm can receive at most two extra uses per board; saved in its `_runtime.abilityGrants`. Does not replace `abilityBonus`; initialization includes both. Refunds retain extra uses granted since the move. |
| `abilityUses(): { [charmId]: number }` | Frozen snapshot of remaining uses for every active ability charm. Available during `on.win`, including when the run's current board has been cleared. An in-flight ability is provisionally charged before executing so a winning ability is counted as spent; false/cancel/error refunds that charge. |
| `addCoins(n)` | Run-level only: non-board hooks and `on.win`. Board hooks must use history-derived `sb.addCoins`; misuse throws. |
| `addSticker(cardId, type): boolean` | Valid IDs are integers 1–52; types are `wild`, `fool`, `key`, `gold`, `lucky`. Assigns and saves `run.stickers[cardId]`; restickering replaces the type. Returns `true` for a valid assignment, `false` otherwise. Never changes current `game.rules`; applies from the next board. |
| `rewind(count): boolean` | Existing paid batch remains paid even during a window. Removes up to `count` entries for one run undo. Emits normal undo and counts one paid undo. |

All new primitives are exposed on the content-check stub. Stub `solvable` accepts `solveResult` to exercise all three verdicts; its preview records the call and supplies fixture moves rather than running a worker.

## Events and author guidance

- `on.ability(ctx, {id})` runs after a successful use has consumed its charge. Cancelled/false activations emit nothing. Synergy hooks can call `grantUse` without bypassing its persistent cap.
- `ability.when: 'start'` is available only before the board's first manual move, in addition to uses and `available(ctx)`. `_manualPlayed` persists across undo/reset/resume; automatic plays alone do not close it.
- Spend-based `on.undo` hooks must ignore `ev.reset` and `ev.free`; `kit.paidUndo(ev)` is the pure guard. State restoration and anchor hooks must still process both events.
- Existing Cache Hit (`cyber.cache`), Echo Canyon (`canyon.echo`), Redundancy (`deepstorage.redundancy`) and Packet Loss (`cyber.challenge`) receive a temporary dispatcher compatibility guard for free/reset events. Their content authors should add the same event guard when migrating those modules. Other undo hooks continue to run, including Siege Engine's reversal of its own grant/visibility effects.
- Bookmark already clears its anchor when its marker leaves history. It receives reset/free events and requires **no special-module change**.
- `kit.hasPlayerMove(history)`, `kit.boardWon(state)` and `kit.canUndoBoard(ctx)` support pure reset/window availability; `api.undoWindowUsed` prevents offering a window that has already been closed.
- The undo window also protects a stuck position when free undo can still reach earlier history. HUD labels free steps, and scoring counts only paid presses.
- Sticker marks have an independent channel: `sticker-*` coexists with a normal boon/challenge mark on the same card. Visual restoration clears and reapplies both channels, so unmark/resume preserves the other corner correctly.
- K2b integration: `clearMarks` clears the separate sticker slot, `disposeCard` disposes each sticker mesh's material without disposing shared textures/geometry, and resume re-renders stickers through the pseudo-boon's saved marks/setup path.
- Reserved board keys: `_undoGrants`, `_undoWindow`, `_undoWindowUsed`, `_manualPlayed`, `_stickers`; reserved per-charm runtime keys include `abilityUses` and `abilityGrants`.

## Content checks and fixtures

`STRICT_V2=1` rejects missing/invalid boon families, missing upgrades, identical non-placeholder/non-hidden boon text, challenges without `pressure: true` or a rules hook, and impure ability availability. Without that environment variable, these are migration warnings. Existing structural/runtime failures still fail in either mode. Availability probes reject writes, API effects and random draws, run twice for deterministic boolean results, and exercise both played and initial positions. Boons are exercised at both levels and strengths 1–7. Hidden pseudo-boons do not need a theme.

Dev-only fixtures (not imported in production): preview, reset, window, use battery/ability events, capped undo faucet/stuck exemption, explicitly exempt undo, start-only next-board stickers, and Weather Eye reachability. Existing survey/workshop/fog fixtures remain covered.

As content migration retires legacy IDs, the dev fixture module registers hidden historical hint/refund definitions only when their production definitions are absent. This keeps all four named hint regressions and legacy undo guards covered without restoring retired charms to offers. All four original production hint buttons passed before the roster migration; the final check uses production definitions where present and hidden historical fixtures for retired IDs.

Pure v2 checks live in `tools/charm-checks/_runtime-v2.mjs`. Browser checks use the real solver worker and runtime handlers; dev artwork is supplied by the test harness because dev charms intentionally have no production art assets. Production console/page errors are still fatal.

## Verification

Ran 2026-10-13 against `node serve.mjs 8143` (reused, then restarted after an unrelated drop).

| Check | Result |
| --- | --- |
| `node tools/rules-check.mjs` | pass |
| `STRICT_V2=1 node tools/charm-content-check.mjs` | pass (2660 charm/strength checks; all extension modules OK) |
| `VOYAGE_TEST_URL=http://[::1]:8143 node tools/charm-runtime-check.mjs` | pass; 12 screenshots in `/tmp/k3-shots-8143`; no console/page errors |

The first runtime run failed only the sticker coexistence assertion: `dev.survey` marks column 0's top card (deal 1 → 45), while the fixture hardcoded card 19. That is a K3 test bug, not a mark-channel bug. `tools/charm-runtime-check.mjs` now stickers the live survey card. Rerun passed, including same-card `wanted` + `sticker-wild` after resume.

Production Voyage board (Puppeteer, same origin, no `_examples.js` injection) for the five named charms:

| Charm | API | Result |
| --- | --- | --- |
| Holo-Scan (`space.holoscan`) | `hint()` | Played one solver move, spent one use, status `HINT PLAYED.` Classic `H` stayed blocked. |
| Eye of Horus (`lapis.horus`) | `hint()` + reveal | Played one solver move, spent its use. |
| Koan (`zen.koan`) | `preview(3)` | Line + badges 2/3, no history/state change, use spent. |
| Trailhead (`pinecone.trailhead`) | `resetBoard()` | Restored the deal at 0 run undos / 0 `undosUsed`. |
| Lagoon Lounge (`aero.lounge`) | `openUndoWindow()` | Free undo of auto+manual at 0 run undos; window closed on the next forward move. |

No page/script errors on that pass. Screenshots: `/tmp/k3-prod-shots`.

### Not K3 (reported, not edited)

Charm HUD art 404s for the renamed IDs `zen.koan` and `pinecone.trailhead`. Files on disk are still `assets/art/charms/zen.mindful.webp` and `assets/art/charms/pinecone.compass.webp`. Holo-Scan, Eye of Horus, and Lagoon Lounge already have matching webp files. Content/art owners should add or rename those two assets; abilities still ran (glyph fallback).

## Deferred

No K3 runtime feature is deferred. Per-theme family/upgrade migration and explicit free/reset guards in the four legacy content hooks belong to the content authors. Port/economy hook dispatch and solver-visible rules remain K2/K1 ownership respectively.
