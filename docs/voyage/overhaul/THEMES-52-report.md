# Final 52-theme implementation report

October 13, 2026. Implements [ROSTER-52.md](ROSTER-52.md) within the theme/art/audio/document ownership boundary.

## Roster and compatibility

Added Signal (`signal`), Roller Rink (`rink`), The Darkroom (`darkroom`), Smoke Watch (`smokewatch`), Bloodmoon (`bloodmoon`), Deep Sea (`deepsea`), Plaster Studio (`plaster`), Backrooms (`backrooms`), Vaporwave (`vaporwave`) and Silent Cinema (`cinema`) to `WORLDS`.

`THEME_ORDER` has **52 unique ids**: the original 48, minus `space`, `varsity`, `nighttrain`, `driftwood`, `keep`, `canopy`, plus these ten. All six retired definitions and their assets remain available for old settings. Expansion order filters its three retired entries; core order omits its three. Classic picker and random selection consume that order. Browser checks confirmed all six saved settings render their old theme and an unknown theme falls back to Neo-Classical. A 10,000-selection check stayed in the active pool.

No changes to `js/main.js`, `js/voyage/**`, `sw.js` or `js/table.js` were made for this work. No git checkout, stash, reset, clean or commit was run. Concurrent agents' changes were left intact.

## Palettes

Colors follow the palette notes used by `tools/gen-locked-themes.mjs`. Light faces keep dark indices readable; the lowest paper/standard-suit contrast is **4.69:1**. Lighting is predominantly neutral warm key light plus a subdued thematic fill, with modest bloom so colored settings do not wash out card ranks. Deep Sea adds bubbles and subtle existing edge-caustic support; all others use low-count motes.

| Theme | Font | Background / panel | Accent / secondary | Paper | Ink / red | Rail / inlay | Particles |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Signal | Antonio | `#101827` / `#1c2838` | `#e5b263` / `#a8c7df` | `#f6f3e8` / `#e1e5e6` | `#172436` / `#a6323f` | `#303b48` / `#b88741` | motes |
| Roller Rink | Josefin Sans | `#291c2d` / `#39283d` | `#f1b5d4` / `#86d7d1` | `#fff6e8` / `#eadfc9` | `#2c2334` / `#aa2d60` | `#713652` / `#becbd1` | motes |
| The Darkroom | Antonio | `#170e10` / `#29181b` | `#ee8c80` / `#c1c4c7` | `#fcf1de` / `#e8dcc5` | `#241a1b` / `#a32936` | `#68232e` / `#a5a8ad` | motes |
| Smoke Watch | Antonio | `#252d2e` / `#313b3c` | `#e7b177` / `#a4b8d0` | `#fff2db` / `#e8dcc4` | `#26332e` / `#a33e33` | `#514d42` / `#b6864c` | motes |
| Bloodmoon | Cinzel | `#1d151c` / `#30212a` | `#e0b278` / `#c77887` | `#faefda` / `#e4d4ba` | `#281d22` / `#98283d` | `#492632` / `#b18d56` | motes |
| Deep Sea | Cormorant Garamond | `#0c202b` / `#173440` | `#8fdee4` / `#e6b4c4` | `#f4f5e9` / `#dfe9df` | `#16303c` / `#a53357` | `#495347` / `#bda06b` | bubbles |
| Plaster Studio | Cormorant Garamond | `#373738` / `#484444` | `#f0d3bd` / `#becbd4` | `#fffbf1` / `#eee7da` | `#353438` / `#a14349` | `#ae8277` / `#be9d86` | motes |
| Backrooms | Antonio | `#373326` / `#484231` | `#e9d492` / `#cad4ae` | `#fff7dc` / `#eee3bd` | `#343226` / `#963d3e` | `#968650` / `#d1be7b` | motes |
| Vaporwave | Josefin Sans | `#36253e` / `#49334e` | `#f2b3cf` / `#8cddd9` | `#fff8ee` / `#efdfdf` | `#2b3349` / `#ad3069` | `#7c526f` / `#73bfc5` | motes |
| Silent Cinema | Josefin Sans | `#201c20` / `#302730` | `#e0c28c` / `#bec8d2` | `#fff4df` / `#e8ddc8` | `#262329` / `#a03147` | `#612e3c` / `#b99b60` | motes |

Machine-readable values and contrast measurements: [theme-palettes.json](themes-52-review/theme-palettes.json).

## Art

Copied all three alias source folders, preserving the originals: `lookout` → `smokewatch`, `castle` → `bloodmoon`, `bathysphere` → `deepsea`. The seven same-id folders already held the approved masters, so were reused in place without overwriting their originals. Selected final heroes: `lookout/hero-smoke.png`, `castle/hero-distant.png`, `bathysphere/hero-deepsea.png`, and reframed `plaster/hero.png`; the other six use `hero.png`.

Ran `bash tools/optimize-assets.sh <id>` for each of the ten ids. Each serving folder contains nine WebPs: backdrop, environment, board, back, J/Q/K courts, hero and thumb. The existing optimizer needed no changes. Reviewed all ten thumbs, heroes, boards and backs together: [art contact sheet](themes-52-review/art-contact-sheet.jpg).

## Audio

Added ten original theme prompt sets to `tools/sfx-manifest.mjs`. Generated via ElevenLabs using the existing owner-authorized key-loading mechanism; no credentials were copied into the checkout or report.

```
node tools/gen-sfx.mjs --themes=signal,rink,darkroom,smokewatch,bloodmoon,deepsea,plaster,backrooms,vaporwave,cinema
node tools/gen-sfx.mjs --music --themes=signal,rink,darkroom,smokewatch,bloodmoon,deepsea,plaster,backrooms,vaporwave,cinema
```

Ten music tracks and forty sound effects. Music: about 90 seconds / 1.44 MB each. UI: 0.48 seconds / 8,821 bytes; chime: 2 seconds / 33,062 bytes; win: 6 seconds / 97,010 bytes; ambience: 20 seconds / 321,036 bytes. All fifty files have valid MP3 streams at 44.1 kHz, matching the existing runes template. [Audio sizes, durations and codec details](themes-52-review/audio-files.json).

## Sea-chart islands

Generated only the ten new islands with `tools/gen-chart-art.mjs --only=<ten ids>`, using **gemini-nano-banana-2.1** and the unchanged shared nautical-gouache prompt. No pre-existing island assets or generator code were edited. The masters are in `assets-src/art/chart/islands/<id>.png`; serving sprites are transparent 256 × 256 WebPs, all under 19 KB, comfortably below 60 KB.

Reviewed the ten beside eight existing islands (roman, cyber, aero, zen, library, cafe, runes, arctic). Refined Signal and Roller Rink's tagline cues to explicitly mention the radio dish and mirror ball, then regenerated those two. Signal's second image had tiny disconnected outer paper-line fragments; its serving sprite retains the principal alpha component and soft edge, with a 224px maximum object dimension centered on a 256px transparent canvas. The painted master remains available. The final prompt set is preserved in [island-prompts.json](themes-52-review/island-prompts.json). The final comparison has matching angle, compact footprint and painterly detail: [island contact sheet](themes-52-review/islands-contact-sheet.jpg).

## Verification and review captures

Reviewed all ten final dealt-table screenshots individually. Cards and controls are readable. [Table contact sheet](themes-52-review/tables-contact-sheet.jpg) · [title contact sheet](themes-52-review/titles-contact-sheet.jpg) · [final capture log](themes-52-review/final-captures.log).

Served on port **8172**: [remote preview](https://kaena--8172.getbb.app).

All ten final themes passed live loading checks with **no 404s, console errors or page errors**: [results.json](themes-52-review/results.json) and [loading-check.log](themes-52-review/loading-check.log). Each loaded nine images, five decoded audio buffers and its existing font. These final loading checks use Low quality for a short repeatable run. Captures use headless Chrome with SwiftShader, Medium quality, reduced motion, Classic mode, at 1280 × 800. Rank bounds passed for all 52 cards in standard, four-color, high-contrast, and combined modes: 416 index checks per theme ([capture log](themes-52-review/cards-and-captures.log)). Dealt-board captures check that card faces visibly render. Final pale-surface and cinema capture results are in [slot-review.json](themes-52-review/slot-review.json). Pale Plaster, Backrooms and Vaporwave surfaces received darker slot outlines and bullseyes plus darker, stronger foundation suit marks through optional world palette fields; the existing texture support supplies those marks without a table/texture code change.

| Theme | Table | Title | Card faces and back |
| --- | --- | --- | --- |
| Signal | [table](themes-52-review/signal-game.png) | [title](themes-52-review/signal-title.png) | [cards](themes-52-review/signal-cards.png) |
| Roller Rink | [table](themes-52-review/rink-game.png) | [title](themes-52-review/rink-title.png) | [cards](themes-52-review/rink-cards.png) |
| The Darkroom | [table](themes-52-review/darkroom-game.png) | [title](themes-52-review/darkroom-title.png) | [cards](themes-52-review/darkroom-cards.png) |
| Smoke Watch | [table](themes-52-review/smokewatch-game.png) | [title](themes-52-review/smokewatch-title.png) | [cards](themes-52-review/smokewatch-cards.png) |
| Bloodmoon | [table](themes-52-review/bloodmoon-game.png) | [title](themes-52-review/bloodmoon-title.png) | [cards](themes-52-review/bloodmoon-cards.png) |
| Deep Sea | [table](themes-52-review/deepsea-game.png) | [title](themes-52-review/deepsea-title.png) | [cards](themes-52-review/deepsea-cards.png) |
| Plaster Studio | [table](themes-52-review/plaster-game.png) | [title](themes-52-review/plaster-title.png) | [cards](themes-52-review/plaster-cards.png) |
| Backrooms | [table](themes-52-review/backrooms-game.png) | [title](themes-52-review/backrooms-title.png) | [cards](themes-52-review/backrooms-cards.png) |
| Vaporwave | [table](themes-52-review/vaporwave-game.png) | [title](themes-52-review/vaporwave-title.png) | [cards](themes-52-review/vaporwave-cards.png) |
| Silent Cinema | [table](themes-52-review/cinema-game.png) | [title](themes-52-review/cinema-title.png) | [cards](themes-52-review/cinema-cards.png) |

Saved-setting results: [saved-settings.json](themes-52-review/saved-settings.json). The first browser run was interrupted by the local server exiting. A longer combined capture run was also terminated before its final table; verification was completed in shorter loading and capture runs, and all ten final screenshots were reviewed.

`node tools/rules-check.mjs` passed ([full log](themes-52-review/rules-check.log)), including generator/player agreement and undo over 40 rulesets, replay/undo of 28 restricted full-deck solutions, dealer/hint worker protocols, and the Classic baseline over 58 deals.

## Documentation

Updated README to list all 52 active themes, including the three previously missing existing worlds (Arctic Station, Fossil Hall and The Mint). Added final production briefs and [parked-themes.md](../../parked-themes.md), covering the six retirements and all nine set-aside review ideas. Source art and previews remain intact.

## Service worker handoff — 150 new served paths

`sw.js` is owned elsewhere and was left untouched. Add the following paths to its asset handling as appropriate. Also available one path per line in [sw-new-assets.txt](themes-52-review/sw-new-assets.txt). Existing retired assets should remain accessible to saved settings.

```text
assets/art/signal/board.webp
assets/art/signal/backdrop.webp
assets/art/signal/env.webp
assets/art/signal/back.webp
assets/art/signal/hero.webp
assets/art/signal/thumb.webp
assets/art/signal/court_j.webp
assets/art/signal/court_q.webp
assets/art/signal/court_k.webp
assets/music/signal.mp3
assets/sfx/signal_ui.mp3
assets/sfx/signal_chime.mp3
assets/sfx/signal_win.mp3
assets/sfx/signal_ambience.mp3
assets/art/chart/islands/signal.webp
assets/art/rink/board.webp
assets/art/rink/backdrop.webp
assets/art/rink/env.webp
assets/art/rink/back.webp
assets/art/rink/hero.webp
assets/art/rink/thumb.webp
assets/art/rink/court_j.webp
assets/art/rink/court_q.webp
assets/art/rink/court_k.webp
assets/music/rink.mp3
assets/sfx/rink_ui.mp3
assets/sfx/rink_chime.mp3
assets/sfx/rink_win.mp3
assets/sfx/rink_ambience.mp3
assets/art/chart/islands/rink.webp
assets/art/darkroom/board.webp
assets/art/darkroom/backdrop.webp
assets/art/darkroom/env.webp
assets/art/darkroom/back.webp
assets/art/darkroom/hero.webp
assets/art/darkroom/thumb.webp
assets/art/darkroom/court_j.webp
assets/art/darkroom/court_q.webp
assets/art/darkroom/court_k.webp
assets/music/darkroom.mp3
assets/sfx/darkroom_ui.mp3
assets/sfx/darkroom_chime.mp3
assets/sfx/darkroom_win.mp3
assets/sfx/darkroom_ambience.mp3
assets/art/chart/islands/darkroom.webp
assets/art/smokewatch/board.webp
assets/art/smokewatch/backdrop.webp
assets/art/smokewatch/env.webp
assets/art/smokewatch/back.webp
assets/art/smokewatch/hero.webp
assets/art/smokewatch/thumb.webp
assets/art/smokewatch/court_j.webp
assets/art/smokewatch/court_q.webp
assets/art/smokewatch/court_k.webp
assets/music/smokewatch.mp3
assets/sfx/smokewatch_ui.mp3
assets/sfx/smokewatch_chime.mp3
assets/sfx/smokewatch_win.mp3
assets/sfx/smokewatch_ambience.mp3
assets/art/chart/islands/smokewatch.webp
assets/art/bloodmoon/board.webp
assets/art/bloodmoon/backdrop.webp
assets/art/bloodmoon/env.webp
assets/art/bloodmoon/back.webp
assets/art/bloodmoon/hero.webp
assets/art/bloodmoon/thumb.webp
assets/art/bloodmoon/court_j.webp
assets/art/bloodmoon/court_q.webp
assets/art/bloodmoon/court_k.webp
assets/music/bloodmoon.mp3
assets/sfx/bloodmoon_ui.mp3
assets/sfx/bloodmoon_chime.mp3
assets/sfx/bloodmoon_win.mp3
assets/sfx/bloodmoon_ambience.mp3
assets/art/chart/islands/bloodmoon.webp
assets/art/deepsea/board.webp
assets/art/deepsea/backdrop.webp
assets/art/deepsea/env.webp
assets/art/deepsea/back.webp
assets/art/deepsea/hero.webp
assets/art/deepsea/thumb.webp
assets/art/deepsea/court_j.webp
assets/art/deepsea/court_q.webp
assets/art/deepsea/court_k.webp
assets/music/deepsea.mp3
assets/sfx/deepsea_ui.mp3
assets/sfx/deepsea_chime.mp3
assets/sfx/deepsea_win.mp3
assets/sfx/deepsea_ambience.mp3
assets/art/chart/islands/deepsea.webp
assets/art/plaster/board.webp
assets/art/plaster/backdrop.webp
assets/art/plaster/env.webp
assets/art/plaster/back.webp
assets/art/plaster/hero.webp
assets/art/plaster/thumb.webp
assets/art/plaster/court_j.webp
assets/art/plaster/court_q.webp
assets/art/plaster/court_k.webp
assets/music/plaster.mp3
assets/sfx/plaster_ui.mp3
assets/sfx/plaster_chime.mp3
assets/sfx/plaster_win.mp3
assets/sfx/plaster_ambience.mp3
assets/art/chart/islands/plaster.webp
assets/art/backrooms/board.webp
assets/art/backrooms/backdrop.webp
assets/art/backrooms/env.webp
assets/art/backrooms/back.webp
assets/art/backrooms/hero.webp
assets/art/backrooms/thumb.webp
assets/art/backrooms/court_j.webp
assets/art/backrooms/court_q.webp
assets/art/backrooms/court_k.webp
assets/music/backrooms.mp3
assets/sfx/backrooms_ui.mp3
assets/sfx/backrooms_chime.mp3
assets/sfx/backrooms_win.mp3
assets/sfx/backrooms_ambience.mp3
assets/art/chart/islands/backrooms.webp
assets/art/vaporwave/board.webp
assets/art/vaporwave/backdrop.webp
assets/art/vaporwave/env.webp
assets/art/vaporwave/back.webp
assets/art/vaporwave/hero.webp
assets/art/vaporwave/thumb.webp
assets/art/vaporwave/court_j.webp
assets/art/vaporwave/court_q.webp
assets/art/vaporwave/court_k.webp
assets/music/vaporwave.mp3
assets/sfx/vaporwave_ui.mp3
assets/sfx/vaporwave_chime.mp3
assets/sfx/vaporwave_win.mp3
assets/sfx/vaporwave_ambience.mp3
assets/art/chart/islands/vaporwave.webp
assets/art/cinema/board.webp
assets/art/cinema/backdrop.webp
assets/art/cinema/env.webp
assets/art/cinema/back.webp
assets/art/cinema/hero.webp
assets/art/cinema/thumb.webp
assets/art/cinema/court_j.webp
assets/art/cinema/court_q.webp
assets/art/cinema/court_k.webp
assets/music/cinema.mp3
assets/sfx/cinema_ui.mp3
assets/sfx/cinema_chime.mp3
assets/sfx/cinema_win.mp3
assets/sfx/cinema_ambience.mp3
assets/art/chart/islands/cinema.webp
```

## Limits / anything off

Vaporwave’s decorative inset crosses the upper slot band; the final darker slot outlines and suit marks keep it readable. These captures verify software rendering; real-GPU/mobile performance and Ultra quality were not assessed. `tools/expansion-check.mjs` still assumes the original expansion art manifest has seven generation prompts per theme; the final art set instead uses approved locked masters. Browser QA used a temporary copy of that helper with the obsolete manifest assertion removed and port 8172 configured, leaving the helper itself unchanged. `package.json` still has a stale historical theme count in its description; it is outside this task's file ownership.
