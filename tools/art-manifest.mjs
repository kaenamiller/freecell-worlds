// Prompts for every generated image. One entry per file: assets-src/art/<theme>/<id>.png
const NO_TEXT = ' Absolutely no text, letters, numbers, writing, logos, watermarks or UI.';

export const STYLE = {
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
};

const COURT = {
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
      prompt: `Design for the back of a premium playing card, perfectly symmetrical (point-symmetric through the centre), full-bleed pattern with an ornamental border, in a ${s} ${d.back} Flat, straight-on, orthographic artwork that fills the entire frame edge to edge: no card edges, no table, no perspective, no shadows, no blurred background.` + NO_TEXT,
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
