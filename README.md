# FreeCell Worlds

FreeCell Worlds — FreeCell in three.js with eleven fully themed tables, spring-physics cards, positional sound, post-processing, a built-in solver and an installable PWA shell.

```
npm run serve        # http://localhost:8080  (any static server works)
```

## Themes

| Theme | Look | Ambient effect | Sound |
| --- | --- | --- | --- |
| **Neo-Classical** | black marble + gold meander, gold-statue court cards | dust motes | bronze-bell chimes, harp/lyre, temple ambience |
| **Neon Grime** | wet carbon + neon circuitry, glowing card faces | rain | synth plucks, synthwave, rainy-city ambience |
| **Ocean Aero** | glossy aqua water + caustics, dolphin court cards | bubbles | marimba/glass chimes, lounge chillout, lagoon |
| **Zen Garden** | raked gravel inside a vermilion lacquer ring, ukiyo-e court cards | falling cherry petals | singing-bowl chimes, koto + shakuhachi, bamboo-fountain garden |
| **Enchanted Forest** | mossy forest floor with glowing runes and mushrooms, storybook court | fireflies | celesta/music-box, harp + flute, night-forest ambience |
| **Art Deco** | black-emerald lacquer with brass sunbursts, jazz-age court | rising champagne bubbles | vibraphone, 1920s swing, speakeasy room tone |
| **Día de Muertos** | embroidered indigo cloth, papel picado, sugar-skull court, candle flicker | marigold petals | hand bell, nylon guitar + marimba, candlelit ofrenda |
| **Deep Space Station** | bright starship observation lounge, holo-table with scan sweep | twinkling stars | clean synth chirps, sci-fi strings, bridge hum |
| **Azulejo** | ivory ceramic + cobalt tile border, hand-painted blue maritime court | sparse cool dust motes | porcelain chimes, Portuguese guitar, seaside courtyard |
| **Jet Set** | powder-blue laminate + walnut, 1960s travel-poster court | sparse warm dust motes | cabin bell, bossa nova lounge, quiet airport |
| **Riverboat Royale** | bottle-green felt + mahogany and brass, engraved Victorian court | lamplit dust motes + gentle lamp flicker | chip clinks, saloon piano + fiddle, paddle-steamer river ambience |

Themes live in `js/themes.js` (palette, card style, lighting, bloom, materials, art + audio names). Adding one means: an entry in `js/themes.js`, prompts in `tools/art-manifest.mjs` and `tools/sfx-manifest.mjs`, then `node tools/gen-art.mjs`, `node tools/gen-sfx.mjs`, `node tools/gen-sfx.mjs --music`, `bash tools/optimize-assets.sh`. Fonts are declared in `css/style.css`; UI skinning is `body[data-theme=…]` rules at the end of that file.

## Architecture

| File | Role |
| --- | --- |
| `js/main.js` | scene, theme manager, input, game flow, win cascade, adaptive quality |
| `js/table.js` | per-theme table layer: surface, rails, inlays, slots, ambient effects |
| `js/textures.js` | card faces/backs (court art composed double-ended), surface + normal maps, slot pads |
| `js/card.js` | bevelled card mesh, physical materials, paper normal map, neon emissive faces |
| `js/animation.js` | tween engine + `CardMotion` spring system (overshoot, lean, landing/flip hooks) |
| `js/post.js` | composer: bloom, tone-mapped output, vignette/grain/aberration (+ optional GTAO) |
| `js/fx.js` | pooled additive particles, expanding rings, flash light |
| `js/audio.js` | Web Audio engine: variants + pitch jitter, stereo pan, rising foundation chimes, theme loops |
| `js/ui.js`, `js/stats.js`, `js/store.js` | title screen, HUD, modals, toasts; stats/achievements/daily; persistence |
| `js/rules.js`, `js/solver.worker.js` | game rules and solver (unchanged) |
| `sw.js`, `manifest.webmanifest` | offline + installable |

## Auto-play to foundations

Settings → Gameplay → *Auto-play to foundations* (on by default). A card goes home on its own when it is the next card its foundation needs **and** it is *safe*: its rank is at most 2, or both opposite-colour foundations already hold rank ≥ (rank − 1), so nothing left on the table can still need it as a base. Only column tops and free cells are considered (`safeFoundationMoves` in `js/rules.js`).

Because that rule alone can stall in cross-blocked endgames (e.g. an unsafe 8♥ sitting on the 3♠ you need), there is one extension under the same toggle: once foundation moves *alone* can clear the whole table, the win is guaranteed and order-independent, so the remaining cards are played out (`canFinishWithFoundationOnly`).

Auto-played moves are tagged in the history: **Undo** takes them back together with the move that triggered them, and the Moves counter and stats only count the player's own moves. Auto-play pauses while a card is held, during the deal and during auto-solve.

## Quality tiers

`Settings → Quality`: **Auto** starts at High (Medium on touch devices) and steps down when frames average over ~26 ms — resolution first, then post-processing.

- **Ultra** — adds GTAO ambient occlusion. *Experimental:* on a software (SwiftShader) renderer it produced a dark rectangle artifact I could not trace; it was never verified on a real GPU, so it is opt-in and never chosen by Auto.
- **High** — bloom + MSAA render target + finishing pass.
- **Medium** — as High with a lower pixel-ratio cap.
- **Low** — direct render, no post-processing.

## Generating assets

Keys are read at run time from `FREECELL_ENV`, `~/Documents/mahjpods/.env`, or `./.env` and are never written into this repo. Needs `GEMINI_API_KEY` and `ELEVENLABS_API_KEY`.

```
node tools/gen-art.mjs [filter] [--force]   # Gemini images -> assets-src/art/<theme>/<id>.png
bash tools/optimize-assets.sh               # -> compressed WebP in assets/art/
node tools/gen-sfx.mjs [filter] [--force]   # ElevenLabs sound effects -> assets/sfx
node tools/gen-sfx.mjs --music [theme]      # ElevenLabs music -> assets/music
```

Prompts live in `tools/art-manifest.mjs` and `tools/sfx-manifest.mjs`. Existing files are skipped unless `--force` is given. `assets-src/` holds the full-resolution originals (~58 MB) outside the served tree.

`tools/shoot.mjs` is a dev helper that drives the game in headless Chrome and saves screenshots (`node tools/shoot.mjs game cyber`).

## Not done / ideas

- Depth-of-field and PCSS shadows.
- KTX2/Basis texture compression (assets are WebP via canvas).
- Per-suit court art (currently one J/Q/K image per theme, tinted per suit).
- Real-GPU verification of the Ultra tier and mobile performance.
