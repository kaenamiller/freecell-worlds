# Brief C6 — Voyage charm content (simple charms): lapis, canopy, diner, cove, keep

You are writing Voyage charm **content** for these themes: `lapis`, `canopy`, `diner`, `cove`, `keep`. The engine ("kernel") is already built.

Read first:
1. `docs/voyage/charms-design.md` — §1 (design rules, ease guidance), §5 (the rows for your themes: your spec), and skim §2–§3 for the primitive names.
2. `docs/voyage/charms-build-log.md` — the K1 and K2 summaries describe the API **as actually built**. Where they differ from the design doc, the build log wins. §2.5 of the design doc has the measured ease table.
3. The header comment of `js/voyage/charms.js` (hook + api reference) and `js/voyage/content/kit.js` (helpers). Look at `js/voyage/content/_examples.js` for working examples.

## What to write
For each theme, implement its **S** rows (the 3 boons — minus any marked **C** — plus the challenge) in its own file:
- `js/voyage/content/lapis.js`
- `js/voyage/content/canopy.js`
- `js/voyage/content/diner.js`
- `js/voyage/content/cove.js`
- `js/voyage/content/keep.js`

Each file imports `defineCharm` from `../registry.js` (plus helpers from `./kit.js` / `../boardrules.js` as needed) and registers charms with id `<theme>.<key>` (challenge: `<theme>.challenge`), `kind`, `theme`, `name`, `icon`, `text` (challenges: `text: (s) => ...` with the real numbers at strength s), `tags` on challenges, the hooks from the Impl column, and `ease` per §1 / §2.5. Rows marked **C** are built by another agent in `content/special/` — skip them (don't create stubs for them; the placeholder system fills gaps).

Rules of the road:
- Follow §1: boons only add capability; score from history; per-board caps on event-granted undos; seeded rng only.
- Match the code style of `js/voyage/charms.js` (2-space, single quotes, short comments only where they help).
- If the spec is ambiguous, pick the reading that is simplest to implement and explain it in the charm `text`. If a row truly can't be built with the kernel, implement the closest faithful variant and note it in the build log.
- Only edit the files listed above. Do not edit kernel files, other themes' files, `content/index.js`, or `content/special/**`. If you find a kernel bug, describe it under "Requests to K2" / "Requests to K1" in `docs/voyage/charms-build-log.md` (append only) and work around it locally if you can.
- Several agents are working in this same checkout right now on other files. Never run `git checkout/stash/reset/clean`, never commit, never reformat files you don't own.

## Verify
- `node tools/charm-content-check.mjs` — no errors, and none of your themes listed as having placeholders. Add focused checks for anything subtle (e.g. a score hook) in `tools/charm-checks/content-c6.mjs` if the check script supports auto-discovered check modules.
- If you start a game server, use port **8145** (`node serve.mjs 8145`) and only that port. A headless smoke test of one Voyage board per theme is a bonus, not required.

## Done means
All your themes have 3 real boons + 1 real challenge (except C rows), the check passes, and you've appended a short "C6 (lapis, canopy, diner, cove, keep)" section to `docs/voyage/charms-build-log.md` listing any deviations from the spec and the ease values you chose.

## Addendum from the orchestrator (read this)
- K2 is done; K1 has landed its API but may still be finishing its own summary in the build log — the K2 section and the "Requests to K2" notes from K1 already describe the rules API as built.
- The §2.5 calibration table is short-budget and noisy (high "unknown" rates). Use it for direction, not precision: keep any single challenge's ease within about −0.15·s (so ≤ ≈ −1.0 at s7) and any boon's ease ≤ +0.5. Rules are verified by the dealer anyway.
- **Design change:** Deep Freeze (`arctic.challenge`) freezes at most **2** cells (1 at s1–4, 2 at s5–7; thaw at 8 and 20 cards home) — 3 frozen cells measured 43% unsolvable.
- Don't stack a theme's own rules on top of the boss: tags are what prevent that, so get them right.
