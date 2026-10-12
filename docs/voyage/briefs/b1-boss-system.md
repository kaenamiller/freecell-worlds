# Brief B1 — Voyage boss system (GPT-6.1 Sol)

You own the boss **system**: spec §2 of `docs/voyage/boss-build.md` (budget + calibration, draw, pre-solving the boss board, content API additions incl. `text(strength, ctx)` with run seed, `crown`/`thorn` mark styles, `boonRelation` badges, finale stipend, boss-board star normalisation, boss intro card + tell flash, Lockstep ceiling band, capacity readout) and removing the placeholder `boss.narrows`.

## Read first
1. `docs/voyage/boss-build.md` — the spec for this work (your section + §4 ownership).
2. `docs/voyage/boss-challenges.md` — original boss design (rationale, risks).
3. `docs/voyage/charms-build-log.md` — the kernel API **as built** (K1, K2, S1–S3 sections); `js/voyage/charms.js` header; `js/voyage/content/kit.js`.

## Rules of the road
- Same checkout as other agents working right now (B1 boss system, B2 boss content, B3 Fog of War). Edit only files you own per §4. Re-read a shared file right before each edit, small targeted edits, never reformat. Never run `git checkout/stash/reset/clean`, never commit.
- Keep classic mode unchanged and keep these passing: `node tools/charm-content-check.mjs --strict`, `node tools/rules-check.mjs`.
- Cross-agent needs go in `docs/voyage/charms-build-log.md` under "Requests to B1/B2/B3" (append only).

## Coordination
B2 is writing `js/voyage/content/bosses.js` now. For run-stable randomness it uses `stream(seed, 'boss', id)` from `js/voyage/rng.js` directly (both in `text(s, ctx)` via `ctx.seed` and in `rules` via `ctx.seed`) — make sure `ctx.seed` reaches boss `text` in `charmView`/`runView` and anywhere else boss text is rendered. Land the `crown`/`thorn` mark styles early (B2 calls `api.mark(ids,'crown'|'thorn')`). Run the calibration (§2.1) **after** B2's bosses exist (poll for real content in `bosses.js`; meanwhile build everything else), then fill §5 of the spec.

Use port **8160**. Headless Chrome: `/usr/bin/google-chrome`, puppeteer-core as in `tools/voyage-ui-check.mjs`. Note: awaiting long-running page promises over CDP can fail with "Promise was collected" — start the work in-page and poll a window flag instead.

## Done means
A seeded run reaches board 7 (use test hooks) for at least 3 different bosses: boss intro card, tell flash, stipend toast, eased-challenge note when budgeted down, offer/map badges, star normalisation in the result breakdown; pre-solve cache hit logged; screenshots in `/tmp/b1-shots`. Append a "Bosses: B1" summary to the build log.
