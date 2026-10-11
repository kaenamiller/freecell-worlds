// usage: node tools/gen-sfx.mjs [filter] [--force] [--music]
import { existsSync } from 'node:fs';
import { need, save, pool, retry } from './lib.mjs';
import { sfxList, musicList } from './sfx-manifest.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const music = args.includes('--music');
const filter = args.find((a) => !a.startsWith('--'));
const themes = args.find((a) => a.startsWith('--themes='))?.slice(9).split(',');
const key = need('ELEVENLABS_API_KEY');

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function sfx(it) {
  if (!force && existsSync(it.file)) return console.log('skip', it.file);
  const body = { text: it.text, duration_seconds: it.dur, prompt_influence: 0.55 };
  if (it.loop) body.loop = true;
  const buf = await retry(() => post('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', body));
  save(it.file, buf);
  console.log('ok  ', it.file);
}

async function track(it) {
  if (!force && existsSync(it.file)) return console.log('skip', it.file);
  const buf = await retry(
    () => post('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', { prompt: it.prompt, music_length_ms: it.ms, model_id: 'music_v1', force_instrumental: true }),
    2
  );
  save(it.file, buf);
  console.log('ok  ', it.file);
}

const items = (music ? musicList() : sfxList()).filter((it) =>
  (!themes || themes.some((t) => it.id === t || it.id.startsWith(`${t}_`))) && (!filter || it.id.includes(filter)));
if (!items.length) throw new Error('No audio matched the requested theme/filter');
await pool(items, music ? 1 : 4, (it) => (music ? track(it) : sfx(it)).catch((e) => {
  console.error('FAIL', it.id, e.message);
  process.exitCode = 1;
}));
