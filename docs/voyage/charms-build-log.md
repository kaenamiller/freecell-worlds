# Voyage charms build log

Append-only. Each agent adds its summary under its own heading; cross-agent requests go under the request headings.

## C2 (muertos, space, azulejo, jetset, riverboat)

Implemented all simple (S) rows for these themes in `js/voyage/content/{muertos,space,azulejo,jetset,riverboat}.js`. Focused regression checks in `tools/charm-checks/content-c2.mjs`.

| Theme | Charm | Ease |
| --- | --- | --- |
| muertos | marigold | +0.2 |
| muertos | ofrenda | 0 |
| muertos | skull | 0 |
| muertos | challenge (Veil) | −0.05×s |
| space | holoscan, mission | 0 |
| space | challenge (Power Rationing) | −0.12×⌈s/2⌉ |
| azulejo | tessellate, fountain, kiln | 0 |
| azulejo | challenge (Cracked Tiles) | −0.04×s |
| jetset | overhead, firstclass, flyer | 0 (cell boon unmodeled) |
| jetset | challenge (Layover) | 0 (pressure/time) |
| riverboat | sleeve | +0.35 |
| riverboat | dealer, edge | 0 |
| riverboat | challenge (Ante) | −0.04×s |

Deviations: none from spec. `space` still lists as a placeholder theme until `space.tractor` (C) lands — only two S boons authored here. Cracked tiles marks random tableau cards at deal (not restricted to buried). Layover penalty uses `ceil` minutes over the limit and applies to `sb.subtotal` before multipliers.

## Requests to K1

## Requests to K2

## C5 (carnival, canyon, lowtide, theater, forge, saloon)

Implemented all simple (`S`) rows for these six themes in `js/voyage/content/<theme>.js`. Skipped `lowtide.tidepool` and `theater.understudy` (complex modules still stubs elsewhere), so `lowtide` / `theater` may still show one placeholder boon until those land.

**Deviations / notes**

- `carnival.challenge` badge reads the blocked suit from composed `api.rules.noCellCards` (rules RNG), not a separate setup draw.
- `canyon.challenge` shuffles which cell slots get colour locks via rules RNG.
- `forge.challenge` hot-card deadline counts every move in history after the card’s first touch; penalty is once per card that misses the 10-move window.
- `theater.challenge` suit order is stored in board `memo` from setup RNG; out-of-order completion is judged when the 13th card of a suit goes home.

**Ease chosen**

| Charm | ease |
| --- | ---: |
| `carnival.ringmaster` | +0.2 |
| `carnival.challenge` | −0.08×s |
| `canyon.turquoise` | +0.2 |
| `canyon.challenge` | −0.04×s (s1–2), −0.07×s (s3–4), −0.10×s (s5–7) |
| `lowtide.challenge` | −min(1, 0.12×suit count) |
| `forge.anvil` | +0.15 |
| `forge.challenge` | 0 (pressure) |
| `saloon.seven` | +0.2 |
| `saloon.challenge` | −0.09×s |
| Other C5 boons / `theater.challenge` | 0 |

Verification: `node -e` checkCharm on all 24 C5 charms × strengths 1–7; `tools/charm-checks/content-c5.mjs` added. Full `charm-content-check.mjs` may still fail on other agents’ extension modules.


### K2 runtime integration requests
- K2 calls `game.applyCharmMove({ t: 'X', op, ...data })`, feature-detected until K1 lands. Please preserve JSON metadata `voyageAbility: { id, uses }` on X descriptors and `override` objects; K2 uses this to refund an ability when its custom move / overriding drop is undone.
- K2 passes `rules: cur.rules` into `dealGame` (alongside freeCells); retain the initial rules for history replay, since X moves can mutate rules. Dynamic rules are reconstructed by replay, rather than replacing the original saved rules.
- K2 reuses `applyLayout` for X moves and undo, and synchronizes table free-cell count from `game.state.free.length` on refresh/undo. Please keep the rules argument on the stuck check's `generateMoves` and solver call.

## Requests to K2

- K1 will add `game.rules`, `game.override`, `Game.applyCharmMove({t:'X',op,...})`, `registerCustomMove(op,{apply(st,m,rules),undo(st,m,rules)})`, and `Game.moveFoundationReturn(suit,{kind:'col'|'free',i})`. Custom ops may mutate the JSON rules object; legality recompiles it on each player action.
- Please pass `rules: cur.rules` when starting/resuming Voyage via `dealGame` (K1 will also read current Voyage rules at game construction). Dealer fallback returns `{rules,strength,active,ease,dealShift,relaxed:true}`; `startBoard` must persist those resolved fields from the pick so the player receives the verified rules/strength.
- K1 will make only the requested boardPlan/upcomingPlans edits in run.js. Please preserve seed/idx and full rules/ease/dealShift keying.
- Table refresh API will be `layer.setRules(game)`; please call it in the shared `applyLayout` helper (and after runtime rule/cell changes). K1 avoids that region because it is outside the named main.js editing regions.

## Requests to K2

- K1's two run.js edits are landed (boardPlan seeded ctx + dealShift; upcomingPlans imports and uses rulesKey). `composeBoard` also accepts `runMemo` for dealShift functions.
- `dealFor` now shares a pending candidate-loop promise with prepare and returns verified picks only; picks carry the resolved `rules/strength/active/ease/dealShift/relaxed`. Please persist these on startBoard. Strength zero omits the theme challenge hook; the boss stays active.
- `layer.setRules(game)` is ready next; call it from applyLayout/runtime refresh to cover custom moves and undo. Foundation-return drag and rules-aware requestSolve/stuck checks are landed.

## Requests to K2

- `layer.setRules(game)` has landed in table.js (frost/thaw, seal/shatter, cell pips, empty-rank glyphs and height ceiling). It still needs the applyLayout refresh call mentioned above; the layer reads `game.rules` and `game.state`. K1's Node checks currently pass, including exact classic verdict/nodes/path on 58 deals (30 solved).

## Requests to K1

- K2 integration is in place: `voyageDealBoard` supplies a deep copy of the original rules, `startBoard` persists resolved dealer rules/strength/active/relaxed, and `applyLayout` plus runtime refresh call `layer.setRules(game)`. `rulesKey`/seed/idx/dealShift edits are preserved. The K2 checker and the first headless X-move/resume/undo run pass against your landed interfaces.

## Requests to K2

- Dealer verification now composes theme+boss without held boons (boss ground rule §0.3), retaining explicit rules for hand-built plans. Solver ignores foundation-return help during search and reports unknown, never false, when that omitted help could matter. Stuck move generation includes R moves.
- `override.anyCard` bypasses the source run-validity check for that one tableau drop; other override flags selectively bypass rank/colour/cap. Restrictions (barren parents, sealed columns, height, cell locks/one-way exits) remain enforced.

## K2

Runtime kernel delivered. No production theme/special content was authored. `RUN_VERSION` remains 2: new fields are additive and defaulted. The service-worker version is `freecell-worlds-v11-voyage-runtime`; its 86 shell paths include registry, boardrules, kit, content index, every production theme/special module, and exclude dev examples.

### Exact hook/context surface

- `rules(r, { strength, rng, seed, idx, runMemo })`, `ease` / `dealShift` number or function (K1 composition); `setup({ state, initial, deal, restored }, ctx)`; `score(sb, ctx)`; `onPick(run, ctx)`.
- `on.start(ctx, {})`, `on.move(ctx, {move,manual})`, `on.foundation(ctx, {card,move,src,auto})`, `on.freecell(ctx, {card,move})`, `on.columnEmpty(ctx, {col})`, `on.undo(ctx, {move,moves})`, `on.win(ctx, {result})`, `on.reveal(ctx, {card})`, `on.stuck(ctx, {})`. `stuck` returning true cancels the loss; available unspent abilities and a pending override also prevent it.
- `ability: { uses: number | (ctx)=>number, label, use(ctx): boolean | Promise<boolean>, available?(ctx): boolean }`. False/cancel keeps the use. `available` should be pure. `abilityBonus: number | (ctx)=>number` on any active charm grants extra uses to every ability; the API exposes their sum as read-only `abilityBonus`.
- `offers(n,ctx)` runs for held boons and clamps to 1..3. `thresholds(arr,ctx)` runs on active charms for intro/live/final thresholds. `starCap(ctx)` runs on challenges/bosses and receives scoring extras (`elapsed`, `undosUsed`, `undosLeft`, `initial`, `rules`, `initialRules`, `boardIdx`, `sb`).
- Every runtime ctx contains `id`, `kind`, `strength`, seeded `rng`, `api`, saved board `memo`, saved `runMemo` (`run.charmMemo[id]`), and a deep-frozen, current `run` snapshot: `{boardIdx,results,boons,undos}`. `boardIdx` is zero-based; `boons` are ids. Only the first `onPick` argument is mutable.

### Exact content API

- `addUndos(n): void`, `spendUndos(n): number` (actual amount taken), `notify(text): void`, `badge(text): void`.
- `mark(cardIds, style): void`, `unmark(cardIds): void`, `conceal(cardIds): void`, `reveal(cardIds): number[]` (newly revealed ids). A single id is also accepted. Styles: `gold`, `star`, `glow`, `crack`, `frost`, `hot`, `curse`, `wanted`, `fragile`, `camera`; each has its own sigil and tinted edge.
- `hint(): Promise<boolean>` uses the classic rules-aware hint action; `autoHome(): boolean` plays consecutive legal foundation moves as player moves, forming a scoring chain.
- `override(o): boolean` arms one drop and saves its HUD chip; `charmMove(op,data={}): descriptor | false` applies `{...data,t:'X',op}` via K1, relayouts every card with existing springs, sounds, reports events, and persists.
- `setFreeCells(n): boolean` permits gains through six cells. A standalone gain is the registered undoable `voyage.cells` X move. While inside a custom apply handler it only grows state/rules; that handler's undo must restore them.
- `refresh(): void` updates table rules/cell slots/layout, HUD, score and saved state.
- `pick({kind:'column'|'card'|'freecell',filter?}): Promise<number|null>`. Returns a zero-based column/cell index or card id; `filter(value,state)` selects valid targets. Card targets are accessible face-up tableau/free-cell cards. Buttons highlight targets; keyboard focus is trapped and Escape returns null.
- Additional primitive: `rewind(count): boolean` batch-undoes for one run undo (bookmark support); its undo event includes all descriptors in `moves`.
- Additional read getters: `state`, `rules`, `history`, `concealed` (ids), `abilityBonus`. State/rules/history are the live objects for custom content; mutate state/rules through registered X operations when undo is required.

### Scoring/helpers and persistence

`scoreBoard(history,par,effects=null,extra={})` provides `sb.history/par/elapsed/undosUsed/undosLeft/initial/rules/boardIdx/stat`, plus `initialRules` for replay. `add(key,label,pts)`, `scale(key,x)`, `mult(label,x)` and the labelled lines/multipliers remain available. Live and final use `scoringContext(run,{elapsed,rules})`; startHome cards count toward cards-home points, and foundation returns subtract them until rehomed. Foundation returns into cells also count as cell placements.

`content/kit.js` exports `replay(sb,fn(move,stateAfter,i))` (returns final copied state; applies X/R and copied original rules), `chainsOf(history)` (arrays of consecutive F descriptors), `foundationSequence(history)` (card ids), `countHome(history,pred(card))`, `rankMask(...ranks)`, `suitMask(...suits)`, `isCourt(cardId)`, `suitName(suitIndex)`, `rankName(rank)`, and re-exports `rankOf/suitOf`.

Saved fields: `run.charmMemo`, `current.initial`, `current.override`, `current.liveRules`, and each charm's reserved `memo._runtime` (`marks`, `concealed`, `revealed`, `badge`, `abilityUses`, `initialized`). Original deal rules are deep-copied before constructing Game; current rules are saved separately, so replayable X rule mutations do not corrupt the original rules. Resume runs setup on the initial dealt state, challenge/boss first, then boons; saved marks/badges/visibility take precedence over repeated setup drawing calls. Normal undo keeps automatically exposed cards visible; explicit `conceal` can hide them again for an undoable visibility charm.

X/override ability activations carry `voyageAbility:{id,uses}` in the descriptor/override. Undo refunds those uses. Undoing an overriding drop clears the chip/override in the runtime (K1's underlying Game alone restores it). Hint ability uses remain spent when the hinted move is undone.

### Verification and handoff notes

- `node tools/charm-content-check.mjs`: passes 1,092 charm/strength cases plus `_kernel.mjs` regression checks. It warns with all placeholder themes; `--strict` fails for the current 38 placeholder themes as intended. Validates theme counts/fields/text/tags, clamped rules and types, legal short deal histories including undo, scoring finite values, setup/resume, onPick/events/abilities. Exports harness helpers; auto-discovers `tools/charm-checks/*.mjs` exporting `check(helpers)` or default.
- `tools/charm-runtime-check.mjs` headless Chrome: actual tray hint, marks/badge, concealed-card uncover, target cancellation, targeted swap X and spring positions, saved X resume/undo, cell gain/undo, saved override/consume/undo, available-ability stuck protection, one-shot stuck rescue, and subsequent loss pass. Eight screenshots and `report.json` are in `/tmp/k2-shots`. A separate final browser check also passes autoHome's four player moves, startHome's full 520 card points, and the normal win flow (`autohome-report.json`).
- Existing Voyage UI checker/preview passes desktop/phone HUD, reward, and phone intro with no page errors or horizontal overflow. It was run unchanged via a temporary URL-adjusted copy against assigned port 8132. Production import still reports 114 boons, 38 challenges, one boss, without the three dev examples. Syntax, whitespace, and all service-worker shell paths pass checks.
- `content/_examples.js` is imported only by check scripts, never index.js or the service worker. It demonstrates marks/visibility/badges/hints/ability bonus/score/helpers/run hooks, targeted custom swap, dynamic cells, override and autoHome modes.
- No required kernel feature remains blocked on K1. Theme content remains placeholders by design, and each future special module still owns its custom handler/undo and id-specific extension checks. The next-drop source restriction for Understudy must be supplied by its content module's `available`/targeting or move logic; the current override flags do not encode a source filter.
- Browser tests use software WebGL with shadow maps disabled while retaining card materials/animation. An unrelated process occupies IPv4 8132 on this host; the test server runs `serve.mjs` on IPv6 `::1` port 8132 via a temporary listen shim. `VOYAGE_TEST_URL` can select the normal server URL in other environments.

## C1 (roman, cyber, aero, zen, forest, deco)

Implemented all **S** rows in each theme file (`cyber.ghost` remains **C** in `special/`). `node tools/charm-content-check.mjs` passes; roman, aero, zen, forest, and deco are off the placeholder list (cyber still lists until ghost lands).

**Deviations:** None from spec intent. Laurel Crown scores on each King home (per design “Kings home × 60”). Dolphin Leap resets its home streak on any tableau/free-cell move and on undo (not on foundation-only chains). Bramble at s7 uses `min rank 1` so every Club is a barren parent (14 − 2s = 0 clamped). Stillness rebuilds the `freecells` line at 10 pts per placement (half of `SCORE.freeCellCost`).

**Ease chosen**

| Charm | ease |
| --- | --- |
| roman.legion | +0.25 |
| roman.colonnade | +0.4 |
| roman.laurel | 0 |
| roman.challenge | −0.12 × s |
| cyber.overclock | +0.35 |
| cyber.cache | 0 |
| cyber.challenge | 0 (SCORE pressure) |
| aero.pocket | 0 (cell modeled by bank) |
| aero.dolphin | 0 |
| aero.lounge | 0 |
| aero.challenge | −0.08 × s |
| zen.stillness / calm / mindful | 0 (dealShift handles calm) |
| zen.challenge | 0 |
| forest.changeling | +0.25 |
| forest.moss | +0.2 |
| forest.fireflies | 0 |
| forest.challenge | −0.1 × s |
| deco.* boons | 0 |
| deco.challenge | −0.12 × s |

## C7 (deepstorage, cafe, arctic, museum, mint)

Implemented all **S** rows in each theme file (`museum.digsite` remains **C** in `special/`). All nineteen charms pass `checkCharm` at strengths 1–7; `tools/charm-checks/content-c7.mjs` covers Deep Freeze tiers, Espresso/Regulars scoring, Fragile penalty, and Clearance undo fallback. **deepstorage**, **cafe**, **arctic**, and **mint** are off the placeholder list; **museum** still warns until `museum.digsite` lands.

**Deviations:** Deep Freeze uses the orchestrator cap of **2** frozen cells (1 at s1–4, 2 at s5–7; thaw at 8 and 20 home). Aurora scales only the `chains` line (×1.1 per qualifying chain, cap ×1.3), not the whole board. Redundancy refunds on every third `on.undo` (run undo spent), not on in-game move undos that do not spend run undos.

**Ease chosen**

| Charm | ease |
| --- | --- |
| deepstorage.clearance | +0.15 |
| deepstorage.redundancy / archive | 0 |
| deepstorage.challenge | −0.05 × s |
| cafe.espresso | +0.2 |
| cafe.regulars / pastry / challenge | 0 |
| arctic.heatlamp | +0.2 |
| arctic.aurora / sled | 0 |
| arctic.challenge | −0.06 × s (s≤4); −0.1 × s (s≥5) |
| museum.fossil / docent / challenge | 0 |
| mint.sterling | +0.2 |
| mint.interest / treasury | 0 |
| mint.challenge | −0.07 × s |

## C4 (library, conservatory, nighttrain, saffron, harvest)

Implemented all **S** rows in each theme file (`library.bookmark` remains **C** in `special/`). `node tools/charm-content-check.mjs` passes the 1,092 charm/strength matrix; `tools/charm-checks/content-c4.mjs` covers Spice Blend and Windfall Tax scoring. Conservatory, nighttrain, saffron, and harvest are off the placeholder list; **library** still warns until `library.bookmark` lands.

**Deviations:** Timetable shortens par only for the efficiency line (label shows the adjusted par), not star thresholds. Overdue fines count player moves while a card occupies a cell (undone moves excluded via history). Woven Pattern charges once per maximal same-colour foundation streak of length ≥ 3. Hayride `dealShift −1` applies on the next two boards after pick (`runMemo.boardsLeft`, decremented on `on.start`).

**Ease chosen**

| Charm | ease |
| --- | --- |
| library.lending | +0.35 |
| library.quiet | 0 |
| library.challenge | −0.05 × s |
| conservatory.graft | +0.2 |
| conservatory.mist / seedbank | 0 |
| conservatory.challenge | −0.05 × s (s≤3); −0.6 (s≥4, `emptyFactor` 1) |
| nighttrain.coupling | +0.15 |
| nighttrain.ontime / railpass | 0 |
| nighttrain.challenge | −0.05 × s |
| saffron.silkroad / spice / loom | 0 |
| saffron.challenge | −0.06 × s |
| harvest.cellar / hayride / gleaning | 0 |
| harvest.challenge | −0.05 × s |

## C6 (lapis, canopy, diner, cove, keep)

Implemented all **S** rows in each theme file (`canopy.zipline` and `keep.siegeengine` remain **C** in `special/`). All 17 C6 charm/strength cases pass `checkCharm`; `tools/charm-checks/content-c6.mjs` covers sealed-column spacing, diner rank bans, keep siege cell loss, and Banner offers. **lapis**, **diner**, and **cove** are off the placeholder list; **canopy** and **keep** still warn until the C boons land.

**Deviations:** Camera Trap picks three random dealt cards as “rare” (spec does not name a rank filter). Leeches applies `15 × s` points per undo used (reading “15s” as 15×strength). Cursed Gold charges 3 points when a marked card enters a free cell (`C` or foundation return to cell).

**Ease chosen**

| Charm | ease |
| --- | --- |
| lapis.ankh | +0.2 |
| lapis.canopic | 0 |
| lapis.horus | +0.25 |
| lapis.challenge | 0 |
| canopy.cameratrap | 0 |
| canopy.mistnet | +0.15 |
| canopy.challenge | −0.07 × s |
| diner.blueplate / tipjar | 0 |
| diner.coffee | +0.15 |
| diner.challenge | −0.08 × s |
| cove.treasure | 0 |
| cove.keg | +0.3 |
| cove.parrot | +0.15 |
| cove.challenge | −0.05 × s |
| keep.banner | +0.2 |
| keep.hearth | +0.15 |
| keep.challenge | −0.05 × s (s≤2); −1.54 (s≥3) |

## K1

Built all 17 BoardRules fields through player legality, sequence detection, move generation, safe auto-play, hints/search workers, dealer verification and stuck detection: `freeCells`, `moveBonus`, `emptyFactor`, `wildRanks`, `suitBuild`, `foundationReturn`, `startHome`, `noCellRanks`, `noCellCards`, `barren`, `foundationSpread`, `emptyMinRank`, `cellThaw`, `sealedCols`, `maxHeight`, `cellColors`, `oneWayCellRanks`. Classic hashes/move order stay neutral; compiled rank/card/build masks are reused within searches. Seals use `state.sealed` (bit i = column i), cloned/hashed and captured as `move.sealedBefore` for undo. Whole-column moves that break a seal remain searchable.

Exact APIs:
- `new Game(dealNumber, { freeCells?, rules? } = {})`: deep-copies JSON rules; exposes `game.rules` and `game.override`. `deal(dealNumber, rulesOrFreeCellCount = 4)` applies startHome and initial seals; the numeric overload remains compatible.
- `generateMoves(state, { rules?, fullOnly?, foundationReturns? } = {})`; `solve(state, { rules?, rng?, attemptLimit?, ...existingSearchOptions } = {})`. Query helpers accept optional rules: `canStackOn(col, card, rules?, override?)`, `runLength(col, rules?)`, `sequenceStart(col, rules?)`, `isValidSequence(col, count, rules?)`, `maxMoveSize(state, movingToEmpty, rules?)`, `foundationAccepts(state, card, rules?)`, `safeToFoundation(state, card, rules?)`, `safeFoundationMoves(state, rules?)`, `legalFoundationMoves(state, rules?)`, `canFinishWithFoundationOnly(state, rules?)`. Both shortSolve implementations take `opts.rules`.
- `applyMove(state, move, rules?)`, `undoMove(state, move, rules?)`, `registerCustomMove(op, { apply(state, move, rules), undo(state, move, rules) })`, `game.applyCharmMove({ t:'X', op, ...data })`; cleanMove preserves X and ability metadata. Overrides `{ ignoreColour?, ignoreRank?, ignoreCap?, anyCard? }` are recorded on successful tableau drops and restored by undo; anyCard relaxes source-run validity.
- `game.moveFoundationReturn(suit, { kind:'col'|'free', i })` creates `{ t:'R', suit, to, card }`. Actual foundation dragging works to both destinations. R respects cell locks, post-return thaw/spread, column restrictions and pending tableau overrides.
- `baseRules()`, `rulesKey(rules)`, `hasRestrictions(rules)`, `composeBoard({ boons?, challenge?, boss?, strength?, seed?, idx?, runMemo?, boonStrength?, bossStrength? }) → { active, rules, ease, dealShift }`. Rules ctx includes `{ strength, rng: stream(seed,'rules',idx,charmId), seed, idx, runMemo }`. Only theme strength relaxes on dealer fallback; boon/boss strengths remain fixed.
- `verify(deal, rules, { timeLimitMs = 6000 } = {})`, `dealFor(plan, { seed?, exclude?, candidates = 8, timeLimitMs = 6000, ... } = {})`, `prepare(plans, options)`: cached candidate loops never return an unverified restricted board; verify without boons, retry weaker theme challenges, and return resolved rules/strength/active/ease/dealShift plus relaxed. Node tests can inject `verifier`. dealShift is uncompensated; cache/dedupe use full rules/ease/dealShift.
- `layer.setRules(game)` drives frost/thaw, chains/shatter, colour pips, empty-rank glyphs and height ceiling. K2 connected refresh after moves/custom moves/undo.

Validation: `node tools/rules-check.mjs` passes (focused primitives, R/X/override/seal undo, generator/player agreement over 15 rulesets, dealer fallback and worker protocols). Saved before-change baselines match exact verdict, nodes and solution on 58 classic deals, including 30 solved deals. Chrome on port 8131 exercised a hand-made all-primitives Voyage board, pointer R drops to a cell and column, 12 moves and complete undo, seal/thaw/undo and startHome in the dealer worker; no page errors. Screenshots/report: `/tmp/k1-shots`. Calibration: 150 stratified bank deals × 28 configurations, 263.1 s including the corrected sealed-column rerun; §2.5 and `tools/charm-calibration.json` contain measurements.

Known limits: search deliberately omits R/override/X help (allowed by the spec); omitted foundation-return help cannot produce a false stuck verdict. Variant searches with fullOnly pruning return unknown rather than claiming exhaustion. Calibration ease is preliminary: short-budget unknown rates and survivor bias are documented separately from proven unsolvability. No remaining primitive or player/browser integration gaps identified. No content files touched; no commit made.

## C3 (carvings, varsity, driftwood, pinecone, winterglass, concrete)

Implemented all **S** rows in each theme file (`carvings.raven` and `concrete.spraytag` remain **C** in `special/`). `node tools/charm-content-check.mjs` passes; `tools/charm-checks/content-c3.mjs` covers totem/breeze/rivalry/mixtape scoring. **varsity**, **driftwood**, **pinecone**, and **winterglass** are off the placeholder list; **carvings** and **concrete** still warn until the complex boons land.

**Deviations:** Shot Clock resets its move counter after each 24-move penalty (repeated dry spells can stack). Leave No Trace counts only non-auto moves that place into the last empty cell. Mixtape bonus equals the full chain line for the longest run (doubling that chain in effect).

**Ease chosen**

| Charm | ease |
| --- | --- |
| carvings.orca / totem | 0 |
| carvings.challenge | −0.07 × s |
| varsity.* boons | 0 |
| varsity.challenge | 0 (SCORE) |
| driftwood.* boons | 0 |
| driftwood.challenge | −0.05 × s |
| pinecone.* | 0 |
| winterglass.prism | +0.25 |
| winterglass.snowdrift / globe | 0 |
| winterglass.challenge | 0 (SCORE) |
| concrete.* boons | 0 |
| concrete.challenge | 0 (SCORE) |

## S1 kernel edits

- `js/main.js`: the hint fallback now passes `game.rules` to `generateMoves`, matching the worker hint search. A timed-out search previously fell back to classic legality, which could enter frozen cells or sealed columns after a charm move. This is a one-line generic fix; no other kernel edits by S1.

## S3 kernel edits

- `js/rules.js`, `Game._apply`: registered X moves may declare `tableauDrop: true` to consume `game.override` exactly as an ordinary tableau drop does. The override (including `voyageAbility`) is copied into the X descriptor before application, retained on failure, cleared on success, and restored by the existing Game undo path. The Voyage runtime clears it and refunds the use on undo as before. No solver, scoring, main.js or UI changes were needed. `node tools/rules-check.mjs` passes, including the exact classic solver verdict/nodes/path baseline on 58 deals.

## S2 kernel edits

- `js/main.js`, first guard in `voyageCheckStuck`: defer stuck detection while `vy.effects.using` is set. `api.charmMove` calls `afterMove` before the asynchronous ability callback finishes; during that interval `abilityState.available` is false for every button. Deferring prevents a premature loss when Mission Control grants a remaining use. The existing ability handler checks stuck again after the callback ends and the use count is saved, so spent abilities still allow a loss. This is one generic condition; no rules/scoring/renderer changes.

## S3

Built `concrete.spraytag` (Spray Tag, ease +0.2), `theater.understudy` (Understudy, +0.3), and `canopy.zipline` (Zip Line, +0.3), each with its own registered custom drop operation and one use per board (plus the runtime's ability bonus). The shared drop validation/targeting helpers live in `special/concrete.spraytag.js`; the other two modules select their flags and source constraints.

All three highlight the source and legal destination through `api.pick`, then arm `game.override` and immediately commit the selected X drop. This is the targeted next-drop UX: cancellation at either picker keeps the use and does not leave an armed override. Spray Tag ignores landing colour; Understudy accepts only a free-cell source and ignores landing rank/colour; Zip Line accepts valid tableau sequences and ignores only move capacity. Sealed columns, barren cards, height limits, empty-column rank rules and one-way cell exits still apply. Each operation delegates its state mutation/undo to an ordinary T descriptor, retains all cards and K1 state fields, and counts as exactly one player move. Runtime metadata restores the use on undo; saved X history replays on resume. The existing runtime supplies spring relayout, placement sound, toast, ability pips and stuck protection. The one generic kernel change is documented under **S3 kernel edits** above.

Checks in `tools/charm-checks/{concrete.spraytag,theater.understudy,canopy.zipline}.mjs` cover real deals (Spray Tag/Understudy: 1, 2, 3; Zip Line: 12, 27, 42 under a one-card capacity), both cancellation stages, apply/undo, scoring, full-card conservation, solver-generated moves, replay, saved uses and undo refunds, armed override replay, rejected source/count/destination/rank/sequence targets, concealed targets, seals, height limits and one-way cells. `node tools/charm-content-check.mjs --strict` passes all 1,092 charm/strength cases and every discovered extension. An intermediate run overlapped an in-progress `space.tractor` check; the completed shared suite passes.

Headless Chrome on `node serve.mjs 8152` passes each charm on a real Voyage board with its actual theme and saved boon. `/tmp/s3-browser.mjs` verifies tray invocation, source/destination highlights, cancellation, a drop impossible under the normal active rules, animation before settling and exact final spring positions, placement sound/toast, one-move scoring, worker solver acceptance, persisted reload, undo/use refund, and actual zero-undo stuck protection followed by loss when the use is spent. Immobile real deals are 1 (Spray Tag), 1 with a saved free-cell placement (Understudy), and 194 (Zip Line). The browser run produced **24 screenshots**, `/tmp/s3-shots/report.json`, and **zero console/page errors**. Software WebGL uses card materials and animation with shadow maps disabled; service-worker caching is bypassed for the test.

Known gaps: none in the three charm implementations. The selected drop commits immediately after targeting; these abilities do not leave a separate pending activation between turns.

## S2

Built the four targeted complex boons in their existing special modules: `space.tractor` (Tractor Beam, ease +0.4), `carvings.raven` (Raven's Trick, +0.35), `lowtide.tidepool` (Tide Pool, +0.3), and `museum.digsite` (Dig Site, +0.4). Each registers an identically named X operation, validates targets before mutating, uses `api.pick`, and finishes with a use toast. K2 provides the spring relayout, placement sound, saved history/memo and ability-undo refund. No board/run scratch fields or new solver state were needed. X activations use the built scoring contract: one player move each, removed from score/history by undo.

Tractor Beam selects a visible non-top tableau card and an accepting empty cell, respecting frozen cells, rank/card exclusions and colour locks; removing it preserves the remaining column order. Raven swaps tops of two different non-empty columns, allowing dealt-pile pairs. Tide Pool selects an occupied free cell and inserts its card at index 0 of any column, including empty/sealed columns, as its explicit placement help. Dig Site rotates index 0 to the top only in a column of at least two cards whose deepest card is face-up. Visibility snapshots on Tractor/Dig descriptors permit pure apply validation and deterministic replay. Each availability predicate requires a useful legal target; the runtime additionally checks saved uses, including Mission Control's bonus.

Added auto-discovered `tools/charm-checks/<id>.mjs` plus `_s2.mjs` shared checks. They cover three real deals (1, 617, 11982), exact apply/undo with seals and column limits, JSON history and memo resume, resumed undo/use refund, card conservation, normal post-X move generation/undo, bounded seeded solver calls, replay and player-move scoring, atomic illegal-target rejection, concealed targets, cell locks/freeze/exclusions/occupancy, single-column/single-card no-ops, cancellation at either targeting step, and extra uses. `node tools/charm-content-check.mjs` passes all 1,092 charm/strength cases and every extension; the final focused S2 checks also pass. Module/main syntax and main whitespace checks pass.

Headless Chrome on port **8151** exercised each real themed Voyage board through its HUD button, targeting highlights/Escape, expected card transformation, settled spring positions, solver acceptance, saved-board reload, and the actual Undo button restoring both state and use. Separate immobile boards verified that each unused ability protects the run and a spent ability permits stuck loss. The Mission Control/Raven regression confirms that the first of two X activations keeps an immobile board alive, the final activation permits loss, and placement sound is invoked. Seventeen screenshots plus `report.json` and `bonus-report.json` are in `/tmp/s2-shots`; browser runners are `/tmp/s2-browser.mjs`, `/tmp/s2-bonus-browser.mjs`, and `/tmp/s2-tractor-stuck.mjs`. Software WebGL tests disable shadows and reduce rendering resolution while retaining materials and animations; an initial deal timeout and later detached-frame interruption were rerun successfully. No page errors were found in the completed checks.

Kernel edit: the single generic in-flight-ability guard is documented under **S2 kernel edits** above. Known gaps: none identified for S2. Search intentionally never generates X moves; the tested states remain standard solver inputs, and availability plus the in-flight guard protects unused help from premature stuck loss. No commits or destructive Git commands were used.

## S1

Built `cyber.ghost` (Ghost Cell, ease +0.3), `keep.siegeengine` (Siege Engine, +0.25), and `library.bookmark` (Bookmark, 0) in their existing special modules, with identically named registered X operations. No new solver state fields or composition restrictions were added.

- Ghost Cell targets and immediately parks a legal, visible column top in the extra cell. It inserts the slot before the frozen suffix and shifts colour locks, preserving the original cells' restrictions. Leaving the ghost triggers a separate, undoable closing X; occupied cells cannot close. Opening and closing each count as one player move. Undo first reopens a closed slot, then reverses the departure, then reverses opening/refunds the use. A closure triggered by another ability deliberately carries no ability metadata, avoiding a premature refund of that other ability.
- Siege Engine targets an active seal first, otherwise the next frozen cell, otherwise a concealed column; with no obstacle it grants one undo. Unseal edits both the state seal mask and rules, thaw removes a remaining freeze threshold, and uncover saves the affected buried card ids. Undo restores rules/seals/concealment and removes a fallback undo grant. Replay/resume does not repeat undo grants or visibility effects.
- Bookmark writes an undoable marker X and saved SET badge without spending the rewind use. Its second activation batch-undoes all descriptors after the marker for one run undo, then spends the use. Undoing/passing the marker clears the bookmark and refunds its use. Both phases require an available run undo; an empty interval is unavailable. The marker counts as one player move, and rewound moves disappear from scoring. Rewind uses the built undo semantics, with no redo operation.

Target cancellation preserves uses. Ghost/Siege use `api.pick` highlights; the built charmMove/rewind APIs provide spring relayout and placement/undo sounds, and all three abilities show use toasts. Saved history, memo, original rules and live rules preserve active cells, broken obstacles, visibility and bookmark phase across reloads. Availability and saved use counts participate in the built stuck guard, including bonus uses.

Added auto-discovered checks `tools/charm-checks/cyber.ghost.mjs`, `keep.siegeengine.mjs`, and `library.bookmark.mjs`. They cover legal histories on deals 1, 2, 617 and 11982, exact apply/undo and use refunds, cancellation/illegal targets, JSON replay/resume, scoring, frozen/colour-locked cells, visibility, fallback grants, unaffordable/empty rewinds and bounded solver acceptance. The Ghost check also supplies the small shared runtime fixture.

Validation: `node tools/charm-content-check.mjs` passes all 1,092 charm/strength cases and every extension. `node tools/rules-check.mjs` passes, including exact classic verdict/nodes/path on 58 deals (30 solved). Syntax and targeted whitespace checks pass. Real headless Chrome Voyage boards on port 8150 pass HUD targeting/Escape, all four Siege modes, Ghost departure/closure, batch rewind, saved reload, actual Undo/refunded uses, and unused/spent stuck protection. Separate endgames pass wins after each ability, Ghost closing on the winning move, expected move/card scoring and worker solver acceptance. Screenshots plus `report.json`, `win-report.json` and browser runners are in `/tmp/s1-shots`. Software WebGL checks disable shadows and draw every sixth frame while retaining card materials, normal animation updates and input paths.

Kernel edit: the one-line rules-aware hint fallback is recorded under **S1 kernel edits** above. Known gaps: none identified for S1. Search deliberately does not generate X operations; every tested resulting board remains a valid solver input. No commits or destructive Git commands were used.

## Requests to B1/B2/B3

- B3 is implementing Fog using existing scoped conceal/reveal hooks plus temporary renderer-only peek. Shared edits are limited to main.js input handlers, a separate table.js fog section + setFog export, and the Tap to peek row/binding in index.html/js/ui.js. B1: please preserve these additions; no Voyage runtime API edit is needed. Dynamic depth-3 reveal runs on start/move/undo and restored setup; Clearance remains permanent. Tap preference defaults false via its settings binding (store.js is outside B3 ownership).

## Requests to B1/B2/B3

- B1: `crown` (crown silhouette) and `thorn` (barbed zigzag) card styles are landed. Boss text will receive `{seed}` everywhere through charmText/runView. `bossRng(seed,id)` will export the exact `stream(seed, 'boss', id)` stream from boardrules.js. B1 computes boon rule diffs as a Set of changed rule field names, with `.ability` boolean and `.kind` string; boss boonRelation callbacks may use `diff.has(field)`. B1 edits only setRules in table.js for the foundation band, leaving B3 fog section and input handlers alone.

## Bosses: B2

Implemented all eight rule bosses in `js/voyage/content/bosses.js` (`boss.lockdown` … `boss.tombs`). Run-stable suit/columns use `stream(seed, 'boss', id)` in both `text` and `rules`. Royal Decree / Barren Suit call `setup` with `crown` / `thorn` marks. `rules` merges `cellThaw`, `barren`, `foundationSpread`, `sealedCols`, and `noCellRanks` with prior board state rather than overwriting.

| Boss | ease | boonRelation highlights |
| --- | ---: | --- |
| Lockdown | 0 (cells modeled by bank) | `+` freeCells / cellThaw boons |
| Thaw | −3.05 | `+` extra cells / startHome; `~` stacked thaw |
| Royal Decree | −2.46 | `!` Ghost Cell / Clearance; `+` wildRanks / moveBonus |
| Kings' Throne | −2.29 | `!` emptyFactor > 2; `+` moveBonus |
| Barren Suit | −1.54 (~1 CE) | `!` barren boons; `+` wildRanks / moveBonus |
| Lockstep | −1.30 | `!` foundationSpread > 3; `+` foundationReturn / startHome |
| Hand Carry | −0.60 | `!` emptyFactor > 2; `+` moveBonus |
| Twin Tombs | 0 (sealedCols neutral at budget) | `!` sealedCols boons; `+` moveBonus |

`tools/charm-checks/bosses.mjs` covers solo/merged `composeBoard`, seeded barren/tombs stability, decree marks, and `boonRelation` for every non-placeholder boon. `node tools/charm-content-check.mjs --strict` and `node tools/rules-check.mjs` pass. Left `boss.narrows` removal to B1.

- B1 update: boon diffs now support both `diff.has(field)` and `diff[field]` containing the boon-adjusted value (e.g. emptyFactor 3), matching B2 content. `seed` is also supplied to runtime charmContext so Barren setup uses the same suit as text/rules. Calibration started after all nine real bosses appeared.

## Requests to B1/B2/B3

- B1 acknowledged the design revision: Hand Carry removed from tells and calibration automatically follows the registered boss list. Re-read the replacement Magnetic Storm (STACK) and Root Bound (CELLS) content before restarting calibration. Fog limited-peek UI remains B3-owned; B1 keeps capacity readout for Kings' Throne and any non-classic capacity. B1 will verify limited Fog text reaches every seeded view and cache keys continue to include dealShift.

## Requests to B1/B2/B3

- B3: user/orchestrator revised Fog to **3 peeks per board**, **+1 per emptied column**, max **6 held**. Count + undoable grant history are saved in Fog memo; the chip uses api.badge. Peek starts spend the count, short/cancelled pre-reveal holds are free. `dealShift` is now **−0.5**, tooltip: "Cards more than 3 deep are face-down; you have 3 peeks (+1 per emptied column)." B1: please use −0.5 in any Fog calibration/presentation data. Input imports the small spendFogPeek helper from the owned Fog content module; no runtime edits needed.

## Requests to B1/B2/B3

- B3 accessibility integration request to B1: please include `c.badge` in `compactCharm`'s button aria-label in `js/voyage/ui.js`, so Fog's remaining-peek count is announced along with its static tooltip. The badge is already shown visually through the existing runtime API; current explicit aria-label overrides the badge child text.

## Bosses: B3

Implemented `boss.fog` in its owned special module, the separate table fog section, main.js input handlers, and the Tap to peek settings row/binding. Fog conceals cards below the top three at deal, then permanently reveals the new top three after moves/undo and on restored setup. Seen cards stay seen. `tags: ['VIS']`, neutral solver rules/ease, `dealShift: -0.5`, and Clearance relation `!` follow the revised brief; Clearance fully clears fog and mist.

The user/orchestrator's limited-resource revision is included: three peeks initially, +1 per column-empty event, at most six held. Memo stores the remaining count and history boundaries for grants; actual grant deltas distinguish capped grants from earned peeks. Undo (including batch undo and resumed undo) removes only earned grants without refunding spent peeks. The boss chip shows the remaining count through `api.badge`; the numeric badge fits without covering its icon. Tooltip: "Cards more than 3 deep are face-down; you have 3 peeks (+1 per emptied column)."

Stationary pointer holds reveal at 250 ms; moving beyond the existing 6 px drag threshold cancels a pending peek for free. A hold that already revealed and then becomes a drag still completes the drag; its peek remains spent because spending occurs at reveal start. Tap to peek persists with the existing settings and toggles a column; keyboard supports held P + 1–8 and sequential P then 1–8, with Escape, blur, pointer cancellation and lost capture closing temporary peeks. Peek changes only renderer visibility, never history or kernel concealment. Release consults the current persisted concealed set, so undo, permanent reveals and resume cannot re-hide seen cards. Exhausted holds also consume the input gesture without accidentally moving a card. Mist uses one lazily created quad per column and one shared shader/material; frame updates reuse the cached set, meshes and uniforms.

Validation: `node tools/charm-checks/boss.fog.mjs`, `node tools/charm-content-check.mjs --strict` (1,141 charm/strength cases plus every extension), and `node tools/rules-check.mjs` pass; classic verdict/nodes/path still match all 58 baselines. Syntax and targeted whitespace checks pass. The repeatable browser check is `node tools/charm-checks/boss.fog.mjs --browser` against `node serve.mjs 8162` (or `VOYAGE_TEST_URL`). Headless Chrome verifies 20 scenarios: deal/mist, dynamic depth, exact hold/release restoration, spending/exhaustion, short/drag cancellation, hold becoming drag, pointer cancellation, keyboard hold/toggle, tap setting/toggle, exhausted holds on movable cards, real column-empty grant, resumed undo of that grant, reload during peek, persisted setting/count, blur, light-theme mist, Clearance and classic drag/undo. No page errors. Thirteen final screenshots and `report.json` are in `/tmp/b3-shots`; earlier browser/test-harness debugging artifacts are kept separately in `/tmp/b3-shots/debug`. The browser uses software WebGL with shadows disabled and draws every sixth frame, while retaining production materials, animations and input/event paths. In-page async work is started then polled, avoiding collected CDP promises.

Ownership boundaries were preserved; no commits or destructive Git commands. B1's optional spoken HUD-badge integration request remains recorded above because `js/voyage/ui.js` is B1-owned.

## Requests to B1/B2/B3

- B1: Fog's dynamic badge and boss-relation tooltip are now included in the compact HUD button aria-label, covering B3's remaining-peek announcement request. Calibration completed on the eight-boss revised roster with all compatible s7 pairs, new STACK/CELLS theme challenges, and Fog −0.5; summary is in boss-build.md §5 (317.3 s).

### Bosses: B3 — drag cancellation clarification

The orchestrator's repeated reminder clarifies that a gesture becoming a drag is free. B3 now refunds the peek when a revealed stationary hold transitions into a card drag, in addition to leaving pre-reveal drags/short presses free. This supersedes the earlier B3 note that an already-revealed hold remained spent after becoming a drag. The refund updates the saved budget and boss badge without adding a move or changing persisted concealment; it respects the six-peek cap. Unit and browser checks now assert the refund as well as normal drag completion. Hand Carry is absent from the registered content (B2/B1 ownership).

B3 final clarification validation: the updated `boss.fog.mjs --browser` rerun passes all 20 scenarios, including the post-reveal drag refund; the latest `/tmp/b3-shots/report.json` records zero page errors. Focused Fog checks, strict content checks (1,141 cases plus extensions), rules/classic baselines, syntax and whitespace checks all pass. B1 has completed the spoken HUD badge integration request, so that earlier B3 follow-up is closed. Screenshots remain in `/tmp/b3-shots`.


## Bosses: B1

Implemented the boss system in boss-build.md §2 for the revised eight-boss roster. The seeded draw excludes placeholders; `boss.narrows` is removed and missing saved boss ids load safely. Finale budgets use the measured pair lookup with an ease-sum fallback, lower only the theme challenge to a floor of 4, and keep boss/boon strength at 7. Boss text and setup receive the run seed; `bossRng(seed, id)` matches B2's direct stream, so Barren Suit names and marks the same suit throughout the run. Crown and thorn have distinct corner sigils and edge colours. Boon diffs support both Set membership and adjusted field values, with relation badges/tooltips on offers, map details and the HUD; dynamic badges are included in spoken labels, closing B3's accessibility request.

Final-row plans are prepared as soon as their nodes exist, two rows ahead, without held boons. Verified bank candidates are cached by solver rules and reused only when their blended rating fits the current band and the deal has not been used. Real worker logs confirm pre-solve verification and cache hits. Per-plan keys also include active charm ids/strengths, preserving score-only boon hooks when the same solver rules were warmed without boons. The dealer retains mandatory full verification and its duty cycle; a failing finale challenge never relaxes below strength 4.

Added the once-only +2 finale undo stipend/toast, ×0.92 finale star thresholds in the HUD/intro/result breakdown, and the specified free-cell cost scaling. Board 7 shows a boss intro before its theme intro, the eased-finale note, and a two-second tell flash. Lockstep's glowing foundation ceiling uses min foundation + spread and refreshes with moves/undo. Non-classic move capacity appears as “Move up to N”; sealed missing cell slots remain visible. Voyage HUD wrapping and tray padding keep boss relations/capacity visible on narrower screens. The service-worker shell/version includes real bosses, Fog and the calibration lookup. Classic controls/rules/scoring remain unchanged.

Calibration ran after B2/B3's final content was present: no Hand Carry; Magnetic Storm has STACK, Root Bound has CELLS, and limited-peek Fog has dealShift −0.5. `tools/boss-calibrate.mjs` measured 60 deals per boss and compatible s7 pair, lower strengths on 16 deals, with 40 ms searches and shared outcomes for identical rules/deals. Eight bosses, 264 compatible s7 pairs, 1,037 measured rows and 8,358 unique searches completed in 317.3 seconds. Raw data is in `tools/boss-calibration.json`, and boss-build.md §5 records the table. The short-budget lookup is conservative: 260 pairs ease down, and unknown searches are recorded separately from proven unsolvability. Strength-4 pairs still require the dealer's full six-second verification; no unknown deal is accepted.

Validation: `node tools/charm-content-check.mjs --strict` passes 1,141 charm/strength cases plus every extension; `node tools/rules-check.mjs` passes, including exact classic verdict/nodes/path on 58 deals (30 solved). Focused checks in `/tmp/b1-check.mjs` and `/tmp/b1-budget.mjs` cover seeded draw/text/setup, all 264 budget pairs, strength floors, relations, two-row preparation, stipend, score thresholds/cost, rules-key cache reuse and retention of score-only boon hooks. Syntax, owned-file whitespace and all 89 service-worker shell paths pass. Voyage test helpers use complete variant sequence generation; the classic helper is unchanged.

Headless Chrome on port 8160 reaches the real board-7 flow for Lockstep (`B1-browser-29`), Kings' Throne (`B1-browser-12`), Barren Suit (`B1-browser-0`) and Lockdown (`B1-browser-27`). Test hooks skip the first six boards while retaining seeded boss draws and generated routes; the finale uses the real worker/dealer and normal UI handlers. Each passes both intros, eased note, tell/stipend, offer/map/HUD relations, logged cache hit, actual solve moves/undo, saved reload without a second stipend, and a won result with normalized-star breakdown. Additional reruns warm without boons then enter with a score boon, preserving its active hook. Lockstep band, Throne capacity and 13 seeded thorn marks are checked. The six-charm HUD is checked at 1280, 960 and 390 px. Thirty-five screenshots and the four-case zero-error `report.json` are in `/tmp/b1-shots`; runner: `/tmp/b1-browser.mjs`. Software WebGL disables shadows and draws every sixth frame while retaining production materials/animations; in-page async work is started and polled to avoid collected CDP promises.

Ownership boundaries were preserved. No commits or destructive Git commands were used.

## Requests to B1/B2/B3

- B1 completion note to the spec owner: runtime/calibration use Fog −0.5 and seven B2 bosses plus Fog. The older boss-build.md §3 bullet still says −0.75 and its §4 B2 ownership row still says eight bosses; those two descriptive counts should be reconciled with the revised §1 roster. B1's required §5 calibration is complete.
