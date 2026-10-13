# Voyage charm overhaul — systems spec (v2)

Status: being built on branch `charm-overhaul`. This is the source of truth for the overhaul's **systems and kernel interfaces**. The per-theme roster lives in `ROSTER.md` (same folder). The original design rules in `docs/voyage/charms-design.md` §1 still apply unless this file overrides them.

## 0. Goals

1. **Every pick is a real decision.** No flat bonuses dressed up as conditions (a board only scores when won, and a win sends all 52 cards home, so "+N per heart" is a constant). Each theme trio should offer three charms that change the run in *different* ways.
2. **Score and coins matter.** Board score still sets stars (offers). A new **coin** track feeds **ports**, where the player shops, sells, upgrades and buys card stickers.
3. **Builds.** Families, upgrades, stickers and synergy charms let a run develop an identity.
4. **New rule shapes** for boons, challenges and bosses, so the finale and the restrictions stop repeating six ideas.
5. **Fix what's broken**: dead hint buttons in Voyage, undo faucets, copies.

## 1. Glossary

- **Boon / challenge / boss**: as before (`kind`).
- **Family**: one of `cells`, `columns`, `wild`, `suit`, `foundation`, `ability`, `undo`, `coin`, `vision`, `sticker`, `fortune` (deal shaping, offers, run-level luck). Every boon declares `family`. UI shows a family glyph.
- **Level**: 1 or 2. Bought at a port ("upgrade"). Boons declare `upgrade: 'one-sentence level-2 text'` and read `ctx.level`.
- **Coins** (`⛁`): run currency. Earned at board end; spent at ports.
- **Sticker**: a persistent per-card enhancement for the rest of the run (`run.stickers[cardId] = type`).
- **Port**: a between-boards shop screen reached after clearing a harbour node.
- **Curse**: a challenge that only applies pressure (score, coins, undos, stars, visibility). Declared `pressure: true`. Its chip says "Curse"; rule challenges say "Rule".

## 2. Rules kernel additions (K1 — solver-visible)

All new fields join `RULE_DEFAULTS` in `js/rules.js` with neutral defaults and must be honoured identically by move generation, the solver, `Game` legality, `maxMoveSize`, `runLength` / `isValidSequence` / `sequenceStart`, safe auto-play, hints, the dealer worker and `rulesKey`. Help fields don't need verification; restrict fields must be added to `hasRestrictions` (`js/voyage/boardrules.js`). JSON-plain only.

| Field | Default | Kind | Meaning |
| --- | --- | --- | --- |
| `wildCards` | `[]` | help | card ids that ignore colour when stacking (as the moving card and as the card landed on). Rank order still applies. Used by Wild stickers. |
| `anchorCards` | `[]` | help | card ids that **anything** may be placed on (any rank, any colour). The pair (anchor, child) is a valid link inside a run. Barren still wins if the anchor is barren. Used by The Fool. |
| `freeCards` | `[]` | help | card ids exempt from every free-cell restriction (`noCellRanks`, `noCellCards`, `cellColors`, `oneWayCellRanks`, `cellLimits`). Used by Key stickers. |
| `buildUp` | `0` | help | suit mask: cards of these suits may also be placed on a card one rank **lower** of the opposite colour (a 6♦ on a black 5). Runs are any chain of valid pairs. |
| `suitRunFree` | `false` | help | a run whose cards are all one suit ignores the move-capacity limit (it still needs a legal destination). |
| `cellLimits` | `[]` | help/restrict | per cell index, `null` or `{ maxRank }` — that cell only accepts cards ranked ≤ maxRank. A limit on a cell index ≥ 4 is **help** (it decorates a bonus cell); a limit on cells 0–3 is restrict. |
| `emptyMaxRank` | `0` (off) | restrict | an empty column only accepts a sequence whose bottom card has rank ≤ n. When set, empty columns don't multiply capacity (same treatment as `emptyMinRank ≥ 2`). |
| `cellClose` | `null` | restrict | `{ at: [h1, h2, …] }`: once cards-home ≥ h_k, the k-th cell from the right is **closed while empty**. A card already in a closing cell stays and may leave normally; after it leaves, that cell is closed. Pure function of state (home count + occupancy). Capacity counts only open empty cells. |
| `gate` | `null` | restrict | `{ suit, after }`: that suit's foundation accepts nothing until at least `after` cards of the *other* suits are home. Pure function of `found`. |
| `dealSkew` | `null` | restrict | array of 8 column lengths summing to 52 − (cards removed by `startHome`) — or a named preset `'slope'` ( [10,9,8,7,6,5,4,3] ), `'valley'` ([4,6,7,9,9,7,6,4]) — applied by `deal(n, rules)`: the shuffled sequence is dealt round-robin into columns that still have room. Changes the dealt state, so the dealer verifies it. |
| `phase` | `null` | restrict | `{ at: h, rules: { …overrides } }`: when cards-home ≥ h, the override fields replace the base fields. Overrides are limited to fields that are evaluated with the state available: `noCellRanks`, `oneWayCellRanks`, `foundationSpread`, `emptyMinRank`, `emptyMaxRank`, `gate`. Used by the Eclipse boss. Auto-play under a phase must be safe in **both** phases (only auto-play a card that `safeToFoundation` approves under each). |
| `rankShift` | `{}` | help | `{ cardId: ±1 }`: for stacking purposes only, that card counts as one rank higher/lower (as parent and as child). Foundations ignore it. Mutated mid-board by the Promotion ability through an undoable `X` move. Solver may treat it as given (it is just a different build table). |

Notes:
- The build table in `compileRules` (`out.build`) is where `wildCards`, `anchorCards`, `buildUp`, `rankShift` belong. `runLength(column, rules)` already uses `builds()` pairwise, so these compose.
- `game.rules` can be mutated by charm X moves; compiled rules must not go stale (check how `resolved()` caches).
- `deal(n, rules)` must apply `dealSkew` before `startHome` and `sealedCols` logic, and the Game, workers and dealer must agree.
- New override flag for abilities: `override.ignoreRestrictions` (Skeleton Key): the next placement ignores `barren`, `sealedCols`, `emptyMinRank`, `emptyMaxRank`, `maxHeight`, `cellColors`, `noCellRanks`, `noCellCards`, `cellLimits`, `cellClose` (for a free-cell placement, a closed or frozen cell is still not usable — it ignores bans, not missing cells). Rank and colour still apply. Also `override.rankGap: 2` (Stepping Stone): the next tableau drop may land on a card two ranks higher instead of one (colour rule still applies). Both are recorded on the move descriptor so undo restores the override, like the existing ones.
- Optional stretch (K1, only after everything above is green): **Suit Spur** from `docs/voyage/parked-abilities.md` (fifth foundation). Leave it parked if it puts the rest at risk.


### 2.0b Addendum (sent to K1 after kick-off) — more fields

| Field | Default | Kind | Meaning |
| --- | --- | --- | --- |
| `suitRunFree` | `0` | help | **Changed to a suit mask** (was bool): a run whose cards are all of one suit in the mask ignores the move-capacity limit. All suits = 15. |
| `cellLimits[i]` | | | also accepts `{ minRank }` (cell only takes cards ranked ≥ minRank), alone or with `maxRank`. |
| `emptyAlwaysCounts` | `false` | help | empty columns still multiply move capacity even when `emptyMinRank` / `emptyMaxRank` / `emptyColors` would otherwise remove them (Guest House, a counter to column challenges). |
| `phase.rules` | | | may also override `emptyFactor` and `moveBonus` (capacity is computed with the state, so this is state-only). |
| `cellStack` | `0` | restrict | the first k cells form a stack: a card entering any of them goes into the leftmost empty one of those k, and only the rightmost occupied one of those k may leave. Pure function of state. |
| `pinned` | `null` | restrict | `{ cards: [ids], until: h }`: while cards-home < h, a pinned card may not move at all (not as part of a sequence, not to a cell, not home). Cards above it move freely. |
| `maxEmpty` | `0` (off) | restrict | a move that would leave more than n empty columns is illegal (foundation moves included). |
| `colorSpread` | `0` (off) | restrict | after any foundation move, \|red cards home − black cards home\| ≤ n. |
| `emptyColors` | `[]` | restrict | per column index `null` / `'red'` / `'black'`: when that column is empty it only accepts a sequence whose bottom card has that colour. |
| `barrenCards` | `[]` | restrict | card ids that nothing may be placed onto (dealt piles exempt, like `barren`). |

Parked (not in this pass): Annex (9th column — 8 columns are hard-coded across main.js/table.js layout and hit areas), Bunk Cell (a cell holding two cards changes the state shape), a 53rd Joker card (card ids are 1..52 throughout). The Fool ships as `anchorCards` instead.


### 2.0c Addendum #2 (K1)

| Field | Default | Kind | Meaning |
| --- | --- | --- | --- |
| `cellExitWild` | `false` | help | a card moving **out of a free cell onto a column** ignores colour (rank order still applies). Source-dependent: only the free-cell → tableau move gets it. |
| `openCols` | `0` | help | column mask: **any** single card (or valid run) may be placed onto the top card of these columns, ignoring rank and colour (barren/seals still apply). The loosely placed card does not form a run with the card below it. |


### 2.0d Addendum #3 (K1)

| Field | Default | Kind | Meaning |
| --- | --- | --- | --- |
| `twinStack` | `0` | help | 1: a card may also be placed on a card of the **same rank and opposite colour** (9♠ on 9♥); 2: same rank, any colour. Build-table entry, so runs may contain such pairs. |
| `shallowCols` | `0` | help | columns holding ≤ n cards count as empty **for move capacity only** (they still accept cards normally). |
| `cellLimits[i]` | | | also accepts `{ suits: mask }` (cell only takes cards of those suits), combinable with min/maxRank. |

**Suit Spur is promoted from stretch to required** (both outside brainstorms ranked it a top pick). Implement it per `docs/voyage/parked-abilities.md` § Suit Spur as kernel support: the custom move `voyage.spur` (plant) in rules.js, state `st.spur = { suit, base, top } | undefined` (in `hashState`, `cloneState`), foundation moves with a destination (original or spur), `foundationAccepts` / safe auto-play / `legalFoundationMoves` / `isSolved` / `canFinishWithFoundationOnly` / `foundationReturn` / `foundationSpread` honouring both piles, and the fifth slot rendered in `table.js`. The content agent will write the ability charm (`arctic.aurora`) on top; document the exact move descriptor and helper (e.g. `canPlantSpur(st, card, rules)`) in your report.

### 2.1 Composition (K1 owns `js/voyage/boardrules.js`)

`composeBoard({ boons, levels = {}, stickers = {}, challenge, boss, strength, boonStrength, bossStrength, seed, idx, runMemo })`:

- Each `active` entry gains `level` (`levels[id] || 1`).
- If `stickers` is non-empty, append a built-in pseudo-boon `{ id: 'voyage.stickers', kind: 'boon', level: 1 }` (its definition is written by K2 in `js/voyage/stickers.js`; composeBoard just includes it when the charm exists).
- The `rules(r, ctx)` ctx gains `level`, `boons` (array of held boon ids, including the pseudo one), `stickers` (copy) and `family(name)` → number of held boons of that family.
- New optional charm hook `rulesAfter(r, ctx)`: runs after every charm's `rules` (in active order), for synergy charms that read the composed rules (e.g. "the rank below every wild rank is also wild").
- New optional boss hook `confiscate(boonIds, ctx) → boonId | null`: the returned boon is removed from `active` for that board (it is still held by the run). composeBoard returns `confiscated: id | null`. `boardPlan` forwards it; the UI shows it on the boss chip, the map's final row and the board intro.
- `ease` stays the sum of active charms' ease. Bosses must sit on one difficulty axis: K1 measures every boss (existing + new) with `tools/boss-calibrate.mjs` and sets `ease` so that boss boards land on the tier-7 curve; record the table in `docs/voyage/overhaul/K1-report.md`.

`boardPlan(run, theme)` (in `run.js`, K2) passes `levels: run.levels`, `stickers: run.stickers`.

## 3. Charm runtime additions (K3 — `js/voyage/charms.js`, `js/voyage/content/kit.js`, Voyage runtime API in `js/main.js`)

### 3.1 ctx
- `ctx.level` (1|2), `ctx.family(name)` (count of held boons in that family), `ctx.coins` (read-only, run coins).
- `charmText(id, strength, { seed, level })`: when `level === 2` and the charm has `upgrade`, return the upgrade text.

### 3.2 api (new / fixed)
| Call | Effect |
| --- | --- |
| `hint()` | **Fix**: must work in Voyage without dev unlock. Runs the solver under `game.rules` and **plays** its first move (one history entry). Returns `true` if a move was played. Not counted in `run.hints`. |
| `preview(n = 3)` | Runs the solver (5 s) under `game.rules`, returns `solution.slice(0, n)` descriptors (or `null`), applies nothing, and highlights them (first move: source and destination glow like a selection; 2nd/3rd: numbered badges on their source cards). Any move, undo or ability clears the preview. |
| `resetBoard()` | Undo the entire history back to the deal (one descriptor at a time, so each move's own undo restores rules/state). Does **not** spend a run undo. Emits one `on.undo` with `{ reset: true, moves }`. Refund charms must ignore `ev.reset`. Ability refunds tied to undone moves still refund, except the reset ability's own use. |
| `openUndoWindow()` | Arms a per-board flag: until the next manual forward move, each Undo press steps back one player move (plus its auto-plays) **without** spending a run undo, and is allowed at 0 undos. Each free step emits `on.undo` with `ev.free === true`; spend-based charms ignore free steps; `sb.undosUsed` counts only paid undos. Saved in board memo for resume. |
| `addUndos(n)` | Now **capped per board**: undos granted by charms during a board (any call while `run.status === 'board'`) count against `VOYAGE.charmUndoCap` (3). Excess is dropped and the toast says "undo cap reached". Exempt: calls from `on.stuck` handlers and calls from charms flagged `undoCapExempt: true`. HUD can read `api.undoGrants` / cap. `onPick` and port purchases are not board-time and are never capped. |
| `grantUse(charmId \| '*', n = 1)` | Give extra ability uses this board to one ability charm (or every one). Capped at +2 per charm per board. For synergy charms. |
| `addCoins(n)` | **Only** for run-level hooks (`onPick`, `onPort`, `on.win`). Board-time coins come from `sb.addCoins` so undo can't farm them. |
| `stickers` (getter) | copy of `run.stickers`. |

### 3.3 Events / hooks
- `on.ability(ctx, { id })` — fired after any ability use (any charm), for synergy charms.
- `onPort(run, ctx)` — called for every held boon when the player docks at a port (before the shop opens). May mutate `run` (coins, undos) and add shop modifiers via `ctx.port` (see §4.3).
- `price(item, cost, ctx) → cost` — boons may discount port prices.
- `coins(n, ctx) → n` — adjust coins earned at board end (after `sb` coin lines).
- `boardUndos(n, ctx) → n` — adjust the `VOYAGE.undosPerBoard` grant after a cleared board (used by tradeoff charms).
- Everything from `docs/voyage/charms-design.md` §3 still applies.

### 3.4 Charm definition fields (new)
`family` (required for boons), `upgrade` (level-2 text, required for boons), `pressure: true` (curses), `undoCapExempt`, `rulesAfter`, `confiscate` (bosses), `onPort`, `price`, `coins`, `boardUndos`, `tell` (one short phrase for the boss/challenge tell).

`tools/charm-content-check.mjs` must enforce: every non-placeholder boon has `family` and `upgrade`; no two boons share an identical `text`; every challenge has `pressure` or a solver-visible `rules`.

## 4. Run systems (K2 — `run.js`, `map.js`, `scoring.js`, `config.js`, `stats.js`, new `port.js`, new `stickers.js`, `ui.js`, `css/voyage.css`, Voyage flow in `main.js`)

### 4.1 Coins
- `run.coins` (start 0; `RUN_VERSION` bumps to 3; old saves are discarded as today).
- `ScoreBreakdown.addCoins(key, label, n)` adds a coin line (`sb.coinLines`); `sb.coinTotal`.
- At board end: `earned = VOYAGE.coins.base (10) + VOYAGE.coins.perStar (6) × stars + floor(total / VOYAGE.coins.perPoints (150)) + sb.coinTotal`, then each held boon's `coins(n, ctx)` hook. Stored on the result (`result.coins`, with the lines) and added to `run.coins`.
- The result screen shows a coin breakdown under the score breakdown. HUD and map show the coin purse.

### 4.2 Harbour nodes (map)
- Nodes in rows 0–5 (boards 1–6) may be harbours (`node.port = true`), seeded per node id with probability `VOYAGE.portChance` (0.4). Guarantees: within any one choice set there is at least one harbour on rows 1 and 3 (boards 2 and 4), and siblings never both. Board 7 is never a harbour.
- The map marks harbour nodes with an anchor glyph and tooltip "Port after this table".
- After the reward pick on a harbour board, status goes to `'port'` instead of `'map'`.

### 4.3 Port
`js/voyage/port.js` (pure, Node-testable) builds a seeded shop: `createPort(run) → port` stored on `run.port`.

| Stall | Contents | Price (coins) |
| --- | --- | --- |
| Boons | 3 boons not held, from themes on any table (seeded), each shows its family and theme | 45 (a boon whose `ease ≥ 0.4` or ability: 60) |
| Stickers | 3 sticker offers (seeded type); buying one opens a 52-card picker (cards on foundations-order grid) to choose the card | Wild 30, Gold 20, Lucky 25, Key 25, Fool 40 |
| Upgrade | any held boon with `upgrade` and level 1 → level 2 | 40 |
| Provisions | +1 undo (max 3 per visit) | 15 |
| Sell | any held boon → coins; removing it also removes its level | 20 |
| Reroll | re-seed the boon stall once per visit | 10 |

Buying a boon calls its `onPick`. Hooks `onPort` / `price` from §3.3 apply. `ctx.port` lets a boon add `extraBoons` (+n offers), `discount` (fraction) or `freeReroll`. Leaving the port → `'map'`. The port is saved in the run (resume works).

### 4.4 Stickers (`js/voyage/stickers.js`)
Defines the built-in pseudo-boon `voyage.stickers` (hidden from the tray; it has its own row in the run summary). Types:

| Type | Effect | Kernel |
| --- | --- | --- |
| `wild` | the card ignores colour when stacking | `rules.wildCards` |
| `fool` | anything may be placed on this card | `rules.anchorCards` |
| `key` | the card ignores free-cell restrictions | `rules.freeCards` |
| `gold` | +5 coins each board when it goes home while 13 or more other cards are still in play (an early homing, not the final sweep) | `sb.addCoins` from history |
| `lucky` | +1 undo the first time it goes home each board (counts toward the board cap) | `on.foundation` |

Marks: card faces show a small sticker sigil (new mark styles `sticker-wild`, `sticker-fool`, `sticker-key`, `sticker-gold`, `sticker-lucky` in `js/card.js`; shape-distinct, readable without colour). A card can hold one sticker; restickering replaces it. Sticker marks must coexist with charm marks (draw both: sticker sigil in the opposite corner).

### 4.5 Levels
`run.levels = { [boonId]: 2 }`. `boardPlan` passes levels. Tray/reward/port cards show "II" for level 2 and the level-2 text.

### 4.6 Challenge labels and boss confiscation
- Chips/cards show **Rule** or **Curse** (from `pressure`).
- The boss chip, final-row map node and boss intro show "Confiscates: <boon>" when a boss returns one from `confiscate`.

### 4.7 Config (`js/voyage/config.js`)
Add: `charmUndoCap: 3`, `portChance: 0.4`, `coins: { base: 10, perStar: 6, perPoints: 150 }`, `prices: { boon: 45, boonRare: 60, upgrade: 40, undo: 15, undoMax: 3, sell: 20, reroll: 10, sticker: { wild: 30, gold: 20, lucky: 25, key: 25, fool: 40 } }`.


### 4.8 Addendum (K2a) — more run-level hooks for content

| Hook | Called | Meaning |
| --- | --- | --- |
| `lookahead(n, ctx) → n` | map reveal | extra map rows visible (clamp 1..4). |
| `challengeStrength(s, ctx) → s` | `boardPlan` | adjust the theme challenge's strength for the next board (clamp 1..7; bosses unaffected). Receives `ctx.run.results`. |
| `picks(n, ctx) → n` | reward screen | how many of the offered boons the player may take (default 1, clamp 1..2). The reward UI lets them pick that many. |
| `portServices(ctx) → [{ id, label, text, price, needsCard?, needsBoon?, apply(run, arg) }]` | port | extra port stalls defined by charms (e.g. copy a sticker onto another card). View model: `port.services`. Handler: `portService(serviceId, arg)`. |
| `onUpgrade(run, ctx)` | port upgrade | runs once when the boon reaches level 2 (for boons whose effect happens on pickup). |
| `price(item, cost, ctx)` | port | already listed; `item.kind` is `boon` / `sticker` / `upgrade` / `undo` / `reroll` / `sell` (for `sell`, the returned value is what the player receives). |

## 5. Verification

- `node tools/rules-check.mjs` and `node tools/charm-content-check.mjs` must pass at all times on the shared checkout (if your change breaks someone else's check, fix your change).
- New kernel fields: generator/player agreement + undo checks in `tools/rules-check.mjs` (extend the 15-ruleset loop), and solver verification of a few restricted deals.
- Browser checks: `node serve.mjs <your port>` and `VOYAGE_TEST_URL=http://[::1]:<port> node tools/charm-runtime-check.mjs` (puppeteer lives in `~/Documents/mahjpods/film/node_modules`). Assigned ports: K1 8141, K2 8142, K3 8143, content agents 8150+.
- Shared checkout rules: edit only files you own (listed in your brief). Re-read a file right before editing it. Never rewrite a shared file wholesale. Never run `git checkout`, `git stash`, `git reset`, `git clean` or `git commit`.
