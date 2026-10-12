# FreeCell Worlds

FreeCell Worlds — FreeCell in three.js with forty-two fully themed tables, spring-physics cards, positional sound, post-processing, a built-in solver and an installable PWA shell.

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
| **Coastal Carvings** | dark cedar + painted relief, original raven/bear/orca carvings for the court | sparse dust motes | wooden chimes, sparse marimba + strings, rainy coastal pavilion |
| **Varsity Club** | navy wool + stitched cream and oxblood leather, vintage athletic-poster court | warm dust motes | vibraphone, relaxed brass + piano, distant stadium atmosphere |
| **Driftwood Bay** | weathered timber + slate-blue paint, pen-and-watercolor fishing-village court | soft water reflections + cool motes | buoy-bell chimes, fingerpicked guitar + felt piano, quiet fishing harbor |
| **Camp Pinecone** | pine-green canvas + cedar and rope, vintage outdoor field-guide court | warm motes + gentle campfire light | camp-bell chimes, acoustic guitar, crickets + lake water + campfire |
| **Winterglass** | midnight-blue frosted glass + crystal and silver, stained-glass fantasy court | cool luminous motes | crystal bells, celesta + harp + strings, airy ice-palace ambience |
| **Concrete Playground** | charcoal blacktop + coral/cobalt/yellow paint, streetwear poster court | sparse sunset motes | spray-can clicks, mellow instrumental hip-hop, distant city + basketball |
| **Midnight Library** | smoked oak + oxblood leather, engraved bookplate archive staff | lamplit motes | brass bell, felt piano + cello, rain on library windows |
| **Glasshouse Conservatory** | jade paint + verdigris iron, botanical watercolor gardeners | sparse pollen-colored motes | porcelain/harp notes, harp + piano, rain on glass |
| **Daylight Express** | sunlit walnut + burgundy wool and brass, railway-poster court | sparse warm motes | latch clicks, piano + bowed bass, muffled railway rhythm |
| **Saffron Court** | sunlit cedar + indigo textiles and pierced brass, artisan gouache court | warm motes | tea-cup chimes, plucked strings, quiet courtyard fountain |
| **Amber Harvest** | cider-brown pine + copper, agricultural-poster orchard workers | autumn-colored petals | copper bell, acoustic guitar + bass, orchard breeze |
| **Carnival Nocturne** | indigo canvas + candy-striped rails, fairground-poster court | golden motes | small bell, gentle carousel organ, quiet midway machinery |
| **Canyon Turquoise** | terracotta stone + turquoise inlay, artisan gouache court | sparse mineral-colored motes | stone chime, nylon guitar + strings, desert breeze |
| **Low Tide** | damp slate + oxidized pewter, naturalist field-guide court | faint edge caustics + cool motes | pewter bell, felt piano + harmonics, tidepool drips |
| **Between Shows** | matte-black stage + crimson rails, tactile wooden marionette court | spotlight dust | wooden-joint clicks, music box + pizzicato, backstage creaks |
| **Obsidian Forge** | matte basalt + iron and copper, etched metalworker court | ember-colored motes + perimeter glow | iron taps, low strings + dulcimer, banked furnace |
| **Frontier Saloon** | weathered oak + saddle leather, hand-tinted western woodcut court | warm dusty motes | wooden taps, upright piano + guitar, desert saloon ambience |
| **Pharaoh's Tomb** | dark sandstone + lapis and gold, painted tomb-portrait court | torchlit gold dust | gold bell, oud + ney, quiet burial chamber |
| **Canopy Station** | dark teak + field-green rails, naturalist watercolor biologists | humid daylight motes | brass bell, nylon guitar + flute, canopy drips |
| **Cherry Counter** | daylight grey laminate + cherry vinyl and chrome, mid-century diner poster court | daylight motes | coffee-cup tap, electric piano + guitar, quiet highway diner |
| **Treasure Cove** | salt-stained oak + rope and aged brass, engraved nautical-chart court | lantern-lit motes | ship's bell, concertina + guitar, sea-cave surf |
| **High Keep** | aged oak + crimson wool and iron, illuminated-manuscript court | hearth-lit motes + warm edge glow | bronze handbell, lute + recorder, banked hearth |
| **Deep Storage** | brushed concrete + gunmetal and hazard striping, classified-file court | halogen dust + tarp-glow accent light | sonar ping, analog synth + vibraphone, ventilation hum |
| **The Toy Box** | maple table + primary block rail, vintage toy-catalog court | afternoon motes | wooden-block tap, toy piano + glockenspiel, quiet playroom |
| **Prize Lights** | navy felt + bulb-colored rail, 1970s broadcast court | marquee motes + cyan accent light | podium tap, electric piano + light brass, hushed TV stage |
| **Safety Pin** | matte black stage paint + silver tape, photocopied club court | magenta-gel motes | bottle tap, dry snare + bass through a wall, club room tone |
| **Honey House** | amber table + black-and-yellow rail, dripping comb and bee courts | honey-gold light | hive-frame tap, solo cello, distant bees beyond the screen |

Themes live in `js/themes.js` (palette, card style, lighting, bloom, materials, art + audio names). Adding one means: an entry in `js/themes.js`, prompts in `tools/art-manifest.mjs` and `tools/sfx-manifest.mjs`, then `node tools/gen-art.mjs`, `node tools/gen-sfx.mjs`, `node tools/gen-sfx.mjs --music`, `bash tools/optimize-assets.sh`. Fonts are declared in `css/style.css`; UI skinning is `body[data-theme=…]` rules at the end of that file.

The expansion worlds are defined in `js/theme-expansion.js`, with generation prompts in `tools/expansion-content.mjs`. Both manifests include it automatically. Generation commands accept `--themes=library,conservatory,...` to limit work to an explicit set; existing assets are skipped unless `--force` is passed. `node tools/expansion-check.mjs` validates all new themes against a game server on port 8123 and saves review captures in `/tmp/freecell-expansion-qa`.

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

## Voyage mode

Voyage is a roguelite mode alongside Classic. It's a run of 7 boards across themed tables on a branching chart. Each cleared board earns 1–3 stars, and stars set how many of the table's three charms (boons) you can choose from. Charms last the whole run. Every table has a theme challenge that scales with the board number, and the final board adds a boss challenge that's shown from the start. All boards share one undo budget: 5 to start, +3 per cleared board. There are no restarts, and abandoning a board or reaching an unwinnable position with no undos left ends the run. A Daily Voyage uses a date seed, and runs are saved after every move.

| File | Role |
| --- | --- |
| `js/voyage/run.js` | run state machine (map → board → reward), `runView` view model, saving |
| `js/voyage/map.js` | 7-row chart: 3 starting tables, 2 links per node, rows generated two ahead so no theme repeats on a path |
| `js/voyage/charms.js` | charm registry and hooks (`rules`, `ease`, `setup`, `score`, `on.*`, `onPick`), board composition, placeholder content |
| `js/voyage/scoring.js` | score breakdown (cards, efficiency vs par, free-cell use, chains) and stars |
| `js/voyage/dealer.js` | picks deals from the seed bank for a board's tier, rules and charm ease; background preparation |
| `js/voyage/ui.js`, `css/voyage.css` | chart, HUD, intro, results and charm picks, run end, tutorial, stats tab |
| `js/voyage/config.js` | tuning knobs (undos, tiers, compensation, scoring, star thresholds) |
| `js/difficulty.js`, `js/shortsolve.js`, `tools/seedbank/` | offline deal rating and seed-bank build (`assets/data/seedbank.json`) |

**Difficulty.** Voyage only deals deals from the pre-rated seed bank. Each deal's score combines the fewest free cells it needs (solver-proven), how deeply aces and twos are buried, and a near-best solver's move count. Board k is dealt from tier k. Charms that change free cells are rated exactly from bank data. Effects the solver can't model declare an `ease` in tiers, and the dealer offsets `VOYAGE.compensation` of the combined effect by picking a harder or easier deal. Par is the deal's solver move count × `SCORE.parFactor`. Rules the bank can't answer are checked with the solver in a duty-cycled background worker while the previous board is played.

The free-cell count is `state.free.length` throughout `js/rules.js`, and the table lays out 1–6 cells.

Each table has three boons and one scaling challenge. Boss designs are in `docs/voyage/boss-challenges.md`.

## Random themes

The home screen features three randomly selected themes per launch alongside Random theme. **All themes** opens the full, scrollable picker, also available from the in-game Themes button, with four tiles per row (two on narrow screens).

The home screen starts in **Random theme** mode by default. Settings → Gameplay → **Automatic random theme** chooses a different theme on launch and for each new deal, including Deal again after a win. Turn it off to keep the current theme; selecting a named theme also turns it off. Selecting Random theme turns it back on. Continuing a saved game preserves its theme.

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
