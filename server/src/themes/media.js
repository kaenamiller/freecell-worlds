// Image and music generation for one variation, plus cutting the served files from the
// originals. Images: Nano Banana 2.1 (gemini-nano-banana-2.1, see AGENTS.md; IMAGE_MODEL
// may override it). Music: ElevenLabs music_v1. GEN_MOCK=1 swaps both for local stand-ins.

const IMAGE_MODEL = 'gemini-nano-banana-2.1';
const NO = 'Absolutely no text, letters, numbers, words, logos, signage, watermarks, UI, captions, or frames.';
const PAINT = 'Painterly cinematic illustration for a premium solitaire game. Sophisticated, cohesive, not a photograph, not 3D, not anime.';
const COURT = `Square 1:1 full-bleed illustration. ONE upright head-and-shoulders person, facing slightly toward the viewer. Not a playing card, not mirrored, not a second upside-down figure. No rank, suit, border, or card outline. Place the face and hair in the upper half of the square, large enough to read at postage-stamp size, with the shoulders continuing through the middle. Simple uncluttered background. ${NO}`;

// The originals a theme needs, in generation order. The hero comes first and is passed
// to the rest as a style reference so the set stays cohesive.
export function imageJobs(spec) {
  const a = spec.art;
  const pal = `Palette: ${a.palette}.`;
  const court = (who) => `${PAINT} ${COURT} ${who}. ${a.portraitBackground}. ${pal}`;
  return [
    { id: 'hero', aspect: '16:9', prompt: `${PAINT} Wide 16:9 title-screen key art. ${a.hero}. ${pal} ${NO}` },
    { id: 'board', aspect: '16:9', prompt: `${PAINT} Top-down orthographic texture of a card-table surface, filling the frame edge to edge, no surrounding room. ${a.board} ${pal} ${NO}` },
    { id: 'backdrop', aspect: '16:9', prompt: `${PAINT} Wide 16:9 environment panorama. ${a.backdrop}. ${pal} No cards. ${NO}` },
    { id: 'back', aspect: '3:4', prompt: `${PAINT} ${a.back}. ${pal} The pattern must reach every edge. ${NO}` },
    { id: 'court_j', aspect: '1:1', prompt: court(a.jack) },
    { id: 'court_q', aspect: '1:1', prompt: court(a.queen) },
    { id: 'court_k', aspect: '1:1', prompt: court(a.king) },
  ];
}

// The files the game loads (js/themes.js artFor), cut from the originals the way
// tools/optimize-assets.sh does for built-in themes.
export const SERVED = [
  { file: 'board.webp', from: 'board', size: [2048, 1152], quality: 86 },
  { file: 'backdrop.webp', from: 'backdrop', size: [1600, 900], quality: 80, blur: 7, brightness: 0.94 },
  { file: 'env.webp', from: 'backdrop', size: [1024, 512], quality: 80 },
  { file: 'hero.webp', from: 'hero', size: [1920, 1080], quality: 80 },
  { file: 'thumb.webp', from: 'hero', size: [640, 360], quality: 78 },
  { file: 'back.webp', from: 'back', size: [768, 1024], quality: 88 },
  { file: 'court_j.webp', from: 'court_j', size: [768, 768], quality: 88 },
  { file: 'court_q.webp', from: 'court_q', size: [768, 768], quality: 88 },
  { file: 'court_k.webp', from: 'court_k', size: [768, 768], quality: 88 },
];

const b64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// Returns PNG/JPEG bytes. Errors flagged `permanent` (a safety block) aren't worth retrying.
export async function generateImage(env, job, { reference, spec } = {}) {
  if (env.GEN_MOCK === '1') {
    if (spec?.tagline?.includes('mockfail')) throw Object.assign(new Error(`image ${job.id}: mock failure`), { permanent: true });
    return { bytes: await mockPng(job, spec), contentType: 'image/png' };
  }
  const parts = [];
  if (reference) {
    parts.push({ inlineData: { mimeType: reference.contentType, data: b64(reference.bytes) } });
    parts.push({ text: `The attached image is an approved style and palette reference only. Do not copy its layout. Match its medium, color, and mood.\n\n${job.prompt}` });
  } else parts.push({ text: job.prompt });
  const model = env.IMAGE_MODEL || IMAGE_MODEL;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: job.aspect, imageSize: '2K' } },
    }),
  });
  if (!res.ok) throw new Error(`image ${job.id}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const cand = json.candidates?.[0];
  const part = cand?.content?.parts?.find((p) => p.inlineData || p.inline_data);
  if (!part) {
    const why = json.promptFeedback?.blockReason || cand?.finishReason || 'no image';
    const blocked = /SAFETY|PROHIBITED|BLOCKLIST|IMAGE_SAFETY|RECITATION/.test(why);
    throw Object.assign(new Error(`image ${job.id}: ${why}`), { permanent: blocked });
  }
  const data = part.inlineData || part.inline_data;
  return { bytes: unb64(data.data), contentType: data.mimeType || data.mime_type || 'image/png' };
}

export async function generateMusic(env, spec) {
  if (env.GEN_MOCK === '1') return null; // the game falls back to the soundsLike table's track
  const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: spec.music, music_length_ms: 90000, model_id: 'music_v1', force_instrumental: true }),
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    // 4xx other than rate limits means ElevenLabs rejected the prompt itself.
    throw Object.assign(new Error(`music: ${res.status} ${text}`), { permanent: res.status >= 400 && res.status < 500 && res.status !== 429 });
  }
  return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: 'audio/mpeg' };
}

// Resize/crop (and blur) one original into a served WebP through the Images binding.
// Without the binding (some local setups) the original is served as-is.
export async function deriveImage(env, original, served) {
  if (!env.IMAGES) return { bytes: original.bytes, contentType: original.contentType };
  const [width, height] = served.size;
  const transform = { width, height, fit: 'cover' };
  if (served.blur) transform.blur = served.blur;
  if (served.brightness) transform.brightness = served.brightness;
  const out = await env.IMAGES.input(new Blob([original.bytes]).stream()).transform(transform).output({ format: 'image/webp', quality: served.quality });
  return { bytes: new Uint8Array(await out.response().arrayBuffer()), contentType: 'image/webp' };
}

// --- mock stand-ins (GEN_MOCK=1) --------------------------------------------------------
// A small gradient PNG in the spec's palette, so the whole flow runs without API keys.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function chunk(type, data) {
  const body = new Uint8Array([...new TextEncoder().encode(type), ...data]);
  return new Uint8Array([...u32(data.length), ...body, ...u32(crc32(body))]);
}

async function mockPng(job, spec) {
  const [aw, ah] = job.aspect.split(':').map(Number);
  const w = 64 * aw, h = 64 * ah;
  const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16));
  const p = spec?.palette || {};
  const [a, b] = job.id === 'back' ? [rgb(p.inlay || '#888888'), rgb(p.rail || '#444444')] : job.id.startsWith('court') ? [rgb(p.paperShade || '#dddddd'), rgb(p.accent || '#aa8844')] : [rgb(p.accent || '#aa8844'), rgb(p.bg || '#222222')];
  const raw = new Uint8Array(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const t = (x / w + y / h) / 2;
      for (let c = 0; c < 3; c++) raw[y * (w * 3 + 1) + 1 + x * 3 + c] = Math.round(a[c] * (1 - t) + b[c] * t);
    }
  }
  const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const ihdr = new Uint8Array([...u32(w), ...u32(h), 8, 2, 0, 0, 0]);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', z), chunk('IEND', new Uint8Array())];
  return new Uint8Array(await new Blob(parts).arrayBuffer());
}
