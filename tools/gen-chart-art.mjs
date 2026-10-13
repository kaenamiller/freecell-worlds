// Generate the painted Voyage chart kit.
// Usage:
//   node tools/gen-chart-art.mjs
//   node tools/gen-chart-art.mjs --only=roman,cyber --force
//   node tools/gen-chart-art.mjs --only=fog-isle --reprocess-only
// PNG masters go to assets-src; serving WebPs and a contact sheet go to assets/art/chart.
import { existsSync, mkdirSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { THEMES, THEME_ORDER } from '../js/themes.js';
import { need, pool, retry, save } from './lib.mjs';

const MODEL = 'gemini-nano-banana-2.1';
const args = process.argv.slice(2);
const force = args.includes('--force');
// Repair serving assets from existing masters without a generation request.
const reprocessOnly = args.includes('--reprocess-only');
const key = reprocessOnly ? null : need('GEMINI_API_KEY');
const only = new Set((args.find((arg) => arg.startsWith('--only='))?.slice(7) || '').split(',').filter(Boolean));
const source = 'assets-src/art/chart';
const output = 'assets/art/chart';
mkdirSync(`${source}/islands`, { recursive: true });
mkdirSync(`${output}/islands`, { recursive: true });

const PAINT = `Hand-painted storybook nautical chart art, traditional gouache and transparent watercolor with fine charcoal contours. Dark teal, indigo, weathered parchment, muted mineral pigments, warm lantern gold. Slightly imperfect handmade edges, sophisticated tabletop-game illustration, cohesive scale and three-quarter top-down angle. No typography, letters, numbers, border, frame, watermark, UI, card, or photorealism.`;

async function image(id, prompt, ratio = '1:1', size = '1K') {
  const file = `${source}/${id}.png`;
  if ((reprocessOnly || !force) && existsSync(file)) return file;
  if (reprocessOnly) throw new Error(`Missing master for ${id}`);
  const body = {
    contents: [{ parts: [{ text: `${PAINT}\n\n${prompt}` }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: ratio, imageSize: size } },
  };
  await retry(async () => {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 300)}`);
    const json = await response.json();
    const part = json.candidates?.[0]?.content?.parts?.find((item) => item.inlineData || item.inline_data);
    if (!part) throw new Error(`No image returned for ${id}`);
    save(file, Buffer.from((part.inlineData || part.inline_data).data, 'base64'));
    console.log('generated', file);
  });
  return file;
}

const KNOCKOUT = String.raw`#!/usr/bin/env python3
"""Flood-fill parchment/paper backgrounds to alpha for Voyage chart sprites."""
from collections import deque
from pathlib import Path
from PIL import Image
import sys

def paperish(c):
    r, g, b = c[:3]
    luma = (r + g + b) / 3
    sat = max(r, g, b) - min(r, g, b)
    # Paper is light and warm/neutral. Teal water is cooler and usually darker.
    if luma < 150 or r < 150:
        return False
    if b > r + 18 and g > r:
        return False
    return sat <= 120

def knockout(path):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    px = im.load()
    corners = [px[1, 1][:3], px[w - 2, 1][:3], px[1, h - 2][:3], px[w - 2, h - 2][:3]]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    # Island shadows have the opposite luminance mask to white cloud wisps.
    # Ignore the old alpha: earlier exports accidentally knocked out the land.
    if Path(path).stem == 'fog-isle':
        for y in range(h):
            for x in range(w):
                c = px[x, y]
                luma = (c[0] + c[1] + c[2]) / 3
                alpha = max(0, min(255, int((218 - luma) * 1.8)))
                px[x, y] = (40, 76, 81, alpha)
        im.save(path)
        return
    foggy = Path(path).stem == 'fog'
    if foggy:
        for y in range(h):
            for x in range(w):
                c = px[x, y]
                luma = (c[0] + c[1] + c[2]) / 3
                alpha = 0 if luma < 178 else min(255, int((luma - 178) * 6.5))
                px[x, y] = (c[0], c[1], c[2], alpha)
        im.save(path)
        return

    visited = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))

    def idx(x, y):
        return y * w + x

    nbr = ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1))
    while q:
        x, y = q.popleft()
        i = idx(x, y)
        if visited[i]:
            continue
        visited[i] = 1
        c = px[x, y]
        if not paperish(c):
            continue
        luma = (c[0] + c[1] + c[2]) / 3
        alpha = 0 if luma >= 186 else min(255, int((186 - luma) * 10))
        px[x, y] = (c[0], c[1], c[2], alpha)
        if alpha < 90:
            for dx, dy in nbr:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and not visited[idx(nx, ny)]:
                    q.append((nx, ny))
    im.save(path)

if __name__ == '__main__':
    for arg in sys.argv[1:]:
        knockout(Path(arg))
        print('knockout', arg)
`;

function knockout(file) {
  const result = spawnSync('python3', ['-c', KNOCKOUT, file], { stdio: 'inherit' });
  if (result.status) throw new Error(`knockout failed for ${file}`);
}

function webp(input, target, filter, quality = 78) {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', input, '-vf', filter, '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '6', target], { stdio: 'inherit' });
  if (result.status) throw new Error(`ffmpeg failed for ${target}`);
}

const specials = [
  ['sea', 'A seamless open-ocean chart background viewed from high above: deep blue-green painted water, subtle currents, wavelets and faded compass/rhumb-line traces. Even detail with no land, ships, text, or focal object.', '16:9'],
  ['fog', 'A tileable bank of wispy sea fog on a truly transparent alpha background. Soft irregular cloud edges and broad empty transparent gaps; white and pale blue-gray only. No ocean, land, scene, or opaque backdrop.', '16:9'],
  ['boat', 'One small adventurous wooden sailing boat, three-quarter top-down view, bow pointing right, cream sail, tiny warm brass details, clean instantly readable silhouette. Isolated on a truly transparent alpha background with generous empty space.', '1:1'],
  ['boss-landmark', 'A dark painted island landmark for a nautical chart: a rocky isle with a tall lighthouse or watchtower, lantern-gold window, almost a silhouette against mist, three-quarter top-down like the other islands but gloomier and more monumental. Isolated on a truly transparent alpha background. No text.', '1:1'],
  ['fog-isle', 'A very faint, information-free island silhouette for a chart fog bank: simple dark teal-gray landmass with no buildings, no icons, low contrast, almost a ghost shape. Isolated on a truly transparent alpha background. No text.', '1:1'],
];

await pool(specials.filter(([id]) => !only.size || only.has(id)), 2, async ([id, prompt, ratio]) => {
  const master = await image(id, prompt, ratio);
  // Knockout works on a temporary copy; preserve the original painted master.
  const work = mkdtempSync(join(tmpdir(), 'chart-art-'));
  const png = join(work, basename(master));
  copyFileSync(master, png);
  try {
    const target = `${output}/${id}.webp`;
    if (id === 'sea') webp(png, target, 'scale=1600:900:force_original_aspect_ratio=increase:flags=lanczos,crop=1600:900', 80);
    else {
      if (id === 'fog' || id === 'boat' || id === 'boss-landmark' || id === 'fog-isle') knockout(png);
      if (id === 'fog') webp(png, target, 'format=rgba,scale=1024:576:flags=lanczos', 72);
      else webp(png, target, 'format=rgba,scale=256:256:flags=lanczos', 82);
    }
  } finally { rmSync(work, { recursive: true, force: true }); }
});

const themes = THEME_ORDER.filter((id) => !only.size || only.has(id));
await pool(themes, 2, async (id) => {
  const theme = THEMES[id];
  const png = await image(`islands/${id}`, `One compact island vignette for "${theme.name}". Visual idea: ${theme.tagline}. Make the destination unmistakably inspired by that world while remaining a natural island surrounded by a very small painted shoreline/water halo. Match a consistent footprint, scale, camera angle, lighting and detail density across a set of 48 islands. No words. Isolated object on a truly transparent alpha background; no square background, horizon, sky, or scene extending to the canvas edge.`);
  knockout(png);
  webp(png, `${output}/islands/${id}.webp`, 'format=rgba,scale=256:256:force_original_aspect_ratio=decrease:flags=lanczos', 76);
});

// A reproducible contact sheet makes scale/style and compression outliers easy to inspect.
if (!only.size) {
  const sheet = spawnSync('python3', ['-c', `
from PIL import Image
from pathlib import Path
ids = ${JSON.stringify(THEME_ORDER)}
cell, cols = 140, 8
rows = (len(ids) + cols - 1) // cols
sheet = Image.new('RGBA', (cols * cell, rows * (cell + 18)), (18, 51, 61, 255))
from PIL import ImageDraw
draw = ImageDraw.Draw(sheet)
for i, ident in enumerate(ids):
    im = Image.open(f'${output}/islands/{ident}.webp').convert('RGBA')
    im.thumbnail((128, 128))
    x = (i % cols) * cell + (cell - im.size[0]) // 2
    y = (i // cols) * (cell + 18) + (cell - im.size[1]) // 2
    sheet.alpha_composite(im, (x, y))
    draw.text(((i % cols) * cell + 7, (i // cols) * (cell + 18) + cell), ident, fill='#f0e5c5')
sheet.save('${output}/islands-contact-sheet.webp', 'WEBP', quality=82)
print('contact sheet', sheet.size)
`], { stdio: 'inherit' });
  if (sheet.status) throw new Error('contact sheet failed');
}

console.log(`Chart art ready (${MODEL}).`);
