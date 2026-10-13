# CHART — painted Voyage sea chart

Replaces the rectangle-and-line map with a 2D painted chart: themed islands, dashed sea lanes, a boat at the player’s position, and fog sitting on the lookout edge.

## What shipped

- `js/voyage/chart.js` — layout (seeded jitter, family clustering, landscape L→R / portrait bottom→top), SVG lanes, island buttons, sail-along-path (~1.45 s, skippable), docking lantern beat (≤1 s).
- `js/voyage/ui.js` — `showMap` / `hideMap` / detail “Set course”, second-tap commit, arrow keys among available islands, Enter to commit, Esc/tap skip, `'map'` tutorial copy, `showDocking` before the harbour market.
- `js/main.js` — `voyagePickNode` waits on `Promise.all([dealFor(...), sailTo])` so the sail overlaps dealing; `voyageShowMap` runs the docking beat when `status === 'port'`; `openMap` remains read-only.
- `css/voyage.css` — sea plate, drifting fog bank clipped to `--fog-edge`, harbour lantern, storm thunderhead, reduced-motion pauses.
- Art: `assets/art/chart/{sea,fog,boat}.webp` and `assets/art/chart/islands/{48 themes}.webp`, plus `islands-contact-sheet.webp`.
- `tools/gen-chart-art.mjs` (model **gemini-nano-banana-2.1**), `tools/knockout-chart.py` (parchment flood-fill to alpha).
- Preview fixtures + `tools/voyage-ui-check.mjs` chart cases (including `chart-late`, a board-6 map with full history); `sw.js` precaches the plate and 48 islands.

## Layout pass (second review)

Visible rows spread across the full chart (current near the start, finale toward the far edge). Islands are larger; names sit under the art; the per-island “Available route” kicker is gone. Sea lanes use a dark under-stroke plus gold dashes. Fog is a feathered, drifting bank past the last visible row, not a dashed rectangle.

Collision is a **bounded** relax: at most 4 sibling-separate passes and 4 pairwise uncollide passes (plus 2 after a clamp), nearest-row pairs only, with an early exit when a pass moves nothing. Render is re-entrancy-guarded and coalesces `resize` to one frame so a late-run map cannot lock the main thread. `chart-late` (5 visited/current, 6 skipped, Grand Port children, 4 finale-row islands) laid out in **1.6 ms** desktop / **0.4 ms** mobile (limit 50 ms).

## Art

Generation:

```
node tools/gen-chart-art.mjs
node tools/gen-chart-art.mjs --only=honeyhouse,moth,cutpaper,broadcast,sewing,risograph,runes
node tools/gen-chart-art.mjs --only=winterglass --force
python3 tools/knockout-chart.py assets-src/art/chart/fog.png assets-src/art/chart/boat.png assets-src/art/chart/islands/*.png
```

Serving WebPs are ≤ 40 KB per island (target was 60 KB at 2×). Winterglass was regenerated after an automatic “fog plate” knockout ate the first pass. Contact sheet: `assets/art/chart/islands-contact-sheet.webp`. Missing island files fall back to a tinted silhouette.

## Screenshots

All chart cases at 1024×768 and 390×844, no overflow, no console errors, island hit targets ≥ 44 px:

| File | Scene |
| --- | --- |
| `/tmp/chart-shots/chart-start-{desktop,mobile}.png` | Opening three routes |
| `/tmp/chart-shots/chart-mid-{desktop,mobile}.png` | Travelled path + skipped branches |
| `/tmp/chart-shots/map-storm-{desktop,mobile}.png` | Harbour + storm chips |
| `/tmp/chart-shots/map-confiscation-{desktop,mobile}.png` | Finale + confiscation |
| `/tmp/chart-shots/chart-lookahead-2-*.png` / `chart-lookahead-3-*.png` | Fog edge moves with Tuning lookout |
| `/tmp/chart-shots/chart-readonly-*.png` | Mid-board read-only (`Return to board`) |
| `/tmp/chart-shots/chart-sail-*.png` | Mid-sail frame |
| `/tmp/chart-shots/chart-docking-*.png` | Docking lantern |
| `/tmp/chart-shots/chart-late-*.png` | Board 6 with five visited islands, skipped branches, Grand Port children, finale in fog |
| `/tmp/chart-shots/live-intro-sail.png` | Live Voyage board intro after overlapping sail |

`tools/voyage-ui-check.mjs` chart cases + `chart-interactions` + `interactions` passed at both widths (prepared sail 192 ms desktop / 183 ms mobile after `finishSoon`; hover does not rewrite the sidebar; boss landmark inspects without Set course; desktop pan + ghost lanes + fog isles).

## Live run (port 8170)

Server: `node serve.mjs 8170`. Remote share: https://kaena--8170.getbb.app

Puppeteer on the real app: Begin Voyage → Set course.

- Animated pick → board intro: **3501 ms** (deal was the long pole; sail 1450 ms ran inside that wait).
- `settings.reducedMotion`: sail skipped (no `is-sailing` beat). A second fresh deal took 6776 ms — dealer variance, not added animation.
- Serial sail-then-deal would have been deal + ~1.45 s; overlapping `Promise.all` does not add the two waits. Tap/Esc still skip the boat.

## Designer pass (prior review)

Six notes, all on the painted chart (mobile unchanged except no-regression):

1. **Hover glow.** Island `transition` is `transform` + `opacity` only. Glow lives on `.voyage-island-glow` (opacity, no filter). Hover scales in place (`translate(-50%,-46%) scale(1.05)`), so the island does not jump or flash a filter glow.
2. **Challenge, not Rule/Curse.** Voyage UI labels every challenge as `Challenge` (`kindName`). Sidebar reads `Challenge · Strength N`. Island chips are icon-only. `pressure` is still on the charm data. HUD, intro, storm, and aria-labels match.
3. **Boss landmark.** `data-node="__boss__"` sits on the far horizon, labelled `Board 7 · Final boss`, with painted `assets/art/chart/boss-landmark.webp`. Click / focus / arrows inspect it; sidebar has no Set course; **Back to route** restores the next island. Does not change the committed course.
4. **Centering.** Opening map packs the live columns in the clear water (`choiceX` ≥ 156, span `(depth-1)*colGap`). Later maps keep current inset (`choiceX - 132`) with history on the left.
5. **Pan.** Desktop drag on the sea (not on `[data-node]`) and shift/trackpad wheel pan `--pan-x`. `user-select: none` so a drag does not highlight text. Dotted ghost lanes run into the fog with faint `fog-isle.webp` silhouettes. Pan right reaches the boss (`maxPan` > 40). Portrait still scrolls vertically; native `chartScroll` stays false.
6. **Hover vs click.** Island `pointerover` no longer calls `selectNode`. Hover only scales/glows; click and keyboard still update the sidebar.

Art: `node tools/gen-chart-art.mjs --only=boss-landmark,fog-isle` (model **gemini-nano-banana-2.1**), knockout, precache in `sw.js`.

Re-shot all `chart-*` / `map-storm` / `map-confiscation` cases at 1024×768 and 390×844 on port **8170**. Frames: start columns sit in the open water with fog teasers and a peek of the boss; mid/late keep current inset; sail is mid-lane; sidebar always `Challenge · Strength N`; mobile portrait still fits 390×844.

## Quality pass — 2026-10-13 (port 8171)

The prior designer pass above is historical; this pass supersedes its compressed history, offscreen boss placement, and fog-isle export.

- **Transparent fog silhouettes:** repaired `fog-isle.webp` from the existing master. Cloud wisps use a lightness mask; island silhouettes now use a separate darkness mask and a uniform fog-teal tint. All four image edges have alpha **0**, with soft alpha around the painted land. The serving asset is **16,242 bytes**. `gen-chart-art.mjs --reprocess-only` repairs exports without an API key or image-generation request; special-asset knockout operates on temporary copies, preserving masters.
- **Readable history and names:** every landscape column has a fixed **160 px** pitch. Earlier boards extend left instead of collapsing into 46 px gaps. Entry pan frames the current position and choices; board 7 frames the previous/current columns. The first two live columns use the viewport height even when a deeper lookout needs a tall scrollable column. Names wrap naturally to two lines in independent label space; no ellipsis or hidden text. Visited/skipped islands retain readable labels and visibly faded art. Dense lookout spacing reserves room for both name lines and hover growth.
- **Boss home:** a sticky chart horizon holds the painted landmark, icon, boss name, and fully readable **Board 7 · Final boss** label. It stays visible at entry and during horizontal/vertical panning, with a compact horizontal arrangement on phones. Islands scroll beneath a separate horizon area, so distant columns cannot overlap the boss label. Click and keyboard inspect it; **Back to route** restores the exact previously inspected route. Boss sidebar art and heading use separate layout space on both sizes. Mobile theme headers size to their text so long taglines cannot cut off the board kicker.
- **Pan and hover:** drags can start on sea or islands. Pointer focus is deferred until the gesture is classified; crossing the 7 px drag threshold pans and suppresses selection/commit. Click, double tap, arrows, Enter, shift-wheel, and trackpad gestures remain functional. Hover leaves the sidebar unchanged. Available-island glow stays at constant opacity and colour while the island grows to **1.05×**; image filters never transition. Unknown sea lanes have an SVG opacity fade into fog. Teasers/ghost lanes end at the final row; the board-7 read-only caption reads “Final table reached.”
- **Mobile:** retained bottom-to-top routing, vertical scrolling, and at least 44 px hit targets. Tighter island bands leave space for the fixed boss horizon and the starting boat without label collisions.

Reproduce the asset repair and the complete capture/check run:

```sh
node tools/gen-chart-art.mjs --only=fog-isle --reprocess-only
node serve.mjs 8171
VOYAGE_TEST_URL=http://localhost:8171 VOYAGE_SHOTS=/tmp/chart-polish node tools/voyage-ui-check.mjs chart
```

### Current screenshots

Every primary scene is captured at **1024×768** (`desktop`) and **390×844** (`mobile`). All files below are under `/tmp/chart-polish/` and have been visually reviewed, including horizon/history frames.

| Primary file pair (`{desktop,mobile}`) | Scene |
| --- | --- |
| `chart-start-{desktop,mobile}.png` | Start, all full island names and visible boss |
| `chart-mid-{desktop,mobile}.png` | Current position, choices, travelled/skipped route |
| `map-storm-{desktop,mobile}.png` | Harbour and storm challenge icons |
| `map-confiscation-{desktop,mobile}.png` | Board-7 read-only with confiscation |
| `chart-lookahead-2-{desktop,mobile}.png` | Standard lookout |
| `chart-lookahead-3-{desktop,mobile}.png` | Extended lookout |
| `chart-lookahead-4-{desktop,mobile}.png` | Dense lookout, scrollable distant columns |
| `chart-readonly-{desktop,mobile}.png` | Mid-board read-only |
| `chart-sail-{desktop,mobile}.png` | Paused mid-sail frame |
| `chart-docking-{desktop,mobile}.png` | Dock and lantern arrival |
| `chart-late-{desktop,mobile}.png` | Board 6, history extends off left |
| `chart-board7-readonly-{desktop,mobile}.png` | Explicit final-table read-only fixture |
| `chart-boss-selected-{desktop,mobile}.png` | Boss inspected from opening view |

Additional captures:

- Each mobile primary scene also has a `-horizon.png` capture; desktop lookout 4 has one too.
- History frames cover every travelled column at successive pan/scroll positions. Desktop capture stops align with the 160 px columns so viewport edges fall between names:

  | File pattern | Desktop `N` | Mobile `N` |
  | --- | --- | --- |
  | `chart-mid-{desktop,mobile}-history-N.png` | 1–2 | 1–3 |
  | `chart-late-{desktop,mobile}-history-N.png` | 1–3 | 1–4 |
  | `map-confiscation-{desktop,mobile}-history-N.png` | 1–3 | 1–3 |
  | `chart-board7-readonly-{desktop,mobile}-history-N.png` | 1–3 | 1–3 |
  | `k2b-map-confiscation-{desktop,mobile}-history-N.png` | 1–3 | 1–3 |

- Legacy aliases `k2b-map-storm-{desktop,mobile}.png` and `k2b-map-confiscation-{desktop,mobile}.png` were re-shot too, including mobile horizons and confiscation history frames.
- `hover-00.png` through `hover-08.png`: short actual hover frame sequence; `hover-contact-sheet.png`: visual review sheet; `hover-measurements.json`: per-animation-frame scale, glow colour/opacity, and image-filter measurements.
- `check.log`: full capture/check output; `mobile-check.log`: final adaptive mobile-header captures; `gesture-check.log`: final island/boss drag checks; `history-check.log`: aligned desktop history captures. `fog-alpha-preview.png`: repaired silhouette composited onto chart-coloured water for alpha QA.

### Verification

**Passed:** 30 primary screenshots, 16 horizon captures, 30 history captures, and the nine-frame hover image sequence, all reviewed. The final hover recording sampled **11 animation frames over 434 ms**: scale **1.000→1.050**, glow opacity **1.0** throughout, exactly one glow-gradient value and one image-filter value. No glow flash in the recorded images. The final gesture checks finished prepared sailing in **186 ms desktop / 187 ms mobile**. JavaScript syntax checks pass for all changed modules.

The chart harness checks **all island pairs** for overlapping bounds, full label content for overflow/ellipsis, boss visibility, page/native horizontal overflow, hit-target size, asset failures, and runtime errors. It also verifies dragging from an island never inspects or commits, drag/shift/trackpad panning, keyboard boss access, exact route restoration, hover/sidebar independence, reduced motion, sail skip, docking, image fallback, and lookout fog movement. The hover sequence is inspected visually and the per-frame measurements assert monotonic 1.00→1.05 growth with an unchanged glow gradient/opacity and image filter.

## Deferred

- Charm icon 404s from parallel content work (`/assets/art/charms/*`) are ignored in the chart screenshot harness; they are not chart assets.
- Sailing runs for up to 1.45 s while the dealer prepares; `finishSoon` cuts the remaining sail to about 180 ms when the deal is ready. Theme load after the chart still sits after both promises, as it did before.
- A few island plates keep a faint watercolor halo after knockout; they sit on the sea without a paper square.
- Old unused `.voyage-node` tree CSS is still in `voyage.css` for other surfaces; the map no longer uses it.
