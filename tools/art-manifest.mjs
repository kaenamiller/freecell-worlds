// Prompts for every generated image. One entry per file: assets-src/art/<theme>/<id>.png
const NO_TEXT = ' Absolutely no text, letters, numbers, writing, logos, watermarks or UI.';

export const STYLE = {
  carvings:
    'Northwest Coast Indigenous-art-inspired painted cedar sculpture and bold formline-inspired graphic animal art, original contemporary compositions rather than copies of existing family crests or specific artworks, carved red cedar with visible chisel marks, charcoal black, vermilion, warm ivory and restrained blue-green, misty Pacific coastal forest atmosphere, grounded and sculptural, detailed premium game art.',
  varsity:
    'nostalgic collegiate varsity clubhouse aesthetic for an invented university, deep navy wool, chenille athletic patches, cream stitching, oxblood leather, collegiate gold and aged brass, letterman jackets and pennants, vintage mid-century athletic-poster illustration, warm autumn game-day afternoon, original fictional insignia and no real school logos, detailed premium game art.',
  driftwood:
    'sleepy fishing-village nautical aesthetic, silvered driftwood and worn seafoam paint, slate blue, chalk white, small rust-red accents and aged brass, rope knots, wool sweaters and yellow oilskin coats, weathered timber waterfront cottages, small working fishing boats, serene early-morning sea mist, cozy pen-and-watercolor illustration mixed with cinematic material detail, premium game art.',
  roman:
    'neo-classical ancient Roman and Greek aesthetic: polished white and green-veined marble architecture, fluted columns, gold-leaf statues and ornaments, warm Mediterranean sunlight, deep burgundy and ivory and antique gold palette, cinematic and luxurious, highly detailed, AAA game art.',
  cyber:
    'cyberpunk future neon grime aesthetic: rain-slicked megacity, wet asphalt, grimy industrial tech, saturated magenta and cyan and acid-yellow neon, holographic signage glow, volumetric haze, cinematic and gritty, highly detailed, AAA game art.',
  aero:
    'Frutiger Aero ocean dolphincore aesthetic: glossy aqua and turquoise water, glassy bubbles, rainbow light refractions, lens flares, sparkling sun rays, tropical fruit, friendly bottlenose dolphins, early-2000s optimistic skeuomorphic vibe, clean bright saturated colors, highly detailed, AAA game art.',
  zen:
    'Japanese zen garden aesthetic: sumi-e ink wash and ukiyo-e influences, washi paper texture, raked gravel, moss-covered stones, cherry blossoms, vermilion lacquer and soft gold leaf, misty mountains, serene morning light, refined and minimal, highly detailed, AAA game art.',
  forest:
    'enchanted storybook forest aesthetic: moonlit ancient trees, thick emerald moss, ferns, glowing blue and amber mushrooms, fireflies, faint glowing runes, soft god rays, magical fairy-tale atmosphere, rich greens and teals with warm amber glow, highly detailed, AAA game art.',
  deco:
    '1920s Art Deco aesthetic: black lacquer and emerald green, brushed brass and champagne gold, geometric sunburst fans and chevrons, jazz-age glamour, warm lamplight and a hint of smoke, ivory and burgundy accents, elegant symmetric design, highly detailed, AAA game art.',
  muertos:
    'Día de los Muertos aesthetic: glowing orange marigolds, candlelight, colorful papel picado banners, painted sugar skulls, embroidered flowers in magenta teal and purple, deep indigo night, warm celebratory and reverent mood, highly detailed, AAA game art.',
  space:
    'clean optimistic sci-fi starship aesthetic: bright orbital station and bridge interiors, smooth white and light-grey panels, rounded console shapes with orange, lavender and blue accent lighting, big observation windows onto stars, planets and nebulae, crisp hopeful 1990s-inspired future, highly detailed, AAA game art.',
  azulejo:
    'Portuguese azulejo aesthetic: hand-painted cobalt-blue botanical and maritime ornament on warm white glazed ceramic, traditional Lisbon courtyard architecture, limestone arches, subtle glaze crazing and imperfect brush strokes, Atlantic sea light, predominantly white and blue with restrained aged brass, refined sunlit luxury, highly detailed game art.',
  jetset:
    '1962 jet-set mid-century modern retro-futurism: sweeping sculptural airport architecture, curved panoramic windows, elegant walnut furniture, cream terrazzo, satin aluminum, tomato-red upholstery and powder-blue accents, optimistic glamorous golden age of air travel, sophisticated cinematic travel-poster mood, highly detailed game art, fictional airline with no real branding.',
  riverboat:
    '1870s Mississippi paddle-steamer casino aesthetic: lavish Victorian riverboat salon, polished mahogany, deep bottle-green felt, oxblood velvet, engraved antique brass, tobacco-cream paper, warm oil lamps and chandeliers, charming roguish high-stakes poker atmosphere, rich cinematic period detail, original characters rather than film actors.',
};

const COURT = {
  carvings: {
    j: 'a bold stylized raven rendered as an original painted red-cedar animal carving, charcoal beak and vermilion and ivory geometric detailing with blue-green accents, highly readable sculptural silhouette, not a human figure, no human costume, no specific clan crest',
    q: 'a powerful stylized bear rendered as an original painted red-cedar animal carving, rounded ears and strong expressive animal silhouette with charcoal, vermilion and ivory geometric detailing, not a human figure, no human costume, no specific clan crest',
    k: 'a majestic stylized orca rendered as an original painted red-cedar animal carving, bold black-and-ivory sweeping shape with vermilion detailing and a distinctive dorsal fin, highly readable sculptural silhouette, not a human figure, no human costume, no specific clan crest',
  },
  varsity: {
    j: 'a confident young track athlete wearing a navy-and-cream letterman jacket with a small abstract athletic patch and holding a relay baton, original fictional university athlete, vintage screen-printed athletic-poster illustration with crisp navy, cream, gold and oxblood color shapes',
    q: 'a confident collegiate tennis champion with a short vintage waved haircut, a cream tennis sweater and navy-and-gold varsity jacket draped over her shoulders, holding a wooden tennis racket, original fictional university athlete, vintage screen-printed athletic-poster illustration with crisp navy, cream, gold and oxblood color shapes',
    k: 'a broad-shouldered collegiate football captain wearing an oxblood-and-navy letterman jacket with cream leather sleeves and holding a vintage brown leather football, original fictional university athlete, vintage screen-printed athletic-poster illustration with crisp navy, cream, gold and oxblood color shapes',
  },
  driftwood: {
    j: 'a friendly young fishing-boat deckhand wearing a navy wool watch cap, striped sweater and faded seafoam work jacket, holding a coil of rope, warm expressive pen-and-watercolor portrait with visible paper texture and clean readable silhouette',
    q: 'a seasoned female harbor skipper wearing a mustard-yellow oilskin coat and a blue wool scarf, wind-tousled hair and a quiet confident smile, holding a small nautical chart without writing, warm expressive pen-and-watercolor portrait with visible paper texture and clean readable silhouette',
    k: 'a kindly old fisherman with a grey beard, navy wool cap, weathered face and chunky cream cable-knit sweater beneath a slate-blue coat, warm expressive pen-and-watercolor portrait with visible paper texture and clean readable silhouette',
  },
  azulejo: {
    j: 'a Portuguese maritime navigator with a period cap and a small brass compass, rendered entirely in expressive cobalt-blue hand-painted ceramic brushwork on ivory glaze, strong traditional mirrored-card silhouette',
    q: 'a regal Portuguese queen wearing a delicate crown and richly patterned robes, framed by blue botanical scrollwork, rendered entirely in cobalt-blue hand-painted ceramic brushwork on ivory glaze',
    k: 'a dignified Portuguese maritime king with a beard and ornate crown, holding a ship-shaped ceremonial ornament, rendered entirely in cobalt-blue hand-painted ceramic brushwork on ivory glaze',
  },
  jetset: {
    j: 'a handsome early-1960s airline navigator in a powder-blue uniform with a wing pin and peaked cap, holding a folded route chart without writing, flat mid-century travel-poster illustration with bold clean shapes and limited shading',
    q: 'a glamorous early-1960s jet-set traveler with a sculptural coiffure, ivory silk scarf, tomato-red coat and pearl earrings, flat mid-century travel-poster illustration with bold clean shapes and limited shading',
    k: 'a distinguished silver-haired airline captain in a navy uniform with satin-gold wings and a white peaked cap, flat mid-century travel-poster illustration with bold clean shapes and limited shading',
  },
  riverboat: {
    j: 'a charming young riverboat gambler with a rakish smile, dark wavy hair, oxblood waistcoat, silk cravat and pocket-watch chain, original character, finely engraved Victorian playing-card illustration with hand-tinted colors',
    q: 'a commanding elegant riverboat casino hostess with a dark updo, emerald silk gown, lace collar, pearl earrings and an ornate folding fan, original character, finely engraved Victorian playing-card illustration with hand-tinted colors',
    k: 'a silver-haired riverboat casino proprietor with a neat moustache and beard, black frock coat, bottle-green waistcoat and gold watch chain, original character, finely engraved Victorian playing-card illustration with hand-tinted colors',
  },
  roman: {
    j: 'a young heroic Roman legionary in a crested helmet, rendered as a gold statue bust, polished metallic gold with marble-pedestal feel',
    q: 'a regal Greek goddess in the manner of Athena with a laurel diadem and draped chiton, rendered as a gold statue bust, polished metallic gold',
    k: 'a stern bearded Roman emperor wearing a laurel wreath, rendered as a gold statue bust, polished metallic gold',
  },
  cyber: {
    j: 'a street-samurai hacker with a glowing cyan visor, shaved sides, neon tattoos and cybernetic jaw implants',
    q: 'a neon-haired cyberpunk diva with a holographic magenta halo, chrome cheek plating and glowing eyes',
    k: 'a ruthless corporate overlord with a chrome crown-like headpiece, cybernetic eye, high collar and rain-wet black coat',
  },
  aero: {
    j: 'a cheerful bottlenose dolphin leaping out of glossy water wearing a little sailor captain hat, splashing droplets',
    q: 'an elegant dolphin wearing a pearl-and-coral tiara, with a rainbow water arc and floating bubbles behind her',
    k: 'a majestic dolphin wearing a golden crown, surrounded by sparkling water spray, citrus slices and a rainbow',
  },
  zen: {
    j: 'a young samurai retainer with a topknot and a simple indigo kimono, calm and dignified, painted in ukiyo-e woodblock style with bold ink outlines',
    q: 'an elegant Heian-era empress in layered silk robes with an ornate hair comb and a folding fan, painted in ukiyo-e woodblock style with bold ink outlines',
    k: 'a stern wise shogun in ornate vermilion and black armour with a horned kabuto helmet, painted in ukiyo-e woodblock style with bold ink outlines',
  },
  forest: {
    j: 'a mischievous young woodland elf scout with pointed ears, a leaf-green hood and a tiny lantern, storybook illustration style',
    q: 'a graceful fae queen with long flowing hair, a crown of glowing flowers and translucent dragonfly wings, storybook illustration style',
    k: 'a wise ancient elf king with a long beard, a crown of antlers and oak leaves and a moss-green cloak, storybook illustration style',
  },
  deco: {
    j: 'a dapper young bellhop-jazz trumpeter in a pillbox cap and a buttoned jacket, 1920s Art Deco poster illustration with bold geometric gold and black shapes',
    q: 'a glamorous flapper queen with a sleek bob, a feathered headband, long pearl necklaces and a cigarette holder, 1920s Art Deco poster illustration with bold geometric gold and black shapes',
    k: 'a powerful gangster boss king in a pinstripe suit, a fedora and a gold pocket watch chain, 1920s Art Deco poster illustration with bold geometric gold and black shapes',
  },
  muertos: {
    j: 'a smiling calavera mariachi guitarist skeleton in a charro jacket and sombrero, face painted as an ornate sugar skull with colourful flowers, folk-art illustration',
    q: 'an elegant La Catrina skeleton lady in a wide feathered hat and a flower crown of marigolds, ornate sugar skull face paint, folk-art illustration',
    k: 'a regal skeleton king with an ornate sugar skull face, a marigold crown and a rich embroidered cape, folk-art illustration',
  },
  space: {
    j: 'a bright young space-station ensign in a sleek form-fitting jumpsuit with a teal collar and a small comm badge, confident smile, clean sci-fi concept-art illustration',
    q: 'a poised station captain, a woman with a short elegant haircut in a sleek uniform with gold collar trim and a comm badge, clean sci-fi concept-art illustration',
    k: 'a distinguished fleet admiral with silver hair and a neat beard in a dark uniform with gold and red collar trim and rank insignia, clean sci-fi concept-art illustration',
  },
};

const BG = {
  carvings: 'against a plain dark charcoal-cedar background with soft side light revealing carving depth',
  varsity: 'against a plain warm cream paper background with one restrained navy-and-gold pennant shape',
  driftwood: 'against a plain chalk-white watercolor-paper background with a faint slate-blue wash',
  azulejo: 'against a plain ivory glazed-ceramic background with very faint blue brushwork',
  jetset: 'against a plain warm cream background with a restrained powder-blue abstract arc',
  riverboat: 'against a plain tobacco-cream paper background with faint engraved hatching',
  roman: 'against a plain flat dark burgundy background',
  cyber: 'against a plain flat dark indigo background with faint magenta rim light',
  aero: 'against a plain flat soft aqua-blue background',
  zen: 'against a plain flat soft cream washi-paper background with a faint ink-wash mountain',
  forest: 'against a plain flat dark mossy-green background with soft glowing bokeh lights',
  deco: 'against a plain flat black background with a thin gold geometric sunburst fan behind the head',
  muertos: 'against a plain flat deep indigo background with a few marigold petals',
  space: 'against a plain flat deep navy background with a soft bokeh of stars',
};

// Per-theme scene descriptions.
const DESC = {
  carvings: {
    board: 'A continuous dark smoked-cedar playing surface with subtle long wood grain, a broad hand-carved red-cedar border confined to the outermost edges, original interlocking abstract animal-inspired relief with charcoal-black, vermilion and ivory painted details and a little blue-green. Raking light reveals gentle chisel marks. Centre remains flat, evenly dark and unornamented, no animal figures, symbols or strong lines in the central playing area.',
    backdrop: 'A sheltered open-sided cedar pavilion beside a misty Pacific coastal inlet, two large original painted animal-carving poles standing at the far margins, dark evergreen forest and distant mountains across the still water, pale overcast morning light, quiet atmospheric composition. No ceremonial performance or people.',
    hero: 'A beautifully carved and painted original cedar raven sculpture on the RIGHT side of a cedar pavilion, a neat fan of ivory playing cards with bold red-and-black backs on a wooden ledge below, larger carved animal poles at the edge of a misty coastal inlet and evergreen forest beyond. LEFT third calm dark cedar paneling for title readability. Strong sculptural lighting and painted relief, no human figures.',
    back: 'A bold flat original symmetrical animal-inspired graphic with interlocking raven-like wings and abstract wave forms, charcoal-black field with vermilion, warm ivory and a small blue-green accent, clean thick flowing lines and carved-wood-inspired border. Do not reproduce an existing family crest or named artwork. No human figures, feathers as costume or lettering.',
  },
  varsity: {
    board: 'A continuous deep navy wool-felt playing surface with subtle woven fibres. Cream double-stitched seams run only around the outermost border, oxblood leather edging, small gold-and-cream chenille athletic patches only at the extreme corners, a restrained brass line at the edge. Centre is uninterrupted navy with even low contrast, no central crest, no balls, jackets, equipment, gridiron lines or objects on the playing area.',
    backdrop: 'A cozy vintage university athletics clubhouse with walnut paneling, oxblood leather benches, navy-and-cream letterman jackets hanging on hooks, wool pennants and a glass trophy cabinet. Tall windows show autumn trees and a distant football stadium under warm afternoon sunlight. All athletic symbols are fictional abstract shapes without lettering.',
    hero: 'A charismatic vintage college athlete in a navy wool letterman jacket with cream leather sleeves on the RIGHT, casually holding a neat fan of playing cards beside a navy-felt clubhouse table, autumn campus and stadium beyond the windows, pennants and trophy case behind. LEFT third calm dark navy-and-walnut interior for title readability. Warm nostalgic collegiate atmosphere.',
    back: 'An original embroidered varsity athletic patch composition: deep navy wool field, cream double stitching, gold chenille star and laurel forms, paired symmetrical oxblood pennants and a bold central abstract winged ball emblem. Clearly tactile fabric and embroidery, crisp clean collegiate geometry, no lettering, no real university or professional team logo.',
  },
  driftwood: {
    board: 'A weathered driftwood-rimmed tabletop with a continuous muted medium-dark slate-blue painted central inset, fine quiet brush texture and subtle wear only at the edges. Silvered driftwood and neatly laid pale rope edging form the outermost border, small aged-brass fasteners and tiny rust-red corner accents. Centre stays uninterrupted and evenly slate blue, no central compass, grid, rope, boats, shells, maps or objects.',
    backdrop: 'A sheltered waterfront cafe porch in a sleepy fishing village at dawn, silvered timber railings and faded seafoam-painted cottages, small working fishing boats gently moored among pilings, rope coils and lobster pots at the margins, a distant lighthouse softened by pale sea mist, quiet slate-blue harbor water and warm light from one cottage window.',
    hero: 'A peaceful waterfront cafe porch with a kindly old fisherman in a navy wool cap and cream sweater on the RIGHT, a fan of ivory playing cards on a small driftwood table beside a ceramic mug. Small fishing boats, crooked seafoam timber cottages and a distant lighthouse across a sleepy misty harbor. LEFT third quiet shaded slate-blue porch wall for title readability. Cozy contemplative morning atmosphere.',
    back: 'Slate-blue and seafoam flat nautical card-back artwork with mirrored chalk-white rope knots and gentle wave lines, a small perfectly symmetric compass medallion, rust-red accents and a weathered cream rope border, hand-drawn pen-and-watercolor print texture, understated elegant working-harbor feel, no skulls, pirate motifs or lettering.',
  },
  azulejo: {
    board: 'An ivory glazed ceramic tabletop, a quiet continuous warm-white central field with extremely subtle glaze crazing. Elaborate hand-painted cobalt-blue azulejo tile borders with maritime waves, botanical scrolls and tiny compass rosettes ONLY along the outermost edges. Thin blue grout lines only in the decorative border, no central grid or medallion. Soft ivory centre, no baked-in harsh reflections or shadows.',
    backdrop: 'A sunlit Portuguese seaside courtyard with cobalt-and-white azulejo walls, pale limestone arches, climbing bougainvillea at the margins and a distant blue Atlantic harbor through an arch, warm afternoon light, airy and serene.',
    hero: 'A beautiful sunlit Portuguese tiled terrace overlooking a blue harbor, a magnificent cobalt-and-white ceramic vase and a neat fan of blue-backed ivory playing cards on a small tiled table on the RIGHT half of the frame, limestone arches and flowering greenery, the LEFT third is quiet whitewashed wall and soft shadow for title readability.',
    back: 'Warm-white glazed ceramic field with intricate cobalt-blue botanical scrollwork, mirrored maritime wave motifs and an elegant symmetrical compass-rose medallion. Exclusively blue and white, handmade painted edges, crisp ornamental azulejo tile border.',
  },
  jetset: {
    board: 'An elegant walnut-rimmed tabletop with a continuous muted powder-blue satin laminate central inset, extremely faint fine material grain, a cream-and-satin-aluminum border at the outer edges with tiny tomato-red mid-century starburst accents only in the extreme corners. No runway, no buildings, no aircraft and no bright lines across the centre. Even low-contrast medium-blue centre for ivory card readability.',
    backdrop: 'A glamorous early-1960s sculptural airport first-class lounge, sweeping curved panoramic windows, cream terrazzo, walnut and red lounge chairs, a polished silver passenger jet parked beyond the glass, peach sunset fading into powder-blue sky, no lettering or logos.',
    hero: 'A glamorous early-1960s traveler with a silk scarf and tomato-red coat standing on the RIGHT of a sweeping sculptural airport lounge, holding a neat fan of ivory playing cards, a silver jet through curved windows and peach sunset beyond, LEFT third calm cream architecture in shade for title readability, vintage travel-poster composition.',
    back: 'Muted powder-blue field with ivory sweeping flight-path arcs, paired abstract satin-aluminum aircraft silhouettes, tomato-red starbursts and a symmetrical central winged geometric medallion for an invented airline. Flat screen-printed mid-century modern graphic design with simple geometric linework, no scrollwork, no filigree, no Victorian ornament, no gradients, no three-dimensional bevels, no branding.',
  },
  riverboat: {
    board: 'A continuous deep bottle-green wool felt playing surface with subtle fine fibres, polished dark mahogany border with engraved antique-brass filigree only at the outermost edges, small oxblood velvet corner accents. Centre stays uninterrupted, dark and even, no chips, cards, money, lamps, objects or central medallion.',
    backdrop: 'A lavish 1870s Mississippi paddle-steamer casino salon with tall river-facing windows, mahogany paneling, oxblood curtains, brass chandeliers and glowing oil lamps. Beyond the windows a broad river at dusk with shoreline lights and another distant paddle steamer, atmospheric warm amber light.',
    hero: 'A charming original riverboat gambler with a rakish smile, oxblood waistcoat and black frock coat on the RIGHT, fanning traditional playing cards beside a green-felt poker table in a magnificent Victorian paddle-steamer salon. Tall windows reveal the Mississippi at sunset and a paddle wheel outside, LEFT third subdued dark mahogany for title readability. No resemblance to any actor.',
    back: 'Traditional oxblood-red engraved card back with tobacco-cream Victorian scrollwork, a paired symmetrical paddle-wheel and river-wave medallion, intricate fine guilloche patterns and antique-gold keylines, perfectly balanced historical playing-card print.',
  },
  roman: {
    board:
      'The surface is deep green-black marble with fine gold veining and a subtle inlaid gold-leaf meander (Greek key) border near the edges and a faint laurel-wreath medallion at the very centre. Dark vignette at the corners.',
    backdrop: 'A grand marble colonnaded atrium open to a golden-hour sky, gold statues in niches, warm light shafts, distant sea.',
    hero: 'A gold statue of a goddess holding a fan of playing cards in front of a marble temple at sunset, dramatic rim light.',
    back: 'Gold meander border, central gold laurel medallion with an eagle, burgundy field with subtle acanthus scrollwork.',
  },
  cyber: {
    board:
      'The surface is dark wet carbon-fibre and asphalt with glowing cyan and magenta circuit-trace lines, grime, puddle reflections, hazard stripes near the edges. Dark vignette at the corners.',
    backdrop: 'A rain-soaked neon alley canyon between towering grimy skyscrapers, huge holographic ads, steam vents, glowing signs, dark sky.',
    hero: 'A neon-lit cyberpunk dealer with a visor fanning glowing playing cards in a rainy alley, dramatic rim light.',
    back: 'Glowing cyan and magenta circuit-board mandala with a central neon hexagon emblem on a near-black field, grungy edges.',
  },
  aero: {
    board:
      'The surface is glossy translucent aqua water seen from above with soft rainbow caustic light patterns, gentle ripples, tiny bubbles, and a pale foam border near the edges. Bright centre, slightly darker corners.',
    backdrop: 'A bright tropical ocean horizon seen from just above the water, sun glitter, rainbow, dolphins leaping in the distance, floating glossy bubbles, fluffy clouds.',
    hero: 'A joyful dolphin leaping through a rainbow arc of water carrying a fan of playing cards, glossy bubbles everywhere.',
    back: 'Aqua gradient field with rainbow bubbles, a central glossy dolphin-shaped emblem, white sparkle border.',
  },
  zen: {
    board:
      'The surface is dark charcoal-slate raked gravel with fine concentric rake lines and gentle wave patterns, a thin vermilion lacquer border with a fine gold-leaf line near the edges, soft moss patches and a few cherry-blossom petals only in the extreme corners. The centre stays calm, even and low-contrast.',
    backdrop: 'A serene Japanese temple garden at dawn seen through a wooden engawa veranda, a koi pond with a red arched bridge, cherry blossom trees in bloom, misty mountains, soft golden light.',
    hero: 'A graceful geisha-inspired figure in a vermilion kimono fanning playing cards beneath cherry blossoms beside a torii gate at dawn, misty mountains behind.',
    back: 'Vermilion and black lacquer card back with a gold-leaf sakura and wave (seigaiha) pattern, a central gold circular crest of a crane, fine border.',
  },
  forest: {
    board:
      'The surface is dark mossy forest floor: deep green velvet moss, tiny ferns and clover, a ring of small glowing blue and amber mushrooms and faint glowing cyan-green runes etched into bark-brown borders near the edges, a few fallen leaves only near the corners. The centre stays calm, even and low-contrast.',
    backdrop: 'A moonlit enchanted forest glade with enormous ancient mossy trees, soft god rays, glowing mushrooms, fireflies and a faint misty brook, deep teal and green shadows with warm amber highlights.',
    hero: 'A graceful fae queen with dragonfly wings holding a fan of glowing playing cards in a moonlit enchanted forest clearing, fireflies swirling around her, dramatic rim light.',
    back: 'Deep emerald card back with a gold-and-green Celtic-knot border, a central glowing crescent moon between oak leaves and tiny stars, subtle bark texture.',
  },
  deco: {
    board:
      'The surface is polished black-emerald lacquer with a fine brass-gold Art Deco border of stepped chevrons and sunburst fans near the edges and a thin gold line grid; the corners have small gold fan motifs only. The centre stays calm, dark and low-contrast with a very faint gold concentric-circle inlay.',
    backdrop: 'A glamorous 1920s Art Deco ballroom lounge with brass chandeliers, emerald velvet curtains, black and gold geometric wall panels, a small stage with a jazz band silhouette, warm smoky lamplight.',
    hero: 'A glamorous 1920s flapper in a sparkling gown fanning playing cards in a golden Art Deco lounge, a jazz band behind her, gold sunburst geometry, dramatic warm light.',
    back: 'Black card back with a gold and emerald Art Deco pattern of concentric fans and chevrons, a central gold sunburst medallion, thin gold border.',
  },
  muertos: {
    board:
      'The surface is deep indigo embroidered cloth with a colourful hand-embroidered border of marigolds, roses and leaves in orange, magenta, teal and purple near the edges and a scalloped papel-picado-style edge; small lit candles only in the extreme corners. The centre stays calm, dark indigo and low-contrast.',
    backdrop: 'A candlelit Día de los Muertos ofrenda at night with tiers of glowing marigolds and candles, sugar skulls, colourful papel picado banners overhead and a distant lantern-lit cemetery, deep indigo and warm orange glow.',
    hero: 'An elegant La Catrina skeleton lady in a flower-crown hat fanning playing cards amid glowing marigolds, candles and papel picado banners at night, dramatic warm rim light.',
    back: 'Deep indigo card back with a colourful folk-art mandala of marigolds, a central painted sugar skull, teal magenta and orange flowers, scalloped border.',
  },
  space: {
    board:
      'The surface is a dark navy holographic star-map tabletop of smooth glass with a thin cyan grid, faint star charts and orbital rings, a rounded border made of segmented orange, lavender and pale-blue panels near the edges, minimal and clean. The centre stays calm, dark and low-contrast.',
    backdrop: 'A clean bright starship observation lounge with a huge curved window looking out onto a ringed planet, a colourful nebula and stars, smooth white panels and rounded consoles glowing orange and blue.',
    hero: 'A confident captain in a sleek uniform fanning glowing playing cards on a bright starship bridge, a huge window behind her showing a ringed planet and nebula, dramatic hopeful lighting.',
    back: 'Navy card back with a clean pattern of concentric orbital rings and stars, rounded orange and lavender accent bars, a central small ringed-planet emblem, thin border.',
  },
};

export function manifest() {
  const out = [];
  for (const t of Object.keys(STYLE)) {
    const s = STYLE[t];
    const d = DESC[t];
    out.push({
      theme: t,
      id: 'board',
      aspect: '16:9',
      size: '2K',
      prompt:
        `Top-down orthographic view of a card-game table surface, filling the whole frame edge to edge, in a ${s} ${d.board} ` +
        'The central area must stay calm and low-contrast so playing cards can sit on top of it legibly. No cards, no characters, no objects in the centre.' +
        NO_TEXT,
    });
    out.push({
      theme: t,
      id: 'backdrop',
      aspect: '16:9',
      size: '2K',
      prompt: `Wide atmospheric environment panorama used as a game backdrop and soft reflection map, in a ${s} ${d.backdrop} Wide cinematic composition, strong light sources for reflections.` + NO_TEXT,
    });
    out.push({
      theme: t,
      id: 'hero',
      aspect: '16:9',
      size: '2K',
      prompt: `Key art for a premium solitaire card game, in a ${s} ${d.hero} Dramatic cinematic composition with empty space on the left third for a title.` + NO_TEXT,
    });
    out.push({
      theme: t,
      id: 'back',
      aspect: '3:4',
      size: '2K',
      prompt: `Design for the back of a premium playing card, perfectly symmetrical (point-symmetric through the centre), full-bleed pattern with ${t === 'jetset' ? 'a simple geometric line border' : 'an ornamental border'}, in a ${s} ${d.back} Flat, straight-on, orthographic artwork that fills the entire frame edge to edge: no card edges, no table, no perspective, no shadows, no blurred background.` + NO_TEXT,
    });
    for (const [r, desc] of Object.entries(COURT[t])) {
      out.push({
        theme: t,
        id: `court_${r}`,
        aspect: '1:1',
        size: '2K',
        prompt:
          `Half-length character portrait for a playing-card court figure (${{ j: 'Jack', q: 'Queen', k: 'King' }[r]}): ${desc}. ` +
          `Centred, facing slightly toward the viewer, filling the frame, ${BG[t]}, in a ${s}` +
          ' Bold readable silhouette that works when reduced to a small card. Full-bleed illustration filling the whole frame: no inner card frame, no white border, no rounded-card outline.' +
          NO_TEXT,
      });
    }
  }
  return out;
}
