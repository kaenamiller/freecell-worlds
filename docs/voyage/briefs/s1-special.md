# Brief S1 — Voyage complex charms: cyber.ghost, keep.siegeengine, library.bookmark

You are building the **complex** Voyage charms `cyber.ghost`, `keep.siegeengine`, `library.bookmark` — state- and rule-mutating abilities (dynamic extra cell, obstacle breaking that edits game.rules/state, batch rewind).

Read first:
1. `docs/voyage/charms-design.md` — §1, §2.2 (overrides, custom moves, game.rules), §3.2–§3.4 (api, events, abilities, `api.pick`), the §5 rows for these charms and the §6 notes.
2. `docs/voyage/charms-build-log.md` — K1/K2 summaries: the API **as built** (wins over the design doc).
3. `js/voyage/charms.js` header, `js/voyage/content/kit.js`, `js/voyage/content/_examples.js`, and the parts of `js/rules.js` (custom moves, override) and `js/main.js` (Voyage section: `charmMove`, relayout, abilities, stuck check) your charms rely on.

## What to write
One module per charm (already stubbed, imported by `content/index.js`):
- `js/voyage/content/special/cyber.ghost.js`
- `js/voyage/content/special/keep.siegeengine.js`
- `js/voyage/content/special/library.bookmark.js`

Each registers its charm (`kind: 'boon'`, `theme`, `name`, `icon`, `text`, `ease`, `ability`, …) and any custom move op via `registerCustomMove`. Requirements per charm:
- Works through play, **undo** (including undo of the ability's own move/override, which restores the use), **save/resume mid-board**, and the **stuck check** (an unused ability that could help must keep the run alive; a spent one must not).
- Can't break winnability (boons only add capability) and can't desync the solver: after any of your moves the state must still be a valid `{tableau, free, found}` (+ any K1 state fields) that `solve()` / hints accept.
- Score stays consistent (custom moves count as player moves unless the build log says otherwise).
- Visual feedback: targeting highlights via `api.pick`, an animated relayout, a sound, a toast on use.
- Add checks in `tools/charm-checks/<charm-id>.mjs` (auto-discovered by `tools/charm-content-check.mjs`): apply/undo round-trips on real deals, illegal-target rejection, resume.

## Ownership and coordination
You own only the files above plus your `tools/charm-checks/*.mjs`. Other agents are working in this checkout at the same time (theme content files, other special modules). If you need a kernel change (`rules.js`, `main.js`, `charms.js`, `card.js`, `table.js`, `ui.js`), keep it **minimal and generic**, re-read the exact region right before editing, make small targeted edits, never reformat, and record it under a "S1 kernel edits" heading in `docs/voyage/charms-build-log.md`. Never run `git checkout/stash/reset/clean`, never commit.

Use port **8150** for any server (`node serve.mjs 8150`). Headless Chrome: `/usr/bin/google-chrome`; puppeteer-core as in `tools/voyage-ui-check.mjs`. Verify each charm in a real headless Voyage board (force the charm into the run's boons via a saved run or a debug hook) and save screenshots to `/tmp/s1-shots`.

## Done means
Each charm works end to end in the browser and in `node tools/charm-content-check.mjs`; you've appended a "S1" section to `docs/voyage/charms-build-log.md` with what was built, any kernel edits, and known gaps.

## Addendum from the orchestrator (read this)
- K2 is done; K1 has landed its API but may still be finishing its own summary in the build log — the K2 section and the "Requests to K2" notes from K1 already describe the rules API as built.
- The §2.5 calibration table is short-budget and noisy (high "unknown" rates). Use it for direction, not precision: keep any single challenge's ease within about −0.15·s (so ≤ ≈ −1.0 at s7) and any boon's ease ≤ +0.5. Rules are verified by the dealer anyway.
- **Design change:** Deep Freeze (`arctic.challenge`) freezes at most **2** cells (1 at s1–4, 2 at s5–7; thaw at 8 and 20 cards home) — 3 frozen cells measured 43% unsolvable.
- Don't stack a theme's own rules on top of the boss: tags are what prevent that, so get them right.
