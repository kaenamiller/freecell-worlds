# K1 — rules kernel v2

Implemented the original §2/§2.1 scope and addenda §2.0b–d, including required Suit Spur, plus the deal-dependent `dealRules` hook so Keel Stones and Pinned are verified under the cards they actually pick.

## Interfaces for other agents

- All fields have JSON-plain neutral defaults. `suitRunFree` is a suit mask (all suits = 15), not a boolean. `twinStack` is 0/1/2. `cellLimits[i]` may combine `minRank`, `maxRank`, and `suits`; all supplied constraints must match. `freeCards` bypasses these and rank/card/colour bans, including one-way cell exits. It cannot bypass frozen/closed cells, stacked-cell order, or pinning.
- Plain `game.rules` is recompiled at every action/query. Nested mutations, including `rankShift[card]`, take effect immediately; X undo must restore the previous map/entry. Search-local compiled rules are immutable snapshots.
- `phase` replaces the supplied fields at `cardsHome(state) >= at`, including `emptyFactor` and `moveBonus`. Unspecified fields keep their base values. Undo and foundation returns derive the previous phase from home count; returns check destination legality at home count minus one. Forced auto-play requires safety under both phases. `cellClose` and `colorSpread` disable forced safe auto-play; checked foundation-only finishing remains available.
- `activeFreeCells` retains its legacy meaning: the thawed prefix length. Use `cellIsClosed`, `cellIsOpen`, or `freeCapacity` to account for tide closure. An occupied closing cell keeps its card until it leaves; its slot closes as soon as it is empty.
- `cellStack` routes any Game drop into its first k cells to their leftmost empty index. Descriptors store that actual index. Only the rightmost occupied stack cell can leave. Generator cell classes include rank/suit limits and future slot behaviour.
- `emptyMaxRank` and any `emptyColors` remove empty-column capacity multiplication, unless `emptyAlwaysCounts` is set. `shallowCols` counts columns of length ≤ n as capacity buffers, and excludes a qualifying destination from that buffer count. `maxMoveSize(state, movingToBuffer, rules, cards)` returns Infinity for an eligible single-suit run; destination legality and sequence validity still apply.
- `openCols` changes destination placement only; it never makes a loose pair into a valid movable run. Barren parents and seals still win. `cellExitWild` changes only free-cell-to-tableau placements.
- `maxEmpty` prevents moves from creating extra empty columns above the cap. Moves which reduce or preserve an already exceeded count remain legal. A foundation move may exceed the cap only when a simulated foundation-only finish succeeds with the cap disabled; this necessary endgame exception avoids making every capped board unwinnable.
- `dealSkew` presets distribute all 52 shuffled cards first, then apply `startHome`. Custom eight-length arrays may total 52 (same behaviour), or the remaining `52 - 4 * startHome` cards (distribute the filtered shuffle to exactly those lengths). Bad lengths throw. Seals are initialized after the resulting deal.
- `ignoreRestrictions` relaxes destination bans, including barren cards/empty colours, but keeps rank/colour, move capacity, run validity, pinning, stack order, and missing/frozen/closed cells. `rankGap: 2` permits both the normal rank gap and a two-rank gap. The successful tableau drop consumes the override; Skeleton Key also consumes it on a successful free-cell drop. Descriptors preserve the full override for undo.
- `composeBoard` accepts `levels`, `stickers`, and `extraChallenges` (ids or `{ id, strength }` entries). Theme challenges run before the boss, at `challengeStrength ?? strength`; explicit entry strengths win. All `rulesAfter` hooks run in active order after all `rules` hooks. Per-charm rules ctx (and `boonRelation`'s ctx) includes `id`. Context includes board-active boon ids, copies of stickers, level, and `family(name)`.
- Optional `dealRules(r, ctx)` runs after `rules` / `rulesAfter` once a deal exists. `ctx` is the usual rules ctx plus read-only `state` (dealt after `startHome` / `dealSkew`) and `deal`. RNG is `stream(seed, 'dealRules', idx, id)`. `composeBoard` does not run it. `applyDealRules(rules, plan, n)` clones and applies it. The dealer treats any plan whose `active` charms define `dealRules` as restricted: bank answers are ignored, boss pre-solve cache is skipped, and every candidate is verified under the deal-final rules. `dealFor` returns those rules; `startBoard` copies them onto `run.current.rules` (or applies `applyDealRules` when the pick omitted `rules`). Resume uses the saved final ruleset. `runes.challenge` and `safetypin.challenge` pick their deal cards here; `setup` only marks from `ctx.api.rules`.
- Boss confiscation removes a boon only from this board's active list and ease/family sum, returning `confiscated`. A pseudo-boon `voyage.stickers` is included only when stickers exist and its definition is registered. Dealer keys and fallbacks retain levels, stickers, extra challenges, and confiscation; boons that add restrictions receive verification under the actual rules.

## Suit Spur

Call `canPlantSpur(state, cardId, rules)` for an exposed column top or free-cell card. A plant needs rank ≥ original foundation + 2, no existing spur, legal pin/stack/gate/spread/balance/cap conditions. Apply through `game.applyCharmMove({ t: 'X', op: 'voyage.spur', src: { kind: 'col' | 'free', i }, card })` (card is optional and is filled by application). This removes that exposed card and creates `state.spur = { suit, base, top: base }`; it changes no rule fields. Undo deletes the spur and restores the card.

An F descriptor onto the spur carries `dest: 'spur'`; omitted destination means the ordinary pile in classic states. `foundationDestination(state, card)` routes a split suit by its base. `Game.moveToFoundation(src, dest?)` and `foundationAccepts(state, card, rules, dest?)` accept `'original'` / `'spur'`; omitting the argument routes automatically. The ordinary pile stops at base − 1. Spur R descriptors carry `from: 'spur'` and the real suit; use `game.moveFoundationReturn(suit, to, 'spur')`. The base cannot return.

`cardsHome`, `suitHomeCount`, `foundationTop`, and `cardIsHome` include the split piles. Foundation spread uses the higher top of the two piles for the split suit; gate and colour balance use the number of actual cards home. Safe auto-play checks actual child-card membership, so a high spur top cannot pretend a low gap is home. Hashing and cloning include the spur; classic state hashes remain unchanged.

The fifth slot appears on the right-hand edge of the table, with suit art and an original-pile ceiling marker. Main's existing foundation layout/drop paths recognize slot index 4 as the spur. Generic X relayout shows the planted card immediately. Content scoring/event hooks should treat the `voyage.spur` X card as a card sent home; later spur F moves use the normal foundation event.

## Verification and calibration

Calibration was not re-run this pass; `tools/boss-calibration.json` (`partial: false`, 40 deals × 100 ms, 12-deal lower pairs, 800.7 s, 9948 unique searches) and `tools/charm-calibration.json` (60 stratified deals × 100 ms, 272.5 s) already cover every boss including Eclipse, the Auditor and High Tide, plus every new restrict field. Boss `ease` values in `js/voyage/content/bosses.js` match `suggestedEase` from that run.

Cell loss is modeled exactly by the bank (`effectiveScore`), so Lockdown (−2 cells) and the Auditor (−1 cell, no other restrict field) stay at ease 0. Twin Tombs is sealed columns, not cell count; its residual −0.24 is the unmodeled remainder after that correction. Thaw, Decree, Eclipse and similar keep negative ease because `cellThaw` / `noCellRanks` / `phase` are not in the bank model. A later `BOSS_CALIBRATE_CURVE_ONLY` pass (12 dealer picks, 400 ms) records finale-band verify yields under those ease values; short-budget unknowns are failures to verify, not proofs of loss. Runtime still uses a 6 s search.

Pin badges are deferred: card marks/stickers belong to other agents and would require a nontrivial mark lifecycle.

`node tools/rules-check.mjs` includes a dealer case that a `dealRules` hook’s picked card is present on every candidate the verifier sees. Classic baseline is unchanged.

### Boss ease (applied = suggested)

Measured 40 reproducible bank deals from tiers 5–7 per boss (100 ms/search, three 2,000-node restarts). Suggested ease is `−max(0, measuredCE − bankCellCE) × 1.54` tiers, except Lockdown and the Auditor which are forced to 0 because their only modeled pressure is missing cells. `ease` below is the value composed from the charm definition at measurement time (pre-adjustment for a few bosses).

| Boss | Alone verify | Alone unknown | measured CE | bank cell CE | Suggested ease | Applied ease |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Lockdown | 5.0% | 90.0% | 1.06 | 2 | 0.00 | 0 |
| Thaw | 5.0% | 32.5% | 1.19 | 0 | −1.84 | −1.84 |
| Royal Decree | 2.5% | 97.5% | 1.24 | 0 | −1.91 | −1.91 |
| Kings' Throne | 10.0% | 90.0% | 0.88 | 0 | −1.36 | −1.36 |
| Barren Suit | 0.0% | 100.0% | 1.51 | 0 | −2.33 | −2.33 |
| Lockstep | 25.0% | 75.0% | 0.11 | 0 | −0.16 | −0.16 |
| Twin Tombs | 22.5% | 77.5% | 0.16 | 0 | −0.24 | −0.24 |
| Eclipse | 0.0% | 100.0% | 1.51 | 0 | −2.33 | −2.33 |
| The Auditor | 7.5% | 92.5% | 1.00 | 1 | 0.00 | 0 |
| High Tide | 15.0% | 85.0% | 0.60 | 0 | −0.92 | −0.92 |
| Fog | 25.0% | 75.0% | 0.00 | 0 | 0.00 | 0 |

Compatible strength-7 pair yields in this budget were mostly 0–10% (Fog up to 32.5%, High Tide 27.5%, Twin Tombs 40%). Pairs below 35% yield or −4.6 total ease were re-measured down to strength 4; `bossBudget` still consults those pair rows.

### Finale-band curve check (12 picks, 400 ms)

| Boss | Ease | Curve verify yield |
| --- | ---: | ---: |
| Lockdown | 0 | 25.0% |
| Thaw | −1.84 | 0.0% |
| Royal Decree | −1.91 | 16.7% |
| Kings' Throne | −1.36 | 16.7% |
| Barren Suit | −2.33 | 0.0% |
| Lockstep | −0.16 | 16.7% |
| Twin Tombs | −0.24 | 33.3% |
| Eclipse | −2.33 | 0.0% |
| The Auditor | 0 | 50.0% |
| High Tide | −0.92 | 8.3% |
| Fog | 0 | 25.0% |
| House | 0 | 58.3% |
| Mirror | 0 | 50.0% |

House and Mirror are pressure/content bosses (ease 0); they were included in the curve pass after the kernel bosses. Low curve yields at 400 ms are expected on tier-7 picks; they do not justify adding ease on top of bank-modeled cell loss.

### Restrict-field ease suggestions

Measured on 60 seeded, tier-stratified bank deals (`K1-calibration-v1`); 100 ms/deal, 6 × 2,000-node restarts. Ease is interpolated between base and base minus one cell (1.54 bank tiers), capped at 2 cell-equivalents. Zeros were indistinguishable from base at this budget.

| Primitive / parameter | Unsolvable | Unknown | Median solved nodes | × base | Suggested ease |
| --- | ---: | ---: | ---: | ---: | ---: |
| Base (4 cells) | 0.0% | 55.0% | 2385 | 1.00 | 0.00 |
| Base minus one cell | 0.0% | 66.7% | 3733 | 1.57 | −1.54 |
| cellLimits 1 ≤5 | 0.0% | 46.7% | 2497 | 1.05 | 0.00 |
| cellLimits 1 ≥9 | 0.0% | 35.0% | 2311 | 0.97 | 0.00 |
| cellLimits 1 diamonds | 0.0% | 51.7% | 2506 | 1.05 | 0.00 |
| emptyMaxRank 7 | 0.0% | 100.0% | — | — | −3.08 |
| emptyMaxRank 5 | 0.0% | 100.0% | — | — | −3.08 |
| cellClose 1 @28 | 0.0% | 56.7% | 3466 | 1.45 | −0.37 |
| cellClose 3 @16,28,40 | 0.0% | 40.0% | 3346 | 1.40 | 0.00 |
| gate ♣ after 6 | 0.0% | 53.3% | 3388 | 1.42 | 0.00 |
| gate ♣ after 12 | 0.0% | 80.0% | 3486 | 1.46 | −3.02 |
| dealSkew slope | 0.0% | 51.7% | 2466 | 1.03 | 0.00 |
| dealSkew valley | 0.0% | 45.0% | 2979 | 1.25 | 0.00 |
| phase courts → spread3 @26 | 0.0% | 90.0% | 3329 | 1.40 | −3.08 |
| phase capacity @26 | 0.0% | 45.0% | 2374 | 1.00 | 0.00 |
| cellStack 2 | 0.0% | 46.7% | 3431 | 1.44 | 0.00 |
| cellStack 4 | 0.0% | 58.3% | 3511 | 1.47 | −0.57 |
| pinned 7♣ until 12 | 0.0% | 56.7% | 2275 | 0.95 | −0.17 |
| maxEmpty 2 | 0.0% | 36.7% | 2523 | 1.06 | 0.00 |
| colorSpread 3 | 0.0% | 51.7% | 2506 | 1.05 | 0.00 |
| emptyColors 4 red | 0.0% | 58.3% | 3338 | 1.40 | −0.54 |
| barrenCards 2 | 0.0% | 70.0% | 2450 | 1.03 | −1.71 |

Full primitive table (including pre-v2 fields) is in `tools/charm-calibration.json`. Content authors should treat `emptyMaxRank` and late `gate` / court `phase` as heavy; `cellClose` at High Tide’s 16/28/40 schedule did not separate from base here (High Tide’s boss ease −0.92 comes from the boss-alone pressure, not this row).

### `dealRules`

`runes.challenge` (Keel Stones) and `safetypin.challenge` (Pinned) previously chose cards in `setup()` and mutated live `game.rules`, so the dealer verified an unrestricted deal. They now set `noCellCards` / `pinned.cards` in `dealRules`. `rules-check` proves the verifier sees the dealt bottom-of-column card.
