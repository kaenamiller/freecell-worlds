# Brief B3 — Fog of War boss (GPT-6.1 Sol)

Build `boss.fog` per spec §3 of `docs/voyage/boss-build.md`: dynamic depth-3 fog via the kernel concealment API, press-and-hold peek (≥250 ms) and a **Tap to peek** accessibility setting (+ keyboard P + column digit), a cheap theme-neutral mist layer, `dealShift`, tags, `boonRelation`, checks.

## Read first
1. `docs/voyage/boss-build.md` — the spec for this work (your section + §4 ownership).
2. `docs/voyage/boss-challenges.md` — original boss design (rationale, risks).
3. `docs/voyage/charms-build-log.md` — the kernel API **as built** (K1, K2, S1–S3 sections); `js/voyage/charms.js` header; `js/voyage/content/kit.js`.

## Rules of the road
- Same checkout as other agents working right now (B1 boss system, B2 boss content, B3 Fog of War). Edit only files you own per §4. Re-read a shared file right before each edit, small targeted edits, never reformat. Never run `git checkout/stash/reset/clean`, never commit.
- Keep classic mode unchanged and keep these passing: `node tools/charm-content-check.mjs --strict`, `node tools/rules-check.mjs`.
- Cross-agent needs go in `docs/voyage/charms-build-log.md` under "Requests to B1/B2/B3" (append only).

## Coordination
B1 is concurrently editing the Voyage section of `js/main.js`, `js/table.js` (Lockstep band) and `js/voyage/ui.js`; you edit only input handling in `main.js`, a separate fog section in `table.js`, the settings row in `js/ui.js`/`index.html`. Peek must not interfere with drag (a hold that turns into a drag is a drag; peek only when the pointer stays put), must not count as a move, and must restore exactly the concealed set on release, including after undo and resume. To test on a real board before B1's finale flow is done, force `run.boss = 'boss.fog'` and jump to board 7 via test hooks.

Use port **8162**. Headless Chrome: `/usr/bin/google-chrome`, puppeteer-core as in `tools/voyage-ui-check.mjs`. Note: awaiting long-running page promises over CDP can fail with "Promise was collected" — start work in-page and poll a window flag.

## Done means
Browser-verified: fog at deal, dynamic reveal as columns shrink, hold-peek and release, tap-peek setting, keyboard peek, undo, resume, no drag regressions, classic mode unaffected; screenshots in `/tmp/b3-shots`; `tools/charm-checks/boss.fog.mjs` passing; a "Bosses: B3" section appended to the build log.
