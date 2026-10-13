# Charm overhaul brainstorm (Grok)

Read against `docs/voyage/charms-design.md` §1–3, parked abilities, and boss §0. Boons are monotone help. Challenges are solver-visible state or pressure. Score/coins from final history. Seeded RNG only. No click-tax “charms.”

Families: `cells` · `columns` · `wild` · `suit` · `ability` · `undo` · `coin` · `foundation` · `vision`

Mix: 8 ongoing rule bends · 10 once-per-board abilities · 6 economy · 6 synergy. ★ = eight I would ship first.

---

## 1. Thirty boons

### Ongoing rule bends (~8)

**1. Annex ★** — *family: columns*  
Tooltip: A ninth column starts empty and stays in play for the run.  
L2: The annex also counts as an empty column for supermove capacity even while occupied (treat occupancy as empty for `emptyFactor` only).  
Sketch: new `rules.extraCols = 1` (help). Deal leaves it empty; `hashState` / `generateMoves` / `maxMoveSize` see 9 columns. Occupied annex is still a legal destination. Solver-visible help; no verify.

**2. Bunk Cell ★** — *family: cells*  
Tooltip: One free cell holds a legal 2-card run; the pair moves as a unit.  
L2: That bunk holds 3, or two bunks of 2.  
Sketch: `rules.bunkCells = [i]` plus `st.free` as arrays of length ≤2 for those slots. `canStackOn` inside the bunk; moving the bunk is one `t:'C'` of size 2. Capacity treats a bunked pair as occupying one cell. C module; hash the nested free arrays.

**3. The Fool ★** — *family: wild*  
Tooltip: A 53rd wild card lives in its own slot; it stacks as any colour and any rank ±1, and never goes home.  
L2: Once per board the Fool may also stand in as any rank for a single drop (`override.ignoreRank` consumed).  
Sketch: `rules.joker = true`, extra slot `st.joker` (card id 52). `canStackOn` / `runLength` treat it as wild colour and adjacent rank either way. `isSolved` ignores it (52 homes). Custom slot UI. Help; solver should generate joker moves (this *is* the capability). If solver cost is too high, generate only as parent/child of tops.

**4. Contrarian Keel ★** — *family: columns*  
Tooltip: One seeded column builds *up* in alternating colour instead of down.  
L2: You pick the contrarian column at board start (`ability` once, or first empty you create becomes it).  
Sketch: `rules.upCols = [i]` (bitmask). `canStackOn` for that destination uses rank+1. Dealt pile on that column is exempt (illegal pairs may exist). `runLength` agrees. Seeded `ctx.rng` picks the index. Help on that column only.

**5. Soft Pair** — *family: wild*  
Tooltip: You may also stack a card onto another of the **same rank** and opposite colour (a pair). Pairs do not extend into longer runs.  
L2: Same-rank **either** colour, and a pair may be moved as a 2-card sequence.  
Sketch: `rules.pairStack = true` in `canStackOn` (rank equal, colour opposite). `isValidSequence` treats a pair as a terminal 2-run, not a chain. Distinct from `wildRanks`.

**6. Guest House** — *family: columns*  
Tooltip: Empty columns still multiply move size even when a challenge forbids parking there.  
L2: Empty columns quadruple (`emptyFactor = 4`) on boards that also restrict empties.  
Sketch: `rules.emptyFactorCountsRestricted = true` so `maxMoveSize` uses empty count even if `emptyMinRank` / low-dock / colour-lock makes them unparkable. Pure help vs COLUMN challenges / bosses.

**7. Open Return** — *family: foundation*  
Tooltip: Foundation tops may return to the tableau **or** a free cell, and returning does not break a home-chain for scoring.  
L2: Once per board, return a *buried* foundation card by peeling the pile down to it (those cards re-deal onto the tableau in order).  
Sketch: L1 is `foundationReturn = true` (exists) plus score hook: `chainsOf` ignores `t:'R'`. L2 is a charm move that rewinds that suit’s foundation to a picked rank and sprays the peeled cards onto chosen columns — C, undoable.

**8. Split River** — *family: suit*  
Tooltip: One seeded suit may be built down **in colour** (both red, or both black) as well as classic alternating.  
L2: Both suits of that colour get the extra build.  
Sketch: `rules.colourBuild = { suits: mask }` in `canStackOn` / `runLength`. Not `suitBuild` (same-suit). Marks those cards `glow`.

---

### Once-per-board abilities (~10)

**9. Rank File ★** — *family: ability* (Promotion)  
Tooltip: Once per board, shift an exposed card’s rank by ±1 for the rest of the board (Ace/King clamp). It still homes at its **printed** rank.  
L2: Two shifts, or one card ±2.  
Sketch: ability `pick(card)` → charm move writes `st.rankShift[id] = ±1` (hashed). Stacking reads shifted rank; `foundationAccepts` reads printed rank. Undo restores. Never makes a home skip. Distinct from `override.ignoreRank`.

**10. Fifth Pile ★** — *family: foundation*  
Tooltip: Once per board, send an exposed card home as the base of a fifth foundation and finish that suit on two piles.  
L2: The spur can be planted from a *buried* face-up card (column closes the gap).  
Sketch: **Claim parked Suit Spur.** Custom move stores `{suit, base, top}`; `isSolved` counts both piles; `foundationSpread` uses `max(original, spur)`; fifth slot in the top row. Solver-visible help.

**11. Second Wind ★** — *family: undo*  
Tooltip: Once per board, undo as many times as you want; the next forward move closes the window.  
L2: Window also refunds one run undo when it closes, if you stepped back at least 8 moves.  
Sketch: **Claim parked Undo Window.** `memo.window`; Voyage undo path skips `spendUndo` while `ev.free`. Spend-charms ignore `ev.free`. Not Bookmark (no pre-mark, stepwise).

**12. Recast** — *family: undo*  
Tooltip: Once per board, put every card back where it was dealt. Does not spend a run undo.  
L2: After recast, one card of your choice keeps its current position (the rest reset).  
Sketch: **Claim parked Deal Reset.** `api.resetBoard()` undoes history to `run.current.initial`. `on.undo` with `ev.reset`. Refund charms ignore reset.

**13. Sightline** — *family: vision*  
Tooltip: Once per board, show the solver’s next three moves. You still play them.  
L2: Five-move preview, or preview persists until you deviate.  
Sketch: **Claim parked Three-Move Look.** `api.preview(3)` — do **not** call `hint()` (that plays). Status names the line; highlights 1–3. Clears on play/undo.

**14. Keelhaul** — *family: columns*  
Tooltip: Once per board, slide an entire column to the annex / a new empty slot, leaving its old slot empty.  
L2: You may also reverse the column’s order as it moves (deepest becomes top).  
Sketch: Needs Annex **or** a temporary 9th slot for the board (`rules.extraCols` for one board). Charm move rewrites two column arrays. If L2 reverse: still help (new orders, not fewer moves). Illegal pairs allowed (dealt-pile semantics).

**15. Sticker Press** — *family: coin*  
Tooltip: Once per board, stamp **Wild** on one exposed card for the rest of the **run**.  
L2: Choose Wild, Gold, Lucky, or Key. Lucky still capped per board.  
Sketch: ability `pick(card)` → `run.stickers[id] = 'wild'`. `rules` from stickers: Wild ORs into per-card colour ignore (not `wildRanks`). Persistent 52-card identity. Port can still sell/upgrade stickers; this is the in-board printer.

**16. Spur of the Moment** — *family: ability*  
Tooltip: Once per board, your next drop may ignore colour **and** the supermove cap, but the run must still be in rank order.  
L2: Two such drops, or also ignore one-way-cell / colour-locked cell on that drop.  
Sketch: `api.override({ ignoreColour, ignoreCap })`. Not Zip Line (cap only) or Spray Tag (colour only) or Understudy (free-cell any rank). Solver ignores override.

**17. Dry Dock Peek** — *family: vision*  
Tooltip: Once per board, peek at the next map node’s challenge text and boss tag (if any) without leaving the board.  
L2: Also see that node’s deal-tier band, and you may pay 1 undo to **reroll** a non-boss node’s challenge strength ±1 (seeded alternative).  
Sketch: `run` read of `upcomingPlans`; UI toast/panel. Reroll writes `runMemo` consumed by `composeBoard` / dealer `planKey`. Information + rare run mutate; not a table convenience.

**18. Customs Seal** — *family: cells*  
Tooltip: Once per board, mark a free-cell card as **Key** for this board only: it may enter cells that rank/colour/one-way rules would refuse.  
L2: The Key stamp lasts the run (true sticker).  
Sketch: `memo.keyTemp = card`; `cellAccepts` help-branch. L2 writes `run.stickers`. Distinct from Ghost Cell (no extra slot).

---

### Economy (~6)

**19. Manifest** — *family: coin*  
Tooltip: Choose one buried card at deal as cargo. If it goes home **from a column** (never a cell) after at least 20 other cards are home, gain 8 coins.  
L2: 14 coins, or you may pick the cargo after seeing the deal (ability, first 5 moves).  
Sketch: `setup` rng buried → `mark(gold)`. `score`/`coins` from `replay`: cargo’s `t:'F'` source is a column and `homeCount >= 20`. Fail-able; not “+12 per heart.”

**20. Harbour Bond** — *family: coin*  
Tooltip: After a 3★ clear, you may **stake** 2 undos. If the next board is also 3★, gain them back plus 6 coins; if not, they’re gone.  
L2: Stake 3, win 12 coins, and the bond still pays if the next board is 2★+ (undos still need 3★).  
Sketch: `on.win` UI prompt → `runMemo.bond`. Next `on.win` resolves `spendUndos` already done vs `addUndos` + coins. Wager direction from the brief. Never forced.

**21. Assay** — *family: coin*  
Tooltip: Each **Gold** sticker pays +3 coins when that card homes, but only if you emptied a column earlier on the same board.  
L2: +5, and Lucky stickers also pay 1 coin (still +1 undo, capped).  
Sketch: `replay` flag `emptied`; then Gold homes add coins. Synergy with stickers **and** a real plan (empty a column). Scales with Gold count without being automatic.

**22. Port Credit** — *family: coin*  
Tooltip: Docking at a harbour refunds 1 undo and puts 20% off the next sticker you buy.  
L2: 2 undos, 40% off, and you may **upgrade** a boon without spending the usual upgrade fee once.  
Sketch: `onPick` / port hook in run-structure (not board `rules`). `runMemo.coupon`. Pure economy; `ease` 0.

**23. Short Book** — *family: undo*  
Tooltip: If you finish a board using **fewer undos than the board index** (board 5 → under 5), mint 4 coins and a Lucky charge (the next home from a cell grants +1 undo, cap 1).  
L2: Also mint a Gold sticker on a rng non-stickered rank-7..10.  
Sketch: `on.win` from `sb.undosUsed` vs `boardIdx`. Fail-able on late boards. Not “+1 undo when anything ordinary happens.”

**24. Hull Insurance** — *family: coin*  
Tooltip: Pay 3 coins now. The first time this run you would go stuck with 0 undos, gain 2 undos instead (once).  
L2: Triggers twice, or pays 1 coin back if you never claim it by the finale.  
Sketch: `onPick` spend coins (port or offer). `on.stuck` + `runMemo` like Sugar Skull, but bought. Pressure/resource, not a rule.

---

### Synergy / build-around (~6)

**25. Chorus** — *family: suit*  
Tooltip: For each **suit** family boon you hold (including this), one additional suit may build down in colour (see Split River).  
L2: Those suits also score 2 coins if completed **in the same chain**.  
Sketch: `rules(r, ctx)` counts `run.boons` with `family==='suit'`. Caps at 4. Build-around for suit piles; L2 coins from `chainsOf` + four kings in one chain (rare, chosen).

**26. Cooper’s Guild** — *family: cells*  
Tooltip: If you hold 2+ **cells** family boons, one extra free cell. At 3+, that cell is a Bunk (2-card).  
L2: Thresholds 2 / 3 become 1 / 2; at 4 cells-family, the extra cell is never colour-locked or frozen.  
Sketch: `rules.freeCells += 1` when count≥2; compose with Bunk field. **No ease** for extra cell (bank models it). Makes +cell charms a guild instead of three identical extras.

**27. Wildfire** — *family: wild*  
Tooltip: Each **wild** family boon you hold adds +1 to a “wild budget”: that many extra ranks (seeded 3–10, not already wild) are wild this board.  
L2: Wild cards also count as Key while they sit in cells.  
Sketch: `rules.wildRanks |=` rng ranks, count = wild-family size. Marks `wild`. Stickers that are Wild count as +1 budget (so sticker-wild builds snowball).

**28. Call Sheet** — *family: ability*  
Tooltip: `abilityBonus +1` if you hold 2+ **ability** charms; at 3+, the first ability use each board does not consume a use.  
L2: All abilities gain +1, and Recast / Second Wind share a second charge if you hold both.  
Sketch: extends Mission Control’s `api.abilityBonus`. `memo.freeFirst` for the 3+ tier. Makes Tractor/Dig/Tide/Understudy a deck, not a pile of one-offs.

**29. Quartermaster** — *family: undo*  
Tooltip: Undo-family count `n`: event-undo caps on this board become `cap + n` (still capped). Emptying a column with n≥2 grants 1 coin instead of an undo.  
L2: Caps +2n; column-empty also refunds one spent undo once per board.  
Sketch: runtime reads family count in `on.columnEmpty` / existing cap memos. Turns “undo when X” from a tax into a stackable engine **with a coin fork**.

**30. Catalogue** — *family: vision*  
Tooltip: For each **vision** boon (previews, peeks, marks), one extra buried card is marked `camera`. Homing all marked cards in **rank order** (low to high) pays 5 coins.  
L2: Pays a Key sticker on the last of them instead of coins, if you want.  
Sketch: `setup` marks k extra buried. Coins from `foundationSequence` subsequence check — easy to fail if you home them out of order. Vision build that isn’t another `hint()`.

---

## 2. Fifteen challenges

Distinct from the stock six: no-cell ranks, barren ranks, empty-min-**high**, foundation spread, frozen cells, sealed columns. Also not “score tax that cannot threaten a clear” unless noted as pressure.

**1. Rising Tide** — *CELLS, rule*  
Empty free cells **close** as homes fill: after 13 / 26 / 39 home, one unused cell becomes unusable (occupied cells stay until emptied, then close).  
s1: close 1 at 39. s2–3: 1 at 26. s4–5: 2 at 13 and 26. s6: 2 at 13, 26 and a 3rd at 39. s7: 3 at 8 / 20 / 34.  
Inverse of `cellThaw`. Capacity = f(`found`, occupancy). Dealer verifies. Auto-play still sound if it never **adds** cells.

**2. Low Dock** — *COLUMN, rule*  
Empty columns only accept a sequence whose **bottom** card is rank ≤ N. Empties still count for capacity (unlike high-min, which kills parking).  
s1–2: N=8. s3–4: N=6. s5–6: N=4. s7: N=3 (A–3 only).  
`emptyMaxRank` (new). Opposite of Dress Code / Crease / Frozen Harbor.

**3. Embargo** — *FOUND, rule*  
One seeded suit cannot home until `sum(found)` of the **other** three ≥ T.  
s1–2: T=6. s3–4: T=10. s5–6: T=16. s7: T=20.  
`rules.embargo = { suit, need }`. `foundationAccepts` reads `found`. Bottleneck Ace is a plan, not a tax.

**4. Painted Columns** — *COLUMN, rule*  
Seeded columns are colour-locked as destinations (red-only / black-only). Tops already there are exempt.  
s1: 1 column. s2–3: 2. s4–5: 3 alternating. s6–7: 4.  
`rules.colColors[i]`. Not `cellColors` (Two-Tone Strata).

**5. Uneven Hold** — *COLUMN, deal*  
Deal is skewed: two columns get +k cards stolen from two others (heights like 10/10/7/7/6/4/4/4). Legality classic.  
s1: ±1. s3: ±2. s5: ±3. s7: ±4 (verify hard; relax to ±3 if bank fails).  
`dealSkew` in `deal(n, rules)`. Dealer must verify (help-less restrict via depth). Human cost is buried depth, not a new illegal move.

**6. Flood Line** — *COLUMN, rule*  
You may have at most M empty columns at once. A move that would empty a column past M is illegal unless another empty is filled in the same move (never — so you must fill before digging the next).  
s1–2: M=3. s3–4: M=2. s5–7: M=1.  
`emptyCols` from tableau — state-only. Brutal with Annex; tag-exclude or let Annex still exist as a filled 9th.

**7. Descending House** — *FOUND, rule*  
One seeded suit builds **King down to Ace** on its foundation (tableau still builds down).  
s1–3: that suit only. s4–5: two suits. s6–7: two suits and they may not lead the other foundations by more than 4 (light spread, different from Lockstep’s 3-cap as the primary gag).  
`rules.foundDir[suit] = -1`. `foundationAccepts`, auto-play re-justified (not monotone with classic). Large kernel; high identity.

**8. Queue Cells** — *CELLS, rule*  
Free cells must fill **left to right** and empty **right to left** (a stack of slots). You cannot skip an empty slot to the left.  
s1–2: 4 cells as a queue of 4. s3–4: only 3 slots in the queue (4th free classic). s5–7: full queue and the leftmost occupied cell is one-way to foundation (`oneWay` on index 0 only).  
`cellAccepts` / leave-cell checks from occupancy pattern. State = `free[]`.

**9. Quarantine** — *STACK, rule*  
A seeded buried card cannot leave its dealt column until `sum(found) ≥ T` (cards above it can).  
s1–2: T=8, one card. s3–4: T=13. s5: two cards, T=13. s6–7: two cards, T=20.  
`rules.noMoveCards` until found threshold — still a function of `found` + card location. Mark `curse`. Not barren.

**10. Discord** — *STACK, rule*  
No two **adjacent column tops** may be the same colour after a tableau drop. Homing and cells ignore this. Dealt start may violate; the first illegal pair must be broken before you can drop elsewhere.  
s1–2: only columns 0–1 watched. s3–5: all 8. s6–7: also the annex if present.  
Predicate on `tableau[i][last]` colours. Cheap to hash.

**11. Heavy Court** — *MOVE, rule*  
J/Q/K cannot travel inside a sequence; they move alone (still stack classically as singles).  
s1: Kings only. s3: K+Q. s5: JQK. s7: JQK and 10s.  
`isValidSequence` / `maxMoveSize` per moving card. Not `noCellRanks`. Feels like “courts are furniture.”

**12. Twin Keeps** — *COLUMN, rule*  
Two seeded columns must stay within Δ height of each other (empties count 0).  
s1–2: Δ=4. s3–4: Δ=3. s5–6: Δ=2. s7: Δ=1.  
`|len[a]-len[b]| ≤ Δ` after every tableau move. Distinct from `maxHeight` / sealed.

**13. Odd Shelf** — *STACK, rule*  
Only **odd** ranks (A,3,5,7,9,J,K) may be parents. Even cards can move and home but hold nothing. Dealt illegal pairs exempt.  
s1–2: only Kings are even-barren? Too close to barren — instead: s1–3 evens 2–6 barren-as-parents; s4–5 all evens; s6–7 all evens and even cards cannot enter cells either (that last bit is CELLS — split: keep STACK only, cells stay open).  
`barren` is “suit AND rank.” This is `rules.oddParents = true` (rank%2). New shape.

**14. Cell Ceiling** — *CELLS, rule*  
Free cells only accept rank ≤ N. High cards still tableau/home.  
s1–2: N=10. s3–4: N=8. s5–6: N=6. s7: N=4.  
`rules.cellMaxRank`. Not a banned-rank bitmask (those usually hit courts). Hits the parking of mids.

**15. Turn of the Tide** — *MOVE, rule* (two-phase, state = found count)  
Until 26 cards home, empty columns do **not** boost supermoves (`emptyFactor = 1`). After 26, empties triple (`emptyFactor = 3`) but **Low Dock N=5** snaps on.  
s1–2: switch at 34 (kinder). s3–5: 26. s6–7: 20, and pre-switch also `moveBonus -1`.  
All of this is `f(found)`. Mini-boss on any board. Auto-play OK (capacity only + late low-dock).

Pressure extras if a theme needs non-rule: **Visibility skew** (deal skew + conceal the tall columns below top 2) is VIS pressure, not a 16th rule.

---

## 3. Six bosses

Budget: boss CE + theme s7 ≲ 3.0. Tags must not stack with the board-7 theme. Revealed on the map from run start.

**1. Harbourmaster’s Audit** — *identity: reacts to your build*  
Tooltip: The Audit bans the family you leaned on.  
Rule: At run start the boss is `CELLS|COLUMNS|WILD|FOUND` according to whichever family you hold most by board 6 (tie → run seed). Then:
- CELLS: Rising Tide s7 (3 closes).
- COLUMNS: Flood Line M=1 plus Painted on 2 columns.
- WILD: Odd Shelf (evens cannot parent) and Wild/Fool **ignored** for colour (confiscates wild help).
- FOUND: Embargo on your deepest suit at T=20 plus Lockstep-3.  
Confiscation is the gag: your engine is the lock. Flag weakened charms on the offer UI from board 1 (“Audit watches cells”). Phase: none; the reaction *is* the phase. Solver: one resolved `RuleSet` after board-6 snapshot — pre-solve during 1–6 must assume a default family, then **re-verify** when the family is known (start pre-solve after board 5). Heavy, but the identity is unmatched.

**2. The Two Harbours** — *identity: two-phase tableau*  
Tooltip: At 26 home the board changes harbour: cells thaw, but the tide comes in.  
Phase 1 (`sum(found) < 26`): 2 cells frozen (`cellThaw` @26 only — they all pop at the flip), `emptyFactor = 1`.  
Phase 2: cells full, `emptyFactor = 3`, Low Dock 4, and one Painted column.  
UI: a harbour lantern that swaps colour at 26. Safe auto-play: capacity rises, then destinations shrink — disable greedy finish-with-foundations-only across the flip. Tag: split CELLS+COLUMN — pick one tag for exclusion, put the rest in flavour if collision (prefer COLUMN if the theme is CELLS). CE: opening ~2, endgame ~1.5.

**3. Confiscation Day** — *identity: steals a boon*  
Tooltip: The finale seizes your highest-ease boon; you play without it. A ghost of it sits on the table.  
Rule: Subtract that boon’s `rules()` from the composed set. If it was an ability, uses = 0. If it was The Fool, the joker slot is empty. Pressure: 0 coins from stickers this board (Gold/Lucky mute).  
Solver verifies **without** that boon (already the charm-less verify is stronger; still compose remaining help). UI: greyed tray icon “held at customs.” Not a new restrict field — identity is the theft. Pair with a **mild** restrict so the board isn’t just “standard FC”: Queue Cells s3. Tag CELLS.

**4. King-in-the-Hold** — *identity: one axis, theatrical*  
Tooltip: Empty columns take only A–5, and Kings cannot enter cells. That’s the whole joke.  
Rule: `emptyMaxRank = 5` + `noCellRanks` Kings. Fixed dual-axis but **one fantasy**: you park low in empties and manoeuvre Kings on tableau like furniture (Heavy Court on K optional if CE allows).  
No phases. Readable in one screenshot (low-dock glyphs + crown-lock). Tag COLUMN (exclude with Crease-likes). CE ~1.5–2. Calibration anchor next to Lockdown.

**5. The Fool’s Trial** — *identity: gives you the joke card, then hunts it*  
Tooltip: You get The Fool for this board even if you don’t own it. Nothing may be stacked **on** the Fool, and the Fool may not sit in a cell while `found < 26`.  
Phase 2 at 26: Fool becomes a full wild parent, but **Embargo** hits a seeded suit at T=26 (already satisfied — embargo lifts at the flip). So phase 1 is “joker is hot potato”; phase 2 is “joker is a weapon, one suit just opened.”  
State: joker slot + found. If the player already has The Fool, L2 (rank ignore once) is confiscated instead. Tag STACK or CELLS. Solver must generate joker moves.

**6. Dry-Dock Leviathan** — *identity: deal skew + quarantine + a wager*  
Tooltip: Two columns are mountains (deal ±3). The deepest card in each is quarantined until 20 home. Optional: stake 3 undos at the start for 3★ → 15 coins; fail the stake and the quarantine lasts until 32.  
The stake is pressure (undos/coins), not a rule; the mountain+quarantine is the solver-visible boss. Tag COLUMN. UI: two chained deep cards. Feels like a sea monster under the piles, not another freeze-cell.

---

## 4. Ten port / run-structure ideas

Harbours already: buy any-theme boon, sell, upgrade to L2, buy undos, buy stickers (Wild / Gold / Lucky / Key). Below are extra services and map twists.

**1. Sticker workbench.** Combine two Gold → one Gold+Lucky on the same card; or peel a sticker to another card for 4 coins. Prevents “wrong card got lucky.” Once per dock.

**2. Dry-dock chart.** Pay 1 undo to see the next **two** node challenges at true `text(s)` and the boss tag. Ties to Dry Dock Peek; the port is the reliable version.

**3. Black market.** Offer one **banned** sticker: *Mirror* (this card stacks as either colour **and** either rank ±0 only as parent — i.e. holds anything of rank-1 either colour). Costs 12 coins + accept a 1-board **Embargo** on a rng suit next board (pressure you chose). Solver-visible next board.

**4. Insurance desk.** Hull Insurance as a port buy (boon 24). Also sell “dead man’s chest”: if you die stuck, the next run on this seed-family starts with 2 coins. Meta-light; skip if runs must be seed-pure.

**5. Wager window.** Explicit 3★ stake (brief §7): 2 undos → if 3★, +2 undos + coins by board index; if 2★, even; if 1★, lose the stake. Available at harbour **before** the next node, not mid-board.

**6. Shipyard fork.** Map: after a harbour, three nodes — *Calm* (dealShift −0.5, weaker shop after), *Trade* (normal, harbour after), *Storm* (s+1 challenge, +1 sticker offer after). Same theme pool; the fork is the run.

**7. Customs inspection.** Forced event node (not a board): “declare” a family. Next board, that family’s charms gain L2 for **one board only** without paying upgrade; the boss Audit, if present, is likelier to pick that family (seeded weight). Build-identity with teeth.

**8. Ghost light (vision node).** Not a full board: a 6-column miniature (40 cards, 3 cells) under Fog. Reward is a Sightline charge or a peek sticker. Cheap to deal from a small bank. Gives vision charms somewhere to live.

**9. Annex lease.** Port can **rent** Annex for the next board only (5 coins) if you don’t own it. Converts Annex from a once-per-run holy relic to a taste. If you already own it, rent Bunk Cell instead.

**10. Captain’s log (sell-back + rewrite).** Sell a boon for coins **and** immediately draw 2 replacements from **any** theme not yet seen, pick 1. Stops dead-run feeling when early picks were points-era leftovers. Limit once per run so it isn’t a full reroll engine.

---

## 5. Top five “this would make the game way more fun”

**1. Stickers on the 52, plus a printer in-run.**  
Voyage already deals the same 52 every board and nobody uses that. Stickers turn “I know where the Ace of spades lives in my head” into a build: Key the court that always bricks cells, Gold the card you can delay for Assay, Wild the rank you keep as a hinge. Sticker Press / workbench make the harbour a place you **plan**, not a store that sells +1 undo. It is the Balatro enchant-the-deck beat, and it is almost free to explain.

**2. The Fool + Bunk Cell + Annex as the new “wow” trio.**  
The charms people quote today are one-shot rule breaks (Tractor, Dig, Tide Pool). The overhaul needs **standing** weird geometry: a 53rd card that never homes, a cell that holds a run, a 9th empty. Those change the picture of the table every board, compose with each other (Fool in a bunk; annex as contrarian), and still obey monotone help. They also give bosses something to confiscate that players will actually swear about.

**3. Fifth Pile (Suit Spur) as the signature ability.**  
Homing a 10 while the 4 is buried is the fantasy FreeCell players already try to cheat toward. Making it a once-per-board, solver-visible split foundation is a bigger brain-event than another colour-ignore drop. It interacts with embargo, spread bosses, and suit-family Chorus. Planting it should feel like calling a line in Spire: you spend the use when the gap is the whole puzzle.

**4. Challenges that change the *shape* of empties and time.**  
Rising Tide, Low Dock, Flood Line, Turn of the Tide, Uneven Hold — none of these are “Kings can’t cell, again.” They make the midgame a clock (cells closing), make empty columns a **type** of slot (low vs high), or make the deal look unfair in a readable way (two mountains). Two-phase at 26 home is the boss version of the same idea: the board you learned in the first ten minutes is not the board you finish. That is Spire act structure sitting on one deal.

**5. Ports as the score sink, wagers as the star sink.**  
Points-as-stars-as-offers is why +156 heart charms exist. Coins that buy stickers/upgrades, and undos you can *stake* on a 3★, make stars a currency you gamble instead of a meter that drips offers. Harbour Bond / Wager window / Manifest (cargo that can miss) are the anti-Nectar: you can fail them on a won board and still have a story. If only one economy ships, ship **stake undos on 3★** plus **Gold stickers**; the rest of the shop can wait.

---

*Parked claims: Suit Spur → Fifth Pile; Undo Window → Second Wind; Deal Reset → Recast; Three-Move Look → Sightline.*
