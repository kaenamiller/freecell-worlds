// One-off samples for bespoke charm icons. Not part of the production art pipeline.
import { need, save, retry } from './lib.mjs';

const MODEL = process.env.ART_MODEL || 'gemini-nano-banana-2.1';
const key = need('GEMINI_API_KEY');

const CELLS = [
  'a single lit candle with a small flame',
  'a moth with patterned wings, seen from above',
  'a wooden spool wound with red thread',
  'a round four-hole sewing button',
  'a vintage tabletop radio with a round dial',
  'a simple paper crown',
  'a pair of open tailor scissors',
  'one marigold flower',
  'a decorated sugar skull',
  'a blacksmith anvil',
  'two six-sided dice',
  'a carnival prize wheel',
  'a small wooden canoe, side view',
  'a chunk of amber with a tiny insect inside',
  'a small tabletop letterpress',
  'a rooftop television antenna',
];

const grid = CELLS.map((name, i) => `${i + 1}. ${name}`).join('\n');

const shared = `A sprite sheet of exactly 16 separate object icons in a perfect 4 column by 4 row grid.
Each icon is centered in its own equal cell with wide even gutters. Icons never touch each other or the canvas edge.
No borders, no grid lines, no numbers, no letters, no words, no labels, no watermarks, no drop shadows, no cast shadows, no floor, no scenery.
Straight-on orthographic view. Simple iconic objects, readable at 48 pixels. Consistent scale: every object fills about 60 percent of its cell.
Art direction: the same hand-illustrated playing-card language used for storybook court cards. Fine charcoal ink contours, soft translucent watercolor, warm limited palette of charcoal, terracotta, olive, amber, and cream. Even soft lighting. Consistent line weight across every cell.

Cell contents, left to right, top to bottom:
${grid}`;

const samples = [
  {
    id: 'sheet-white',
    prompt: `${shared}\n\nBackground: one perfectly flat pure white (#FFFFFF) filling the entire canvas and every gutter. No texture, no gradient, no paper grain.`,
  },
  {
    id: 'sheet-magenta',
    prompt: `${shared}\n\nBackground: one perfectly flat chroma-key magenta (#FF00FF) filling the entire canvas and every gutter. No texture, no gradient, no paper grain. Do not tint the icons magenta. Keep icon colors in the warm ink-and-watercolor palette.`,
  },
];

async function gen(item) {
  const body = {
    contents: [{ parts: [{ text: item.prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: '1:1', imageSize: '2K' },
    },
  };
  await retry(async () => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 400)}`);
    const j = await res.json();
    const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
    if (!part) throw new Error('no image: ' + JSON.stringify(j).slice(0, 400));
    const data = (part.inlineData || part.inline_data).data;
    const out = `docs/previews/charm-icons/${item.id}.png`;
    save(out, Buffer.from(data, 'base64'));
    console.log('ok', out, Buffer.from(data, 'base64').length);
  });
}

for (const item of samples) {
  console.log('generating', item.id, 'with', MODEL);
  await gen(item);
}
