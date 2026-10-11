// usage: node tools/gen-art.mjs [filter] [--force]
import { existsSync } from 'node:fs';
import { need, save, pool, retry } from './lib.mjs';
import { manifest } from './art-manifest.mjs';

const MODEL = process.env.ART_MODEL || 'gemini-3-pro-image';
const args = process.argv.slice(2);
const force = args.includes('--force');
const filter = args.find((a) => !a.startsWith('--'));
const themes = args.find((a) => a.startsWith('--themes='))?.slice(9).split(',');
const key = need('GEMINI_API_KEY');

async function gen(item) {
  const out = `assets-src/art/${item.theme}/${item.id}.png`;
  if (!force && existsSync(out)) return console.log('skip', out);
  const body = {
    contents: [{ parts: [{ text: item.prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: item.aspect, imageSize: item.size } },
  };
  await retry(async () => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
    const j = await res.json();
    const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
    if (!part) throw new Error('no image: ' + JSON.stringify(j).slice(0, 300));
    save(out, Buffer.from((part.inlineData || part.inline_data).data, 'base64'));
    console.log('ok  ', out);
  });
}

const items = manifest().filter((m) => (!themes || themes.includes(m.theme)) && (!filter || `${m.theme}/${m.id}`.includes(filter)));
if (!items.length) throw new Error('No art matched the requested theme/filter');
await pool(items, 3, (it) => gen(it).catch((e) => {
  console.error('FAIL', it.theme, it.id, e.message);
  process.exitCode = 1;
}));
