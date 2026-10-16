# FreeCell Worlds

FreeCell Worlds — FreeCell in three.js with fifty-two fully themed tables, spring-physics cards, positional sound, post-processing, a built-in solver and an installable PWA shell.

```
npm run serve        # http://localhost:8080  (any static server works)
```

## Themes

| Theme | Look | Ambient effect | Sound |
| --- | --- | --- | --- |
| **Neo-Classical** | black marble + gold meander, gold-statue court cards | dust motes | bronze-bell chimes, harp/lyre, temple ambience |
| **Neon Alley** | wet carbon + neon circuitry, glowing card faces | rain | synth plucks, synthwave, rainy-city ambience |
| **Bubble Lagoon** | glossy aqua water + caustics, dolphin court cards | bubbles | marimba/glass chimes, lounge chillout, lagoon |
| **Zen Garden** | raked gravel inside a vermilion lacquer ring, ukiyo-e court cards | falling cherry petals | singing-bowl chimes, koto + shakuhachi, bamboo-fountain garden |
| **Enchanted Forest** | mossy forest floor with glowing runes and mushrooms, storybook court | fireflies | celesta/music-box, harp + flute, night-forest ambience |
| **Art Deco** | black-emerald lacquer with brass sunbursts, jazz-age court | rising champagne bubbles | vibraphone, 1920s swing, speakeasy room tone |
| **Día de Muertos** | embroidered indigo cloth, papel picado, sugar-skull court, candle flicker | marigold petals | hand bell, nylon guitar + marimba, candlelit ofrenda |
| **Azulejo** | ivory ceramic + cobalt tile border, hand-painted blue maritime court | sparse cool dust motes | porcelain chimes, Portuguese guitar, seaside courtyard |
| **Jet Set** | powder-blue laminate + walnut, 1960s travel-poster court | sparse warm dust motes | cabin bell, bossa nova lounge, quiet airport |
| **Riverboat Royale** | bottle-green felt + mahogany and brass, engraved Victorian court | lamplit dust motes + gentle lamp flicker | chip clinks, saloon piano + fiddle, paddle-steamer river ambience |
| **Coastal Carvings** | dark cedar + painted relief, original raven/bear/orca carvings for the court | sparse dust motes | wooden chimes, sparse marimba + strings, rainy coastal pavilion |
| **Camp Pinecone** | pine-green canvas + cedar and rope, vintage outdoor field-guide court | warm motes + gentle campfire light | camp-bell chimes, acoustic guitar, crickets + lake water + campfire |
| **Winterglass** | midnight-blue frosted glass + crystal and silver, stained-glass fantasy court | cool luminous motes | crystal bells, celesta + harp + strings, airy ice-palace ambience |
| **Concrete Playground** | charcoal blacktop + coral/cobalt/yellow paint, streetwear poster court | sparse sunset motes | spray-can clicks, mellow instrumental hip-hop, distant city + basketball |
| **Lamplight Library** | smoked oak + oxblood leather, engraved bookplate archive staff | lamplit motes | brass bell, felt piano + cello, rain on library windows |
| **Glasshouse Conservatory** | jade paint + verdigris iron, botanical watercolor gardeners | sparse pollen-colored motes | porcelain/harp notes, harp + piano, rain on glass |
| **Saffron Court** | sunbaked amber cedar + saffron linen and golden brass, golden-hour artisan gouache court | warm motes | tea-cup chimes, plucked strings, quiet courtyard fountain |
| **Amber Harvest** | cider-brown pine + copper, agricultural-poster orchard workers | autumn-colored petals | copper bell, acoustic guitar + bass, orchard breeze |
| **Carnival Nocturne** | indigo canvas + candy-striped rails, fairground-poster court | golden motes | small bell, gentle carousel organ, quiet midway machinery |
| **Turquoise Canyon** | terracotta stone + turquoise inlay, artisan gouache court | sparse mineral-colored motes | stone chime, nylon guitar + strings, desert breeze |
| **Low Tide** | damp slate + oxidized pewter, naturalist field-guide court | faint edge caustics + cool motes | pewter bell, felt piano + harmonics, tidepool drips |
| **Backstage** | matte-black stage + crimson rails, tactile wooden marionette court | spotlight dust | wooden-joint clicks, music box + pizzicato, backstage creaks |
| **Obsidian Forge** | matte basalt + iron and copper, etched metalworker court | ember-colored motes + perimeter glow | iron taps, low strings + dulcimer, banked furnace |
| **Frontier Saloon** | weathered oak + saddle leather, hand-tinted western woodcut court | warm dusty motes | wooden taps, upright piano + guitar, desert saloon ambience |
| **Pharaoh's Tomb** | dark sandstone + lapis and gold, painted tomb-portrait court | torchlit gold dust | gold bell, oud + ney, quiet burial chamber |
| **Cherry Counter** | daylight grey laminate + cherry vinyl and chrome, mid-century diner poster court | daylight motes | coffee-cup tap, electric piano + guitar, quiet highway diner |
| **Treasure Cove** | salt-stained oak + rope and aged brass, engraved nautical-chart court | lantern-lit motes | ship's bell, concertina + guitar, sea-cave surf |
| **Hangar X** | brushed concrete + gunmetal and hazard striping, classified-file court | halogen dust + tarp-glow accent light | sonar ping, analog synth + vibraphone, ventilation hum |
| **First Pour** | deep teal + pale oak, white-tile specialty café and editorial coffee-professional court | sparse morning motes | ceramic saucer taps, guitar + piano + bass, quiet espresso-machine ambience |
| **Arctic Station** | snow-white aluminum + orange and steel-blue, expedition-poster court | aurora-lit motes | switch click, warm piano + glockenspiel, polar wind |
| **Fossil Hall** | dark museum stone + bone ivory and brass, engraved fossil-worker court | case-lit dust | plaque tap, strings + celesta, vast hall hush |
| **The Mint** | banknote green + gilt and lilac, steel-engraving court | warm proof-room dust | paper-weight tap, piano + strings, lamp hum |
| **The Toy Box** | maple table + primary block rail, vintage toy-catalog court | afternoon motes | wooden-block tap, toy piano + glockenspiel, quiet playroom |
| **Prize Wheel** | navy felt + bulb-colored rail, 1970s broadcast court | marquee motes + cyan accent light | podium tap, electric piano + light brass, hushed TV stage |
| **Basement Show** | matte black stage paint + silver tape, photocopied club court | magenta-gel motes | bottle tap, dry snare + bass through a wall, club room tone |
| **Honey House** | amber table + golden honey rim, dripping comb and bee courts | honey-gold light | hive-frame tap, solo cello, distant bees beyond the screen |
| **The Velvet Moth** | plum velvet + tarnished silver, moth aristocrats in extravagant collars | warm lamp motes | velvet tap, felt-piano waltz, quiet lounge |
| **Cut-Paper Kingdom** | layered cobalt paper + coral and butter scallops, paper-puppet court | falling paper scraps | paper tap, music box, quiet craft table |
| **Midnight Broadcast** | walnut console + amber lamps, television-headed broadcast court | amber indicator glow | switch click, electric piano, tape hiss |
| **The Giant's Sewing Box** | linen pincushion + oversized spools and buttons, embroidered court | afternoon dust | button click, nylon guitar, quiet sewing box |
| **Risograph Royalty** | warm paper + misregistered ink, halftone editorial court | sparse print-shop motes | ink-drum tap, dry electric piano, quiet press room |
| **Viking Runes** | weathered oak + iron rivets, wool-and-amber carver court | fjord-light ash motes | nail tap, tagelharpa, fire and distant water |
| **Radio Outpost** | charcoal metal + amber instruments, radio-observatory court | cold starlight motes | relay tap, analog synth + piano, observatory hum |
| **Roller Rink** | maple + magenta and silver facets, rink guard/skater/DJ court | disco-colored motes | skate-wheel tap, gentle disco, empty rink |
| **The Darkroom** | matte black + safelight red, photographic-printer court | muted safelight motes | tray tap, piano + bowed vibraphone, enlarger hum |
| **Smoke Watch** | weathered pine + smoke blue, lookout/ranger court | dusk motes | fire-finder click, guitar + low strings, cab wind + stove |
| **Blood Moon** | black oak + crimson and iron, gothic castle court | candlelit motes | iron latch, cello + harpsichord, stone-corridor wind |
| **Deep Sea** | blue-black brass + cyan and rose, diving-expedition court | bubbles + faint edge caustics | pressure-switch tap, glass harmonica + celesta, sphere hum |
| **Plaster Studio** | pale plaster + clay rim, sculptor/caster court | north-light dust | plaster tap, piano + viola, linen + window breeze |
| **Liminal Halls** | stained carpet + yellow wallpaper, uneasy office court | fluorescent dust | light-switch click, detuned piano + pads, ballast hum |
| **Vaporwave** | pink marble + teal checker, pastel mall court | pink sunset motes | cassette click, FM synth + electric piano, fountain + escalator |
| **Silent Cinema** | charcoal + velvet burgundy, usher/pianist/projectionist court | projector dust | lever click, silent-film piano + organ, quiet projector |

The active roster is `THEME_ORDER` in `js/themes.js`. Six retired tables retain definitions and assets for saved settings; see [parked themes](docs/parked-themes.md).

Themes live in `js/themes.js` (palette, card style, lighting, bloom, materials, art + audio names). Adding one means: a definition in `js/themes.js` or `js/theme-expansion.js`, an active roster entry, prompts in `tools/art-manifest.mjs` and `tools/sfx-manifest.mjs`, then `node tools/gen-art.mjs`, `node tools/gen-sfx.mjs`, `node tools/gen-sfx.mjs --music`, `bash tools/optimize-assets.sh`. Fonts are declared in `css/style.css`; UI skinning is `body[data-theme=…]` rules at the end of that file.

The expansion worlds are defined in `js/theme-expansion.js`, with generation prompts in `tools/expansion-content.mjs`. The original expansion manifests include it automatically. Final-roster art masters follow `tools/gen-locked-themes.mjs` and the hero selections in `docs/voyage/overhaul/ROSTER-52.md`; audio prompts are in `tools/sfx-manifest.mjs`. Generation commands accept `--themes=library,conservatory,...` to limit work to an explicit set; existing assets are skipped unless `--force` is passed. `node tools/expansion-check.mjs` validates the original expansion worlds against a game server on port 8123 and saves review captures in `/tmp/freecell-expansion-qa`. The locked final ten use approved source masters outside that original art manifest; their browser checks, captures and service-worker asset handoff are in [the 52-theme report](docs/voyage/overhaul/THEMES-52-report.md).

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
| `js/voyage/map.js` | 7-level branching tree: 3 opening tables, each table forks into 2 of its own, revealed two levels ahead. No theme is ever shown twice in a run (a run reveals 29 tables, so this needs ≥ 29 themes; with fewer it only avoids repeats along the route) |
| `js/voyage/charms.js` | charm registry and hooks (`rules`, `ease`, `setup`, `score`, `on.*`, `onPick`), board composition, placeholder content |
| `js/voyage/scoring.js` | score breakdown (cards, efficiency vs par, free-cell use, chains) and stars |
| `js/voyage/dealer.js` | picks deals from the seed bank for a board's tier, rules and charm ease; background preparation |
| `js/voyage/ui.js`, `css/voyage.css` | chart, HUD, intro, results and charm picks, run end, tutorial, stats tab |
| `js/voyage/config.js` | tuning knobs (undos, tiers, compensation, scoring, star thresholds) |
| `js/difficulty.js`, `js/shortsolve.js`, `tools/seedbank/` | offline deal rating and seed-bank build (`assets/data/seedbank.json`) |

**Difficulty.** Voyage only deals deals from the pre-rated seed bank. Each deal's score combines the fewest free cells it needs (solver-proven), how deeply aces and twos are buried, and a near-best solver's move count. Board k is dealt from tier k. Charms that change free cells are rated exactly from bank data. Effects the solver can't model declare an `ease` in tiers, and the dealer offsets `VOYAGE.compensation` of the combined effect by picking a harder or easier deal. Par is the deal's solver move count × `SCORE.parFactor`. Rules the bank can't answer are checked with the solver in a duty-cycled background worker while the previous board is played.

The free-cell count is `state.free.length` throughout `js/rules.js`, and the table lays out 1–6 cells.

Each table has three boons and one scaling challenge. Boss designs are in `docs/voyage/boss-challenges.md`.

## Analytics

`track(name, params)` in `js/analytics.js` sends each event to GA4 and to our own first-party store. Every event and param is defined once in `js/analytics-schema.js`. `js/consent.js` decides the collection mode: full, anonymous (EEA/UK/CH before the player accepts, or with Global Privacy Control), or off (Settings → Privacy). Both destinations are set in `js/analytics-config.js` and stay inert while empty. Nothing is collected on localhost or under automated browsers. To see events, open `?analytics=debug`: they're logged to the console and `window.__fcwAnalytics`. On localhost, `&analytics_region=eu|us` and `&analytics_api=<url>` are also accepted. `node tools/analytics-check.mjs` plays the game against a stand-in endpoint and checks what arrives. Plans: [docs/analytics-plan.md](docs/analytics-plan.md), [docs/first-party-analytics-plan.md](docs/first-party-analytics-plan.md).

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

`tools/perfcheck.mjs` profiles visible frames (JS plus GL driver work such as shader compiles and texture uploads) through the first deal, random-theme re-deals, a theme switch and idle play, on the real GPU (`node serve.mjs 8123 & node tools/perfcheck.mjs [quality] [port]`; `--swiftshader` for software GL).

## Not done / ideas

- Depth-of-field and PCSS shadows.
- KTX2/Basis texture compression (assets are WebP via canvas).
- Per-suit court art (currently one J/Q/K image per theme, tinted per suit).
- Real-GPU verification of the Ultra tier and mobile performance.
