// One-off logo and app-icon explorations. Not part of the production art pipeline.
// Usage: node tools/gen-brand-samples.mjs [--only=logo-globe,icon-planet] [--force]
// Masters land in assets-src/art-staging/brand.
import { existsSync, readFileSync } from 'node:fs';
import { need, pool, retry, save } from './lib.mjs';

const MODEL = process.env.ART_MODEL || 'gemini-nano-banana-2.1';
const key = need('GEMINI_API_KEY');
const args = process.argv.slice(2);
const force = args.includes('--force');
const only = new Set((args.find((arg) => arg.startsWith('--only='))?.slice(7) || '').split(',').filter(Boolean));
const ROOT = 'assets-src/art-staging/brand';
const REF = `${ROOT}/island-reference.png`;
const LOGO_REF = `${ROOT}/logo-o-globe.png`;
// Edit jobs restyle the approved logo using the approved icon, without the island sheet.
const EDIT_REFS = [`${ROOT}/logo-o-bold.png`, `${ROOT}/icon-gs-classic.png`];

const STYLE = `Art direction: the same hand-painted storybook nautical style as the attached island sprites. Traditional gouache and transparent watercolor with fine charcoal contours. Dark teal, indigo, weathered parchment, muted mineral pigments, warm lantern gold. Sophisticated tabletop-game illustration.`;
const ISLANDS = `Tiny floating island boards like the attached reference sit on the globe's surface as its continents: a gold Roman statue on marble, a neon cyber tower, a carnival ferris wheel, a brass diving helmet, a pink blossom tree on raked sand, a wooden saloon, a frosted research hut. Each island is a miniature, readable, with its own painted shoreline ring.`;
const ICON = `App icon for a phone home screen. Square, full bleed, edge to edge, no rounded corners, no border, no frame. Keep every important element inside the central 70 percent so a circular or squircle mask never crops it. One bold readable silhouette that still reads at 48 pixels. No text, letters, numbers, watermark, or UI.`;
const LOGO = `Game logo lockup on one perfectly flat solid background color #0d0806 (near-black warm brown) filling the whole canvas, no texture, no vignette, so it can be cut out. Centered with generous empty margin on every side. The only words are "FreeCell Worlds", spelled exactly like that, with no other text, tagline, letters, or numbers anywhere.`;

const JOBS = [
  {
    id: 'logo-globe-banner',
    ratio: '16:9',
    prompt: `${LOGO}\n\nA small painted globe of teal ocean sits above the wordmark. ${ISLANDS} Beneath it, the words "FreeCell Worlds" in an elegant high-contrast engraved serif, warm antique gold leaf with a thin dark outline, set on a gently arched line. A small spade pip sits as a jewel at the top of the globe. ${STYLE}`,
  },
  {
    id: 'logo-o-globe',
    ratio: '16:9',
    prompt: `${LOGO}\n\nA horizontal wordmark "FreeCell Worlds" set in a refined classical Roman serif in warm antique gold leaf, letterpress crisp. The letter "o" in "Worlds" is replaced by a tiny painted globe of teal ocean dotted with miniature island boards (a gold statue, a ferris wheel, a blossom tree). A thin gold meridian ring circles the globe. Above "FreeCell", four tiny suit pips (spade, heart, diamond, club) in gold and deep red. ${STYLE}`,
  },
  {
    id: 'logo-crest',
    ratio: '4:3',
    prompt: `${LOGO}\n\nA crest emblem: a painted globe of teal ocean with miniature islands as continents, held in a gilded brass armillary ring. A fan of four antique playing cards (ace of spades, ace of hearts, ace of diamonds, ace of clubs) spreads behind the globe like a halo. A parchment ribbon banner sweeps across the bottom reading "FreeCell Worlds" in an engraved gold-and-ink serif. ${ISLANDS} ${STYLE}`,
  },
  {
    id: 'logo-chart',
    ratio: '16:9',
    prompt: `${LOGO}\n\nAn old-world nautical chart cartouche logo. On the left, a painted globe of teal ocean with miniature islands as continents, wrapped by a thin gold compass-rose star whose north point is a spade pip. To its right, the wordmark "FreeCell Worlds" stacked on two lines, "FreeCell" over "Worlds", in a tall engraved serif of warm gold leaf with ink outline, like a title cartouche on a sea chart. ${ISLANDS} ${STYLE}`,
  },
  {
    id: 'icon-globe',
    ratio: '1:1',
    prompt: `${ICON}\n\nA single painted globe of deep teal ocean, lit from the upper left with warm lantern-gold rim light, floating on a deep indigo night-sea background with faint gold stars. ${ISLANDS} The globe fills about 65 percent of the canvas. ${STYLE}`,
  },
  {
    id: 'icon-card-ring',
    ratio: '1:1',
    prompt: `${ICON}\n\nA tiny painted planet of teal ocean dotted with miniature island boards, encircled at a tilt by a ring of fanned antique playing cards like the rings of Saturn, card faces showing classic suit pips. Deep indigo background with faint gold stars and a soft glow behind the planet. ${ISLANDS} ${STYLE}`,
  },
  {
    id: 'icon-spade-world',
    ratio: '1:1',
    prompt: `${ICON}\n\nA bold spade pip silhouette, outlined in thick warm gold leaf, whose interior is a painted world: teal ocean with miniature island boards (a gold Roman statue, a ferris wheel, a blossom tree, a diving helmet) scattered across it, seen three-quarter top down. Deep near-black warm brown background (#0d0806) with a soft gold glow behind the spade. ${STYLE}`,
  },
  {
    id: 'icon-little-world',
    ratio: '1:1',
    prompt: `${ICON}\n\nA small round world, storybook "little planet" style, with a curved teal ocean horizon. On top of it stands one hero island: the gold Roman statue on its marble plinth from the reference, large and centered, with three smaller islands (ferris wheel, blossom tree, saloon) peeking over the curve of the world. An ace of spades playing card stands upright like a sail behind the statue. Deep indigo sky background with faint gold stars. ${STYLE}`,
  },
  {
    id: 'logo-o-stacked',
    ratio: '4:3',
    refs: [LOGO_REF],
    prompt: `${LOGO}\n\nA stacked two-line version of the attached approved wordmark. "FreeCell" on the first line, "Worlds" on the second line set larger. The letter "o" in "Worlds" is a painted globe of teal ocean dotted with miniature island boards, noticeably larger than the other letters and wrapped by a thin tilted gold orbit ring. The four tiny suit pips (spade, heart, diamond, club) sit centered above "FreeCell". Same refined classical serif and warm antique gold leaf as the reference. ${STYLE}`,
  },
  {
    id: 'logo-o-armillary',
    ratio: '16:9',
    refs: [LOGO_REF],
    prompt: `${LOGO}\n\nA one-line wordmark "FreeCell Worlds" in the same classical serif as the attached approved logo, but in pale ivory with a fine gold inline and a thin dark ink outline, like an engraved title plate. The letter "o" in "Worlds" is a small antique armillary globe: a teal ocean sphere with miniature island boards, crossed by two gold meridian rings, with a tiny gold spade pip at its north pole. A slim gold rule runs under "FreeCell" and ends in a small spade. ${STYLE}`,
  },
  {
    id: 'logo-o-bold',
    ratio: '16:9',
    refs: [LOGO_REF],
    prompt: `${LOGO}\n\nA bolder, chunkier version of the attached approved wordmark for small screens. "FreeCell" in smaller spaced capitals above a large "Worlds" in a heavy bracketed display serif. Thick bevelled gold letters with a deep teal-black outline and a soft warm glow. The "o" in "Worlds" is a large painted globe of teal ocean with three clear miniature islands (a gold statue, a ferris wheel, a pink blossom tree) and a gold orbit ring that sweeps behind the "W" and in front of the "r". ${STYLE}`,
  },
  {
    id: 'icon-gs-classic',
    ratio: '1:1',
    prompt: `${ICON}\n\nA single round globe of rich blue-teal painted ocean, fills about 75 percent of the canvas, with soft gouache wave texture and a warm gold rim light. In the exact center of the globe sits one large solid gold spade pip, bold and simple, polished gold leaf with a subtle bevel and a soft shadow on the ocean. The spade covers about half the globe's width. Only a few tiny pale island shapes near the globe's edge, kept faint so the spade dominates. Deep near-black warm brown background (#0d0806). ${STYLE}`,
  },
  {
    id: 'icon-gs-meridian',
    ratio: '1:1',
    prompt: `${ICON}\n\nA blue painted ocean globe crossed by two thin gold meridian lines and a gold equator ring, like an antique navigator's globe. A large solid gold spade pip stands in the center of the globe, flat polished gold with a crisp dark outline, covering about half the globe's width. No islands. Deep indigo background with a soft gold halo behind the globe. Very clean, minimal and bold. ${STYLE}`,
  },
  {
    id: 'icon-gs-orbit',
    ratio: '1:1',
    prompt: `${ICON}\n\nA small blue ocean planet with a solid gold spade pip in its center, the spade bold and simple with a gentle bevel. A single thin gold orbit ring tilts around the globe. Three tiny island boards sit on the globe's rim (a gold statue, a ferris wheel, a pink blossom tree), very small so they never compete with the spade. Deep indigo night background with a few faint gold stars. ${STYLE}`,
  },
  {
    id: 'icon-gs-fullbleed',
    ratio: '1:1',
    prompt: `${ICON}\n\nA blue painted ocean globe so large it nearly fills the square, its curved edge just inside the canvas, with soft gouache waves and a lantern-gold rim light along the upper left. A large solid gold spade pip sits dead center, thick and simple, warm gold leaf with a soft drop shadow. Corners of the canvas are deep near-black indigo. No islands, no stars, no extra detail. ${STYLE}`,
  },
  {
    id: 'logo-spade-ring',
    ratio: '16:9',
    edit: true,
    prompt: `Edit the first image. Keep everything exactly the same — the "FREECELL" capitals, the "Worlds" lettering, the gold finish, teal outline, glow, suit pips, layout, proportions and the flat #0d0806 background. Change only the globe that forms the "o" in "Worlds": replace it with the globe from the second image, a blue painted ocean globe with soft gouache waves and a thin gold rim, with one large solid gold spade pip in its center. No islands, statues or objects on the globe. Keep the same size and position, and keep the gold orbit ring sweeping behind the "W" and in front of the "r".`,
  },
  {
    id: 'logo-spade-plain',
    ratio: '16:9',
    edit: true,
    prompt: `Edit the first image. Keep everything exactly the same — the "FREECELL" capitals, the "Worlds" lettering, the gold finish, teal outline, glow, suit pips, layout, proportions and the flat #0d0806 background. Change only the globe that forms the "o" in "Worlds": replace it with the exact globe from the second image, a blue painted ocean globe with soft gouache waves, a thin gold rim and one large solid gold spade pip in its center. Remove the orbit ring entirely. No islands, statues or objects on the globe. Same size and position as the original globe.`,
  },
  {
    id: 'logo-spade-ring-front',
    ratio: '16:9',
    edit: true,
    prompt: `Edit the first image. Keep everything exactly the same — the "FREECELL" capitals, the "Worlds" lettering, the gold finish, teal outline, glow, suit pips, layout, proportions and the flat #0d0806 background. Change only the globe that forms the "o" in "Worlds": replace it with the globe from the second image, a blue painted ocean globe with soft gouache waves and one large solid gold spade pip in its center, sized to match the letter height of "Worlds" so it reads as a natural "o". Wrap it in a thin tilted gold orbit ring that passes in front of the lower globe and behind the top, never crossing the spade. No islands, statues or objects on the globe.`,
  },
];

async function gen(job) {
  const out = `${ROOT}/${job.id}.png`;
  if (!force && existsSync(out)) return console.log('skip', out);
  const parts = job.edit
    ? [...EDIT_REFS.map((ref) => ({ inlineData: { mimeType: 'image/png', data: readFileSync(ref).toString('base64') } })), { text: job.prompt }]
    : null;
  const body = {
    contents: [{ parts: parts || [
      ...(job.refs || []).flatMap((ref) => [
        { inlineData: { mimeType: 'image/png', data: readFileSync(ref).toString('base64') } },
        { text: 'This attached image is the approved logo. Keep its typeface, gold finish and globe treatment unless the prompt changes them.' },
      ]),
      { inlineData: { mimeType: 'image/png', data: readFileSync(REF).toString('base64') } },
      { text: `The attached image is a sheet of approved island sprites from the game. Use it for medium, palette, and the look of the island boards only. Do not copy its grid layout or background.\n\n${job.prompt}` },
    ] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: job.ratio, imageSize: '2K' } },
  };
  await retry(async () => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
    if (!part) throw new Error(`No image returned for ${job.id}`);
    save(out, Buffer.from((part.inlineData || part.inline_data).data, 'base64'));
    console.log('generated', out);
  });
}

await pool(JOBS.filter((job) => !only.size || only.has(job.id)), 4, gen);
