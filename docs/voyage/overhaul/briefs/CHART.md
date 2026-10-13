# CHART — the Voyage map becomes a 2D sea chart

You are building the new Voyage map screen for FreeCell Worlds (static three.js FreeCell, plain ES modules, no build step, DOM overlays styled per theme). Other agents are working **in the same checkout at the same time**; follow the ownership rules exactly.

## The concept (from the game's designer)
Replace today's rectangles-and-lines map with a **painted sea chart**: a little boat sits at the player's position, surrounded by fog. The next tables are **islands** across the water. The player picks one and the boat **sails off** toward it, which leads into the next board. Harbours (ports) are an obvious fit: a dock with a lantern on the island, and sailing into one after the board ends in docking at the market.

## Read first
1. `docs/voyage/ui-contract.md` (including the v2 section) — `showMap(view)`, `mapView` rows, node fields (`state`, `links`, `port`, `storm`, `stormChallenge`, `confiscated`, `final`, `challenge`, `boons`), handlers (`pickNode`, `openMap`).
2. `js/voyage/ui.js` (`showMap` and the chart rendering around it, the detail side panel, tutorial `'map'`), `css/voyage.css` (map section), `js/voyage/map.js` (tree shape: 7 rows, 3 roots, 2 children each, `lookahead` rows visible — can be 1–4 via the Tuning charm), `js/voyage/run.js` `runView`.
3. In `js/main.js`: `voyageShowMap`, `voyagePickNode` (the dealer `dealFor` runs there — the sail animation must overlap that wait, not add to it), `voyageHandlers.openMap`.
4. `tools/gen-charm-icons.mjs` and `tools/lib.mjs` for how art is generated (Gemini API key is read from `~/Documents/mahjpods/.env` by `lib.mjs`; the designer authorised it for this project's art), `tools/optimize-assets.sh`, and how theme art/palettes are exposed in `js/themes.js` / `js/theme-expansion.js`.
5. Screens to match for tone: `/tmp/k2b-shots/k2b-port-desktop.png` (the harbour market you'll dock into).

## Files you own
`js/voyage/ui.js` (map section only: `showMap`, `hideMap`, chart drawing, map detail panel, the `'map'` tutorial copy), new `js/voyage/chart.js` (all chart layout/drawing/animation), `css/voyage.css` (map section only), new `assets/art/chart/**`, new `tools/gen-chart-art.mjs`, `tools/voyage-ui-preview.*` / `tools/voyage-ui-check.mjs` (add map cases), `sw.js` (only to add new assets to whatever it precaches), `docs/voyage/overhaul/CHART-report.md`. In `js/main.js` only `voyageShowMap`, `voyagePickNode`, `voyageHandlers.openMap` — re-read right before editing; another agent (K3) is still editing other Voyage functions in main.js. Never run `git checkout/stash/reset/clean/commit`.

## Requirements
- **2D, not three.js**: layered SVG and/or canvas over a painted sea background, with drifting fog layers (CSS/canvas, cheap). Must stay smooth on a mid-range phone; pause animation when the map is hidden.
- **Islands**: one per visible node, painted in that node's table theme (art per theme, see below), placed along the tree with seeded jitter so it reads hand-drawn rather than a grid. Routes are dashed sea lanes. Desktop flows left → right; phones (portrait) bottom → top.
- **Node states** must stay as readable as today: current position (boat), available choices (bright, tappable), upcoming (visible beyond, dimmer), skipped (faded wake behind), and **fog beyond the lookahead** — the fog edge sits exactly where visibility ends, so a bigger lookahead visibly pushes it back.
- **Node types at a glance**: harbour (dock + lantern + anchor glyph), storm (thunderhead + second challenge chip), finale (the boss on the horizon, half in fog, visible from the start, with its confiscation note when present), Rule vs Curse challenge chips.
- **Information is not lost**: hovering/focusing/tapping an island shows the same information the current detail panel shows (challenge at strength, the three boons with family + level, port/storm notes). A second tap (or a "Set course" button in the panel) commits — `handlers.pickNode(id)`. Keyboard: arrow keys move between available islands, Enter commits; screen-reader labels on every island.
- **Sail-off animation**: on commit, the boat sails along the lane to the chosen island (~1.2–1.8 s, ease-in-out, wake trail, fog parts), then the board intro proceeds. It must start immediately and run **concurrently** with the dealer's `dealFor` in `voyagePickNode` (wait for both, never serially). Skippable by tap/Esc. `settings.reducedMotion` → no animation, straight cut.
- **Docking**: when the status is `'port'`, show a short arrival beat (boat at the dock, lantern lights) before/as the market opens; keep it ≤ 1 s and skippable.
- **Read-only mid-board view** (`openMap`) keeps working.
- **Art** (generate with `tools/gen-chart-art.mjs`, model **`gemini-nano-banana-2.1`**, the designer's preferred model — cheap and it won their blind tests): a seamless-ish painted sea background (dark nautical palette that works under every theme's accent colours), fog texture(s) with alpha, a small boat (top-down/three-quarter, clean silhouette, a few sizes or one hi-res), and **one island vignette per table theme (48)**, transparent background, consistent scale/angle/style across all of them so the chart looks like one map. Keep prompts in the script, write PNG → convert to WebP (see `optimize-assets.sh`), target ≤ 60 KB per island at the displayed size ×2. Regenerate the outliers until all 48 sit together stylistically; look at them yourself as contact sheets. Include a graceful fallback (a simple drawn island silhouette tinted with the theme accent) if an island image is missing.
- **Mobile**: works at 390×844 without horizontal overflow; islands remain tappable (≥ 44 px targets).

## Acceptance
- Preview fixtures + `tools/voyage-ui-check.mjs` cases for: start of run, mid-run with skipped branches, harbour + storm nodes, finale with boss and confiscation, lookahead 2 vs 3, read-only mid-board, sail-off (mid-animation frame), docking — at 1024×768 and 390×844, no console errors, no overflow. Review every screenshot yourself and iterate until it looks like a polished, cohesive painted chart.
- A real browser run on port 8170: start a Voyage, pick a node, confirm the sail animation overlaps dealing (measure: time from click to board intro should not exceed today's by more than ~0.3 s when the deal is already prepared), and that reduced motion skips it.
- `docs/voyage/overhaul/CHART-report.md`: what you built, art inventory + generation command, screenshots list, anything deferred.

When done, reply with a short summary and the report path.
