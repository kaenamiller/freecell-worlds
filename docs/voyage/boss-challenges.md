# Voyage Mode — Boss Challenges (Board 7 finale)

Status: design draft. Scope: the *boss challenge* only. Theme challenges, charms, and the star/score system are out of scope except where they interact.

Board 7 = the board's theme challenge **plus** one boss challenge. The boss is a run-wide, theme-neutral rule twist that must be (a) modelled by the solver so the deal is provably winnable, (b) readable at a glance, and (c) explainable in one tooltip sentence.

---

## 0. Ground rules shared by every boss

### 0.1 Difficulty unit: CE ("cell-equivalents")

"≈ N CE" = roughly as hard as standard FreeCell with N fewer free cells. **All CE numbers below are design estimates, not measurements.** Calibrate before shipping: for each boss, solve ~1,000 seeds under the ruleset and compare the unsolvable rate and median solver nodes against standard FreeCell with 3, 2 and 1 cells; the matching row gives the CE. Budget: **boss CE + theme-challenge CE at strength 7 ≤ ~3.0**. Past that the seed-bank yield collapses (most random deals become unwinnable) and the board feels like a coin-flip rather than a climax.

### 0.2 Modifiers resolve into one `RuleSet`, in a fixed order

`base → charms → theme challenge → boss`. The solver, move generator, auto-play, hints, and UI all read the same resolved `RuleSet` — never separate per-feature checks.

- **Prefer subtractive offsets over absolute caps** ("−2 cells, floor 1", not "exactly 2 cells") so charms that add cells still matter. Bosses that must be absolute (Hand Carry) say so, and the charm-offer UI flags the affected charms (see §3.3).
- Each boss carries **tags** (`CELLS`, `STACK`, `FOUND`, `COLUMN`, `MOVE`, `VIS`). A boss may not be drawn if a tag collides with the board-7 theme challenge's tag (e.g. a theme that changes stacking legality excludes `STACK` bosses). The starter set (§2) is chosen so any single theme tag still leaves ≥3 eligible bosses.

### 0.3 The seed bank is per-ruleset — this is the main implementation cost

The pre-rated bank was rated under standard rules, so a bank rating does **not** tell us a boss deal is winnable. Plan:

1. Boss and board-7 theme are known from run start (§3), so a worker can **pre-solve during boards 1–6**: take N (~8) bank candidates near the board-7 target rating, solve each under `boss + theme challenge` with **no charms**, keep the first that solves in the budget and lands in the target band. Re-rate with the same solver metric (nodes / solution length) *under the boss ruleset*, since the bank's rating no longer applies.
2. **Charms-as-monotone-help invariant:** any charm that only adds capability (extra cell, extra undo, extra supermove, peek) can only *preserve* solvability. So verifying against the charm-less ruleset guarantees winnability with any charm set. Do not ship a charm that *restricts* play without re-verifying at board 7.
3. If no candidate solves within budget (`solvable: null` from `solve()` counts as a fail), fall back to the next candidates, then to a one-step-easier theme-challenge strength. Never deal an unverified boss board.
4. Alternative if pre-solving is too slow on low-end devices: ship a small per-boss pre-rated sub-bank (~200 seeds per boss, generated offline with the same solver). Decide after measuring worker time on a mid-range phone.

### 0.4 Engine reality check (`js/rules.js`)

Today rules are hard-coded: 4 cells (`for (let i = 0; i < 4; i++)` in `generateMoves`/`hashState`, `free` array length), classic stacking in `canStackOn`/`runLength`/`isValidSequence`, classic foundation in `foundationAccepts`, `(freeCells+1)*2^empty` in `maxMoveSize` and inline in `generateMoves`, and the safe-auto-play rule in `safeToFoundation`/`safeFoundationMoves`. Every boss below is a small parameter on a single `rules` object threaded through those functions. Two cross-cutting points:

- **Safe auto-play must be re-justified per boss.** It is proven safe only under standard foundation/stacking rules. Each boss entry states whether the existing rule stays sound; if not, auto-play (solver *and* player-side `safeFoundationMoves`/`canFinishWithFoundationOnly`) must be restricted for that boss.
- **State that is not derivable from `tableau/free/found` must be added to `hashState`** (only Twin Tombs needs this).

### 0.5 Things deliberately NOT bosses

Move limits, timers, "no undo", random discards, or random card swaps mid-game: the solver's transposition table doesn't track move counts or wall-clock time, and non-deterministic events can't be pre-verified. Same-suit stacking and "paired suits only" stacking: modelable but the unwinnable fraction is so high that seed supply, not design, becomes the constraint.

---

## 1. Candidates

Each entry: **Tooltip** · **Rule** · **Solver** · **Impact** · **UI tell** · **Interactions / risks** · **Complexity** (S/M/L).

### 1. Lockdown — tag `CELLS`
- **Tooltip:** "Two of your free cells are sealed."
- **Rule:** Free cells = (base + charm bonuses) − 2, floor 1. Sealed cells are the two rightmost *active* cells, rendered but unusable.
- **Solver:** `rules.freeCells` parameter; replace the hard-coded `4`s. No state change. Safe auto-play unchanged (still sound).
- **Impact:** ≈ 2 CE flat by definition (with 4 cells → 2). The bluntest boss and the cleanest calibration anchor; use it to define the CE scale.
- **UI tell:** Sealed cell slots show a chained lid / frosted plate; attempting to drop there shakes and clicks. Cell count in HUD reads `2/4`.
- **Interactions / risks:** Directly fights `+cell` charms (they un-seal one each — which is *fine* and satisfying; surface it: "Charm: +1 cell → 3 cells"). Fights star criteria that reward "avoid free cells" — make that criterion relative to available cells on boss boards. Unwinnable fraction at 2 cells is high, so budget this boss's theme challenge at ≤ 1 CE.
- **Complexity:** **S**.

### 2. Thaw — tag `CELLS`
- **Tooltip:** "Free cells start frozen and thaw as cards reach the foundations."
- **Rule:** Active cells = min(4, 1 + [cards on foundations ≥ 8] + [≥ 20] + [≥ 34]) + charm bonuses. A cell that is already holding a card is never lost; thaw only increases capacity.
- **Solver:** capacity is a pure function of `found[]`, already in the hash; no extra state. Capacity only rises with progress, so safe auto-play stays sound.
- **Impact:** ≈ 2–2.5 CE early, ≈ 0 late. A hard opening with a hopeful arc; rewards early foundation work.
- **UI tell:** Frosted cells that crack and clear with a chime at each threshold; a small "8/20/34" pip row under the foundations.
- **Interactions / risks:** Overlaps Lockdown (same tag, never together). Most *climactic* of the cell bosses but needs thorough seed filtering because the opening is the bottleneck. Interacts with "auto-play to foundations" in a good way (auto-play unfreezes cells).
- **Complexity:** **M** (capacity as a function; thaw animation; HUD pips).

### 3. Royal Decree — tag `CELLS`
- **Tooltip:** "Court cards (J, Q, K) cannot enter free cells."
- **Rule:** J/Q/K cards may not be moved to a free cell. Everything else is unchanged.
- **Solver:** a card-class filter in `generateMoves` for `t:'C'` moves. No state change; safe auto-play unchanged (foundation moves aren't affected).
- **Impact:** ≈ 1–1.5 CE (Kings rarely need cells; Jacks/Queens often do).
- **UI tell:** Court cards wear a small crown-lock badge (on top of whatever theme art); when dragging one, free cells dim with a "No" glyph.
- **Interactions / risks:** The easiest boss to read. Charms that "free cell can hold anything / wild cell" should be defined as *not* overriding the decree (decree is a card property, charm is a cell property) — or simply give such charms a "synergy" tag so players know. Colliding visual overlay with theme art on face-down cards is a non-issue since overlays are on the card edge.
- **Complexity:** **S**.

### 4. Kings' Throne — tag `COLUMN`
- **Tooltip:** "Empty columns accept only Kings."
- **Rule:** An empty column may receive only a sequence whose bottom card is a King (single King or a King-headed run). **Supermove capacity ignores empty columns** (`(cells+1)` only) because parking a non-King in an empty column is illegal.
- **Solver:** `canStackOn(empty, card)` ⇒ `rank===13`; remove the `<<emptyCols` doubling from the cap; no state change. Safe auto-play unchanged (only restricts more).
- **Impact:** ≈ 1.5–2 CE (the classic Seahaven restriction, plus loss of the empty-column multiplier).
- **UI tell:** Empty columns show a gilded throne slot with a crown outline; invalid drops bounce off with a "King required" toast on first attempt only.
- **Interactions / risks:** Charms that rely on empty columns (e.g. "empty columns count double") are **weakened** — flag in the charm-offer UI. Never pair with a theme challenge that adds/removes columns or changes empty-column rules (`COLUMN` tag). The `destEmpty && k === col.length` skip in `generateMoves` already avoids pointless whole-column moves; keep it.
- **Complexity:** **M**.

### 5. Barren Suit — tag `STACK`
- **Tooltip:** "Nothing can be built onto [♠]." (suit chosen by run seed; the tooltip names it)
- **Rule:** Cards of the barren suit can't be a *parent* in a built sequence: no card may be placed onto a barren-suit card. They can still move, enter cells/foundations, and be placed on valid parents. Dealt columns are exempt (the deal can contain stacks that would be illegal to build).
- **Solver:** thread `rules.barrenSuit` through `canStackOn`, `runLength`, `isValidSequence` (all three must agree so supermoves and drag-run detection stay consistent). Safe auto-play stays sound (rule only removes parents, never adds).
- **Impact:** ≈ 1 CE (opposite-colour cards lose one of two possible parents).
- **UI tell:** Barren-suit pips are desaturated with a thorn/frost overlay; their cards show a faint "no-build" bar on the bottom edge; valid drop targets simply don't highlight.
- **Interactions / risks:** Can't coexist with theme challenges that modify stacking rules (`STACK` tag). Colour-blind accessibility: the tell must be shape/outline, not hue.
- **Complexity:** **M**.

### 6. Lockstep — tag `FOUND`
- **Tooltip:** "No foundation may climb more than 3 above the lowest."
- **Rule:** A card may go to its foundation only if, after the move, `max(found) − min(found) ≤ 3`.
- **Solver:** extra predicate in `foundationAccepts`. No extra state. Safe auto-play: raising a foundation never constrains another foundation (the cap is relative to the *minimum*), so the existing safe test remains sound as long as each auto-play is itself legal under the predicate. Verify with a unit test over random states.
- **Impact:** ≈ 1–1.5 CE (suits can't run away; the low suit's buried Ace/2 becomes the bottleneck).
- **UI tell:** A glowing "ceiling" band at min+3 on all four foundation piles that moves up as the lowest advances; a tether line between piles. Cards over the ceiling show a lock icon while dragged.
- **Interactions / risks:** Interacts with a theme challenge that changes foundation order/rules (`FOUND` tag) — exclude. Interacts with "auto-play to foundations" and `canFinishWithFoundationOnly` (greedy still exact, since foundation moves remain monotone). The star criterion "chains" is unaffected.
- **Complexity:** **M**.

### 7. Hand Carry — tag `MOVE`
- **Tooltip:** "Empty columns don't help you move sequences."
- **Rule:** Sequence move capacity is `(cells + 1)` — no `2^empty` multiplier. Empty columns still accept cards normally.
- **Solver:** `rules.moveMultiplier = false`; one-line change to `maxMoveSize` and the inline `cap` in `generateMoves`. Safe auto-play unchanged.
- **Impact:** ≈ 1 CE.
- **UI tell:** The "can move N cards" hint in the HUD drops its empty-column bonus; empty columns get a small grayed-out "×2" glyph.
- **Interactions / risks:** **Absolute rule** (it deliberately turns off a mechanic), so it nullifies empty-column-multiplier charms; flag them in the offer UI. The tell is weak at a glance; consider it a "phase 2" boss.
- **Complexity:** **S**.

### 8. Twin Tombs — tag `COLUMN`
- **Tooltip:** "Two columns are sealed: cards can only leave them, not enter, until they're empty."
- **Rule:** Two columns (chosen by the deal seed, never adjacent) are sealed at the deal. While a sealed column is non-empty it accepts no cards. Once it becomes empty the seal breaks permanently.
- **Solver:** per-column "sealed" bit-mask in the state (**must be added to `hashState`**, since a refilled column looks identical to a never-emptied one). `generateMoves` skips destinations whose seal bit is set; clear the bit when the column empties (apply and undo must restore it — extend `applyMove`/`undoMove` descriptors). Safe auto-play unchanged.
- **Impact:** ≈ 1 CE (two columns become one-way dig-outs).
- **UI tell:** A dark lid with chains across the top of each sealed column; the lid shatters with a FX burst when the column empties ("trigger on column empty").
- **Interactions / risks:** Dealt column heights should be re-rated since the tombs matter more if they're deep. Excluded with `COLUMN` themes. Undo must restore seals: covered by the move-descriptor change.
- **Complexity:** **M–L** (state + undo + FX).

### 9. Fog of War — tag `VIS` (not solver-modelled)
- **Tooltip:** "Cards buried more than 3 deep are face-down; hold a column to peek."
- **Rule:** In every column, cards deeper than the top 3 render face-down. Press-and-hold on a column reveals it for the duration of the hold. Legality is unchanged.
- **Solver:** **Not modelled** — it changes information, not legality, so winnability is guaranteed as-is, but the *human-solvable* difficulty is not captured by the solver rating. **Hardening score:** draw the board-7 deal one rating tier *easier* than the standard board 7 (a −0.5 to −1 tier offset, calibrate in playtest), and, because the peek is free, accept the extra human cost as intended challenge.
- **Impact:** subjective; high for planning-heavy players, near zero for players who peek constantly. Peek being free is what keeps it fair.
- **UI tell:** A drifting mist layer over lower column sections; the top 3 cards stay sharp.
- **Interactions / risks:** **Do not combine with any `VIS` theme challenge** (e.g. Día de Muertos face-down cards). Charms that reveal cards would trivialize it; define them as interacting by making the peek faster rather than removing the boss. Not accessible-friendly for players with motor constraints (hold gesture) — provide a toggle-peek in settings.
- **Complexity:** **S** for rules (none), **M** for the render/peek layer.

---

## 2. Recommended starter set (5)

| # | Boss | Tag | Why |
| --- | --- | --- | --- |
| 1 | **Lockdown** | CELLS | Simplest to build; anchors the CE scale; universally readable; fallback if another boss is excluded. |
| 2 | **Royal Decree** | CELLS | Very readable, S-complexity, and a clever feel (the cards you need to park are the ones you can't). |
| 3 | **Kings' Throne** | COLUMN | Iconic, strong visual identity (throne slots), changes how the whole board is played, still a pure parameter for the solver. |
| 4 | **Barren Suit** | STACK | Seeded suit variety gives 4 flavours from one rule; meaningful interaction with the player's choices. |
| 5 | **Lockstep** | FOUND | The only bonus that attacks the endgame plan rather than the tableau; ceiling-band UI is distinctive. |

Why this set: it covers four tags (`CELLS`, `COLUMN`, `STACK`, `FOUND`), so for any theme challenge in any single tag at least three bosses remain eligible; every boss is a deterministic rule parameter with no extra solver state; four of five are S/M complexity. **Phase 2:** Thaw (best cell-boss drama but needs the most seed filtering), Hand Carry (weak tell), Twin Tombs (needs state + undo changes), Fog of War (needs an information-hardening score and peek UI).

---

## 3. How the boss pick works

### 3.1 Recommendation: seeded by run seed, revealed on the map from the start

- **Seeded:** the boss is drawn from the run seed (after the 7 themes are assigned, so tag exclusions can be applied). Same seed ⇒ same boss, which makes daily/shared runs comparable and makes seed-bank pre-solving deterministic.
- **Revealed at run start** (as the board-7 node on the map, with tooltip and its UI tell): the player can plan for it. This directly unlocks (a) charm choices — the offer screen can badge charms as "synergy" or "weakened vs boss" — and (b) background pre-solving of the boss board during boards 1–6 (§0.3).
- Hiding the boss until board 6 would feel like a gotcha (the player already committed 6 charms), give the pre-solver less lead time, and create "my charms were wasted" losses that read as unfair.

### 3.2 Draw procedure
1. Take the starter set (later the full list) minus bosses whose tag collides with the board-7 theme challenge's tag.
2. Drop any whose estimated CE + theme-challenge CE at strength 7 exceeds the 3.0 budget (reduce the theme strength by one step on boss boards instead of dropping, if only one boss is left).
3. Draw by run seed; resolve variable parameters (Barren Suit's suit, Twin Tombs' columns) from the same seed.

### 3.3 Charm-offer UI hook
Because the boss is known, tag every charm in the offer screen with one of: `+` synergy, `~` neutral, `!` weakened/nullified by the boss (e.g. empty-column multiplier charms vs Kings' Throne or Hand Carry). Never silently nullify a charm.

### 3.4 Other tuning notes
- **Undos:** harsher rulesets create more dead ends, so the shared undo budget drains faster at the finale. Consider a one-time "finale stipend" of +2–3 undos on entering board 7 (tune in playtest), rather than easing the board itself.
- **Stars:** score components that depend on the ruleset (avoiding free cells, chains) should be normalised on boss boards so the boss doesn't *automatically* cost a star.
- **Presentation:** a short boss intro card on entering board 7 (rule name, tooltip, UI tell highlighted for 2s), and a persistent boss badge next to the theme badge in the HUD.
- **Option to defer:** offering "choose 1 of 2 bosses" at board 6 was considered and rejected for v1: it doubles pre-solving cost and weakens the "seeded and shared" property. Revisit with ascension-style difficulty levels.
