#!/usr/bin/env python3
"""Key the white ground out of charm sheets and write transparent WebP icons."""
import json
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / 'assets-src/art/charms/sheets'
SRC = ROOT / 'assets-src/art/charms'
OUT = ROOT / 'assets/art/charms'


def key_white(im, thresh=247, soft=14):
    out = im.convert('RGBA')
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            m = min(r, g, b)
            if m >= thresh:
                px[x, y] = (r, g, b, 0)
            elif m >= thresh - soft:
                t = (m - (thresh - soft)) / soft
                px[x, y] = (r, g, b, int(a * (1 - t)))
    # Drop pale fringe pixels that only touch transparency.
    snap = out.copy().load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0 or min(r, g, b) < 236:
                continue
            neighbors = 0
            clear = 0
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        clear += 1
                        neighbors += 1
                        continue
                    neighbors += 1
                    if snap[nx, ny][3] == 0:
                        clear += 1
            if clear >= 5:
                px[x, y] = (r, g, b, 0)
    return out


def fit(cell, size=256, pad=18):
    bbox = cell.getbbox()
    if not bbox:
        return Image.new('RGBA', (size, size), (0, 0, 0, 0))
    crop = cell.crop(bbox)
    inner = size - pad * 2
    scale = min(inner / crop.width, inner / crop.height)
    nw, nh = max(1, round(crop.width * scale)), max(1, round(crop.height * scale))
    crop = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    plate = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    plate.paste(crop, ((size - nw) // 2, (size - nh) // 2), crop)
    return plate


def main():
    index = json.loads((SHEETS / 'index.json').read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    report = []
    for sheet in index:
        src = SHEETS / f"{sheet['id']}.png"
        if not src.exists():
            report.append(f"MISSING {sheet['id']}")
            continue
        keyed = key_white(Image.open(src))
        w, h = keyed.size
        rows = sheet['rows'] or 4
        cols = 4
        cw, ch = w // cols, h // rows
        for n, (cid, subject) in enumerate(sheet['cells']):
            col, row = n % cols, n // cols
            if row >= rows:
                break
            cell = keyed.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
            opaque = sum(1 for p in cell.getdata() if p[3] > 16)
            frac = opaque / (cw * ch)
            icon = fit(cell)
            png = SRC / f'{cid}.png'
            png.parent.mkdir(parents=True, exist_ok=True)
            icon.save(png)
            webp = OUT / f'{cid}.webp'
            subprocess.check_call([
                'ffmpeg', '-v', 'error', '-y', '-i', str(png),
                '-c:v', 'libwebp', '-quality', '82', '-compression_level', '6',
                '-pix_fmt', 'yuva420p', str(webp),
            ])
            flag = 'OK' if 0.015 <= frac <= 0.8 else 'CHECK'
            report.append(f'{flag} {frac:5.1%} {cid}  {subject}')
    text = '\n'.join(report)
    (SHEETS / 'cut-report.txt').write_text(text + '\n')
    print(text)
    bad = [line for line in report if line.startswith('CHECK') or line.startswith('MISSING')]
    if bad:
        print(f'{len(bad)} cells need a look')


if __name__ == '__main__':
    main()
