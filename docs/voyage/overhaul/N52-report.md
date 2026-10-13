# N52 — four new Voyage charm sets

Shipped the seven JSON-plain kernel fields, the concession/spending/offer-pool primitives, and all 16 charms in Plaster Studio, Backrooms, Vaporwave and Silent Cinema. Changes stay in the assigned kernel/runtime/content/check files; main.js changes are confined to voyageRuntimeAPI, voyageWin and the two stuck-dispatch continuations, and ui.js changes are only the conceded-result heading/subtitle and suppressing the normal three-offer storm note on concession. The map section and content/index.js were not edited. No checkout, stash, reset, clean or commit was run.

## Exact kernel semantics

- **loneAccepts**: occupied columns holding one through n cards take any card or valid run, subject to barren parents, seals, height limits and capacity. This is destination permission only: a loose join is never a movable run. Empty columns retain the existing empty-column restrictions, matching Armature's “one or two cards” text.
- **skipBuild**: level 1 adds same-colour links exactly two effective ranks apart; level 2 adds those links in either colour. The ordinary one-rank links remain. The build table drives placement and all sequence queries; rankShift also affects these links.
- **fullCellsBonus**: adds n after the normal capacity formula when every active (thawed) cell is occupied and at least one cell is active. Occupied shuttered/closing cells still count as occupied; frozen cells do not. Safe auto-play does not remove a free-cell card while that would lose this bonus.
- **emptyCure**: below the cards-home threshold, empty columns accept nothing and provide no capacity multiplication, including when emptyAlwaysCounts is held. Undo and foundation returns recompute the threshold; a return cannot use a column that becomes wet after lowering the foundation.
- **cellsNeedEmpty**: when there is no literally empty tableau column, the last k active cells cannot accept cards or provide empty-cell capacity. Existing occupants can leave. Key cards and ignoreRestrictions cannot open missing, frozen or shuttered slots. Creating an empty column opens the shutters; filling the last empty column closes them again.
- **sameColorRanks**: for a moving card of a masked original rank, ordinary one-rank builds require its own colour. Wild ranks/cards and suit-build still add help. The same build table governs runs and safe foundation dependencies.
- **noExitCols**: a non-foundation move cannot empty a marked column, including by moving its whole valid run. A single remaining card can go home normally. This closes the full-run bypass implicit in the specification's “columns can't be emptied except by sending the last card home.” Moving only a suffix remains legal. Skeleton Key's ignoreRestrictions can bypass this restriction.

All seven fields participate in rulesKey through the existing canonical defaults path; all four restrict fields participate in hasRestrictions. Both workers import the common engine. The short solver preserves column/cell identity for No Exit/shutters and does not merge differently restricted empty destinations. Safe auto-play is conservative for loneAccepts and checks skipBuild/same-colour dependencies. The classic predicate, hash and deterministic search baseline are unchanged. Subtle wet sheens, horizontal cell shutters and small loop glyphs are added to table.js only for the new rules.

## Runtime and content details

- **concedeBoard()** returns false outside a live board or on board 7. It uses the normal board-clear state machine, sets conceded=true, forces 1★ and one offer/one pick (overriding storm/offer/pick bonuses), grants normal post-board undos, saves stats and reaches the normal port/map flow. If this stop has no eligible offers, a seeded real visible unheld boon supplies the single fallback offer (the physically exhausted global pool is the only no-offer case). main.js uses “Stepped out” / “To be continued” and skips the card cascade. Stuck dispatch stops once Cliffhanger has entered the reward flow.
- Concession omits the base/star/points **board-formula** coin lines. History-earned charm/sticker coin lines and ordinary end-board hooks still apply; negative totals still clamp to zero. Partial-board score is retained, while the star result is forced to 1. This follows the explicit “0 coins from the board formula” wording; it does not erase objectives already earned by actual play.
- **spendCoins(n)** accepts only nonnegative integers with sufficient funds on a live board, returns a boolean, and records immediate economy spending. Invalid/insufficient/out-of-board calls leave the purse unchanged. Undo never refunds it.
- **offerPool(offers, ctx)** runs once when startBoard builds the saved offer list. Each held hook gets an independent stream(seed, 'offerPool', idx, charmId), theme and normal level/run context. Outputs are deduplicated and filtered to real, visible, unheld boons, bounded by the original pool size; stars/picks cut the saved pool normally. Shuffle Play chooses uniformly from eligible other current-roster themes, uses distinct replacement themes at L2, and selects unheld visible non-placeholder boons. Saved offers do not reroll on resume.
- Armature, Hum and Checkerboard produce their level-specific fields. Mould and Exposure validate face-up picks, apply custom X rule changes, restore prior values on undo, and maintain wild marks. Noclip validates a face-up buried card and another legal destination, preserves ordinary rank/colour and all restrictions, and restores its exact source index on undo. Picker cancellation spends no use.
- Fountain chooses one/two distinct seeded ranks in 3–Q, spends 5 coins before its X move, marks all selected cards and restores the wild-rank mask on undo. Its paid ranks are saved in board memo. Start-only availability stays closed after its manual X move, even after undo; money remains spent.
- Commission is a 10-coin needsCard port service, once per visit. Run memo holds the chosen rank and the next board index; the payout is 4/6 coins for each unique commissioned card whose arrival leaves fewer than 26 cards home. It expires by board index, marks the commissioned rank, uses retained-history replay, and also recognizes declared homeCards/Suit Spur X moves. Returns/undos cannot farm payment.
- Projectionist checks foundation events at >=26 home (L1) or >=20 (L2), grants one use to each exhausted active ability once per board, and remembers those grants through undo/resume. Exit Sign and Cliffhanger consume one/two saved run exits, roll the count back if concession fails, and never fire on the finale. Exit Sign is start-only; Cliffhanger also requires zero undos.
- All 12 boons declare family, upgrade, icon, one-sentence text and ctx.level behaviour; all four rule challenges declare tags, solver rules and calibrated ease. Card-specific effects have marks. All content randomness is seeded.

## Calibration / ease

Final calibration ran with CALIBRATE_52=1 CALIBRATE_DEALS=40 CALIBRATE_MS=100 node tools/charm-calibrate.mjs after closing the No Exit whole-run bypass. It uses the same 40 seeded, tier-stratified deals and seeded search stream per variant, 6 × 2,000-node restarts and maxDepth 320. Runtime was 58.7 s. The N52 mode writes /tmp/n52-calibration.json and leaves K1's tools/charm-calibration.json intact. One missing cell anchors 1.54 tiers; ease follows the existing calibration estimator, capped at two cell equivalents.

| Parameter | Verified | Unknown | Median verified nodes | Suggested ease |
| --- | ---: | ---: | ---: | ---: |
| Base (4 cells) | 17/40 | 57.5% | 2352 | 0.00 |
| Base minus one cell | 9/40 | 77.5% | 2539 | -1.54 |
| emptyCure 6 | 12/40 | 70.0% | 2309 | -0.94 |
| emptyCure 12 | 5/40 | 87.5% | 1565 | -2.14 |
| emptyCure 18 | 2/40 | 95.0% | 4256 | -3.04 |
| cellsNeedEmpty 1 | 10/40 | 75.0% | 2650 | -1.37 |
| cellsNeedEmpty 2 | 15/40 | 62.5% | 1909 | -0.31 |
| sameColorRanks 4096 | 12/40 | 70.0% | 2350 | -0.95 |
| sameColorRanks 6144 | 18/40 | 55.0% | 2359 | 0.00 |
| sameColorRanks 7168 | 21/40 | 47.5% | 2492 | 0.00 |
| sameColorRanks 7680 | 18/40 | 55.0% | 3242 | 0.00 |
| noExitCols 3 | 19/40 | 52.5% | 1419 | 0.00 |
| noExitCols 15 | 12/40 | 70.0% | 2297 | -0.94 |
| noExitCols 255 | 8/40 | 80.0% | 2406 | -1.71 |

Applied Wet Plaster ease interpolates the measured 6/12/18 thresholds (-0.94/-2.14/-3.04). No Exit uses 0/-0.94/-1.71 for 2/4/8 columns; After Hours uses -1.37/-0.31 for 1/2 shutters; Typecast uses -0.95 for Queens and 0 for larger masks. The surprising non-monotonic shutter/rank values are the measured short-budget estimates, not claims that stronger restrictions are easier for humans. All unsuccessful searches here hit a budget/depth limit and were unknown rather than proven losses; there were no false verdicts. Time guards and concurrent host load affect verification counts. The dealer continues to verify restricted boards at its full budget.

## Verification

- STRICT_V2=1 node tools/charm-content-check.mjs: passed, including the new id-based extension (2856 charm/strength checks, 52 themes on this checkout).
- node tools/rules-check.mjs: passed; 51 generator/player agreement + undo rulesets, 36 full-deck restricted solutions replayed/undone through Game, each new restrict field's dealer verification, seven-field dealer-worker coverage, and the unchanged 58-deal exact classic verdict/node/path baseline.
- node tools/economy-check.mjs: passed; live spending and invalid amounts, no undo refund, seeded filtered offer pools, forced one-offer/one-pick concession despite storm/two-pick hooks, saved concession, harbour flow, a seeded fallback when the stop has no offers, finale rejection and earned/negative history coin lines.
- node tools/charm-checks/v2-52.mjs: passed; every new charm at L1/L2 by id, all challenge strengths, X undo, picker cancellation, marks, seeded wishes/offers, commission early/late/expired/insufficient/repeat cases, recharge thresholds and limits, run exit counts and finale guards. Does not depend on new themes already being in THEME_ORDER.
- node tools/charm-checks/v2-52-browser.mjs against the real board on port 8173: passed; Mould/Noclip/Exposure at both levels with real picker/cancel/X/paid undo and use refunds, Fountain at both levels with irreversible coin spend, Projectionist's real foundation recharge and undo, Exit Sign reward → port, Cliffhanger's actual no-moves/no-undos dispatch → reward, and a stuck finale ending the run. No page/console errors in the completed run. Screenshots: /tmp/n52-browser.
- Eight missing charm-art paths were supplied existing art **only by the browser fixture** because icon assets belong to the simultaneous art wave. No production assets or art fallback code were changed; this browser pass verifies runtime, not completion of those eight icons.
- Syntax checks and scoped git diff --check pass.

## Specification interpretations / scope

No numeric charm effect was changed. Explicit clarifications are: No Exit blocks a whole-column supermove as well as a singleton; Commission is once per port and expires on the next board; Projectionist checks >= its threshold so an ability exhausted after the threshold can recharge on the next foundation event; concession keeps earned history coin lines but pays no board formula; Armature's occupied one/two-card columns retain the ordinary restrictions on genuinely empty columns. Ease is calibrated, not guessed. Original worker plumbing, dealer verification and rulesKey serialization already handle new fields and therefore required no duplicate worker engine.
