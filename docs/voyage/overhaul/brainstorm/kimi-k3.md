# Voyage charm overhaul — brainstorm (kimi-k3)

Per `BRIEF.md`. Builds on the decided direction (ports + coins, stickers, level-2 boons, family tags, new rule shapes, identity bosses, wagers, anti-fun removals). Assumed new kernel surfaces, beyond `charms-design.md` §2–3: a `coins` purse on the run (earned from board score, spent at ports), a sticker API (`api.sticker(cardId, type)` / run-level sticker map, types Wild/Gold/Lucky/Key), a `family` field on every boon, a `level` field (1–2), and port hooks (`on.port`, port pricing/sellback). Everything below is otherwise written against the existing kernel (`rules` fields, `ability` + `charmMove`, `score(sb)` from history, `on.*` events with capped undo grants, seeded `ctx.rng`).

---

## 1. Thirty boons

### 1a. Ongoing rule bends (8)

**1. Bunk Cell ★** — family: `cells`
One of your free cells is a bunk: it holds a 2-card run (a second card that stacks legally on the occupant); the pair leaves as one move.
L2 **Barracks**: every free cell is a bunk.
Impl: new help field `rules.bunkCells` (cell index, or `'all'` at L2). `cellAccepts` admits a stack-legal second card into the cell's second slot; state grows a parallel `free2` array (in `hashState`); the pair generates one run move. Help-only → no deal verification.

**2. The Fool ★** — family: `wild`
A 53rd card lives in its own slot: it stacks on anything and anything stacks on it; it never goes home and never blocks a win.
L2 **Two Jokers**: a second Fool joins the slot.
Impl: card id 52 (and 53 at L2), a `fool` slot in state (`hashState`), `rules.fool: n`; `canStackOn` returns true when either side is a Fool; `isSolved` ignores Fools; auto-play never touches them. Solver-visible help.

**3. Annex ★** — family: `columns`
A 9th column is dealt empty.
L2 **Annex II**: a 10th column, also dealt empty.
Impl: `rules.extraCols: 1|2`; `deal(n, rules)` appends empty columns after dealing 52 over 8; move gen / solver / `maxMoveSize` already loop over `state.tableau.length`; UI renders extra slots. Help-only; the deal itself is unchanged so bank ratings still apply.

**4. Switchback ★** — family: `columns`
Pick a column at the start of each board: it builds in either direction (up or down, alternating colour).
L2 **Switchbacks**: pick two columns.
Impl: ability-style `api.pick({kind:'column'})` at `on.start`, stored in `memo`; new help field `rules.colDirs` (per-column bitmask down|up); `canStackOn`, `runLength`, `isValidSequence`, `sequenceStart` honour both directions on marked columns. Pure help (both directions legal), solver-visible.

**5. Doppelgänger** — family: `wild`
A card may stack on the same rank of the opposite colour (9♠ onto 9♥).
L2 **Mirror Twins**: same-rank stacks allowed regardless of colour.
Impl: help field `rules.twinStack: 1|2`; one branch in `canStackOn` (rank equal, colour test by level), threaded through `runLength`/`isValidSequence` so drag-run detection agrees. Ease ~+0.2.

**6. Colour Committee** — family: `foundation`
The four suit foundations merge into two colour foundations (red, black), each climbing A…K with either of its suits.
L2 **Standing Committee**: all four Aces start home.
Impl: `rules.colourFound: true`; state keeps 2 piles of count 0–26; `foundationAccepts(card)` requires rank `== floor(count/2)+1` and matching colour (each rank lands twice, once per suit, either order); `isSolved` unchanged (sum 52); safe auto-play re-justified per boss-doc §0.4 (safe when the other pile is within one pair-step). Big ease (+0.5). L2 stacks with `startHome`.

**7. Shallow Draft** — family: `columns`
A column holding exactly one card still counts as empty for your move capacity.
L2 **Shoal Draft**: columns with up to two cards count as empty.
Impl: help field `rules.shallowCols: n`; `maxMoveSize` and the `cap` in `generateMoves` count columns of length ≤ n as empty for capacity only (they still accept cards normally). Solver-visible, ease ~+0.3.

**8. Flotilla** — family: `suit`
Single cards may be moved onto any exposed card of the same suit, regardless of rank or colour rules.
L2 **Squadron**: 2-card same-suit runs may do the same.
Impl: help field `rules.suitSingles: 1|2`; a single-move branch in `canStackOn` (same suit, run length ≤ level) — runs of 3+ still use classic legality, so it never silently re-validates drag-runs. Ease ~+0.35.

### 1b. Once-per-board abilities and decisions (10)

**9. Suit Spur ★** — family: `foundation` *(claims the parked "Suit Spur" spec)*
Once per board, send an exposed card home as the base of a fifth foundation; that suit finishes in two piles (low ranks on the original, the rest on the spur).
L2 **Twin Spurs**: usable on two suits per board.
Impl: exactly the parked spec — custom move stores `{suit, base, top}` in state + `hashState`; `foundationAccepts`, safe auto-play, `isSolved`, `foundationReturn` and `foundationSpread` all read it; fifth slot rendered in the foundation row. Ease +0.5.

**10. Undo Window ★** — family: `undo` *(claims the parked "Undo Window" spec)*
Once per board, open a streak of free undos; the next forward move closes it.
L2 **Wide Window**: two windows per board.
Impl: parked spec — a saved board flag in `memo` checked by the Voyage undo path before the undos gate; free steps emit `on.undo` with `ev.free` so spend-charms ignore them. Ease +0.3.

**11. Promotion ★** — family: `wild`
Once per board, permanently shift a card's stacking rank ±1 (its suit and its home rank are unchanged).
L2 **Field Promotion**: two uses per board.
Impl: `ability` + `api.pick({kind:'card'})` → choose +1/−1 (clamped: A can't drop, K can't rise); a charm move records `rules.promotions[id] = ±1` (custom moves may mutate `game.rules`; undo restores). `canStackOn`/`runLength` read effective rank; `foundationAccepts` reads face rank, so the card still goes home in order — promotion is purely a tableau tool. Solver-visible after use via `rulesKey`.

**12. Lashings ★** — family: `columns`
Once per board, weld a valid sequence into a single unit: it moves as one card for the rest of the board.
L2 **Double Lashings**: two welds per board.
Impl: pick a column then a depth (must be a valid run); charm move stores the welded id-list in state (`hashState`) and `maxMoveSize`/move gen treat the group as one card of weight 1. The solver may ignore welds (help only) and stay sound — welded cards remain individually legal. Undo unwelds.

**13. Deal Reset** — family: `undo` *(claims the parked "Deal Reset" spec)*
Once per board, put every card back where it was dealt — free, even with zero undos.
L2 **Second Deal**: two resets per board.
Impl: parked spec — `api.resetBoard()` undoes history one descriptor at a time (restoring cells, seals, overrides, X-moves); emits one `on.undo` with `ev.reset` that refund charms ignore. Ease +0.3.

**14. Three-Move Look** — family: `vision` *(claims the parked "Three-Move Look" spec)*
Once per board, see the solver's next three moves without playing them.
L2 **Long Look**: five moves.
Impl: parked spec — `api.preview(n)` solves under `game.rules` (5 s) and returns descriptors; numbered highlights, cleared by any play/undo/ability. Ease +0.15.

**15. Shakedown** — family: `ability`
Once per board, swap any two face-up tableau cards, wherever they sit.
L2 **Double Shuffle**: two swaps per board.
Impl: `api.pick({kind:'card'})` × 2 (both face-up, not in cells/foundations); charm move swaps their positions (may create dealt-style illegal pairs, same semantics as Raven's Trick). The general-purpose escape hatch — weaker than Tractor Beam per use but far more flexible.

**16. Bathyscope** — family: `vision`
Once per board, deep-scan a column: all its face-down cards are revealed; with none face-down, show the solver's next move instead.
L2 **Twin Scopes**: two columns per board.
Impl: `api.pick({kind:'column'})` → `api.reveal(column's concealed ids)`; fallback `api.hint()` mirrors Clearance's existing pattern. The counter-pick to VIS boards, never dead elsewhere.

**17. Weather Eye** — family: `vision`
Once per board, ask the sea: is this position still winnable?
L2 **Barometer**: two uses per board.
Impl: one solver solvability call on the current state under `game.rules`; `api.notify` reports "still winnable" / "no line found" — information only, no moves shown. Cheap to build (existing solve path), and it turns every risky line into a decision with stakes.

**18. Homeward Light** — family: `foundation`
Once per board, bless a suit: its next 3 cards home each grant +1 undo.
L2 **Lighthouse**: next 5 cards.
Impl: `api.pick` of a suit → `memo = {suit, left: 3|5}`; `on.foundation` matching suit → `addUndos(1)`, decrement; hard cap per board in `memo` (kernel rule). A real choice: name the suit you're about to push, not the one that's already home.

### 1c. Economy: coins, stickers, ports, wagers (6)

**19. Long Shot** — family: `coin`
At the start of each board, stake up to 3 undos on a 3★ finish: win 15 coins per undo staked, or lose them.
L2 **Longer Odds**: stake up to 5 undos at 20 coins each.
Impl: `on.start` wager UI → `api.spendUndos(k)` into `memo.stake`; `on.win` reads the board's stars: 3★ → `addUndos(k)` + `coins += 15k`; else the stake is gone. The flagship wager boon — converts undo hoarding into a coin engine with real downside.

**20. Souvenir Press** — family: `coin`
Once per board, press a Gold sticker onto any face-up card (it pays coins when sent home, for the rest of the run).
L2 **Mint Condition**: two presses per board.
Impl: `ability` + `api.pick({kind:'card'})` → sticker API adds Gold to that card id (run-persistent; every board deals the same 52). The choice is the game: pick a card you can home early and often across all seven boards.

**21. Manifest** — family: `coin`
Earn +4 coins for every stickered card sent home (any sticker type).
L2 **Bill of Lading**: +7 coins each.
Impl: `score(sb)` → `countHome(sb.history, id => stickers.has(id))` × rate; conditions are real because stickered cards are few and sometimes awkward to home. The sticker-build payoff.

**22. Harbour Bank** — family: `coin`
Each time you dock at a port, earn interest: +1 coin per 8 you hold.
L2 **Compound Harbour**: +1 per 5.
Impl: `on.port` hook reads `run.coins`. Makes hoarding a strategy and tensions against spending — the classic economy-boon tradeoff.

**23. Chandler** — family: `coin`
Port prices are 20% lower for you.
L2 **Old Friend**: 35% lower, and selling a boon refunds 75%.
Impl: port pricing hook multiplies buy prices; L2 raises sellback ratio. Plain, useful, and it makes every port visit measurably better.

**24. Tide Wager** — family: `coin`
Stake 5 coins at the start of a board: it pays 15 if your longest chain home is 8 or more.
L2 **Sure Tide**: pays on a chain of 6, or pays 25 on 8.
Impl: `on.start` takes the stake into `memo`; `score(sb)` → `chainsOf(sb.history)` decides payout. Failable, plannable (you can build the run before pushing it home), and distinct from flat point chains.

### 1d. Synergy / build-around (6)

**25. Drydock** — family: `cells`
While you hold 3 or more column-family boons, +1 free cell.
L2 **Grand Drydock**: threshold drops to 2.
Impl: `rules(r, ctx)` inspects `ctx.run.boons` family counts → `r.freeCells += 1`. Cells-for-columns: the first cross-family bridge, and it makes weak column boons draftable.

**26. Joker's Entourage** — family: `wild`
You can move +1 card at once for each wild-family boon you hold (including this one).
L2 **Travelling Circus**: +2 each.
Impl: `rules(r, ctx)` → `r.moveBonus += count(wild boons) × level`. Turns the 11 flat wild-rank charms into a scaling archetype instead of duplicates.

**27. Grand Tour** — family: `undo`
While your boons span 4 or more different families, +1 undo at the start of each board and +10% coins.
L2 **Grand Voyage**: threshold 3 families, +2 undos.
Impl: family-set size from `ctx.run.boons`; `on.start` → `addUndos`, coin hook → multiplier. The diversity reward — drafts against family-stacking and keeps ports interesting.

**28. Cast Party** — family: `ability`
Your ability boons get +1 use per board for every 2 ability boons you hold.
L2 **Encore Cast**: +1 per ability boon.
Impl: writes `api.abilityBonus` (read by every ability's `uses` resolution, same channel as Mission Control). Ability-stacking becomes a build, and one-use wonders like Shakedown turn into engines.

**29. Syndicate Ledger** — family: `coin`
Your coin boons pay 25% more for each coin-family boon you hold (cap ×2).
L2 **Syndicate**: 40% each, cap ×3.
Impl: coin-payout hook multiplies by `1 + rate×(n−1)`. The greed archetype: terrible on board 2, monstrous by board 6 — exactly the run-arc shape the roster lacks.

**30. Safehouse Network** — family: `undo`
Your first N free-cell placements each board (N = your cells-family boon count) each grant +1 undo.
L2 **Deep Network**: cap rises to N + 2.
Impl: `on.freecell` counter in `memo`, hard cap per board (kernel rule for event-granted undos). Makes the three identical +1 cell boons cohere into a cells build with an undo drip.

---

## 2. Fifteen challenges

Rule challenges are pure functions of tableau/cells/foundations (dealer-verified); pressure challenges touch only score/coins/stars/visibility. All are new shapes — none re-skin the existing six (no-cell ranks, barren, empty-min-rank, foundation spread, frozen cells, sealed columns) or the other roster shapes (max height, cell colour locks, one-way cells, dealt concealment, marked-card taxes, timers, threshold hikes).

**1. Rising Tide** — rule, `CELLS`. Free cells close for good as the foundations fill.
s1–2: one cell closes at 40 cards home. s3–4: one at 30. s5–6: one at 24, another at 40. s7: cells close at 20, 32 and 44.
Impl: `cellThaw` mechanism inverted — active cells = base − closures(found), pure function of `found[]`; a holding card is never lost (closures only remove *empty* capacity, floor: occupied cells stay). Ease −0.08×s. The endgame tightens exactly when the board opens up — every mid-board park is on a clock.

**2. Embargo** — rule, `FOUND`. A seeded suit may not go home until N other cards are home.
s1–2: N = 6. s3–4: N = 10. s5–6: N = 14. s7: two seeded suits at N = 10 each.
Impl: `foundationAccepts` checks `52 − found[thatSuit] ≥ N`… concretely `sum(found) − found[suit] ≥ N` before accepting that suit's next card. State-pure; safe auto-play defers the embargoed suit automatically. Ease −0.06×s. Turns auto-pilot home-runs into real storage problems.

**3. Contrarian** — rule, `STACK`. Seeded columns build UP (rank + 1, alternating colour) — and only up.
s1–3: one contrarian column. s4–6: two. s7: three.
Impl: `rules.colDirs` per-column (same field as Switchback, forced to up-only here); dealt piles exempt (may contain classic-looking pairs); dealer verifies. Ease −0.06×s. Reading the board wrong is the threat — a whole muscle-memory channel inverted.

**4. Low Bridge** — rule, `COLUMN`. Empty columns only accept sequences whose bottom card is rank ≤ n.
s1–2: ≤ 10. s3–4: ≤ 9. s5–6: ≤ 8. s7: ≤ 6.
Impl: inverse of `emptyMinRank` (`emptyMaxRank`); like the min version, empty columns drop out of move capacity since most parking is illegal. Ease −0.07×s. Kings and Queens can never be parked — burying a King early is suddenly a crisis.

**5. Heraldry** — rule, `COLUMN`. Columns are colour-locked: a locked column accepts only its colour.
s1–2: two seeded columns (one red, one black). s3–4: four. s5–6: six. s7: all eight, alternating by seed.
Impl: `cellColors` mechanism lifted to columns (`colColors: []`); dealt cards exempt; dealer verifies. Ease −0.07×s (−0.1 at s7). Half your parents vanish per column — builds become long-distance routing.

**6. Uneven Keel** — rule (dealt state), `COLUMN`. The deal is skewed into uneven column heights.
s1: 8/8/7/7/6/6/5/5. s3: 9/8/8/7/6/6/5/3. s5: 10/9/8/7/6/5/4/3. s7: 12/10/8/7/6/4/3/2.
Impl: `deal(n, rules)` takes a `skew` profile (like `startHome`, it changes the dealt state, so all workers share it); dealer verifies since deep columns bury low cards. Ease −0.05×s. Cheap to build, scales beautifully, and every skew profile plays differently.

**7. Bedrock** — rule, `STACK`. Cards of seeded ranks, once placed onto a tableau card, can never move again except home.
s1–2: Kings. s3–4: K Q. s5–6: K Q J. s7: K Q J 10.
Impl: a 52-bit "set" mask in state (`hashState`, apply/undo) marking post-deal placements of those ranks; move gen refuses them as sources except `t:'F'`. Dealt positions exempt. Ease −0.07×s. Every placement of a big card is a commitment — parking a King to free a column now costs the King.

**8. La Brea** — rule, `COLUMN`. A seeded column is a tar pit: cards placed into it after the deal can only leave to their foundation.
s1–3: one pit. s4–6: one pit, dealt 3 deeper. s7: two pits.
Impl: same placed-card bit mechanism as Bedrock, per-pit; move gen filters sources in pit columns to dealt cards and foundation-bound moves. Dealt contents can leave normally (winnability preserved by construction + verification). Ease −0.08×s. The dump-and-pray line is gone; the pit eats whatever you feed it.

**9. Looking Glass** — rule, `FOUND`. Seeded suits build their foundations DOWN from the King.
s1–2: one suit. s3–4: two (one per colour). s5–6: three. s7: all four.
Impl: `foundationAccepts` inverted per suit (`rank == top − 1` from a King base); `isSolved` still sums 52; safe auto-play re-justified per boss-doc §0.4 (restrict auto-play for mirrored suits to their mirror-safe test). Ease −0.08×s. The whole endgame direction flips — Aces become the buried treasures and Kings the openers.

**10. Oil and Water** — rule, `STACK`. Adjacent cards in a column may not share a suit (dealt pairs exempt).
s1–2: one seeded suit can't touch itself. s3–5: two suits. s6–7: all four suits.
Impl: one adjacency check in `canStackOn`/`runLength`/`isValidSequence` against the destination's current top. Ease −0.05×s. Quietly brutal with suit-build boons — your own upgrades start fighting the challenge.

**11. Chequer Rule** — rule, `COLUMN`. No column may hold more than n cards of one colour (dealt columns exempt).
s1–3: n = 6. s4–6: n = 5. s7: n = 4.
Impl: colour-count check on the destination column in move legality — pure state function. Ease −0.05×s. Punishes single-colour parking piles; interacts viciously with wild-rank boons that let colours clump.

**12. Toll Lanes** — pressure, `SCORE` (coins). Seeded columns charge coins for every move into them.
s1–2: one lane at 2 coins. s3–4: two lanes at 3. s5–6: three lanes at 4. s7: four lanes at 5.
Impl: `score(sb)` → `replay` counts destination-column entries × rate, deducted from coins (floor 0). The only "score tax" that changes routing: the cheap lane vs. the toll lane is a per-move decision with a ledger.

**13. Convoy Requirement** — pressure, `SCORE` (stars). 3★ requires a longest chain home of at least k.
s1–2: k = 4. s3–4: k = 5. s5–6: k = 7. s7: k = 9.
Impl: `thresholds`-adjacent star hook; `chainsOf(sb.history)` decides the third star. A star condition you must *plan the board around* (stage the run, then push), not a tax that happens to you.

**14. Blowing Sand** — pressure, `VIS`. As cards go home, buried cards flip face-down.
s1–2: every 14th card home flips one. s3–4: every 12th. s5–6: every 10th. s7: every 8th.
Impl: `on.foundation` counter → seeded pick (`ctx.rng` stream keyed to the count) among buried face-up cards → `api.conceal`; they re-reveal by the normal kernel rule when exposed. Visibility-only pressure that punishes slow boards and rewards memorising columns early.

**15. Mooring Fees** — pressure, `SCORE` (coins). Every free-cell placement on the board costs coins, settled at the end.
s1–3: 1 coin each. s4–6: 2. s7: 3.
Impl: `score(sb)` → count `t:'C'` moves in history × rate, deducted from coins (floor 0). Leave No Trace's spiritual successor in the coin economy — frugal cell play is now worth money, which makes cell-hungry lines a purchase decision.

---

## 3. Six bosses

Each respects the boss ground rules: one resolved `RuleSet` in fixed order, tags that collide-check against the board-7 theme challenge, CE budget (boss + theme ≤ ~3), pre-verified deals, no timers/counters/hidden state.

**1. The Tidemaker** — the two-phase sea change. Tags `CELLS`, `COLUMN`.
Phase 1 (0–25 home): Rising Tide — one cell closes at 8, 16 and 24 home. Phase 2 (the turn, 26+ home): the tide turns — all cells reopen, but empty columns now accept only Kings (`emptyMinRank 13`, empties out of capacity).
Identity: the board itself breathes; the mid-game switch means the position you built for phase 1 is wrong for phase 2. Both phases are pure functions of `found[]`, so one solver handles the switch. ≈1.5–2 CE. Complexity M.

**2. The Collector** — confiscation with a ransom. Tag none (run-level).
At board start it confiscates one of your boons — your choice which to surrender (its HUD tray entry is stamped and inert). At 26 home it offers the boon back for 30 coins; after the board, un-bought boons return anyway.
Identity: the port world's loan-shark made flesh; player-agency confiscation (you pick the least-bad loss) keeps it fair while still tearing a hole in your build, and the ransom ties the coin economy to the finale. Solver sees a plain ruleset (the boon is simply absent). ≈0.5 CE + build damage. Complexity S–M.

**3. The Mirror** — reacts to your build. Tag set dynamically.
It reads your held boons' family counts at board start and punishes your strongest family with a fixed map: cells → −2 free cells (floor 1); columns → empty columns accept Kings only; wild → your wild-rank/suit boons are suppressed this board; ability → your abilities start with 0 bonus uses and cost 1 undo to use; undo → undos cost double; coin → 40% of your coins are seized; foundation → foundations stay within 2 ranks; vision → top cards of 4 columns concealed; suit → same-suit stacking banned.
Identity: the final exam on your draft — whatever you stacked becomes the boss's weapon. Punishment is computed once at board start from `run.boons` (constant for the board, so still a static solver-visible ruleset). Offer UI on boards 5–6 hints "The Mirror watches…" so drafting around it is a real late-run decision. ≈1–2 CE depending on the branch. Complexity M.

**4. The Sargasso** — all-in on one axis. Tag `COLUMN`.
Three seeded columns start sealed, and the deal is skewed 10/9/9/8/6/4/3/3. Nothing else — no cell, stack or foundation rules.
Identity: a wall of weed-choked water; the entire game is column geometry. Being single-axis makes it a hard counter to column-built runs and a breather for cell/wild builds — the "fixed onto one difficulty axis" boss. ≈2 CE. Complexity S (both mechanisms exist).

**5. The House** — pure pressure, zero rules. Tag `SCORE`.
No rule changes at all. Instead: star thresholds +25%, Mooring Fees at 2 coins per cell placement, Toll Lanes on two seeded columns at 3 coins — and 3★ pays triple coins.
Identity: the casino finale. Provably winnable deals are trivial (no restrictions), so the entire fight is economic: stars, wagers and the purse. Pairs with Long Shot for a glorious all-in final board. 0 CE rules / heavy pressure. Complexity S.

**6. Metamorph** — rotating phases. Tags rotate `CELLS` → `COLUMN` → `FOUND`.
The ruleset cycles with progress: phase A (0–12 home): courts can't enter cells (`noCellRanks J Q K`); phase B (13–25): empty columns accept Queens and up (`emptyMinRank 12`); phase C (26+): foundations stay within 3 ranks (`foundationSpread 3`). The current phase is banner-announced and the next is shown in the HUD.
Identity: three mini-bosses in trench coats; each phase is a familiar shape, but the *handoff* is the killer (a King buried under a phase-A plan must surface during phase B). All phases are state-pure (keyed on `found`), pre-verified as one ruleset. ≈1.5 CE. Complexity M.

---

## 4. Ten port and run-structure ideas

**1. Chandler's Row (reroll).** Ports stock 4 boons from any theme plus 2 stickers; pay 5 coins to reroll the stock, price doubling per reroll that visit. Turns ports into a slot machine with a budget, and gives coins a sink from the first harbour.

**2. The Wager Table.** A port service: stake 1–5 undos on your next board's star rating (3★ pays 15 coins per undo; 2★ returns the stake; less loses it). Long Shot's engine as infrastructure — available to every run, priced by the house.

**3. Auction Node.** A map node where three boons are sold one at a time against a seeded NPC bidder (deterministic bids from `rng`); you bid coins or undos, and may pass. A boon you win is added immediately. Different texture from shops: discipline vs. FOMO.

**4. Ferryman.** A map edge service: pay 20 coins to skip a board entirely — it counts as a 1★ clear (no coins, no boon offers). Route flexibility with a real cost; the emergency exit for a challenge your build can't face.

**5. Sticker Mover.** Port service: peel a sticker off one card and press it onto another for 10 coins. Stickers stop being permanent regrets and start being a loadout you re-tune as your build changes.

**6. Chart Seller.** Port service: pay 8 coins to reveal any unrevealed map node's theme, challenge and strength before routing. Information as a purchasable resource — the map becomes part of the economy.

**7. Shipwright (refits).** Ports sell run-level hull upgrades: +1 undo at the start of every board (40c); +1 use to one chosen ability boon each board (35c); wager caps raised by 2 (25c). A second upgrade axis beside boon levels, so coins always have a plan.

**8. Storm Nodes (elites).** Optional map nodes that stack TWO themes' challenges (tag-checked so they can't collide) on one board for double coins and a guaranteed boon choice of 3. The Slay-the-Spire elite: the decks are verified under both challenges, and routing into a storm is the greed test.

**9. Bottle Mail.** An event node: a seeded offer, e.g. take a Cursed sticker (+15 coins now; that card costs 2 coins every time it enters a free cell for the rest of the run) or take nothing. Cursed stickers give the sticker system a risk/reward shadow economy.

**10. The Long Pier (grand port).** The harbour before board 7 is always a grand port: sell boons at 75% (not 50%), one-time "refit" (swap any boon for a seeded same-family boon, 20c), and a harbour pilot (25c: the boss board is dealt half a tier gentler). A deliberate last shopping beat so the finale feels provisioned, not stumbled into.

---

## 5. Top 5 "this would make the game way more fun"

**1. Suit Spur (boon 9).** It's the only boon on the table that changes the *geometry of winning* rather than the path to it. Splitting a suit into two foundation piles creates a decision no existing charm offers: which suit to shortcut, and when — plant too early and you've homed a card you needed as a parent; too late and it was just a fancy home move. It's solver-visible, already fully specced in `parked-abilities.md`, interacts with spread challenges and auto-play in interesting ways, and its level-2 (two spurs) is a genuine upgrade rather than a numbers bump. This is the "build-defining relic" the roster lacks.

**2. The Fool (boon 2).** A 53rd companion card gives the run a *character*. Because every board deals the same 52 cards plus your Fool, it becomes a run-long pet you route sequences through — the bridge that makes any two cards neighbours. It's trivially readable (stacks on anything, anything stacks on it), it's help-only so it needs no deal verification, it combos honestly with every wild and columns boon, and its level-2 (a second Fool) is the kind of absurd upgrade players will plan port visits around. Charm systems live or die on memorable toys; the Fool is one.

**3. Long Shot + the wager economy (boon 19, ports 2).** Score today is nearly invisible because it only feeds star counts; coins fix the plumbing, but wagers fix the *emotion*. Staking undos on a 3★ finish converts every late board into a sweat: you feel the exact moment the third star slips away, and undo hoarding — currently the most passive resource in the game — becomes a chip stack you can push in. It's cheap to build (`on.start`/`on.win` + existing undo and coin APIs), it self-balances (bad wagers lose runs), and paired with The House boss it gives the finale a casino-night identity.

**4. Rising Tide (challenge 1).** The best challenges are stories inside a single board, and Rising Tide is the cleanest one available: the board literally shrinks beneath you as you succeed. It inverts the thaw boss's arc (hope → relief) into (comfort → squeeze), which means parking decisions early carry endgame consequences — exactly the "real choice, could fail" bar the brief sets. Mechanically it's the already-built `cellThaw` machinery running backwards, a pure function of `found[]`, so it's solver-clean, dealer-verifiable and nearly free to implement, with a seven-step strength curve that writes itself.

**5. The Mirror (boss 3).** Roguelite bosses are best when they interrogate your run, and The Mirror does it literally: whatever family you stacked becomes the weapon turned on you. That single rule transforms drafting on boards 4–6 — do you double down on your cells build and eat −2 cells, or diversify into mediocrity? — which is the first time the *offer screen itself* becomes a boss mechanic. The family→punishment map is fixed and public, the punishment resolves to a static solver-visible ruleset (no mid-board dynamism, no verification headaches), and every family branch is a different-feeling finale, giving board 7 the replay variety the current ~6 restriction shapes can't.
