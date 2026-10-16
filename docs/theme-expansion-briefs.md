# Final roster status — October 13, 2026

The game now has **52 active themes**. The ten final additions and their production palettes are below. Earlier concept briefs remain as provenance; Daylight Express, Canopy Station, Bannerkeep, Deep Space Station, Varsity Club and Driftwood Bay are retired from selection. See [parked themes](parked-themes.md) and [the final roster](voyage/overhaul/ROSTER-52.md).

# FreeCell Worlds — top 10 proposed theme briefs

Approved expansion brief · October 11, 2026 · Includes the additional Frontier Saloon direction below.

Daytime revision: Night Train is now **Daylight Express** (the internal `nighttrain` ID stays stable for saved settings), joined by daytime Saffron Court and Cherry Counter. Their heroes, backdrops, reflection environments, table textures and thumbnails use natural late-morning daylight; runtime lighting is cooler and brighter with lighter vignette treatment. Hero card fans explicitly carry each theme’s illustrated card backs.

Hero variety revision: seven hero images regenerated with Gemini, with matching thumbnails. Library features an elderly scholar; Night Train a male conductor; Frontier Saloon a rugged silver-moustached older cowboy with a Sam Elliott style presence. Conservatory, Carnival, Canyon, and Low Tide feature plants, objects, or scenery without people. The other four heroes retain their existing art. The seven revised themes use a rightward hero crop on narrow title screens to keep their subjects visible.

Production: 77 source images generated with the built-in image generator, including a corrected orthographic Night Train board; 99 optimized WebP assets (with derived environment maps and thumbnails); 55 audio files generated through the existing ElevenLabs workflow. The production prompt set is `tools/expansion-content.mjs`, and runtime definitions are in `js/theme-expansion.js`. Original images are saved under `assets-src/art/<theme>/`, shipped art under `assets/art/<theme>/`, and audio under `assets/music/` and `assets/sfx/`.

Validation: all eleven themes passed live image/audio loading, font checks, 4,576 card-index bounds checks across standard/four-color/high-contrast combinations, visibly rendered dealt boards, and responsive HUD checks at 1280, 800, and 420 pixels. Carnival and Forge additionally passed at High quality. All source and compressed images and all audio files passed integrity checks; the browser checks reported no errors. Both visual review and a rendered-card regression check confirmed the corrected accent-light configuration.

These briefs consolidate the four recent six-theme brainstorms, checked against the game's 17 current themes. Ranking favors recurrence across those four responses, then distinctiveness, strength of the table concept, and suitability for sustained play. Mentions include explicit runners-up; they are not independent votes, since all four models saw the same project and prior context. The first seven themes recur. Positions 8–10 are editorial selections from the single-response concepts.

The earlier Codex thread also contains a deliberately parked batch of more experimental ideas. Those remain a separate reserve list below. Its stained-glass greenhouse idea is incorporated as an optional conservatory treatment without inflating the recent-response count.

## Shortlist and provenance

| Rank | Consolidated theme | Recent responses | Original suggestions merged | Main reason to select |
|---|---|---|---|---|
| 1 | Midnight Library | 4/4 | The Old Library; The Grand Library; Lamplight Archive; Midnight Library | Strongest consensus; quiet paper-and-ink interior |
| 2 | Glasshouse Conservatory | 3/4 | The Conservatory; Glasshouse Conservatory; The Glasshouse | Daylight greenery, glass, and rain |
| 3 | Night Train | 3/4 | Night Train; Sleeper East; Locomotive Luxe (alternate) | Intimate travel nostalgia and a window onto a journey |
| 4 | Saffron Court | 3/4 | Lantern Souk; Saffron Court; Riad at Dusk | Warm textiles, pierced brass, and courtyard light |
| 5 | Amber Harvest | 2/4 | Amber Harvest; Last Pressing | Autumn agriculture and copper, beyond woodland scenery |
| 6 | Carnival Nocturne | 2/4 | Midway at Night; Carnival Nocturne | Playful painted canvas and festive lights |
| 7 | Canyon Turquoise | 2/4 | Canyon Turquoise; Canyon Dusk (runner-up) | Dry mineral surfaces and terracotta/turquoise contrast |
| 8 | Low Tide | 1/4 | Low Tide | Wet slate, small natural specimens, and restrained coastal color |
| 9 | Between Shows | 1/4 | Between Shows | Wooden puppet courts and theatrical matte-black staging |
| 10 | Obsidian Forge | 1/4 | Obsidian Forge | Basalt and heat; a strong counterpart to Winterglass |

**Sources:** GLM-5.3 Flash — @thread:thr_p2hxanhqfs; Qwen3.8 Max — @thread:thr_mrycr6sch6; Grok 4.7 — @thread:thr_pg3wq76ksr; MiMo v2.6 Pro — @thread:thr_pzbd3ttm7k. Earlier context and parked Codex concepts: @thread:thr_kgqxw6k9ia.

Original names and concepts above come from those threads. The unified names, exact colors, missing court roles, sound arrangements, and production decisions below are proposed additions for review.

## Shared production brief

Follow the current asset workflow: seven authored images per theme — board, backdrop, hero, card back, and three court portraits — plus derived thumbnail and environment images. Audio consists of music, ambience, UI click, foundation chime, and victory flourish. Specify the theme's font, card paper and suit colors, table materials, lighting, interface palette, and ambient effect as one coherent set.

- Keep the board's central 80% flat, evenly lit, and low contrast. Place scenery, strong patterns, highlights, and ornament around its perimeter.
- Keep card faces opaque and ranks exceptionally readable. The standard suits and four-color/high-contrast options must remain recognizable. Print ranks and suits in code rather than generating them into artwork.
- Give court portraits a simple background, generous head-and-shoulder framing, and safe space at the top and bottom for the existing card crop. No vital detail should touch the edges.
- Use balanced, rotationally symmetric card backs. Keep generated art free of lettering, numbers, interface elements, logos, and watermarks.
- Compose hero scenes with a quiet left third for the title and the main subject on the right. Thumbnails must communicate the theme at small size.
- Music should be original, instrumental, restrained, and suitable for a loop. Ambient effects should stay sparse. Animated scenery is optional polish; each theme must work as a still scene and with reduced motion.

These are visual and audio briefs. Voyage challenges and rewards should receive a separate design pass when themes are selected.

## 1. Midnight Library

*Leather spines, green glass lamps, and rain on tall windows.*

**Concept and setting.** A private reading room after hours: rolling ladders, tall shelves, leather-bound books, and a rain-dark window. Two shaded banker's lamps make a small inhabited pool of warmth. Favor the intimate archive over a monumental magical library; paper, ink, and patient human work give it personality.

**Table and palette.** Smoked oak playing surface with very fine grain, an oxblood leather perimeter, and small aged-brass corner plates. Colors: oak-black `#241B16`, oxblood `#652C38`, lamp green `#365C47`, old paper `#F2E6CD`, muted gilt `#BA9458`. Keep shelf ornament and books outside the playfield. Green should appear mainly in the lamps and accents, leaving the table distinct from Riverboat's felt.

**Cards and courts.** Cream paper, charcoal and wine-red suits, thin gilt borders. Backs use restrained marbled endpaper with paired brass key motifs. Jack: a young page holding a closed book; queen: an archivist with a brass reading lens; king: an older keeper with the archive keys. Render as hand-tinted engraved bookplates with clear silhouettes. Use Cormorant Garamond with bold indices; a new bookish serif remains optional.

**Light and motion.** Warm lamp cones against cool rain-blue windows; sparse dust motes and mild edge reflections. Avoid animated pages or moving shadows across cards.

**Sound and hero.** Felt piano, low cello, rain on glass, and an occasional quiet wooden creak. A soft leather tap for UI, a small brass note for foundations, and a gentle piano resolution for victory. Hero: wizened elderly male scholar with silver beard and spectacles, green-glass lamp, and cream cards on the right.

**Review focus.** Choose human archive staff and grounded bookplate art. Its defining feature should be lamplight and paper, distinguishing it from Deco's nightlife and Riverboat's gambling salon.

## 2. Glasshouse Conservatory

*Misted panes, fern fronds, and afternoon rain.*

**Concept and setting.** A Victorian iron-and-glass greenhouse on a rainy afternoon. Orchids, broad fern fronds, terracotta pots, and a distant potting bench surround the table. The room feels bright, humid, and sheltered rather than supernatural. This combines the three recent greenhouse suggestions; the earlier stained-glass greenhouse becomes an optional decorative accent.

**Table and palette.** Muted jade painted surface with a very quiet rattan texture, verdigris iron rails, and small cream ceramic fittings. Colors: jade `#4B7561`, verdigris `#638D83`, warm cream `#F3ECD8`, clay `#B77454`, rain grey `#A9BFC0`. Plant shapes and iron scrolls belong around the frame; neither leaf shadows nor glass reflections should cut through the playing area.

**Cards and courts.** Warm cream faces with forest-dark and brick-red suits. Backs: paired fern fronds and an orchid medallion in botanical linework. Jack: a greenhouse gardener with pruning shears; queen: a botanist holding an orchid; king: an older horticulturist with a watering can. Botanical watercolor and ink give them a different treatment from Forest's fantasy court. Cormorant Garamond suits the default; Playfair Display was suggested as a new-font option.

**Light and motion.** Diffuse daylight, restrained mist behind the table, and rainfall visible through the glass. Use very sparse pollen motes. Optional stained-glass panes should be confined to the upper architecture, preserving the room's daylight identity.

**Sound and hero.** Sparse harp and felt piano over rain on glass, occasional droplets, and soft ventilation. Ceramic taps and a light plucked foundation note. Hero: an unoccupied orchid and fern bench beneath rainy greenhouse arches on the right, shaded green foliage on the left; no human subject.

**Review focus.** Recommend botanical realism as the main direction. A full stained-glass fantasy treatment would overlap more with Winterglass and lose the new daylight-green mood.

## 3. Daylight Express

*Walnut, burgundy wool, and sunlit countryside.*

**Concept and setting.** A vintage passenger compartment on a relaxed late-morning journey. Honey-walnut panels, burgundy wool, satin brass fittings and folded luggage frame rolling green countryside and small towns under a blue sky. Keep the intimate travel nostalgia and male conductor, with abundant natural daylight.

**Table and palette.** Medium-brown honey-walnut center, burgundy wool edging, satin brass fittings. Colors: walnut `#493125`, burgundy `#743944`, midnight blue `#172637`, paper ivory `#F2E6CF`, brass `#B79960`. Keep burl contrast subtle enough that it does not resemble extra card edges. Window mullions and luggage racks stay in the backdrop.

**Cards and courts.** Ivory stock with ink-black and railway-red suits. Backs use abstract punched-ticket geometry and paired rail lines without printed text. Jack: conductor; queen: dining-car host; king: engineer. Vintage railway-poster portraits with natural daylight and restrained color. Cormorant Garamond is a practical existing-font choice; Bodoni Moda is an optional refinement.

**Light and motion.** Broad warm daylight with pale-blue sky fill, brighter exposure and a light vignette. Keep the table and camera steady.

**Sound and hero.** Soft piano and bowed bass over muffled wheel rhythm, carriage creaks, and air outside the sealed window. Small brass-latch UI click, restrained bell chime, and a warm arriving-home victory phrase. Hero: mature male conductor in navy uniform and peaked cap, brass pocket watch, sunlit countryside window, and a fan of railway-pattern card backs on the right.

**Review focus.** Prefer the intimate sleeper over a grand casino-like dining salon. The journey outside the window makes it distinct from both Jet Set and Riverboat.

## 4. Saffron Court

*Pierced brass, indigo cloth, and tea going cold.*

**Concept and setting.** A sheltered courtyard in bright late-morning daylight, with a small adjoining textile and spice market. Merge the riad's calm architecture with the souk's cloth, lanterns, and treasures. Keep one coherent courtyard rather than filling the image with every market prop: cedar screens, a shallow fountain, and a few pierced lamps do most of the work.

**Table and palette.** Medium-brown warm cedar with a narrow brass inlay, indigo cloth at the perimeter, and saffron cushions beyond the table. Colors: indigo `#26334D`, saffron `#D6A33D`, terracotta `#A9604A`, aged brass `#B78D50`, tea cream `#F3E6CB`. Geometric mosaic may appear on walls or the rail, but the playing surface should stay wood and textile to distinguish it from Azulejo.

**Cards and courts.** Cream faces, dark indigo and crimson suits, fine geometric borders. Backs: a symmetric pierced-lantern pattern with an indigo field and saffron accents. Jack: a textile merchant; queen: a courtyard host; king: an experienced brass artisan. Ink-and-gouache portraits of individual people, with pattern concentrated on collars and borders. Cinzel is an existing-font option; Marcellus was proposed as an alternative.

**Light and motion.** Sunlit cream plaster and fountain water, pale-blue sky fill, cool comfortable awning shade, and unlit decorative brass lanterns. Keep patterned shadows out of the playing surface.

**Sound and hero.** Soft plucked strings, restrained hand percussion, a small fountain, cloth rustle, and tiny tea-cup or brass taps. Hero: courtyard host, unlit lantern, tea tray, cloth, and an indigo-and-brass patterned card fan on the right; shaded cedar screen on the left.

**Review focus.** Choose a courtyard with a market at its edge. This preserves Riad at Dusk's stillness while retaining Lantern Souk's warm textile identity.

## 5. Amber Harvest

*Barnwood, cider light, and the last warm leaves.*

**Concept and setting.** A working cider barn in late September at the end of a pressing day. Low sun comes through orchard trees; a copper press, enamel pails, and a few stacked apple crates sit at the margins. Last Pressing supplies the specific place and activity; Amber Harvest supplies the seasonal warmth.

**Table and palette.** Worn pine with a matte dark-cider inset, copper corner fittings, and a narrow canvas rail. Colors: cider brown `#765032`, leaf rust `#B66636`, honey amber `#DDA451`, orchard olive `#697149`, enamel cream `#F4E8CA`. Keep grain quiet and put apples and leaves beyond the playfield. Avoid a generic cabin interior.

**Cards and courts.** Warm cream faces with charcoal-brown and brick-red suits. Backs use a paired cut-apple medallion, seeds, and simple branch shapes. Jack: a young orchard hand with a picking basket; queen: the orchard manager with pruning shears; king: the cider maker beside a copper press handle. Vintage agricultural-poster illustration with visible paper texture and grounded work clothes. Josefin Sans ties the UI to practical barn signage.

**Light and motion.** Low amber sunlight in the scenery, soft even tabletop lighting, and occasional drifting leaves at the extreme edges. Copper gets a small warm highlight, not a bright center reflection.

**Sound and hero.** Gentle acoustic guitar and upright bass; orchard breeze, faint press creaks, and soft enamel taps. A copper-toned foundation chime and short folk-like victory flourish. Hero: copper press, basket, and cream cards catching evening light.

**Review focus.** Commit to cider-making and harvest work. That makes this an autumn agricultural theme rather than a daytime recolor of Camp Pinecone.

## 6. Carnival Nocturne

*Candy stripes, ferris bulbs, and one last ride.*

**Concept and setting.** A small traveling midway after dark, when the last few stalls remain open. Painted signs without lettering, striped tent walls, warm bulb strings, and a distant ferris wheel create a playful setting. Keep it welcoming and handmade; avoid a crowded amusement park or sinister carnival imagery.

**Table and palette.** Matte indigo painted canvas, red-and-cream striped rails, worn gilt corner pieces. Colors: night indigo `#24273F`, cherry red `#C65455`, candy cream `#F7E7C9`, faded teal `#64A59D`, bulb gold `#EFC36A`. Stripes stay at the perimeter. The field should have the slight texture of a fairground game counter, with no giant target or checker pattern under the cards.

**Cards and courts.** Cream faces with navy and cherry-red suits. Backs use a symmetrical ferris-wheel rosette and alternating cream/red border. Jack: a ticket attendant; queen: a carousel painter; king: an older fairground operator. Hand-painted fairground poster portraits with cheerful expressions. Josefin Sans is the proposed default; Rye or Alfa Slab One were suggested for a more decorative display face, subject to readability.

**Light and motion.** Small steady bulb glows and gentle depth haze. A distant wheel may rotate slowly as optional polish. Save confetti for victory; avoid continuous flashing or foreground particle showers.

**Sound and hero.** Restrained carousel-organ colors, pizzicato bass, and soft brushed percussion; faint machinery and tent canvas moving in the breeze. Wooden UI taps, a small bell foundation note, and a short festive win phrase. Hero: carousel horse carving, warm bulb strings, distant ferris wheel, and cards on the right; no human subject.

**Review focus.** Recommend faded traveling-fair charm. Warm bulbs and painted canvas give it a different identity from Neon Grime's electric city and Muertos's candlelit celebration.

## 7. Canyon Turquoise

*Adobe warmth, mesas at sundown, and stone inlay.*

**Concept and setting.** A shaded adobe terrace overlooking layered desert mesas at sunset. Sparse courtyard plants, clay vessels, and cool dusk air establish a dry, expansive world. Keep the design led by geology and architecture; it does not need a frontier saloon or borrowed ceremonial motifs.

**Table and palette.** Matte muted terracotta stone surface, sandstone rail, restrained turquoise inlay at the corners. Colors: adobe `#A56248`, turquoise `#429B9B`, sandstone `#D8B489`, dusk plum `#58445B`, bone `#F2E4CE`. Fine mineral grain, rounded worn edges, and an evenly shaded center. The turquoise should appear as stone, not glowing circuitry.

**Cards and courts.** Bone-white paper with dark brown and iron-red suits. Backs: paired mesa silhouettes, a small sun disk, and turquoise geometric edging. Jack: a desert surveyor with a plain folded map; queen: a ceramic artist holding a small vessel; king: a stoneworker with a simple hand tool. Original earth-toned gouache portraits and spare shapes. Antonio offers a strong readable UI and indices.

**Light and motion.** Violet distant mesas, warm sunset edge light, and cool soft illumination over the cards. A tiny amount of distant dust can move behind the terrace; no sandstorm or heat distortion across the board.

**Sound and hero.** Sparse nylon guitar, warm low strings, desert breeze, and soft clay/stone taps. A muted mineral chime and brief spacious victory cadence. Hero: pottery, turquoise detail, and cards against an expansive sunset canyon view; no human subject.

**Review focus.** Favor a quiet artisan terrace. It adds a dry mineral world, distinguishing it from the wet coast themes and Coastal Carvings's painted cedar.

## 8. Low Tide

*Wet slate, anemones, and a pewter sky.*

**Concept and setting.** A coastal naturalist's table at the edge of a rock shelf just exposed by the tide. Kelp, barnacles, shallow pools, a tin specimen pail, and tiny jewel-colored anemones make the world feel close and observable. The scale is the tidepool itself rather than an entire fishing village.

**Table and palette.** Dark damp slate center with a low oxidized-pewter rail. Colors: wet slate `#364C55`, pewter `#8F9C9A`, kelp `#4F6657`, anemone rose `#BC7D89`, shell cream `#EDE7D7`. Keep reflective wetness strongest at the border. The center should be rough enough to avoid bright glare and remain easy to read.

**Cards and courts.** Shell-white faces with deep blue-black and muted crimson suits. Backs use a radial anemone and mirrored kelp fronds with thin field-guide linework. Jack: a young survey assistant in oilskins with a specimen tray; queen: a marine biologist with a hand lens; king: an older coastal naturalist with a tin pail. Fine pen-and-watercolor illustration with plate-like framing. Cormorant Garamond fits the field-guide tone.

**Light and motion.** Soft overcast illumination, low bloom, a subtle damp edge sheen, and occasional bubbles in background pools. Optional caustics should stay outside the cards.

**Sound and hero.** Sparse felt piano and guitar harmonics over little pool drips and distant surf. Soft slate taps and a tiny rounded metal chime. Hero: an intimate anemone pool, kelp, specimen pail, and cards on a rock ledge; no human subject.

**Review focus.** This has some palette and portrait overlap with Driftwood Bay. Keep cottages, boats, ropes, and lighthouse motifs out of the main composition so the wet rock and small marine life lead.

## 9. Between Shows

*Painted flats, one spotlight, and dust in the beam.*

**Concept and setting.** A small marionette theater during the interval, with the house lights down. Worn teal and crimson flats, velvet curtains, backstage tools, and a small proscenium frame a matte-black stage. This selects Grok's theatrical concept. Qwen's Toy Workshop is a related alternative, but is not counted as another mention of this theme.

**Table and palette.** Matte black stage floor with quiet grain, a thin gold perimeter inlay, painted-wood rails, and faded crimson trim. Colors: stage black `#222226`, puppet teal `#417A7C`, curtain crimson `#9C4552`, painted ivory `#EDE1CC`, old gold `#B79A63`. No puppet strings, spotlight beams, or scenery joins should cross the playable center.

**Cards and courts.** Ivory stock, ink-black and stage-red suits. Backs: a symmetric proscenium arch with paired puppet hands and tassels. Jack: a lively wooden messenger puppet; queen: a painted leading lady with a cloth gown; king: a kindly wooden monarch with a small carved crown. Render them as tactile puppet-object portraits, with visible joints and paint wear. Their material, rather than elaborate costume, makes the court memorable. Josefin Sans keeps the UI clear.

**Light and motion.** One soft spotlight in the scenery, subtle warm rim lighting on the puppets, and sparse dust in the beam. Optional curtain movement should be slight; the theatrical reveal belongs in the hero or victory moment.

**Sound and hero.** Music-box notes, pizzicato strings, woodblock taps, and tiny backstage creaks. A wooden-joint UI click, small celesta foundation note, and a curtain-call victory phrase. Hero: puppet queen and cards on the right of the little stage.

**Review focus.** Choose between a slightly uncanny theater and the more cheerful Toy Workshop alternative. Recommend the theater for its unusual object courts and focused visual identity.

## 10. Obsidian Forge

*Black stone, molten seams, and a hammer's patience.*

**Concept and setting.** A sheltered forge built into dark volcanic stone. Heavy tools, a banked furnace, and a few glowing seams sit at the edges. It should feel like a craftsman's quiet workspace after the hard work is done, with contained heat rather than an active lava disaster.

**Table and palette.** Rough matte basalt, dark iron rails, narrow ember-colored perimeter inlay, and small hammered-copper fittings. Colors: basalt `#24232B`, iron `#45434B`, ember `#D26939`, molten gold `#ECAF60`, ash cream `#EEE5D7`. Keep emissive cracks outside the playing field. Strong roughness and low bloom prevent this from becoming a warm recolor of Neon Grime.

**Cards and courts.** Ash-cream faces with charcoal and deep red suits. Backs use a symmetrical anvil-and-spark medallion with copper engraving. Jack: an apprentice with tongs; queen: a master metalworker with a worked copper ornament; king: an older smith holding a hammer at rest. Charcoal-and-copper etched portraits, grounded work clothing, and readable silhouettes. Cinzel provides sturdy existing-font lettering.

**Light and motion.** Warm furnace rim light with a cool dim fill across the table; a few rising sparks at the margins. No heat shimmer over ranks, and no pulsating glow beneath the cards.

**Sound and hero.** Low sustained strings, sparse hammered-dulcimer tones, quiet furnace breath, and distant cooling-metal ticks. A muted iron UI tap, rounded copper foundation note, and a short rising victory chord. Hero: metalworker, furnace edge light, and cream cards resting on basalt.

**Review focus.** Choose craft and contained fire over lava spectacle. Its dark matte mineral identity creates a useful material and temperature contrast with Winterglass.

## Remaining suggestions and how they were handled

All additional concepts in the four recent responses are retained here for future review:

| Concept | Source | Reason outside the top 10 |
|---|---|---|
| Alpine Chalet / Après-Ski | Qwen | Attractive warm/cold contrast, but close to Camp Pinecone and Winterglass |
| Frontier Saloon | Qwen | Adds a western setting, but shares Riverboat's period gambling-room materials |
| Art Nouveau | Qwen | Strong reserve candidate; could be differentiated by organic copper curves, though decorative glass and luxury interiors already recur |
| Toy Workshop | Qwen | A cheerful alternative to Between Shows; keep as a distinct option rather than claiming exact consensus |
| Medieval Great Hall | Qwen, runner-up | Heraldry and tapestries offer potential, but monumental period grandeur overlaps Neo-Classical |
| Parisian Café | Qwen, runner-up | Pleasant daily-life setting, with weaker separation from Deco and Jet Set |
| Soda Fountain | GLM, runner-up | Useful bright food-themed reserve; chrome and mid-century nostalgia sit near Jet Set |
| Cartographer's Table | GLM, runner-up | Strong parchment/ink theme; Midnight Library takes the first paper-world slot |

**Earlier parked Codex batch:** Porcelain Court; Museum of Impossible Specimens; Cloud Terminal, Gate ∞; Stained-Glass Greenhouse; Rubber-Hose Royal Flush. These are not counted as recent consensus. Porcelain Court and Cloud Terminal have since gained close relatives in Azulejo and Jet Set; stained-glass greenhouse is an optional conservatory treatment. The Velvet Moth, Cut-Paper Kingdom, Midnight Broadcast, The Giant's Sewing Box, and Risograph Royalty are now playable worlds. Museum of Impossible Specimens remains a distinctive experimental reserve.

## Recommended first batch

**Midnight Library, Glasshouse Conservatory, and Night Train** have the clearest combined support and three recognizable settings: still lamplight, rainy daylight, and a journey after midnight. Keep their portraits respectively engraved, botanical watercolor, and railway poster art so they do not become three versions of the same nostalgic room.

For a more adventurous first batch, replace Night Train with **Between Shows**. Its carved puppet court adds a different type of character and visual material.

Each brief's “Review focus” identifies the main creative decision to settle before generation. The proposed names and art directions are ready for selection or revision.


## 11. Frontier Saloon

*Batwing doors, desert dusk, and one more hand.*

A modest 1880s old-west saloon overlooking a dusty street at purple sunset. Weathered oak, saddle leather, kerosene lamps, spindle chairs, an upright piano, and dusty brass distinguish it from Riverboat Royale’s polished mahogany, green felt, chandeliers, and river views. The table center stays dark, matte, evenly lit, and quiet.

Cream cards carry black-brown and brick-red suits. Symmetric backs pair horseshoes and desert stars with woodcut oak-leaf ornament. Courts: a young frontier card player, a female saloon proprietor holding a kerosene lamp, and an older piano player. Hand-tinted woodcut portraits use tobacco cream, saddle brown, brick red, and sunset plum. Antonio supplies bold readable indices and interface typography.

## 12. Morning Ritual

*Fresh coffee, tall windows, and a moment to yourself.*

An airy contemporary third-wave neighborhood coffee shop, revised from Café at Dawn using the user's reference photographs and approved concept sheet. Tall black-framed windows, pale oak, warm-white plaster and subway tile, concrete floors, brushed stainless espresso equipment, warm dark-metal pendants, and greenery at the margins. Clean organized surfaces keep the coffee experience central.

Table: a dark muted teal playing inset with a slim pale-oak perimeter and restrained cream keyline. Palette: teal `#173B38`, oat `#E4CAA1`, terracotta `#BF8168`, and warm-white card paper. Cards use teal-black and terracotta suits; backs feature a latte-rosetta medallion, geometric arcs, and coffee-bean motifs. Clean contemporary editorial courts depict a barista with a milk pitcher, a female pour-over specialist with a gooseneck kettle, and a seasoned roaster with a scoop of beans. Josefin Sans; the portrait crop preserves the full hair silhouette.

Hero: a ceramic flat white with crisp latte art and a fan of fully illustrated face-down cards, against a sunlit espresso bar. A shaded teal wall leaves room for the title. Audio: brushed guitar/piano/bass, espresso preheat hum and faint street sounds, saucer-tap UI and brass-and-cup chime. The stable `cafe` identifier preserves saved settings and Voyage content. Production artwork uses the built-in image generation tool with the approved sheet as reference; exact prompts are saved in `docs/previews/cafe-modern-generation.json`.

## 13. Arctic Station

*Frosted instruments, aurora light, and one snug lamp.*

A snug arctic research station interior at polar twilight: frosted round observation window with aurora glow, ice-crusted instrument panels with cyan indicator lights, signal-orange safety hardware, snow gear and ration tins at the margins.

Table: matte snow-white brushed-aluminum surface with signal-orange rails and steel-blue fittings — the roster's only white-surface table, deliberately glare-free. Colors: polar night navy `#16222E`, signal orange `#FFB25C`, glacier cyan `#8FD4E8`, card red `#D95436`. Cards: white faces with polar-navy and signal-red suits; backs use a compass-rose medallion with fine longitude lines and snowflake marks on deep navy. Courts (expedition-poster screen-print): radio operator, female glaciologist with an ice core, older station commander with frost-flecked beard and brass compass. Antonio.

Hero: unoccupied interior — frosted porthole with aurora, brass barometer, plain unbranded thermos, blank white cards; no humans. A soft aurora cyan accent light plays in-scene. Audio: warm piano/muted brass/glockenspiel against wind-on-structure and instrument hum; insulated-switch UI, glockenspiel chime.

## 14. Fossil Hall

*Spotlit bone, green-black stone, and evening hush.*

A grand natural history museum fossil hall after closing, dinosaur-bone focused: a towering articulated skeleton under warm spotlights, framed plaster reliefs, tall arched windows with deep blue evening light, brass railings and empty benches.

Table: dark green-black stone with bone-ivory rails and brass corner plaques, lit like a museum case. Colors: green-black stone `#23262B`, brass `#D9B36C`, bone ivory `#F3EDDD`, fossil ochre `#A84A34`. Cards: bone-ivory faces with charcoal and ochre suits; backs pair mirrored ammonite spirals around a vertebra medallion in engraved museum-case style. Courts (engraved museum-poster crosshatch): fossil preparator with a fine brush, female paleontologist with a plaster-wrapped fossil, older curator with a brass magnifier. Cinzel.

Hero: unoccupied hall — the great dinosaur skull and sweeping neck dominate the right third under raking spotlights; ivory cards rest on a brass-railed case; no humans. Audio: sparse reverent low strings/piano/celesta; vast-hall room tone with one distant footstep echo; marble-and-plaque UI, low brass chime.

## 15. The Mint

*Guilloche steel, rag paper, and a printer's patience.*

The most conceptual of the batch: a national banknote engraving studio at night. Steel plates, guilloche proof sheets, a magnifier lamp, gilt scales and ink tins; deep banknote green with cream rag paper, copper and gilt. No real currency.

Table: deep banknote-green surface with a whisper of engraved guilloche at the rails only, cream paper rails and gilt corner plates. Colors: banknote green `#16281F`, gilt `#D4B15F`, guilloche lilac `#8E7CA8`, engraving red `#9E4A38`. Cards: cream rag-paper faces with green-black and intaglio-red suits; backs use a symmetric guilloche rosette with an unlettered wreath vignette in crisp intaglio print. Courts (steel-engraving portraits): apprentice plate engraver with a burin, female intaglio printer with a proof sheet, older master engraver with a copper plate. Cinzel.

Hero: unoccupied studio — an unfurled proof sheet with crisp guilloche and an invented winged-coin-and-laurel emblem (regenerated after the first take showed a Washington-like portrait), copper plate, magnifier lamp, cream cards; no humans. Audio: precise piano/strings/celesta; lamp hum and paper rustle; paper-weighted UI tap, gilt bell chime.

## Batch 3 provenance

Proposed October 11, 2026 as three mainstream + three left-field concepts following batch 2; four were approved with direction changes: Café at Dawn (bakery concept adapted to coffee shop), Arctic Station (as proposed), Fossil Hall (natural-history museum focused on dinosaur bones), The Mint (as proposed). Trackside Model Railroad remains a reserve idea. Hero variety follows batch 2's guidance: café features an older silver-haired woman, arctic/museum/mint have no human subjects, giving the roster scene-led heroes alongside its varied character leads.

## 12. Pharaoh's Tomb

*Gold leaf, lapis stone, and a torchlit burial hall.*

A classic burial chamber: sandstone, a gilded sarcophagus, canopic jars, scarab and lotus ornament, and torchlight. The court is a royal attendant, a queen, and a pharaoh, painted as readable tomb portraits. Cinzel supplies the indices. The hero’s fanned cards show the lapis-and-gold scarab back, not blank paper. The internal id remains `lapis`.

## 13. Canopy Station

*Teak platforms, broad leaves, and humid daylight.*

A research deck in a living rainforest: dark teak, field-green rails, brass fittings, rope and mist held at the edges. Daylight science, separate from Enchanted Forest’s moonlit magic and the Conservatory’s potted glasshouse. Naturalist watercolor courts. Cormorant Garamond.

## 14. Cherry Counter

*Chrome trim, cherry vinyl, and coffee going cold.*

A classic roadside diner in sunny late-morning daylight. Medium warm-grey laminate, cherry vinyl, mint tile, and chrome. Large windows show a quiet two-lane road, green roadside trees and a clear blue daytime sky. The server’s fanned cards carry chrome-diamond, cherry-arc and mint-tile back designs. Mid-century poster courts — cook, server, pie baker. Antonio, set like a diner marquee.

## 15. Treasure Cove

*Salt-stained charts, a crooked X, and gold by candlelight.*

A smugglers' sea-cave hideout at night: salt-stained oak, rope edging, aged brass, and an oil lantern against a moonlit teal sea. Separate from Riverboat Royale's polished gambling salon and Driftwood Bay's quiet working harbor — this is adventure piracy, no skulls or horror. The hero is an unoccupied chart room: an open chest of coins, a blank chart, a compass, and cards, with an anchored sloop through the cave mouth. Courts: a young powder-monkey deckhand, a mermaid lookout with a spyglass, and a weathered grey-braided captain. Hand-tinted engraved nautical-chart portraits on parchment cream. Cormorant Garamond. Concertina and nylon guitar over low strings; cave surf and rope creaks.

## 16. Bannerkeep

*Banners in the rafters, wax seals, and a long oak table.*

A medieval great hall after the feast: aged oak, deep-crimson wool banners, beeswax candles, and a banked stone hearth. Grounded history rather than high fantasy, distinct from Enchanted Forest's fae woodland. The courts map to the ranks themselves — knight, queen, king — painted as illuminated-manuscript portraits with gold leaf on vellum cream. The hero is the regal queen beside the long table, banners and hearth glow behind. Cinzel with sharp 5px corners. Lute and recorder over low strings; hearth crackle and wind beyond tall windows.

## 17. Hangar 18

*Halogen hum, quarantine tape, and one covered disk.*

A secret 1950s underground hangar storing a recovered flying saucer — the Roswell legend told as cold-war facility rather than roadside kitsch. Brushed concrete, gunmetal scaffolding, halogen work lights, quarantine sheeting, and warning-stripe yellow; a faint cyan glow escapes beneath the tarp of the covered craft. The hero is the unoccupied hangar bay — the covered disk, a steel table with manila cards, a clipboard, and a rotary telephone. Classified-file gouache courts: a night-shift lab technician, a senior scientist, and a silver-haired man in black. Antonio, uppercase, with sharp corners. Analog synth pads, muted vibraphone, and a restrained theremin-like lead over a deep ventilation hum.

## 18. The Toy Box

*Maple blocks, primary paint, and a rug in the afternoon.*

An unoccupied playroom. Unlettered maple blocks, a tin drum, and a wooden horse on a low table. The court is the toys themselves: a wooden soldier, a cloth doll, and a tin drummer, painted as a vintage catalog. Fredoka. Voyage: Four Square, Jack-in-the-Box, Tidy Up, and Tipped Tower.

## 19. Prize Lights

*Colored bulbs, a spinning wedge, and a navy podium.*

A 1970s daytime game-show stage between rounds. Navy felt, a bulb rail, and an unlettered prize wheel. Courts: floor director, host, returning champion. Antonio. Voyage: Today's Puzzle, Applause, Returning Champion, and Lockout.

## 20. Safety Pin

*Photocopy black, torn newsprint, and a magenta gel.*

A small 1980s club just off stage. Matte black paint, silver tape, one bare bulb, and a magenta gel. Photocopied courts: drummer, singer, guitarist, with no real musicians and no readable flyers. Antonio. Voyage: Three Chords, Safety Pin, Zine, and No Re-entry.

## 21. Honey House

*Golden honey drips, soft wax comb, and a royal court of bees.*

A living hive. Amber playing surface with a rounded golden honey rim, soft wax comb pouring gold in the backdrop, and prominent natural honeybees. Card backs pair bees with mirrored honey drips and pale wax edging. Courts are bees: a worker, a queen in a honey crown, and a drone. Natural bee markings remain; decorative black-and-yellow striping is excluded. Cormorant Garamond. Voyage: Forager, Nectar, Winter Stores, and Capped Comb.

## Final ten production worlds

| Id / name | Palette and material | Typography | Atmosphere / sound |
| --- | --- | --- | --- |
| `signal` / Signal | Polar-night navy, charcoal metal, dish white, amber instruments, cold starlight; cream cards with navy and muted red indices | Antonio | Sparse cold motes; analog synth, felt piano, relay clicks and observatory ventilation |
| `rink` / Roller Rink | Honey maple, mirror silver, magenta and teal, warm tungsten; cream cards with plum-black and magenta-red indices | Josefin Sans | Disco-colored motes; mellow disco, wheel taps and empty-rink air |
| `darkroom` / The Darkroom | Safelight red, amber-black, silver trays, photographic cream; dark bench and cream cards | Antonio | Restrained red motes; felt piano, bowed vibraphone, tongs and enlarger hum |
| `smokewatch` / Smoke Watch | Weathered pine, forest green, stove orange, smoke blue and dusk violet; linen-cream cards | Antonio | Dusk dust; guitar, bowed strings, high-cab wind and stove crackle |
| `bloodmoon` / Bloodmoon | Cold stone, dried-blood crimson, black oak, candle amber and moonlight; warm parchment cards | Cinzel | Candle dust; cello, harpsichord, iron latch and corridor wind |
| `deepsea` / Deep Sea | Abyssal blue-black, luminous cyan, jellyfish rose, brass and pressure glass; pale ivory cards | Cormorant Garamond | Bubbles and faint edge caustics; glass harmonica, celesta and pressure-shell hum |
| `plaster` / Plaster Studio | Plaster white, linen, clay pink, north-light grey and charcoal; matte worktop and white cards | Cormorant Garamond | North-light dust; piano, viola, plaster taps and linen rustle |
| `backrooms` / Backrooms | Moist butter yellow, nicotine cream, stained beige, fluorescent green-white and faint pink; dark charcoal / red card indices | Antonio | Sparse fluorescent dust; detuned electric piano, pads, switch clicks and ballast hum |
| `vaporwave` / Vaporwave | Pink marble, magenta, cyan, peach sunset, teal glass and cream; dark navy / magenta-red card indices | Josefin Sans | Sunset dust; electric piano, FM bells, cassette taps and mall fountain |
| `cinema` / Silent Cinema | Silver nitrate, carbon-arc white, velvet burgundy, amber and soft black; photographic-cream cards | Josefin Sans | Projector dust; upright piano, chamber organ, film lever and projector mechanism |

Art masters reuse the approved locked-theme sets without removing the original folders. Smoke Watch uses `lookout/hero-smoke.png`, Bloodmoon uses `castle/hero-distant.png`, Deep Sea uses `bathysphere/hero-deepsea.png`, and Plaster Studio uses the reframed `plaster/hero.png`. The other six use their approved `hero.png`. Serving WebPs come from `tools/optimize-assets.sh`. Music is a 90-second original instrumental per theme; the four effects are UI, chime, win and a 20-second looping ambience. Sea-chart art uses the existing Gemini nautical-gouache generator, with a compact transparent 256px footprint.
