// usage: node tools/gen-art.mjs [filter] [--force] [--out-dir=assets-src/art] [--manifest=preview.json] [--reference=style.png] [--jobs=1..8]
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { need, save, pool, retry } from './lib.mjs';
import { manifest } from './art-manifest.mjs';

// Repo default is Nano Banana 2.1. See AGENTS.md. ART_MODEL overrides one command only.
const MODEL = process.env.ART_MODEL || 'gemini-nano-banana-2.1';
const args = process.argv.slice(2);
const force = args.includes('--force');
const filter = args.find((a) => !a.startsWith('--'));
const themes = args.find((a) => a.startsWith('--themes='))?.slice(9).split(',');
const assets = args.find((a) => a.startsWith('--assets='))?.slice(9).split(',');
const outDir = args.find((a) => a.startsWith('--out-dir='))?.slice(10) || 'assets-src/art';
const manifestPath = args.find((a) => a.startsWith('--manifest='))?.slice(11);
const jobs = Number(args.find((a) => a.startsWith('--jobs='))?.slice(7) || 3);
if (!Number.isInteger(jobs) || jobs < 1 || jobs > 8) throw new Error('--jobs must be an integer from 1 to 8');
const referencePath = args.find((a) => a.startsWith('--reference='))?.slice(12);
const reference = referencePath ? { inlineData: { mimeType: referencePath.endsWith('.webp') ? 'image/webp' : referencePath.endsWith('.jpg') || referencePath.endsWith('.jpeg') ? 'image/jpeg' : 'image/png', data: readFileSync(referencePath).toString('base64') } } : null;
const key = need('GEMINI_API_KEY');

async function gen(item) {
  const out = join(outDir, item.theme, `${item.id}.png`);
  if (!force && existsSync(out)) return console.log('skip', out);
  const itemReference = item.referencePath ? { inlineData: { mimeType: item.referencePath.endsWith('.webp') ? 'image/webp' : 'image/png', data: readFileSync(item.referencePath).toString('base64') } } : reference;
  const body = {
    contents: [{ parts: [...(itemReference ? [itemReference, { text: 'Use the attached image only as a reference for palette, illustration style, materials and lighting. Generate the separate asset requested below; do not copy its composition, people or objects unless the prompt asks for them.' }] : []), { text: item.prompt }] }],
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

const items = (manifestPath ? JSON.parse(readFileSync(manifestPath, 'utf8')) : manifest()).filter((m) => (!themes || themes.includes(m.theme)) && (!assets || assets.includes(m.id)) && (!filter || `${m.theme}/${m.id}`.includes(filter)));
if (!items.length) throw new Error('No art matched the requested theme/filter');
await pool(items, jobs, (it) => gen(it).catch((e) => {
  console.error('FAIL', it.theme, it.id, e.message);
  process.exitCode = 1;
}));
