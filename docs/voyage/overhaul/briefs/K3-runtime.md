# K3 — Charm runtime v2: levels, families, undo cap, hint fix, preview, reset, undo window, synergy hooks

You are the charm-runtime engineer for the Voyage charm overhaul of FreeCell Worlds (static three.js FreeCell, plain ES modules, no build step). Several agents work **in the same checkout at the same time**; follow the ownership rules exactly.

## Read first
1. `docs/voyage/overhaul/SPEC.md` — §1, §3 (your scope), §5.
2. `docs/voyage/charms-design.md` §3 (the current runtime) and `docs/voyage/parked-abilities.md` (Deal Reset, Undo Window, Three-Move Look specs — your API must make them buildable exactly as specced there).
3. `js/voyage/charms.js`, `js/voyage/content/kit.js`, `js/voyage/registry.js`, a few `js/voyage/content/special/*.js` modules, and in `js/main.js`: `doHint`, `doUndo`, the Voyage section (`voyageRuntimeAPI`, `voyageUndone`, `voyageAfterMove`, `voyageDealBoard`, stuck checks). Also `tools/charm-content-check.mjs`, `tools/charm-runtime-check.mjs`, `tools/charm-checks/_kernel.mjs`.

## Files you own
`js/voyage/charms.js`, `js/voyage/registry.js`, `js/voyage/content/kit.js`, `js/voyage/content/_examples.js`, `tools/charm-content-check.mjs`, `tools/charm-runtime-check.mjs`, `tools/charm-checks/_kernel.mjs` (+ new `tools/charm-checks/_runtime-v2.mjs`), `docs/voyage/overhaul/K3-report.md`.
In `js/main.js` you own **only**: `doHint`, `doUndo`, `voyageRuntimeAPI`, `voyageUndone`, `voyageAfterMove`, `voyageDealBoard`, `voyageRelayout`, `voyageRefresh`, `voyagePickTarget`, `voyageRevealExposed`, the stuck-check functions, plus any new helpers you add next to them (e.g. preview highlighting). K1 owns `dealGame`, drag/drop legality and auto-play; K2a owns the Voyage flow functions (`voyageWin`, `voyagePickCharm`, `voyageShowMap`, `vyView`, `voyageHandlers`, …). Re-read `main.js` right before every edit; keep edits surgical. Do not edit content theme files (`js/voyage/content/<theme>.js`) or specials — content agents rewrite those next.

Never run `git checkout/stash/reset/clean/commit`.

## Tasks
1. **ctx v2** (SPEC §3.1): `ctx.level`, `ctx.family(name)`, `ctx.coins`; `charmText(id, strength, { seed, level })` returns `upgrade` text at level 2. `BoardEffects` reads `level` from `active` entries (K1 adds it in composeBoard; default 1). Hidden charms (`hidden: true`, e.g. `voyage.stickers`) are excluded from `boonsForTheme` and anything offered.
2. **Hint fix** (SPEC §3.2): `api.hint()` must work in Voyage without dev unlock (today `doHint` returns early unless `ui.devUnlocked`, so Holo-Scan/Pocket Compass/Docent/Eye of Horus do nothing and don't spend their use). Keep the classic hint button blocked in Voyage.
3. **`api.preview(n)`** with the highlight UI (selection-style glow on the first move's card and destination, numbered badges on the 2nd/3rd sources; cleared by any move, undo or ability). Theme-neutral.
4. **`api.resetBoard()`** and **`api.openUndoWindow()`** exactly per the parked specs + SPEC §3.2 (events `ev.reset` / `ev.free`, refunds, `sb.undosUsed` only counts paid undos, saved for resume, Bookmark's anchor cleared when history no longer contains it — Bookmark lives in `content/special/library.bookmark.js`; if it needs a one-line change, note it in your report for the content agent rather than editing it).
5. **Undo cap** (SPEC §3.2): per-board count in `cur.memo._undoGrants` (K2a's view model reads this key), cap `VOYAGE.charmUndoCap` (already in config), exemptions (`on.stuck`, `undoCapExempt`). Toast when capped.
6. **Synergy hooks**: `on.ability` event, `api.grantUse(charmId|'*', n)` (cap +2 per charm per board), and make sure abilityBonus still works.
7. **Dev examples**: add dev charms in `_examples.js` that exercise preview, resetBoard, undo window, grantUse and the cap, and cover them in `tools/charm-runtime-check.mjs` (browser, port 8143) and pure checks in `tools/charm-checks/_runtime-v2.mjs`.
8. **Content check v2**: in `tools/charm-content-check.mjs`, add v2 enforcement behind `STRICT_V2=1` (content isn't migrated yet): every non-placeholder, non-hidden boon has `family` (one of the SPEC list) and `upgrade`; no two boons share identical `text`; every challenge has `pressure: true` or a `rules` hook; ability charms' `available` is pure. Without the env var, print warnings only.

## Acceptance
- `node tools/charm-content-check.mjs` passes (warnings allowed without STRICT_V2); `node tools/rules-check.mjs` passes.
- `VOYAGE_TEST_URL=http://[::1]:8143 node tools/charm-runtime-check.mjs` passes against `node serve.mjs 8143`, including your new dev-charm cases, with no console errors.
- The existing Holo-Scan / Pocket Compass / Docent / Eye of Horus now actually play a move in Voyage (verify in the browser check).
- `docs/voyage/overhaul/K3-report.md`: exact API you shipped (signatures + semantics), anything content authors must know, anything deferred.

When done, reply with a short summary and the report path.
