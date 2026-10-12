# Voyage charms: first-pass design (38 themes × 3 boons + 1 challenge)

Status: first-pass design, being built. Numbers are starting points for playtest tuning.

Every theme gets three **boons** (picked after its board and kept for the rest of the run) and one **challenge** (active on that theme's board, scaled by **strength** `s` = board number 1..7). The challenge scales by strength, so the same theme is gentle on board 1 and harsh on board 7. That strength is the challenge's difficulty slider.

The build happens in two phases:

1. **Kernel** (§2, §3): the engine primitives every charm is written against. Two agents, split by file ownership: **K1 Rules kernel** (solver-visible rules) and **K2 Runtime kernel** (events, scoring context, abilities, marks, concealment, charm moves, UI).
2. **Content** (§5): the 152 charms. Simple charms (`S`) are pure configuration of kernel primitives and are written per theme in `js/voyage/content/<theme>.js`. Complex charms (`C`) each have their own module in `js/voyage/content/special/<id>.js`.

---

## 1. Design rules

- **Boons only add capability.** A boon may never make a winnable position unwinnable. Deals are verified under the charm-less ruleset (boss doc §0.3), so this rule is what keeps every board winnable.
- **Challenges come in two kinds.** *Rule* challenges set solver-visible rules, so the dealer verifies the deal under them. *Pressure* challenges only touch score, stars, undos or visibility, so they can never make a board unwinnable.
- **Score from history, not from events.** Points must be computable from the final move history, which already excludes undone moves. Events (`on.*`) are for undo grants, notifications and badges. An event-granted undo must be capped per board, so undo/redo loops can't farm it.
- **Seeded randomness only.** Use `ctx.rng` (or `ctx.rng` in `rules` ctx, see §2.3), never `Math.random`.
- **No pure convenience or inconvenience.** A charm must change what's possible, not just how many clicks a legal plan takes. A sequence move is shorthand for single moves through free cells and empty columns, so capping it below `(cells+1) × 2^emptyCols` only forces card-by-card play (removed: Hand Carry, Power Rationing, the old Root Bound). Raising it above that (Overclock, Colonnade, Zip Line) is real help. Likewise, an ability that only plays moves the player could make anyway (the old Powder Keg's auto-home) isn't a charm. Information (hints, concealment) and resources (undos, peeks) do count.
- **Tags.** Each challenge has `tags` drawn from `CELLS`, `STACK`, `FOUND`, `COLUMN`, `MOVE`, `VIS` and `SCORE`. They're used to stop a theme's challenge and the boss from stacking the same restriction.
- **Text.** One sentence for the tooltip. For challenges, `text(s)` states the actual numbers at that strength.

### Ease guidance (until K1 publishes measured numbers in §2.5)

`ease` is in difficulty tiers (+1 means the board feels one tier easier). The dealer offsets 60% of it.

| Effect class | Suggested ease |
| --- | --- |
| Score/stars/undo-only charm | 0 |
| Small solver-visible help (wild rank, +1 move cap, one suit builds in suit) | +0.15 to +0.3 |
| Big help (+1 free cell: modeled exactly by the bank, so **no ease**; emptyFactor 3, foundation return, aces home) | +0.3 to +0.5 |
| Rule challenge, per strength | −0.04 (light) / −0.07 (medium) / −0.1 (heavy) × s |
| Visibility (conceal) challenge | about −0.05 × s |

---

## 2. K1: Rules kernel (solver-visible)

Files owned: `js/rules.js`, `js/shortsolve.js`, `js/difficulty.js`, `js/solver.worker.js`, `js/voyage/boardrules.js`, `js/voyage/dealer.js`, `js/voyage/dealer.worker.js`, `js/table.js` (cell and column state visuals), and in `js/main.js` **only** the game construction in `dealGame`, drag/drop legality (`dropAction`-style helpers around the `canDropTableau` / `canStackOn` / `moveToFreeCell` calls), auto-play (`safeFoundationMoves` and related), the hint/solve call sites and the Voyage stuck check's solver call.

### 2.1 `BoardRules` fields

`baseRules()` gains all of the fields below with their neutral defaults. Every field must be honoured identically by: move generation and the solver (`generateMoves`, `solve`, `hashState` where the state needs it), `Game` legality (player moves), `maxMoveSize`, `runLength` / `isValidSequence` / `sequenceStart` (so drag-run detection matches stacking), safe auto-play (`safeToFoundation`, `safeFoundationMoves`, `canFinishWithFoundationOnly`), hints, and the dealer worker. `rulesKey(r)` must encode every non-default field. Rules travel with the board (`run.current.rules`) and are saved, so keep them JSON-plain.

| Field | Default | Kind | Meaning |
| --- | --- | --- | --- |
| `freeCells` | 4 | both | exists |
| `moveBonus` | 0 | both | added to sequence-move capacity; result floored at 1 |
| `emptyFactor` | 2 | both | capacity = `(cells+1) × emptyFactor^emptyCols + moveBonus` (1 = empty columns don't help, 3 = triple) |
| `wildRanks` | 0 | help | bitmask over ranks 1..13 (bit r). A card of a wild rank ignores colour when stacking, both as the moving card and as the card it lands on. Rank order still applies |
| `suitBuild` | 0 | help | bitmask over suits 0..3. Cards of these suits may also be built down in suit (same suit, rank−1) |
| `foundationReturn` | false | help | the top card of a foundation may move back onto a legal tableau spot or an empty free cell. New move type `{t:'R', suit, to:{kind:'col'|'free', i}}`. Never auto-played, and the solver only generates it if cheap; it's fine for the solver to ignore it (help) |
| `startHome` | 0 | help | every card of rank ≤ n starts on its foundation (removed from the deal; columns keep their order) |
| `noCellRanks` | 0 | restrict | bitmask: cards of these ranks can't enter free cells |
| `noCellCards` | [] | restrict | card ids that can't enter free cells |
| `barren` | null | restrict | `{suits: mask, ranks: mask}`: nothing can be placed onto a card whose suit **and** rank are both in the masks. Dealt columns are exempt (a dealt pile may contain illegal pairs) |
| `foundationSpread` | 0 (off) | restrict | after any foundation move, `max(found) − min(found) ≤ n` |
| `emptyMinRank` | 0 (off) | restrict | an empty column only accepts a sequence whose bottom card has rank ≥ n. When ≥ 2 it also removes empty columns from capacity (they can't be used as parking) |
| `cellThaw` | null | restrict | `{frozen: k, at: [counts…]}`: the last `k` free cells start frozen; one thaws each time cards-on-foundations reaches the next count. A pure function of `found`, so no extra state. Also used as *help* by Heat Lamp (an extra cell that starts frozen) |
| `sealedCols` | [] | restrict | column indices sealed at the deal: a sealed non-empty column accepts no cards; the seal breaks permanently when it empties. Needs a sealed bitmask in the state (`hashState`, apply/undo) |
| `maxHeight` | 0 (off) | restrict | no tableau move may make a column taller than n (dealt columns may start taller only if n < 7, so keep n ≥ 7) |
| `cellColors` | [] | restrict | per-cell colour lock, e.g. `['red', null, 'black', null]`; a locked cell only accepts that colour |
| `oneWayCellRanks` | 0 | restrict | bitmask: a card of these ranks that's in a free cell may only leave to its foundation |

### 2.2 Overrides and custom moves (used by the complex charms)

- `game.override`: a one-shot relaxation consumed by the next successful tableau drop, of the form `{ ignoreColour?, ignoreRank?, ignoreCap?, anyCard? }`. `Game.canDropTableau` / `moveFreeToTableau` / `moveSequenceToTableau` honour it. The move descriptor records `override: {...}` so undo restores it. It's help, so the solver ignores it.
- **Custom (charm) moves:** `applyMove` / `undoMove` delegate `t:'X'` to a registry, `registerCustomMove(op, { apply(st, m, rules), undo(st, m, rules) })`, exported from `rules.js`. `Game.applyCharmMove(m)` applies and pushes it onto history, and `Game.undo()` undoes it like any other move. The solver never generates `X` moves, and `cleanMove` passes them through. Custom moves may also mutate `game.rules`, through a `rules` argument, as long as undo restores them.
- `game.rules`: the `Game` holds the board's rules (constructor option `rules`), and every legality check reads from it. Classic mode passes `baseRules()`-equivalent defaults.

### 2.3 Composition

`composeBoard` (in `boardrules.js`) gives the `rules(r, ctx)` hook a `ctx = { strength, rng, seed, idx }`, where `rng = stream(seed, 'rules', idx, charmId)`, so challenges can pick seeded suits, ranks or columns. `run.js` `boardPlan` passes `seed: run.seed`. It also adds `dealShift` (a charm field: a number or `(ctx) => number`, in tiers, negative = gentler deal) that is applied **uncompensated** to the dealer's target. It's used by Calm Waters and Hayride. `upcomingPlans` and the dealer `planKey` must key on the full `rulesKey`, `ease` and `dealShift`.

### 2.4 Dealer

- Any active *restrict* field (anything except `freeCells` and the help fields) means the board must be verified. `dealFor` must not return an unverified restrict board: try bank candidates in seeded order until one solves (6 s budget each, up to ~8). If none does, retry with the challenge at strength − 1, and record `relaxed: true` on the pick.
- Help-only rule sets don't need verification, because the bank deal is winnable under base rules and help can't break that.
- `startHome` changes the dealt state, so `deal(n, rules)` must apply it, and the `Game` and the workers must all use the same `deal(n, rules)`.

### 2.5 Calibration (short)

Measured on 150 seeded, tier-stratified bank deals (K1-calibration-v1); 100 ms/deal guard, 6 × 2,000-node restarts, full sequence generation, maxDepth 320. Run time: 263.1 s. Each ruleset uses the same seeded search stream.

“Unsolvable” counts only exhausted searches; “unknown” counts budget/depth exhaustion. Median nodes uses solved deals only, so ratios have survivor bias. Ease is a preliminary tier estimate from (failure-to-verify rate + 0.1 × log₁₀ median-node ratio), interpolated between base and base minus one cell, capped at 2 cell-equivalents. One cell equals 1.54 bank tiers. These short-budget estimates guide content tuning; the dealer still verifies each restricted board with its full six-second budget.

| Primitive / parameter | Unsolvable | Unknown | Median solved nodes | × base | × minus cell | Suggested ease (tiers) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (4 cells) | 0.0% | 31.3% | 4184 | 1.00 | 0.94 | 0.00 |
| Base minus one cell | 0.0% | 48.7% | 4457 | 1.07 | 1.00 | -1.54 |
| moveBonus −1 | 0.0% | 40.0% | 4361 | 1.04 | 0.98 | -0.77 |
| moveBonus −2 | 0.0% | 54.7% | 6175 | 1.48 | 1.39 | -2.19 |
| emptyFactor 1 | 0.0% | 38.0% | 4373 | 1.05 | 0.98 | -0.60 |
| emptyFactor 1.5 | 0.0% | 30.0% | 4273 | 1.02 | 0.96 | 0.00 |
| noCellRanks K | 0.0% | 65.3% | 4790 | 1.14 | 1.07 | -3.03 |
| noCellRanks J Q K | 0.0% | 59.3% | 4264 | 1.02 | 0.96 | -2.46 |
| noCellCards 2 | 0.0% | 23.3% | 4224 | 1.01 | 0.95 | 0.00 |
| noCellCards 8 | 0.0% | 42.7% | 4435 | 1.06 | 1.00 | -1.01 |
| barren ♣ K | 0.0% | 42.7% | 4363 | 1.04 | 0.98 | -1.01 |
| barren ♣ 8–K | 0.0% | 87.3% | 4417 | 1.06 | 0.99 | -3.08 |
| foundationSpread 7 | 0.0% | 32.0% | 4258 | 1.02 | 0.96 | -0.07 |
| foundationSpread 3 | 0.0% | 46.0% | 4335 | 1.04 | 0.97 | -1.30 |
| foundationSpread 1 | 0.0% | 76.7% | 4592 | 1.10 | 1.03 | -3.08 |
| emptyMinRank 7 | 0.0% | 27.3% | 4276 | 1.02 | 0.96 | 0.00 |
| emptyMinRank 13 | 0.0% | 58.0% | 3675 | 0.88 | 0.82 | -2.29 |
| cellThaw 1 @8 | 0.0% | 40.0% | 4221 | 1.01 | 0.95 | -0.76 |
| cellThaw 2 @8,20 | 2.0% | 64.0% | 4351 | 1.04 | 0.98 | -3.05 |
| cellThaw 3 @8,20,34 | 43.3% | 44.0% | 4459 | 1.07 | 1.00 | -3.08 |
| sealedCols 1 | 0.0% | 27.3% | 4174 | 1.00 | 0.94 | 0.00 |
| sealedCols 2 | 0.0% | 30.7% | 4326 | 1.03 | 0.97 | 0.00 |
| maxHeight 12 | 0.0% | 26.7% | 4274 | 1.02 | 0.96 | 0.00 |
| maxHeight 7 | 0.0% | 50.0% | 4245 | 1.01 | 0.95 | -1.64 |
| cellColors 1 red | 0.0% | 34.0% | 4268 | 1.02 | 0.96 | -0.24 |
| cellColors 2 red +2 black | 0.0% | 24.0% | 3668 | 0.88 | 0.82 | 0.00 |
| oneWayCellRanks K | 0.0% | 49.3% | 4326 | 1.03 | 0.97 | -1.59 |
| oneWayCellRanks 8–K | 0.0% | 74.0% | 5051 | 1.21 | 1.13 | -3.08 |

Raw per-deal outcomes: `tools/charm-calibration.json`. Re-run: `node tools/charm-calibrate.mjs` (`CALIBRATE_DEALS` / `CALIBRATE_MS` override the sample/budget). Free-cell count is already modeled exactly by the bank; do not add ease for a cell boon or challenge. Restriction estimates that round to zero were indistinguishable from base at this budget; this does not prove they have no human cost.

### 2.6 Visuals (table.js)

- Frozen cells: a frosted lid, and a crack-and-clear when they thaw.
- Sealed columns: a lid with chains across the top, which shatters when the column empties.
- Colour-locked cells: a red or black pip on the slot.
- `emptyMinRank`: a rank glyph in empty column slots.
- `maxHeight`: a faint ceiling line.

Keep all of these theme-neutral and subtle. They're driven from `game.rules` and state.

---

## 3. K2: Runtime kernel (events, scoring, abilities, UI)

Files owned: `js/voyage/charms.js` (runtime part), `js/voyage/content/kit.js` (new helpers for content authors), `js/voyage/scoring.js`, `js/voyage/run.js`, `js/voyage/config.js`, `js/voyage/stats.js`, `js/voyage/ui.js`, `css/voyage.css`, `js/card.js` (card marks / face-down state), `js/fx.js` if needed, `sw.js`, and in `js/main.js` **only** the Voyage section (from `// Voyage mode` to the end of the Voyage helpers) plus card-mesh helpers needed for marks and concealment.

### 3.1 `ctx` passed to hooks

`{ id, kind, strength, rng, api, memo, runMemo, run }`:

- `memo` is per-board saved scratch space (exists).
- `runMemo` is new: per-run saved scratch space for this charm, in `run.charmMemo[id]`.
- `run` is a read-only view: `{ boardIdx, results, boons, undos }`.

### 3.2 `api`

| Call | Effect |
| --- | --- |
| `addUndos(n)` | exists |
| `spendUndos(n)` | take up to n undos from the run (floor 0) |
| `notify(text)` | exists (toast) |
| `badge(text)` | short label on this charm's HUD tray icon (e.g. `"2/3"`, `"♦"`); saved in `memo` and redrawn on resume |
| `mark(cardIds, style)` / `unmark(cardIds)` | card badge overlays. Styles: `gold`, `star`, `glow`, `crack`, `frost`, `hot`, `curse`, `wanted`, `fragile`, `camera`. Rendered as a small corner sigil plus edge tint, and readable without colour (shape differs per style) |
| `conceal(cardIds)` / `reveal(cardIds)` | render face-down. A concealed card is revealed automatically (with a flip) when it becomes the top of its column or moves; emits `on.reveal(ctx, {card})`. Saved in `memo`; `setup` re-applies on resume |
| `hint()` | show the solver's suggested next move (the classic hint path, under `game.rules`) |
| `autoHome()` | send every card that can legally go to a foundation right now, as player moves (they form one chain) |
| `override(o)` | sets `game.override` (§2.2) and shows a "next drop…" chip |
| `charmMove(op, data)` | applies a custom `X` move registered by the charm module (§2.2), animates every card to its new place (generic relayout), records it in history so undo reverts it |
| `setFreeCells(n)` | change the cell count mid-board with relayout (only for a cell **gain**; must be undoable when called from a charm move) |
| `refresh()` | redraw HUD/table state after a rules change |

### 3.3 Events

`start`, `move`, `foundation`, `freecell`, `columnEmpty`, `undo` (now carries `{ move }` — the undone move), `win` and `reveal` (new), plus `stuck` (new). `on.stuck(ctx)` runs before a run is lost as stuck. If any hook returns `true` (it has granted undos), the loss is cancelled.

### 3.4 Abilities (tap-to-use charms)

A charm may declare `ability: { uses: n | (ctx) => n, label, use(ctx) → boolean, available?(ctx) → boolean }`.

- Uses reset each board, and the remaining count is saved in `memo`.
- The HUD tray icon becomes a button with a use-count pip. It's dimmed when `available()` is false or the uses are spent.
- `use()` returning `false` doesn't consume a use.
- `api.abilityBonus` (read) holds the extra uses granted by other charms. Mission Control adds +1 to every ability; `uses` is resolved as `uses + bonus`.
- For targeted abilities (pick a column or card), `use()` may call `api.pick({ kind: 'column'|'card'|'freecell', filter })`, which returns a Promise of the selection. It highlights valid targets and Esc cancels.
- The stuck check must not end a run while an ability with uses left reports `available`.

### 3.5 Scoring context

`scoreBoard(history, par, effects, extra)` gives score hooks `sb.history`, `sb.par`, `sb.elapsed` (seconds), `sb.undosUsed` (this board), `sb.undosLeft` (run, at board end), `sb.initial` (dealt state after `startHome`), `sb.rules` and `sb.boardIdx`. `content/kit.js` provides:

- `replay(sb, fn(move, stateAfter, i))`
- `chainsOf(history)`
- `foundationSequence(history)` (cards in the order they went home)
- `countHome(history, pred)`
- `rankMask(...ranks)`, `suitMask(...suits)`
- `isCourt`, `suitName`, `rankName`

`historyStats.cards` counts `startHome` cards as home, so `startHome` doesn't cost card points.

Live score (HUD) and final score use the same code path.

### 3.6 Run-level hooks

- `offers(n, ctx) → n`: adjusts how many of the three boons are offered after a board. Stars set the base; clamp to 1..3. Called for every held boon.
- `thresholds(arr, ctx) → arr`: adjusts that board's star thresholds; used by both live and final scoring.
- `starCap(ctx) → 1..3`: a challenge may cap a board's stars (Last Orders).
- `onPick(run)` (exists) is given a `ctx`-like second argument with `runMemo`.

### 3.7 UI

- The charm tray shows badges, ability buttons and use pips. Challenge chip tooltips show `text(s)`.
- The intro banner lists the active challenge at its strength.
- The result breakdown shows charm score lines (each charm's own `sb.add` label).
- The map node detail shows real names, icons and texts.
- Remove the `placeholder` styling only for real content.

---

## 4. Build, ownership and verification

- Everyone works in the **same checkout** (the new themes aren't committed yet). Edit only the files you own. Re-read a file right before each edit, and never rewrite a whole file that others share. Never run `git checkout`, `git stash`, `git reset` or `git clean`, and don't commit.
- If you need a game server, use the port you were assigned (`node serve.mjs` takes `PORT`; check `serve.mjs`).
- Content agents verify with: `node -e "import('./js/voyage/charms.js')"` (it loads, 114 boons and 38 challenges, no placeholders for their themes), the unit-style checks in `tools/charm-content-check.mjs` (written by K2), and a headless play-through of at least one board per theme where the tool supports it.

---

## 5. Content

Legend: **S** = simple (kernel config; written in `content/<theme>.js`), **C** = complex (own module in `content/special/<id>.js`). Charm id = `<theme>.<key>`; challenge id = `<theme>.challenge`.

Unassigned ability shapes live in `docs/voyage/parked-abilities.md`. When generating a new charm, claim one of those before inventing a new ability.

### Neo-Classical (`roman`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| legion | Legion | 🛡️ | Tens are wild: they stack on either colour, and either colour stacks on them. | `wildRanks |= bit(10)` | S |
| colonnade | Colonnade | 🏛️ | Empty columns triple, rather than double, how many cards you can move at once. | `emptyFactor = max(cur,3)` | S |
| laurel | Laurel Crown | 🌿 | +60 points for each suit you complete on a board. | score: Kings home × 60 | S |
| challenge | Senate Decree | 📜 | Court cards can't enter free cells: K (s1–2), K Q (s3–4), K Q J (s5–6), K Q J 10 (s7). | `noCellRanks`; tags CELLS | S |

### Neon Grime (`cyber`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| overclock | Overclock | ⚡ | You can move 2 more cards at once. | `moveBonus += 2` | S |
| ghost | Ghost Cell | 👻 | Once per board, open a ghost free cell; it vanishes after the card you park there leaves. | ability → charm move adding a cell (`setFreeCells(n+1)`), removed by a charm move once emptied; undoable | C |
| cache | Cache Hit | 💾 | Your first undo on each board is refunded. | `on.undo` once/board → `addUndos(1)` | S |
| challenge | Packet Loss | 📶 | Some undos cost double: every 3rd (s1–2), every 2nd (s3–5), every one (s6–7). | `on.undo` counter → `spendUndos(1)`; tags SCORE | S |

### Ocean Aero (`aero`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| pocket | Air Pocket | 🫧 | One extra free cell. | `freeCells += 1` | S |
| dolphin | Dolphin Leap | 🐬 | Sending 4+ cards home in a row grants +1 undo (up to 2 per board). | `on.foundation` chain tracking, capped in memo | S |
| lounge | Lagoon Lounge | 🍹 | Efficiency points ×1.3. | `sb.scale('efficiency',1.3)` | S |
| challenge | Riptide | 🌀 | No foundation may get more than max(2, 9−s) ranks ahead of the lowest. | `foundationSpread`; tags FOUND | S |

### Zen Garden (`zen`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| stillness | Stillness | 🪷 | Free-cell placements cost half the usual points. | rebuild `freecells` line at cost 10 | S |
| calm | Calm Waters | 🎐 | Every board is dealt half a tier gentler. | `dealShift: -0.5` | S |
| mindful | Mindful Pace | 🍵 | ×1.15 score when you finish at or under par. | `sb.mult` | S |
| challenge | Raked Sand | 〰️ | Every move over par costs (4 + 2s) points. | score; tags SCORE | S |

### Enchanted Forest (`forest`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| changeling | Changeling | 🧚 | Jacks are wild: they ignore colour when stacking. | `wildRanks` J | S |
| fireflies | Firefly Jar | ✨ | Each board, 4 buried cards glow; +50 for each one you send home. | `setup` picks with rng (not top cards) → `mark(glow)`; score via `countHome` | S |
| moss | Mossy Bed | 🌱 | Clubs may also be built down in suit. | `suitBuild` ♣ | S |
| challenge | Bramble | 🌿 | Nothing can be placed onto Clubs ranked (14 − 2s) or higher. | `barren {♣, ranks ≥ 14−2s}`; tags STACK | S |

### Art Deco (`deco`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| champagne | Champagne Tower | 🥂 | Chain points ×1.6. | `sb.scale('chains',1.6)` | S |
| highroller | High Roller | 🎰 | Lose 2 undos now; every board scores ×1.2. | `onPick` −2, `sb.mult` | S |
| gilded | Gilded Age | 🎺 | +15 for every Jack, Queen and King sent home. | score | S |
| challenge | Dress Code | 🎩 | Empty columns only accept sequences headed by a (6 + s) or higher (Kings only at s7). | `emptyMinRank`; tags COLUMN | S |

### Día de Muertos (`muertos`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| marigold | Marigold Path | 🌼 | Hearts may also be built down in suit. | `suitBuild` ♥ | S |
| ofrenda | Ofrenda | 🕯️ | +20 for every undo you still hold when a board ends. | score from `sb.undosLeft` | S |
| skull | Sugar Skull | 💀 | Once per run, when you'd be stuck with no undos, gain 2 undos instead. | `on.stuck` + `runMemo` | S |
| challenge | Veil of Marigolds | 🎭 | 2s + 1 random buried cards start face-down until uncovered. | `setup` → `conceal`; tags VIS | S |

### Deep Space Station (`space`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| holoscan | Holo-Scan | 🔭 | Twice per board, show the best next move. | ability uses 2 → `hint()` | S |
| tractor | Tractor Beam | 🛸 | Once per board, pull any face-up card out of the middle of a column into an empty free cell. | ability + `pick(card)` + charm move | C |
| mission | Mission Control | 🛰️ | +2 undos now, and every ability charm gets one extra use per board. | `onPick`, `abilityBonus` | S |
| challenge | Magnetic Storm | 🧲 | Nothing can be placed onto red Kings (s1–3), red Kings or Queens (s4–5), or red Kings, Queens or Jacks (s6–7). | `barren {♦♥, ranks}`; tags STACK | S |

### Azulejo (`azulejo`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| tessellate | Tessellation | 🔷 | +10 for each card sent home with the same rank as the card sent home before it. | `foundationSequence` | S |
| fountain | Courtyard Fountain | ⛲ | +10 for each card moved from a free cell back onto a column. | score | S |
| kiln | Kiln | 🔥 | +1 undo for every 13 cards sent home (up to 3 per board). | `on.foundation` thresholds in memo | S |
| challenge | Cracked Tiles | 🧱 | 1 + s cracked cards; −30 each time one enters a free cell. | `setup` → `mark(crack)`; score; tags SCORE | S |

### Jet Set (`jetset`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| overhead | Overhead Bin | 🧳 | One extra free cell. | `freeCells += 1` | S |
| firstclass | First Class | 💺 | Par is 15% higher when scoring. | recompute `efficiency` line | S |
| flyer | Frequent Flyer | ✈️ | +1 undo after every board you clear, +1 more for 3★. | `on.win` | S |
| challenge | Layover | ⏳ | Finish within (17 − s) minutes; each minute over costs 5% of the board score (up to 50%). | `sb.elapsed`; tags SCORE | S |

### Riverboat Royale (`riverboat`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| sleeve | Ace in the Sleeve | 🂡 | Aces start on the foundations. | `startHome = max(cur,1)` | S |
| dealer | Dealer's Choice | 🎴 | 2★ and 3★ thresholds are 8% lower. | `thresholds` | S |
| edge | House Edge | 🎲 | Each board scores +5% per star you earned on the previous board. | `sb.mult` from `run.results` | S |
| challenge | Ante | 🪙 | The board starts at −30s points; each chain of 5+ wins back 15s (twice at most). | score; tags SCORE | S |

### Coastal Carvings (`carvings`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| raven | Raven's Trick | 🐦‍⬛ | Once per board, swap the top cards of two columns. | ability + `pick(column)` ×2 + charm move | C |
| orca | Orca Pod | 🐋 | Emptying a column grants +1 undo (up to 2 per board). | `on.columnEmpty` capped | S |
| totem | Totem Pole | 🪵 | +40 for each column you empty (each column once per board). | `replay` | S |
| challenge | Longhouse Beams | 🏠 | No column may grow taller than 16 − s cards. | `maxHeight`; tags COLUMN | S |

### Varsity Club (`varsity`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| hattrick | Hat Trick | 🏅 | +2 undos after every 3★ board. | `on.win` | S |
| spirit | Team Spirit | 📣 | Every board scores +3% per charm you hold. | `sb.mult` | S |
| comeback | Comeback | 💪 | ×1.15 on any board where you used 2+ undos. | `sb.undosUsed` | S |
| challenge | Rivalry | 🏈 | Star thresholds are 4s% higher. | `thresholds`; tags SCORE | S |

### Driftwood Bay (`driftwood`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| net | Spare Net | 🪢 | +4 undos now. | `onPick` | S |
| breeze | Fair Breeze | 🌬️ | Your first 3 free-cell placements on each board cost no points. | rebuild `freecells` line | S |
| catch | Catch of the Day | 🐟 | Each board picks a suit; its cards are worth +8 each when sent home. | `setup` rng suit → `badge`; score | S |
| challenge | Fog Bank | 🌫️ | Only the top max(2, 7 − s) cards of each column start face-up. | `setup` → `conceal`; tags VIS | S |

### Camp Pinecone (`pinecone`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| badge | Merit Badge | 🎖️ | +120 on any board where you place 3 or fewer cards in free cells. | score | S |
| compass | Pocket Compass | 🧭 | Once per board, show the best next move. | ability → `hint()` | S |
| campfire | Campfire | 🏕️ | At the start of each board, +1 undo if you hold fewer than 3. | `on.start` | S |
| challenge | Leave No Trace | 🍂 | Each move that fills your last empty free cell costs 8s points. | `replay`; tags SCORE | S |

### Winterglass (`winterglass`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| prism | Prism | 💎 | Queens are wild: they ignore colour when stacking. | `wildRanks` Q | S |
| snowdrift | Snowdrift | ❄️ | Your free-cell point budget is 200 higher. | adjust `freecells` line | S |
| globe | Snow Globe | 🌨️ | The first time each board you fill your last free cell, gain +1 undo. | `on.freecell` once/board | S |
| challenge | Brittle Glass | 🧊 | Each free-cell placement after the max(2, 8 − s)th costs 40 points. | score; tags SCORE | S |

### Concrete Playground (`concrete`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| bankshot | Bank Shot | 🏀 | +12 for each card sent home straight from a free cell. | score | S |
| mixtape | Mixtape | 📼 | Your longest chain on each board scores double. | score | S |
| spraytag | Spray Tag | 🎨 | Once per board, your next drop on a column ignores colour. | ability → `override({ignoreColour})` | C |
| challenge | Shot Clock | ⏱️ | Every 24 moves in a row without sending a card home costs 10s points. | `replay`; tags SCORE | S |

### Midnight Library (`library`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| lending | Lending Desk | 📚 | You may move the top card of a foundation back onto a column or into a free cell. | `foundationReturn` | S |
| bookmark | Bookmark | 🔖 | Once per board, set a bookmark; later, rewind every move since it for a single undo. | ability (two-phase) + batch undo | C |
| quiet | Quiet Study | 🤫 | ×1.1 on any board where you use no undos. | score | S |
| challenge | Overdue | ⏰ | Each card that stays in a free cell longer than (14 − s) moves costs 25 points. | `replay`; tags SCORE | S |

### Glasshouse Conservatory (`conservatory`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| graft | Grafting | 🌿 | Fives are wild: they ignore colour when stacking. | `wildRanks` 5 | S |
| mist | Misting System | 💧 | Red cards cost no points in free cells. | rebuild `freecells` line | S |
| seedbank | Seed Bank | 🌰 | Every board scores +40 for each 3★ board earlier in the run. | score from `run.results` | S |
| challenge | Root Bound | 🪴 | Cards ranked 2 to 1 + ⌈s/2⌉ that enter a free cell can only leave to their foundation. | `oneWayCellRanks`; tags CELLS | S |

### Daylight Express (`nighttrain`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| ontime | On Time | 🕰️ | ×1.15 on any board finished in under 6 minutes. | `sb.elapsed` | S |
| coupling | Express Coupling | 🔗 | You can move 1 more card at once. | `moveBonus += 1` | S |
| railpass | Rail Pass | 🎫 | You're offered one more charm after each board (up to 3). | `offers` | S |
| challenge | Timetable | 🚉 | Par is 5s% shorter. | score par adjust; tags SCORE | S |

### Saffron Court (`saffron`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| spice | Spice Blend | 🌶️ | +30 each time all four foundations reach the same rank. | `replay` | S |
| silkroad | Silk Road | 🐫 | One extra free cell on boards 5–7. | `rules` uses `ctx.idx` | S |
| loom | Loom | 🧵 | +5 for each move of 3+ cards at once. | score | S |
| challenge | Woven Pattern | 🧶 | Each time 3+ cards of the same colour go home in a row, lose 10s points. | `foundationSequence`; tags SCORE | S |

### Amber Harvest (`harvest`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| cellar | Root Cellar | 🥔 | At the start of each board, +1 undo for every 4 you hold (up to +2). | `on.start` | S |
| hayride | Hayride | 🚜 | Your next 2 boards are dealt a full tier gentler. | `dealShift` from `runMemo` countdown | S |
| gleaning | Gleaning | 🌾 | +10 for every Ace and 2 sent home. | score | S |
| challenge | Windfall Tax | 🍏 | Each card sent home on its own (not in a chain of 2+) costs 2 + s points. | `chainsOf`; tags SCORE | S |

### Carnival Nocturne (`carnival`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| wheel | Prize Wheel | 🎡 | Each board spins a score multiplier between ×1.0 and ×1.3. | `setup` rng → `badge`; `sb.mult` | S |
| ringmaster | Ringmaster | 🎪 | Nines are wild: they ignore colour when stacking. | `wildRanks` 9 | S |
| ticket | Ticket Stub | 🎟️ | Each board cleared with 2★+ earns a ticket; at 3 tickets, gain +3 undos. | `on.win` + `runMemo` | S |
| challenge | Rigged Booth | 🎯 | One suit's cards ranked (14 − 2s) and up can't enter free cells. | `noCellCards` (rng suit); tags CELLS | S |

### Canyon Turquoise (`canyon`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| turquoise | Turquoise Inlay | 💠 | Sixes are wild: they ignore colour when stacking. | `wildRanks` 6 | S |
| bloom | Desert Bloom | 🌵 | +2 undos when you clear a board at or under par without using an undo. | `on.win` | S |
| echo | Echo Canyon | 🔊 | Undoing a free-cell placement refunds the undo. | `on.undo` (move.t==='C') | S |
| challenge | Two-Tone Strata | 🏜️ | Free cells are colour-locked: 1 red-only (s1–2), 1 red + 1 black (s3–4), 2 + 2 (s5–7). | `cellColors`; tags CELLS | S |

### Low Tide (`lowtide`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| tidepool | Tide Pool | 🦀 | Once per board, wash a free-cell card back under the bottom of any column. | ability + `pick` + charm move | C |
| ebb | Ebb and Flow | 🌊 | +1 undo every 20 moves (up to 2 per board). | `on.move` | S |
| starfish | Starfish | ⭐ | +75 for every chain of 5+ cards home. | `chainsOf` | S |
| challenge | Barnacles | 🐚 | Nothing can be placed on the Kings of 1 + ⌊(s−1)/2⌋ suits. | `barren {rng suits, K}`; tags STACK | S |

### Between Shows (`theater`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| understudy | Understudy | 🎭 | Once per board, place a free-cell card on any column, ignoring rank and colour. | ability → `override({ignoreRank, ignoreColour})` limited to free-cell source | C |
| curtain | Curtain Call | 🎬 | +150 when a board ends with a chain of 13+ cards. | `chainsOf` | S |
| encore | Encore | 👏 | After a 3★ board, the next board scores ×1.15. | `run.results` | S |
| challenge | Stage Directions | 📜 | Suits must be completed in a set order; each one finished out of turn costs 25s points. | rng order → `badge`; `foundationSequence`; tags SCORE | S |

### Obsidian Forge (`forge`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| anvil | Anvil | ⚒️ | Spades may also be built down in suit. | `suitBuild` ♠ | S |
| temper | Temper | 🔥 | Free-cell points ×2. | `sb.scale('freecells',2)` | S |
| ingot | Ingot | 🧱 | +25 per King sent home, and +1 undo when the 4th King goes home. | score + `on.foundation` | S |
| challenge | Hot Iron | 🌡️ | 1 + s hot cards; once moved, each must reach its foundation within 10 moves or cost 40 points. | `mark(hot)`; `replay`; tags SCORE | S |

### Frontier Saloon (`saloon`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| seven | Lucky Seven | 🎲 | Sevens are wild: they ignore colour when stacking. | `wildRanks` 7 | S |
| wanted | Wanted Poster | 📜 | Each board, one buried card is wanted; +120 when it goes home. | `setup` → `mark(wanted)` | S |
| tab | Run a Tab | 🍺 | +4 undos now; then −1 undo after each of your next 4 cleared boards. | `onPick` + `on.win` + `runMemo` | S |
| challenge | Jailhouse | 🔒 | A card ranked (14 − 2s) or higher that enters a free cell can only leave to its foundation. | `oneWayCellRanks`; tags CELLS | S |

### Pharaoh's Tomb (`lapis`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| ankh | Ankh | ☥ | Sending a King home grants +1 undo (up to 2 per board). | `on.foundation` | S |
| canopic | Canopic Jars | 🏺 | Free cells never cost points. | `freecells` line = full budget | S |
| horus | Eye of Horus | 👁️ | Once per board, show the best next move and uncover up to 3 face-down cards. | ability → `hint()` + `reveal` | S |
| challenge | Sealed Tombs | ⚱️ | 1 (s1–3) or 2 (s4–7) columns are sealed: they accept no cards until emptied. | `sealedCols` (rng, non-adjacent); tags COLUMN | S |

### Canopy Station (`canopy`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| zipline | Zip Line | 🪢 | Once per board, move a valid sequence of any length in one go. | ability → `override({ignoreCap})` | C |
| cameratrap | Camera Trap | 📷 | 3 rare cards are marked each board: +60 each sent home, +1 undo when all 3 are home. | `mark(camera)`; score + `on.foundation` | S |
| mistnet | Mist Net | 🕸️ | Aces, 2s and 3s cost no points in free cells. | rebuild `freecells` line | S |
| challenge | Leeches | 🪱 | Each undo also costs 15s points. | score from `sb.undosUsed`; tags SCORE | S |

### Cherry Counter (`diner`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| blueplate | Blue Plate Special | 🍽️ | Each board features a rank; its four cards are worth +20 each when sent home. | `setup` rng rank → `badge` | S |
| coffee | Bottomless Coffee | ☕ | +1 undo at the start of every board. | `on.start` | S |
| tipjar | Tip Jar | 🫙 | Every board scores +25 per board already cleared this run. | `run.results.length` | S |
| challenge | 86'd | 🚫 | 1 (s1–3), 2 (s4–6) or 3 (s7) ranks can't enter free cells (never Aces or Kings). | `noCellRanks` (rng); tags CELLS | S |

### Treasure Cove (`cove`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| treasure | Buried Treasure | 💰 | The deepest card of one column is treasure: +150 when it goes home. | `setup` → `mark(gold)` | S |
| keg | Lucky Doubloon | 🪙 | Once per board, take back your last move without spending an undo. | ability → `rewind` + refund | S |
| parrot | Parrot | 🦜 | The first time on each board you send a card home from a free cell, +1 undo. | `on.foundation` with free-cell source | S |
| challenge | Cursed Gold | 🪙 | 1 + s cursed cards; each move one spends in a free cell costs 3 points. | `mark(curse)`; `replay`; tags SCORE | S |

### High Keep (`keep`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| siegeengine | Siege Engine | 🪨 | Once per board, break an obstacle: unseal a column, thaw a frozen cell or uncover a face-down column; with none, refund an undo. | ability + charm move mutating `game.rules`/state | C |
| banner | Banner | 🚩 | You're always offered at least 2 charms after a board. | `offers` | S |
| hearth | Hearth | 🔥 | +1 undo at the start of board 4 and +2 at the start of the final board. | `on.start` with `run.boardIdx` | S |
| challenge | Siege | 🏹 | Free-cell placements cost 10s points (s1–2); one fewer free cell (s3–7). | score / `freeCells −= 1`; tags CELLS | S |

### Deep Storage (`deepstorage`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| clearance | Clearance | 🪪 | Face-down cards on your boards start face-up; on boards without any, +1 undo. | `setup` (after challenge) → `reveal` all; else `on.start` | S |
| redundancy | Redundancy | 💽 | Every 3rd undo you spend is refunded. | `on.undo` counter in `runMemo` | S |
| archive | Archive | 🗄️ | One extra free cell. | `freeCells += 1` | S |
| challenge | Redacted | ⬛ | 1 + ⌊s/2⌋ columns are face-down below their top card until uncovered. | `setup` rng cols → `conceal`; tags VIS | S |

### Café at Dawn (`cafe`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| espresso | Espresso Shot | 🫘 | Your first 5 moves on each board don't count against par. | efficiency line recomputed | S |
| regulars | Regulars | 🪑 | +3% score per consecutive 2★+ board before this one (up to +15%). | `run.results` | S |
| pastry | Pastry Case | 🥐 | +10 for every Ace, 2 and 3 sent home within your first 30 moves. | `replay` | S |
| challenge | Last Orders | 🔔 | Finish within (19 − s) minutes or this board is capped at 2★. | `starCap`; tags SCORE | S |

### Arctic Station (`arctic`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| aurora | Aurora | 🌌 | Each chain of 6+ cards home is worth ×1.1 on the board (up to ×1.3). | `chainsOf` → `sb.mult` | S |
| heatlamp | Heat Lamp | 💡 | One extra free cell, frozen until 13 cards are home. | `freeCells += 1`, `cellThaw` help (frozen +1, at [13]) | S |
| sled | Sled Team | 🛷 | +1 undo each time a foundation first reaches 7 (up to 2 per board). | `on.foundation` | S |
| challenge | Deep Freeze | 🧊 | 1 (s1–4) or 2 (s5–7) free cells start frozen and thaw at 8 and 20 cards home. | `cellThaw`; tags CELLS | S |

### Fossil Hall (`museum`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| digsite | Dig Site | ⛏️ | Once per board, lift the deepest card of a column to the top of that column. | ability + `pick(column)` + charm move | C |
| fossil | Fossil Record | 🦴 | Your first chain of 6+ cards on each board grants +1 undo. | `on.foundation` | S |
| docent | Docent | 🎟️ | Once per board, show the best next move. | ability → `hint()` | S |
| challenge | Fragile Exhibits | 🏺 | 1 + s fragile cards; −25 each time one moves again after its first move (except to its foundation). | `mark(fragile)`; `replay`; tags SCORE | S |

### The Mint (`mint`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| sterling | Sterling | 🪙 | Diamonds may also be built down in suit. | `suitBuild` ♦ | S |
| interest | Compound Interest | 📈 | Each board scores +4% per board already cleared. | `sb.mult` | S |
| treasury | Treasury | 🏦 | +2 undos after every board you clear without using an undo. | `on.win` | S |
| challenge | Small Change | 🪙 | Cards ranked 2 to 1 + ⌈s/2⌉ can't enter free cells. | `noCellRanks`; tags CELLS | S |

### The Toy Box (`toybox`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| foursquare | Four Square | ⬛ | Fours are wild: they ignore colour when stacking. | `wildRanks` 4 | S |
| jackinbox | Jack-in-the-Box | 🎁 | Once per board, your next drop ignores rank. Colour still has to match. | ability → `override({ignoreRank})` | C |
| tidyup | Tidy Up | 📦 | +40 points each time you empty a column. | `replay` | S |
| challenge | Tipped Tower | 🧱 | One suit's middle cards won't hold anything: the 6s at s1, growing to 4 through 10 at s6–7. | `barren`; tags STACK | S |

### Prize Lights (`prizelights`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| puzzle | Today's Puzzle | 🎡 | Each board, one rank from 3 through 10 is wild. | `wildRanks` from `rules` rng | S |
| applause | Applause | 👏 | +25 per card in the longest run home, when that run is at least 4. | `sb.stat.chains` | S |
| champion | Returning Champion | 🏆 | If the previous board was 3★, start this one with +1 undo. | `on.start` | S |
| challenge | Lockout | 🔒 | A consecutive block of ranks can't enter free cells: 1 rank (s1–2), 2 (s3–5), 3 (s6–7). Never Aces. | `noCellRanks`; tags CELLS | S |

### Safety Pin (`safetypin`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| threechords | Three Chords | 🎸 | Threes are wild: they ignore colour when stacking. | `wildRanks` 3 | S |
| safetypin | Safety Pin | 📌 | One buried card is pinned. Sending it home grants +1 undo. | `mark` + `on.foundation` | S |
| zine | Zine | 📰 | +30 for each Jack and Queen sent home. | score | S |
| challenge | No Re-entry | 🚪 | Ranks 2 through 1 + ⌈s/2⌉ that enter a free cell can leave only to their foundation. | `oneWayCellRanks`; tags CELLS | S |

### Honey House (`honeyhouse`)
| key | Name | Icon | Effect | Impl | |
| --- | --- | --- | --- | --- | --- |
| forager | Forager | 🐝 | The first time each suit reaches 5 cards home, +1 undo, up to 2 per board. | `on.foundation` | S |
| nectar | Nectar | 🍯 | +12 for every heart sent home. | score | S |
| stores | Winter Stores | 🛖 | From board 4 on, start with +1 undo and score that board ×1.05. | `on.start` + `sb.mult` | S |
| challenge | Capped Comb | 🍯 | One suit's queens are capped, and the seal spreads downward: Queens (s1–2), jack–queen (s3–4), 9–queen (s5–6), 7–queen (s7). Kings stay open. Marked with the `cap` overlay. | `barren`; `mark(…, 'cap')`; tags STACK | S |

---

## 6. Complex charms (C): the 10 special modules

| id | Mechanic family | Notes |
| --- | --- | --- |
| `cyber.ghost` | dynamic extra cell | gain is undoable; the cell closes only when emptied; never removes an occupied cell |
| `space.tractor` | targeted charm move | target any face-up non-top card that isn't concealed; needs an empty free cell; the column order of the remaining cards is unchanged |
| `carvings.raven` | targeted charm move | two different non-empty columns; may create illegal pairs (dealt-pile semantics) |
| `concrete.spraytag` | one-shot override | override is cleared by undo of the drop (restore the use) |
| `library.bookmark` | batch rewind | rewind = undo N moves for 1 run undo; bookmark is cleared by an earlier undo past it |
| `lowtide.tidepool` | targeted charm move | free-cell card → bottom (index 0) of the chosen column |
| `theater.understudy` | one-shot override | only from a free cell; consumed on the drop |
| `canopy.zipline` | one-shot override | ignores the capacity limit only; the sequence must still be valid |
| `toybox.jackinbox` | one-shot override | ignores rank only; colour, runs, seals, height and one-way cells still apply |
| `keep.siegeengine` | rule-mutating charm move | unseal (clear the sealed bit), thaw (frozen −1), uncover (reveal one column); undo restores |
| `museum.digsite` | targeted charm move | moves `col[0]` to the top; not allowed on concealed cards (reveals it) |

Each C module must: register its custom move op (`registerCustomMove`), keep score and history consistent (decide whether an `X` move counts as a player move: it does), handle undo, restore its state on resume, and add checks to `tools/charm-content-check.mjs`.
