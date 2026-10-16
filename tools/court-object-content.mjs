// Approved object/creature courts and retained alternatives.
// Only status=approved overrides legacy humanoid court prompts.
// status=retained preserves the previous humanoid cards in the game.
export const OBJECT_COURTS = {
  "zen": {
    "status": "retained",
    "style": "refined sumi-e ink and restrained ukiyo-e botanical illustration on warm washi cream, soft moss green, charcoal, warm stone grey and a little vermilion, calm garden daylight",
    "subjects": [
      "a complete mature miniature bonsai with a beautifully curved trunk and layered foliage in a shallow ceramic pot",
      "a weathered Japanese stone garden lantern, sculptural stacked stone, moss around the base, no flame face or person",
      "a striking vertically composed naturally eroded garden stone with subtle moss on a small raked-sand base"
    ]
  },
  "azulejo": {
    "status": "approved",
    "style": "hand-painted Portuguese cobalt-blue azulejo ceramic illustration on warm white glaze, subtle glaze crazing, fine confident blue brushwork and restrained botanical flourishes, crisp ornamental readability",
    "subjects": [
      "a graceful swallow in flight painted in cobalt blue, complete wings and tail",
      "a beautifully shaped ceramic urn holding a flowering branch, entire vessel and flowers visible",
      "an elegant historical sailing ship with full billowing sails, painted as a blue-and-white azulejo motif, no crew"
    ]
  },
  "library": {
    "status": "approved",
    "style": "refined engraved storybook still-life illustration, leather oxblood, smoked oak brown, antique brass, warm parchment and restrained green glass, soft golden library lamplight, plain warm parchment background",
    "subjects": [
      "a handsome closed leatherbound book standing slightly angled with gilded tooling and a ribbon bookmark, no title or lettering",
      "a green glass bankers reading lamp with a slender brass stem and warm light, complete shade and base",
      "an open illuminated manuscript with intricate original botanical and geometric ornament, abstract decorative panels only, no text or imitation writing"
    ]
  },
  "conservatory": {
    "status": "approved",
    "style": "elegant botanical watercolor and fine ink, jade, fern green, soft cream and small muted flower accents, humid diffuse conservatory daylight, warm botanical-paper background",
    "subjects": [
      "an unfurling fern with several richly layered fronds and one curled fiddlehead, whole plant with clean silhouette",
      "a flowering orchid on a graceful curved stem with broad leaves, cream and pale pink flowers",
      "a sculptural fan palm with a beautiful layered crown of fronds, entire plant in a simple terracotta vessel"
    ]
  },
  "canyon": {
    "status": "approved",
    "style": "original tactile mineral-and-artisan gouache, turquoise blue-green, terracotta, dusty cream and copper brown, warm desert light, simple sand-cream background",
    "subjects": [
      "a sculptural cluster of raw turquoise stones in warm brown host rock, distinct blue-green mineral surfaces",
      "a beautiful hand-painted ceramic vessel with original turquoise and terracotta geometric ornament, no letters",
      "a compact majestic layered sandstone mesa formation rising from a small desert-rock base, copper strata and tiny turquoise mineral accents, isolated sculptural landform"
    ]
  },
  "lowtide": {
    "status": "approved",
    "style": "original naturalist coastal field-guide watercolor and fine ink, muted seafoam, slate blue, pewter, shell cream and small natural warm accents, overcast tidal light, plain shell-cream background",
    "subjects": [
      "a beautiful tide-pool anemone with a complete radial crown of soft tentacles on a tiny wet rock",
      "one naturally proportioned five-armed sea star with richly stippled skin, all arms fully visible",
      "a complete spiral marine shell with a strong sculptural whorl and subtle nacre, no crab or human features"
    ]
  },
  "forge": {
    "status": "approved",
    "style": "tactile etched-and-painted industrial still life, matte basalt black, wrought iron, restrained molten copper and ember orange, dramatic warm forge light, simple dark charcoal background",
    "subjects": [
      "one complete forged iron hammer with a worn timber handle and subtly glowing copper edges, diagonally composed",
      "a thick dark ceramic foundry crucible holding glowing molten copper, quiet ember light and gentle heat haze",
      "a massive sculptural anvil forged from dark iron and basalt textures, clear horn and broad foot, subtle copper seam glow"
    ]
  },
  "deepstorage": {
    "status": "retained",
    "style": "restrained classified-archive technical gouache, cool gunmetal, brushed concrete grey, muted olive and tiny amber warning-light accents, harsh overhead hangar light, plain dark concrete-grey background",
    "subjects": [
      "a sealed sculptural specimen case made of reinforced glass and worn gunmetal, containing an ambiguous small nonliving mineral sample, no labels or numbers",
      "a mysterious recovered geometric device with layered metal rings and a tiny amber core, clearly an object, no face or anthropomorphic robot",
      "a complete small disk-shaped saucer partly covered by a heavy charcoal canvas tarp, distinct rim and domed shape, isolated at specimen-display scale"
    ]
  },
  "museum": {
    "status": "approved",
    "style": "elegant engraved fossil specimen illustration with tactile bone and stone, bone ivory, warm fossil ochre, deep green-black and antique brass, precise museum spotlight, simple dark green-black background",
    "subjects": [
      "a complete beautifully preserved ammonite fossil with a large readable spiral and fine shell ribs",
      "a clearly recognizable trilobite fossil embedded in a compact sculptural stone slab, complete segmented exoskeleton",
      "a dramatic complete fossil dinosaur skull in three-quarter view, strong jaw and readable teeth, no living skin, no body or human"
    ]
  },
  "mint": {
    "status": "approved",
    "style": "original banknote steel engraving with crisp fine hatchwork and guilloche, banknote green, parchment cream, restrained gilt and lilac, warm proof-room light, simple parchment background",
    "subjects": [
      "an ornate engraved coin seen slightly obliquely with original abstract botanical relief and milled rim, no portrait, letters or numerals",
      "a rectangular guilloche printing plate with a rich central rosette and fine engraved scrolls, clearly a physical plate, no lettering",
      "an ornate raised banknote seal medallion with interlaced guilloche and layered gilt rosette petals, no face, letters or numbers"
    ]
  },
  "moth": {
    "status": "retained",
    "style": "luxurious natural-history moth gouache, plum, dusty rose, tarnished silver and warm cream, velvety wing scales and soft lamplight, simple deep plum background",
    "subjects": [
      "a natural plum-patterned moth with spread wings, complete antennae and fine furry thorax, intricate plum and dusty-rose markings",
      "a natural pale silk moth with full soft cream wings, feathery antennae and faint silver patterns",
      "a natural broad-winged dusk moth with rich dark-plum wings, silver and rose eyespots and a substantial furry body"
    ]
  },
  "sewing": {
    "status": "approved",
    "style": "tactile embroidered-and-painted still-life illustration, visible stitches and woven cloth texture, coral thread, linen cream, honey wood and antique brass, warm sewing-box light, plain linen-cream background",
    "subjects": [
      "an oversized wooden spool wound with coral thread, loose thread loop curling beside it, complete spool",
      "a richly textured round coral pincushion with several delicate brass-headed pins and cream stitching",
      "a complete ornate pair of antique brass sewing scissors with elegant openwork finger loops, blades safely closed, no hands"
    ]
  },
  "signal": {
    "status": "approved",
    "style": "cinematic painterly scientific instrument illustration, polar-night navy, charcoal, cold starlight grey and sparse amber instrument glow, plain deep navy background",
    "subjects": [
      "a complete pair of vintage radio-operator headphones with large worn black padded earcups, an arched steel-and-leather headband and a loose coiled cable ending in a brass audio jack, arranged as a sculptural still life; no receiver box, instrument panel, meter, head, mannequin or person",
      "a compact scientific instrument panel with analog meter windows and subtle amber indicators, unlettered markings only",
      "a complete sculptural white radio-telescope dish on its compact mount, strong elegant silhouette, tiny amber beacon, no person"
    ]
  },
  "darkroom": {
    "status": "approved",
    "style": "painterly photographic-process still life, deep amber-black and silver with one restrained red safelight, matte tactile metal, quiet shadow, plain deep red-black background",
    "subjects": [
      "a sculptural silver film reel with a short curling strip of photographic film, no numbers or writing",
      "a shallow silver developing tray holding a monochrome photographic print of bare tree branches, complete tray, no faces or letters",
      "a complete compact photographic enlarger with bellows, lens head, column and baseboard, clear mechanical silhouette"
    ]
  },
  "deepsea": {
    "status": "approved",
    "style": "original naturalist deep-ocean gouache with cinematic tactile detail, blue-black water, pale cyan living light, muted rose and aged brass, plain deep navy-black background",
    "subjects": [
      "a luminous jellyfish with an elegant translucent bell and complete flowing tentacles, pale cyan and muted rose bioluminescence",
      "a chambered nautilus with its beautiful spiral shell and complete delicate tentacles, natural marine anatomy",
      "a compact antique brass diving bell with a clear round porthole and simple riveted dome, no diver or human inside"
    ]
  },
  "plaster": {
    "status": "approved",
    "style": "painterly sculptural studio still life, matte plaster white, linen, clay pink and cool north-light grey, strong tactile cast texture and soft raking daylight, plain medium warm-grey background",
    "subjects": [
      "a sculptural plaster cast of one relaxed human hand on a small neutral base, clearly an inanimate white plaster study, no living arm or person",
      "a circular plaster relief medallion with original botanical scroll ornament and subtle chipped edges, no face or letters",
      "a classical plaster cast bust on a small plinth, clearly chalk-white inanimate cast sculpture with unpainted eyes, no living skin, no artist"
    ]
  },
  "backrooms": {
    "status": "approved",
    "style": "eerie painterly architectural still life, stained butter-yellow, nicotine cream, sickly fluorescent grey-green and worn beige, flat lonely office light, simple muted yellow-grey background, no warm coziness",
    "subjects": [
      "a complete old rectangular fluorescent ceiling fixture with two dull glowing tubes, stained casing and slightly exposed wire, no ceiling scene",
      "an abandoned worn beige-and-brown office chair, complete seat, back, legs and casters, subtly uncanny empty silhouette",
      "an empty yellow-wall doorway with a dark opening and stained beige carpet at its base, complete lintel and jambs, no person, no silhouette in the opening"
    ]
  },
  "vaporwave": {
    "status": "approved",
    "style": "surreal pastel mall illustration with gentle airbrush gradients and restrained halftone, sunset pink, pale teal, lavender and chrome silver, nostalgic 1990s graphic polish, simple pastel pink background",
    "subjects": [
      "a polished chrome dolphin sculpture leaping in a graceful arc on a small pastel plinth, unmistakably an inanimate sculpture",
      "an inanimate classical white marble bust on a geometric teal pedestal, pink rim light, carved stone eyes, no living person",
      "a single sculptural palm beneath a peach-pink setting sun with sparse teal perspective-grid lines at its base, compact emblem-like composition, no text"
    ]
  },
  "harvest": {
    "status": "approved",
    "style": "vintage agricultural-poster gouache, cider brown, leaf rust, honey amber, olive and warm cream, late-autumn orchard sunlight, simple warm cream background",
    "subjects": [
      "a beautiful apple branch with two ripe red-gold apples and olive leaves",
      "a complete hammered copper cider jug with a gracefully curved handle and rich patina",
      "a compact complete wooden cider press with copper fittings and a small apple basket, no operator"
    ]
  },
  "cafe": {
    "status": "approved",
    "style": "clean warm editorial coffee illustration, deep teal, pale oak, coffee brown, warm cream and restrained brass, natural bright cafe daylight, plain warm tea-cream background",
    "subjects": [
      "a ceramic espresso cup and matching saucer with rich crema and a small brass spoon",
      "a complete ceramic pour-over dripper on a small glass coffee carafe, quiet precise silhouette",
      "a compact elegant brass espresso machine with two group heads and polished dark wood handles, unbranded, no barista"
    ]
  },
  "arctic": {
    "status": "retained",
    "style": "original polar expedition-poster gouache, snow white, steel blue, orange enamel and cold navy, crisp polar daylight, plain deep navy background",
    "subjects": [
      "a translucent cylindrical ice-core sample in a short metal cradle, trapped air bubbles and pale blue layers",
      "a compact sculptural weather instrument with a wind vane and anemometer cups on a short steel mast, orange details",
      "a complete frost-covered expedition radio with orange casing accents and a short antenna, no labels or numbers"
    ]
  },
  "rink": {
    "status": "approved",
    "style": "cinematic illustrated retro roller-rink still life, honey maple, silver mirror facets, restrained magenta and teal glow, original painterly game art, plain deep midnight-purple background",
    "subjects": [
      "one complete vintage quad roller skate with all four wheels, cream leather and small magenta details",
      "a complete suspended mirror ball with crisp small silver facets and subtle reflected teal and magenta glints",
      "a complete compact vintage DJ turntable with a black vinyl record and tonearm, maple accents, no labels or words"
    ]
  },
  "smokewatch": {
    "status": "approved",
    "style": "quiet painterly forest-lookout equipment illustration, weathered pine, smoke blue, ember amber and muted ranger green, soft dusk mountain light, plain smoky blue-grey background",
    "subjects": [
      "a complete pair of worn binoculars with a simple folded strap, subtle amber reflections",
      "a complete compact circular fire-finder instrument with a sighting bar on a short stand, brass and weathered pine, abstract marks only, no numbers",
      "a complete small wooden forest-lookout tower on stilts with a glazed cabin and narrow stair, isolated miniature architectural form, no people"
    ]
  },
  "broadcast": {
    "status": "approved",
    "style": "warm painterly mid-century broadcasting still life, walnut, brushed metal, amber glass and restrained teal and rust, late-night studio lamplight, simple dark walnut-brown background",
    "subjects": [
      "one complete vintage broadcast microphone in a metal cradle on a short desk stand",
      "a complete elegant walnut radio console with warm amber tuning glass and brass knobs, no text or numerals",
      "a complete walnut-cased CRT television displaying an abstract multicolor geometric test pattern without numbers or writing"
    ]
  },
  "risograph": {
    "status": "retained",
    "style": "original bold risograph editorial print, only vermilion, ultramarine, mustard and warm paper, coarse halftone dots, tactile ink and slight misregistration, plain warm-paper background",
    "subjects": [
      "a large intricate abstract overprinted rosette built from concentric offset circles and petal shapes",
      "a sculptural stack of three overlapping halftone proof sheets with abstract circles and geometric blocks, no figures or lettering",
      "a complete risograph ink drum with visible metal cylinder and mustard ink accent, clearly a physical printing component, no face or text"
    ]
  },
  "runes": {
    "status": "approved",
    "style": "original carved Norse workshop still life, weathered oak, bone, iron, madder red, woad blue and amber, cool fjord daylight and warm fire bounce, plain bone-cream background",
    "subjects": [
      "an upright weathered rune stone with a few original isolated carved rune-like stave motifs, not a sentence or lettering panel",
      "a complete carved oak knotwork panel with bold interlaced animal-free abstract bands, deep chisel cuts and small madder accents",
      "a complete sculptural wooden ship-prow carving with elegant curling neck, oak grain and iron rivets, no person"
    ]
  }
};

export function objectCourtManifest({includePreview = false} = {}) {
  return Object.entries(OBJECT_COURTS).flatMap(([theme, d]) => {
    if (d.status !== 'approved' && !includePreview) return [];
    return d.subjects.map((subject, i) => ({
      theme, id: `court_${'jqk'[i]}`, aspect: '1:1', size: '2K',
      referencePath: `assets/art/${theme}/hero.webp`,
      prompt: `Square 1:1 premium playing-card court illustration of ${subject}. Style and palette: ${d.style}. Use the reference only for this theme's visual language, never its people or composition. One bold central subject with a distinct silhouette, essential parts contained inside the middle eighty percent with generous safe margins. Fill the square naturally; the object or creature should occupy about seventy percent of the image and remain instantly recognizable at small playing-card size. A simple quiet background, fine supporting texture only, no busy room or surrounding scene. An elegant illustrated object/creature study, not a character portrait and not a photograph. No people, living human faces, humanoid bodies, hands holding objects, anthropomorphic features, eyes on objects, costumes, crowns or royal accessories. Exceptions only for explicitly requested INANIMATE hand casts or classical stone/plaster busts, which must visibly be sculpture. Actual animals must retain natural anatomy and complete wings, antennae, limbs or tentacles. No mirrored second subject, card outline, inner frame, outer border, white margin, cropped essential parts, text, letters, numbers, logos, watermark or UI. The three ranks share visual language but their different subject shapes distinguish them.`
    }));
  });
}
