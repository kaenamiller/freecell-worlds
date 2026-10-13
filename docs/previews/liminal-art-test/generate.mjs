// Art test only: laundromat, pastel liminal room, vaporwave.
// Usage: node docs/previews/liminal-art-test/generate.mjs
import { existsSync } from 'node:fs';
import { need, retry, save } from '../../../tools/lib.mjs';

const MODEL = 'gemini-nano-banana-2.1';
const key = need('GEMINI_API_KEY');
const OUT = 'docs/previews/liminal-art-test';
const NO = 'Absolutely no text, letters, numbers, words, logos, signage, watermarks, UI, captions, or frames.';

const items = [
  {
    id: 'laundromat-hero',
    aspect: '16:9',
    prompt: `Key art for a premium solitaire card game. An empty American laundromat at 1 a.m., painted as sophisticated cinematic illustration, not a photograph and not a horror scene. Rows of round chrome dryer doors recede on the right, a few tumbling with warm amber clothes behind glass. Sickly cool fluorescent tubes, pale mint linoleum, a wet glass door on the far left with rain and a dark street. One plastic chair. Quiet, ordinary, lonely, a little liminal. The left third of the frame stays visually calm for a future title. In the right foreground, a small fan of face-down playing cards rests on a folding table; the card backs are illustrated chrome rings and pale-blue dryer windows with a warm amber center, fully designed, never blank paper. ${NO}`,
  },
  {
    id: 'laundromat-back',
    aspect: '3:4',
    prompt: `Playing-card back design, perfectly point-symmetric through the center, full-bleed flat print filling the frame edge to edge. No physical card outline, no table, no perspective, no shadow. A chrome dryer-door medallion: concentric rings, a round window of warm amber cloth-color at the center, pale mint and detergent blue field, thin cream geometric border. Quiet, slightly lonely, premium print. ${NO}`,
  },
  {
    id: 'liminal-hero',
    aspect: '16:9',
    prompt: `Key art for a premium solitaire card game. An original painted interior, not a photograph and not a copy of any film or internet image: an endless empty office corridor of moist pale-yellow wallpaper, stained beige carpet, and humming fluorescent panels that repeat a little wrong. The architecture is bare, expansive, and softly unsettling, with one distant doorway that does not feel like an exit. Beauty and dread in the same room. Muted butter yellow, nicotine cream, fluorescent green-white, a faint pinkish stain of light. The left third stays calm for a future title. In the right foreground, a low unmarked table holds a fan of face-down playing cards whose backs repeat the yellow wallpaper damask and a single fluorescent bar. Fully illustrated backs, never blank paper. No monsters, no people. ${NO}`,
  },
  {
    id: 'liminal-back',
    aspect: '3:4',
    prompt: `Playing-card back design, perfectly point-symmetric through the center, full-bleed flat print filling the frame edge to edge. No physical card outline, no table, no perspective, no shadow. Moist butter-yellow wallpaper damask, a thin fluorescent-white bar through the center, stained cream and pale pink, slightly oppressive symmetry, premium print, uneasy rather than cute. ${NO}`,
  },
  {
    id: 'vaporwave-hero',
    aspect: '16:9',
    prompt: `Key art for a premium solitaire card game. A deserted 1990s shopping-mall atrium at sunset, painted as lush nostalgic illustration. Pink and cyan light, a checkerboard marble floor, a single potted palm, a plaster Greco-Roman bust on a pedestal, a glass elevator, and a gradient sky of magenta, peach, and teal seen through the atrium glass. Soft, dreamy, consumer-nostalgia, elegant rather than grimy or cyberpunk. No rain, no neon alley, no city grime. The left third stays calm for a future title. In the right foreground, a fan of face-down playing cards lies on a marble ledge; the backs are pink marble, a teal palm frond, and a small classical column, fully illustrated, never blank. ${NO}`,
  },
  {
    id: 'vaporwave-back',
    aspect: '3:4',
    prompt: `Playing-card back design, perfectly point-symmetric through the center, full-bleed flat print filling the frame edge to edge. No physical card outline, no table, no perspective, no shadow. Pink and teal marble, a mirrored pair of palm fronds, a small classical column medallion, cream and magenta, soft 1990s mall sunset colors, premium ornamental print. No statues with readable inscriptions. ${NO}`,
  },
];

async function gen(item) {
  const out = `${OUT}/${item.id}.png`;
  if (existsSync(out)) return console.log('skip', out);
  const body = {
    contents: [{ parts: [{ text: item.prompt }] }],
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
    if (!part) throw new Error('no image: ' + JSON.stringify(json).slice(0, 300));
    save(out, Buffer.from((part.inlineData || part.inline_data).data, 'base64'));
    console.log('ok', out);
  });
}

for (const item of items) {
  await gen(item);
}
