// Art only for the locked new themes. Does not register them in the game.
// Usage: node tools/gen-locked-themes.mjs [--force] [--only=signal,rink]
import { existsSync, copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { need, pool, retry, save } from './lib.mjs';

const MODEL = 'gemini-nano-banana-2.1';
const key = need('GEMINI_API_KEY');
const args = process.argv.slice(2);
const force = args.includes('--force');
const only = new Set((args.find((a) => a.startsWith('--only='))?.slice(7) || '').split(',').filter(Boolean));
const ROOT = 'assets-src/art';
const NO = 'Absolutely no text, letters, numbers, words, logos, signage, watermarks, UI, captions, or frames.';
const PAINT = 'Painterly cinematic illustration for a premium solitaire game. Sophisticated, cohesive, not a photograph, not 3D, not anime.';

const COURT = `Square 1:1 full-bleed illustration. ONE upright head-and-shoulders person, facing slightly toward the viewer. Not a playing card, not mirrored, not a second upside-down figure. No rank, suit, border, or card outline. Place the face and hair in the upper half of the square, large enough to read at postage-stamp size, with the shoulders continuing through the middle. Simple uncluttered background. ${NO}`;

const themes = [
  {
    id: 'signal',
    name: 'Signal',
    palette: 'polar night navy, dish white, amber instrument glow, dry grass grey, cold starlight',
    board: 'a matte charcoal metal table with a slim amber inlay only at the outer rim and tiny rivets in the corners. The center is empty, even, and dark.',
    backdrop: 'a lone radio telescope dish in a dark valley under a dense star field, a small lit shack, no people',
    hero: 'the great white dish fills the right half under a huge star field. A small shack window glows amber. Left third is dark open valley. Right foreground: a fan of face-down cards on a metal case, backs printed with a simple dish silhouette and concentric signal rings in navy and amber',
    back: 'point-symmetric card back, full-bleed flat print, no card outline. Navy field, a white dish medallion, thin concentric rings, a small amber center, spare and technical',
    courts: {
      j: 'a young night-shift radio operator with over-ear headphones and a wool collar, amber light on one cheek',
      q: 'a woman astronomer with a folded star chart and a calm expression, navy coat, cold rim light',
      k: 'an older station chief with silver hair, a thermos, and a weathered parka, quiet authority',
    },
    courtBg: 'plain deep navy background with a faint amber rim light',
  },
  {
    id: 'rink',
    name: 'Roller Rink',
    palette: 'maple wood, mirror-ball silver, magenta, teal, warm tungsten',
    board: 'a satin maple wood floor seen from above, with a thin magenta painted line and tiny square mirror tiles only in the outer rim. The center is calm honey-maple, low contrast, empty.',
    backdrop: 'an indoor roller rink at night, a huge mirror ball, colored lights on a maple oval, empty of skaters, no signage',
    hero: 'a glittering mirror ball and a sweep of magenta and teal light over an empty maple rink on the right. Left third falls into warm dark. Right foreground: face-down cards on the rail, backs of silver facets and a magenta ring',
    back: 'point-symmetric card back, full-bleed, no card outline. Silver faceted mirror-ball medallion, magenta and teal rings, maple-cream field, disco but elegant',
    courts: {
      j: 'a young rink guard in a satin jacket with skates over one shoulder, friendly, 1970s',
      q: 'a woman mid-skate pose from the waist up, feathered hair, teal satin jacket, joyful and sharp',
      k: 'an older DJ in the booth light, headphones around the neck, gold chain modest, magenta rim light',
    },
    courtBg: 'plain warm dark background with a soft magenta and teal glow',
  },
  {
    id: 'mainstreet',
    name: 'Main Street',
    palette: 'dust purple dusk, weathered pine, saddle leather, one kerosene amber, denim blue',
    board: 'weathered boardwalk planks from directly above, matte, with a slim leather edge and small brass corner tacks. The center is even grey-brown wood, empty, low contrast. Not green felt, not a poker table.',
    backdrop: 'a false-front western main street at purple dusk, one horse at a hitching rail, long shadows, a single lit window, the saloon only a door in the background',
    hero: 'the dusty street and false fronts occupy the right, one horse, purple sky, one warm window. Left third is open dusk sky. Right foreground: face-down cards on a barrel top, backs of tooled leather and a simple star',
    back: 'point-symmetric card back, full-bleed, no card outline. Dust-purple and leather brown, a paired horseshoe and star medallion, restrained western ornament, not a saloon poster',
    courts: {
      j: 'a young wrangler in a worn hat and denim, dust on the collar, late light, no guns drawn',
      q: 'a woman who keeps the general store, practical blouse, grey-streaked hair, a brass scale weight in one hand',
      k: 'an older sheriff at the end of the day, silver moustache, vest, badge unreadable, tired and kind',
    },
    courtBg: 'plain dusk-plum background with warm dust light',
  },
  {
    id: 'plaster',
    name: 'Plaster Studio',
    palette: 'plaster white, linen, clay pink, cool north-light grey, soft charcoal',
    board: 'a pale plaster-dusted worktop from above, matte, with a slim clay-colored rim and tiny plaster fragments only at the corners. The center is even warm white, empty, low contrast.',
    backdrop: 'a sculptor studio in cool north light, dust sheets, casts of hands and faces along the walls, one figure half-emerged from a mold, no living person',
    hero: 'the unfinished plaster figure and dust sheets fill the right, cool window light. Left third is quiet grey wall. Right foreground: face-down cards on a linen-covered bench, backs of a pale relief medallion',
    back: 'point-symmetric card back, full-bleed, no card outline. Warm white and clay, a low-relief classical face medallion very simplified, fine plaster texture, fragile and calm',
    courts: {
      j: 'a young studio assistant with plaster dust in their hair and a soft brush, linen shirt',
      q: 'a sculptor with calipers, hair pinned up, clay-smudged apron, intelligent and still',
      k: 'an older master caster, white hair, dusted hands held quiet, north light on a calm face',
    },
    courtBg: 'plain warm-grey plaster background',
  },
  {
    id: 'darkroom',
    name: 'Darkroom',
    palette: 'safelight red, amber-black, tray silver, photographic cream, deep shadow',
    board: 'a matte black bench from above with a narrow safelight-red rim and small metal corners. The center is even near-black, empty, low contrast, no glare. No cards, no deck, no trays, no bottles, no objects anywhere in the frame.',
    backdrop: 'a photographer darkroom in deep red safelight, hanging prints, three developing trays, an enlarger, no person, no readable pictures',
    hero: 'red safelight, dripping prints and an enlarger on the right, almost no other color. Left third is pure dark. Right foreground: face-down cards whose backs are a red field and a silver aperture ring',
    back: 'point-symmetric card back, full-bleed, no card outline. Deep red and black, a camera-aperture medallion in silver, fine rings, no lens logos',
    courts: {
      j: 'a young darkroom assistant holding print tongs, face lit only by red safelight',
      q: 'a photographer at the enlarger, hair back, red light on one side of the face, focused',
      k: 'an older printer with silver temples, a loupe in one hand, patient, red and black only',
    },
    courtBg: 'plain near-black background with red safelight',
  },
  {
    id: 'castle',
    name: "Dracula's Castle",
    palette: 'candle amber, stone grey, dried-blood crimson, black oak, cold moonlight',
    board: 'dark oak boards from above with a thin crimson cloth edge and small iron corners. The center is even black-brown, empty, low contrast. No pentagrams.',
    backdrop: 'the threshold of a Transylvanian castle at night, tall doors ajar, one candle, stone stairs, cold moon, no monsters in the open, dread and beauty',
    hero: 'the open castle door and a single candle occupy the right, moonlight on stone. Left third is dark sky. Right foreground: face-down cards on a stone sill, backs of black and crimson with a thin gothic arch',
    back: 'point-symmetric card back, full-bleed, no card outline. Black and crimson, a gothic arch and a small bat-wing shape used as ornament, candle-gold line, elegant not cartoon',
    courts: {
      j: 'a pale young footman in a high-collar black coat, holding one candle, uneasy courtesy',
      q: 'the lady of the house, severe beauty, high lace collar, dark wine gown, candlelight, no fangs',
      k: 'the count, older, aquiline, black evening coat, one candle, restrained menace, no comedy fangs, no cape flourish',
    },
    courtBg: 'plain charcoal background with a small candle glow',
  },
  {
    id: 'bathysphere',
    name: 'Diving Bell',
    palette: 'abyssal blue-black, bioluminescent cyan, pale jellyfish rose, brass, pressure-glass',
    board: 'a dark brushed-brass interior floor from above, rivets only at the rim, a faint cyan edge reflection. The center is even blue-black, empty, low contrast.',
    backdrop: 'outside a round diving bell in the deep ocean, glowing jellyfish, one cone of light, black water, no boat, no sky',
    hero: 'the brass sphere and a cloud of pale jellyfish fill the right, one porthole glowing. Left third is black water. Right foreground: face-down cards on the bell rim, backs of brass rings and a jellyfish bell',
    back: 'point-symmetric card back, full-bleed, no card outline. Blue-black field, a radial jellyfish medallion in pale rose and cyan, thin brass ring',
    courts: {
      j: 'a young diver in a round brass helmet with the faceplate open, cyan rim light, wool collar',
      q: 'a marine scientist with a glass specimen jar of faint light, practical, not a mermaid',
      k: 'an older expedition lead with a grey beard and brass pressure gauges on his coat, calm under pressure',
    },
    courtBg: 'plain abyssal blue background with a soft cyan edge',
  },
  {
    id: 'lookout',
    name: 'Fire Lookout',
    palette: 'forest green far below, weathered pine, stove orange, smoke blue, dusk violet',
    board: 'weathered pine boards from above, a slim soot-dark rim, tiny brass map pins only in the corners. The center is even muted pine, empty, low contrast.',
    backdrop: 'a fire-lookout cab on stilts above an endless forest at dusk, a small stove, the Osborne fire-finder table, lightning far away, no people',
    hero: 'the lookout cab and the forest canopy far below fill the right, one warm stove. Left third is open dusk. Right foreground: face-down cards on the map table, backs of a simple compass and pine ring. Not a summer camp, no marshmallows, no canoe',
    back: 'point-symmetric card back, full-bleed, no card outline. Pine green and smoke blue, a compass-rose medallion, thin stove-orange ring, spare',
    courts: {
      j: 'a young lookout with binoculars at the chest, flannel, windburned, alert',
      q: 'a ranger with a map tube, hair in a braid, canvas jacket, capable and quiet',
      k: 'an older observer with a tin cup, grey stubble, the face of someone who has watched weather for years',
    },
    courtBg: 'plain dusk-violet background with a small warm stove glow',
  },
  {
    id: 'cinema',
    name: 'Silent Cinema',
    palette: 'silver nitrate, carbon-arc white, velvet burgundy, amber, soft black',
    board: 'a matte black stage floor from above with a thin worn-gold rim. The center is even charcoal, empty, low contrast. No spotlight beam across the center.',
    backdrop: 'a 1920s picture palace seen from the back of the balcony, a cone of projector light, empty seats, an organ, no titles on the screen, the screen is blank white light',
    hero: 'the projector beam and empty velvet seats fill the right, silver and amber. Left third is dark balcony. Right foreground: face-down cards on the velvet rail, backs of an iris-circle and a small reel. Silent-film era, earlier and quieter than art deco nightlife',
    back: 'point-symmetric card back, full-bleed, no card outline. Black and silver, an iris diaphragm medallion, thin burgundy and amber line, geometric and quiet',
    courts: {
      j: 'a young usher in a braided 1920s uniform and pillbox hat, a small unlit flashlight, eager',
      q: 'a woman pianist from the pit, bobbed hair, simple dark dress, hands not needed in frame, warm amber light',
      k: 'an older projectionist with a film reel under one arm, shirtsleeves, carbon smudge, kind and precise',
    },
    courtBg: 'plain warm-black background with a soft projector-white rim',
  },
  {
    id: 'backrooms',
    name: 'Backrooms',
    copyHero: 'docs/previews/liminal-art-test/liminal-hero.png',
    palette: 'moist butter yellow, nicotine cream, fluorescent green-white, stained beige, a faint pink',
    board: 'stained beige low-pile carpet from directly above, with a slim yellow wallpaper edge only at the rim. The center is even dull beige, empty, low contrast, slightly damp.',
    backdrop: 'an endless empty office corridor of moist pale-yellow damask wallpaper, humming fluorescent panels, stained carpet, one distant door, no people, original painted scene',
    hero: '',
    back: 'point-symmetric card back, full-bleed, no card outline, no white gap, no horizontal stripe cutting the design. Moist butter-yellow damask, a small fluorescent-rectangle medallion at the exact center only, stained cream, uneasy and even',
    courts: {
      j: 'a young night janitor in a plain outdated uniform, mop handle cropped out, fluorescent light, ordinary and slightly wrong',
      q: 'a woman in a dated beige office dress, stiff smile, yellow wallpaper tone on her face, not monstrous',
      k: 'an older supervisor in a short-sleeve shirt and loose tie, exhausted, fluorescent pallor, kind but lost',
    },
    courtBg: 'plain moist yellow-beige background',
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    copyHero: 'docs/previews/liminal-art-test/vaporwave-hero.png',
    palette: 'magenta, cyan, peach sunset, pink marble, teal glass, cream',
    board: 'pink-and-teal marble tiles from above, very quiet in the center so cards will read, with a stronger checker only in the outer rim. The center is a soft even rose, low contrast, empty.',
    backdrop: 'a deserted 1990s mall atrium at sunset, glass dome, palm, plaster bust, checkerboard floor far away, pink and cyan sky, no shop names',
    hero: '',
    back: 'point-symmetric card back, full-bleed flat print, no rounded card corners, no card outline. Pink marble and teal, mirrored palm fronds, a small classical column medallion, cream and magenta',
    courts: {
      j: 'a teenager in a 1990 pastel windbreaker, headphones around the neck with no logo, mall sunset light, relaxed',
      q: 'a woman in a cream blazer and big soft hair, gold hoop earrings plain, teal and pink light, poised',
      k: 'an older man in a pale linen suit, the architect of the mall, silver hair, sunset on one side of his face, dignified',
    },
    courtBg: 'plain gradient background of peach to pink, no pattern',
  },
];

function boardPrompt(t) {
  return `${PAINT} Top-down orthographic texture of a card-table surface, filling the frame edge to edge, no surrounding room. ${t.board} Palette: ${t.palette}. ${NO}`;
}
function backdropPrompt(t) {
  return `${PAINT} Wide 16:9 environment panorama. ${t.backdrop}. Palette: ${t.palette}. No cards. ${NO}`;
}
function heroPrompt(t) {
  return `${PAINT} Wide 16:9 title-screen key art. ${t.hero}. Palette: ${t.palette}. ${NO}`;
}
function backPrompt(t) {
  return `${PAINT} ${t.back}. Palette: ${t.palette}. The pattern must reach every edge. ${NO}`;
}
function courtPrompt(t, who) {
  return `${PAINT} ${COURT} ${who}. ${t.courtBg}. Palette: ${t.palette}.`;
}

function jobsFor(t) {
  const base = [
    ['board', '16:9', boardPrompt(t)],
    ['backdrop', '16:9', backdropPrompt(t)],
    ['back', '3:4', backPrompt(t)],
    ['court_j', '1:1', courtPrompt(t, t.courts.j)],
    ['court_q', '1:1', courtPrompt(t, t.courts.q)],
    ['court_k', '1:1', courtPrompt(t, t.courts.k)],
  ];
  if (!t.copyHero) base.unshift(['hero', '16:9', heroPrompt(t)]);
  return base.map(([id, aspect, prompt]) => ({ theme: t.id, id, aspect, prompt, ref: t.copyHero && id !== 'hero' ? `${ROOT}/${t.id}/hero.png` : null }));
}

async function gen(item) {
  const out = `${ROOT}/${item.theme}/${item.id}.png`;
  if (!force && existsSync(out)) return console.log('skip', out);
  const parts = [];
  if (item.ref && existsSync(item.ref)) {
    parts.push({ inlineData: { mimeType: 'image/png', data: readFileSync(item.ref).toString('base64') } });
    parts.push({ text: `The attached image is an approved style and palette reference only. Do not copy its layout. Match its medium, color, and mood.\n\n${item.prompt}` });
  } else {
    parts.push({ text: item.prompt });
  }
  const body = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: item.aspect, imageSize: '2K' } },
  };
  await retry(async () => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 400)}`);
    const json = await res.json();
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
    if (!part) throw new Error('no image: ' + JSON.stringify(json).slice(0, 280));
    save(out, Buffer.from((part.inlineData || part.inline_data).data, 'base64'));
    console.log('ok', out);
  });
}

const chosen = themes.filter((t) => !only.size || only.has(t.id));
for (const t of chosen) {
  mkdirSync(`${ROOT}/${t.id}`, { recursive: true });
  if (t.copyHero) {
    const dest = `${ROOT}/${t.id}/hero.png`;
    if (force || !existsSync(dest)) copyFileSync(t.copyHero, dest);
    console.log('hero', dest);
  }
}

const items = chosen.flatMap(jobsFor);
let failed = 0;
await pool(items, 3, (item) => gen(item).catch((e) => {
  failed += 1;
  console.error('FAIL', item.theme, item.id, e.message);
}));
if (failed) process.exitCode = 1;
console.log(`done ${items.length - failed}/${items.length}`);
