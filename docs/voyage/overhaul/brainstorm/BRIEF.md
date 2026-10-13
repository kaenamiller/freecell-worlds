# Brainstorm brief: Voyage charm overhaul

You are a game designer helping overhaul the charm system in **FreeCell Worlds — Voyage mode**, a 7-board roguelite run of FreeCell (think Balatro / Slay the Spire structure on top of solitaire). This is a creative, read-only task: **write exactly one file** (named below) and do not edit anything else in the repo. Do not run git commands.

## Read first (in this repo)

- `docs/voyage/charms-design.md` — the current roster (48 themes × 3 boons + 1 challenge), the design rules (§1), the rules kernel fields (§2.1) and runtime API (§3).
- `docs/voyage/parked-abilities.md` — already-specced ability shapes not yet used.
- `docs/voyage/boss-challenges.md` §0 — why rules must be solver-visible.
- Skim a few files in `js/voyage/content/` and `js/voyage/content/special/` to see what's cheap vs. expensive to build.

## What's wrong today (two independent reviews agree)

- ~60 of 144 boons are pure points and ~34 are "+1 undo when something ordinary happens". Many "conditional" charms always pay out, because a board only scores when won and winning sends all 52 cards home (e.g. "+12 per heart sent home" is a flat +156).
- Score only feeds stars → number of charm offers (1–3). So point charms are nearly invisible.
- Charms don't interact; there are no builds/archetypes.
- 11 near-identical wild-rank charms, 3 identical +1 cell charms, two identical heart suit-build charms.
- Challenges/bosses repeat ~6 restriction shapes (no-cell ranks, barren ranks, empty-column min rank, foundation spread, frozen cells, sealed columns). 19 of 48 challenges are score taxes that can't threaten a clear.
- The fun charms are the once-per-board rule breaks (Tractor Beam, Dig Site, Tide Pool, Understudy, Raven's Trick, Bookmark, Zip Line...).

## Direction already decided (build on it; don't relitigate)

1. **Ports + coins.** Board score converts to coins. Some map nodes are harbours; after clearing one you dock at a port: buy a boon from any theme, sell a boon, upgrade a boon (level 2), buy undos, buy **card stickers**.
2. **Card stickers** — persistent per-card enhancements for the whole run (every board deals the same 52 cards): Wild (ignores colour), Gold (coins when sent home), Lucky (+1 undo when sent home, capped), Key (ignores free-cell restrictions).
3. **Upgrades**: every boon can have a level-2 form bought at ports.
4. **Families/synergies**: boons get a family tag (cells, columns, wild, suit, ability, undo, coin, foundation, vision) and some boons scale with how many of a family you hold.
5. **New rule shapes**: rising tide (empty cells close as foundations fill), contrarian column (builds up), Annex (a 9th empty column), Bunk Cell (a cell holds a 2-card run), Joker/"The Fool" (a 53rd wild card in its own slot), Promotion (shift a card's rank ±1 for stacking), embargo (a suit can't go home until N other cards are home), empty columns only accept LOW cards, column colour locks, deal skew (uneven column heights).
6. **Bosses** with identity: two-phase bosses (rules switch at 26 cards home), bosses that confiscate one of your boons for the finale, bosses fixed onto one difficulty axis.
7. **Wagers**: stake undos on a 3★ finish.
8. Anti-fun boons removed: High Roller (sells undos for a multiplier), Misprint (wild 2s do nothing), Heat Lamp (frozen cell + negative ease), Merit Badge (pays you to avoid free cells), Temper (doubles free-cell cost).

## Hard constraints (from the engine)

- **Boons only add capability.** A boon may never make a winnable position unwinnable (deals are verified with no charms).
- **Challenges are either solver-visible rules** (must be a pure function of the board state: tableau, free cells, foundations — no move counters, timers or hidden history) **or pressure** (score/coins/undos/stars/visibility only).
- **Score and coins are computed from the final move history** (undone moves don't count). Event-granted undos must be capped per board.
- **Seeded randomness only.** No mid-board random swaps.
- **No pure convenience.** A charm must change what's possible, not just reduce clicks (capping/raising things below the classic supermove limit is meaningless; an ability that only plays moves you could make anyway isn't a charm). Information (hints, peeks) and resources (undos, coins) count.
- Conditions on score/coin charms must be **real choices**: something the player has to plan for and could fail to get, not something every win does automatically.

## Your deliverable

Write `docs/voyage/overhaul/brainstorm/<YOUR-FILE>.md` containing:

1. **30 boon ideas.** Each: name (evocative, theme-neutral is fine), one-sentence tooltip, family tag, a level-2 upgrade, and a one-line implementation sketch in terms of the kernel (`rules` field, `ability` + `charmMove`, `score`/`sb` from history, `on.*` events, coins, stickers). Mix: ~8 ongoing rule bends, ~10 once-per-board abilities/decisions, ~6 economy (coins/stickers/ports/wagers), ~6 synergy/build-around charms that reference other charms or families. Mark the 8 you think are the most fun with ★.
2. **15 challenge ideas** that threaten a clear (solver-visible, state-only) or create interesting pressure, all distinct from the existing six shapes. Each with how it scales over strength 1–7.
3. **6 boss ideas** with a strong identity (phases, reacting to your build, etc.).
4. **10 port/run-structure ideas** (port services, events, map node types, run-level twists).
5. **Your top 5 "this would make the game way more fun" picks**, with one paragraph each on why.

Be concrete and inventive. Avoid re-skins of the existing roster. Keep it under ~900 lines.
