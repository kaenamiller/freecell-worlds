# K2b — Voyage UI v2: ports, coins, stickers, levels, families, curses

You are the UI engineer for the Voyage charm overhaul of FreeCell Worlds (static three.js FreeCell, plain ES modules, no build step, DOM overlays styled per theme). Several agents work **in the same checkout at the same time**; follow the ownership rules exactly.

## Read first
1. `docs/voyage/overhaul/SPEC.md` — §1, §4 (the systems you are drawing), §5.
2. `docs/voyage/overhaul/briefs/K2a-economy.md` task 7 — **the view-model and handler contract you code against**. K2a builds the model in parallel; until it lands, drive your screens with fixture view models in `tools/voyage-ui-preview.html` / `tools/voyage-ui-preview.mjs`.
3. `docs/voyage/ui-contract.md`, `docs/voyage/ui-notes.md`, `js/voyage/ui.js`, `css/voyage.css`, `js/card.js` (card marks), `index.html` (Voyage markup), `tools/voyage-ui-preview.*`, `tools/voyage-ui-check.mjs`.

## Files you own
`js/voyage/ui.js`, `css/voyage.css`, `js/card.js` (mark rendering only), Voyage markup in `index.html`, `tools/voyage-ui-preview.html`, `tools/voyage-ui-preview.mjs`, `tools/voyage-ui-check.mjs`, `docs/voyage/ui-notes.md`, `docs/voyage/overhaul/K2b-report.md`. Do not edit `js/main.js`, `js/ui.js`, `css/style.css` or anything under `js/voyage/` other than `ui.js`. If you need a main.js hook, write it in your report and in `docs/voyage/ui-notes.md`.

## Tasks
1. **Port screen** `voyageUI.showPort(view)`: a harbour market with stalls (Boons, Stickers, Upgrade, Provisions, Sell, Reroll) and a coin purse. Buying a sticker opens a **52-card picker** (4 suit rows × 13 ranks, theme-neutral mini faces, already-stickered cards show their sticker; Esc cancels) and then calls `handlers.portBuySticker(offerIdx, cardId)`. Insufficient coins: buttons disabled with the shortfall shown. Selling asks for confirmation via the existing `confirm`. "Set sail" → `handlers.portLeave()`. Keyboard + touch accessible. It must look like it belongs to the current table theme (reuse the existing overlay styling variables).
2. **Coins**: purse in the HUD and on the map; coin breakdown on the result screen under the score breakdown (`results.at(-1).coins`, `coinLines`), animated after the stars.
3. **Map**: harbour nodes get an anchor glyph and a "Port after this table" tooltip line.
4. **Charm cards everywhere** (tray, reward, map node detail, port): family glyph + name, level badge "II" for level 2 (show `upgradeText` as the active text), upgrade preview on port upgrade cards ("Now: … → Upgraded: …").
5. **Challenge chips**: "Rule" vs "Curse" label from `pressure`.
6. **Boss confiscation**: when `view.confiscated` / `current.confiscated` is set, show "Confiscates: <boon>" on the boss chip, the final-row map node and the boss intro, and grey out that boon in the tray during the finale.
7. **Undo cap**: small "charm undos 1/3" readout near the undo count when `current.undoGrants > 0`.
8. **Sticker marks** in `js/card.js`: new mark styles `sticker-wild`, `sticker-fool`, `sticker-key`, `sticker-gold`, `sticker-lucky` — a small sigil in the corner opposite the existing charm mark corner so both can show on one card; shape-distinct (readable without colour); subtle. A card can carry a charm mark *and* a sticker mark: the current API is `setCardMark(group, style)` with one style; add a second slot (e.g. `setCardSticker(group, type)`) and document it in your report so K2a/K3 can call it from main.js. Run summary: list stickers.
9. **Preview + checks**: extend the UI preview fixtures to include a port, coins, levels, families, curses, confiscation and stickers; extend `tools/voyage-ui-check.mjs` to screenshot each new screen at 1024×768 and 390×844 (mobile) and assert no overflow / no console errors. Look at the screenshots yourself and iterate until they look polished.

## Acceptance
- Preview renders every new screen with no console errors, at desktop and mobile sizes; screenshots saved under `/tmp/k2b-shots/` and reviewed.
- Existing screens unchanged apart from the additions.
- `docs/voyage/overhaul/K2b-report.md`: what you built, the main.js hooks you need (exact function names/args), screenshots list.
- Use port 8144 for any server you start.

When done, reply with a short summary and the report path.
