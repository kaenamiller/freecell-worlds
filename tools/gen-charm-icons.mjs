// Generate bespoke charm icons as white-background sheets, then cut them out.
// usage: node tools/gen-charm-icons.mjs [--force] [--only=sheet-03]
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { need, save, pool, retry } from './lib.mjs';
import { SUBJECTS } from './charm-icon-subjects.mjs';

const MODEL = process.env.ART_MODEL || 'gemini-nano-banana-2.1';
const key = need('GEMINI_API_KEY');
const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.find((a) => a.startsWith('--only='))?.slice(7);

const STYLE = `A sprite sheet of separate object icons in a perfect grid.
Each icon is centered in its own equal cell with wide even gutters. Icons never touch each other or the canvas edge.
No borders, no grid lines, no numbers, no letters, no words, no labels, no watermarks, no drop shadows, no cast shadows, no floor, no scenery.
Straight-on orthographic view. Simple iconic objects, readable at 48 pixels. Consistent scale: every object fills about 60 percent of its cell.
Art direction: hand-illustrated playing-card language. Fine charcoal ink contours, soft translucent watercolor, warm limited palette of charcoal, terracotta, olive, amber, and cream. Even soft lighting. Consistent line weight across every cell.
Background: one perfectly flat pure white (#FFFFFF) filling the entire canvas and every gutter. No texture, no gradient, no paper grain.`;

function sheets() {
  const out = [];
  for (let i = 0; i < SUBJECTS.length; i += 16) {
    const cells = SUBJECTS.slice(i, i + 16);
    const rows = Math.ceil(cells.length / 4);
    const id = `sheet-${String(out.length).padStart(2, '0')}`;
    const list = cells.map(([, subject], n) => `${n + 1}. ${subject}`).join('\n');
    const tail = rows < 4
      ? `\n\nUse exactly ${rows} rows and 4 columns. Leave the rest of the canvas empty pure white.`
      : '\n\nUse exactly 4 columns and 4 rows.';
    out.push({
      id,
      rows,
      cells,
      prompt: `${STYLE}\n\nExactly ${cells.length} icons.\nCell contents, left to right, top to bottom:\n${list}${tail}`,
    });
  }
  return out;
}

async function gen(item) {
  const out = `assets-src/art/charms/sheets/${item.id}.png`;
  if (!force && existsSync(out)) return console.log('skip', out);
  const body = {
    contents: [{ parts: [{ text: item.prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1', imageSize: '2K' } },
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
    save(out, Buffer.from((part.inlineData || part.inline_data).data, 'base64'));
    console.log('ok', out);
  });
}

const jobs = sheets().filter((s) => !only || s.id === only);
save('assets-src/art/charms/sheets/index.json', Buffer.from(JSON.stringify(jobs.map(({ id, rows, cells }) => ({ id, rows, cells })), null, 2)));
await pool(jobs, 2, (it) => gen(it).catch((e) => {
  console.error('FAIL', it.id, e.message);
  process.exitCode = 1;
}));

if (!process.exitCode) {
  await new Promise((resolve, reject) => {
    const child = spawn('python3', ['tools/cut-charm-icons.py'], { stdio: 'inherit' });
    child.on('exit', (code) => (code ? reject(new Error(`cut failed ${code}`)) : resolve()));
  });
}
