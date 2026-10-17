#!/usr/bin/env python3
"""Measure the dominant hue of every theme's hero plate and print the board-list order.

Order: pale plates first, then red -> orange -> yellow -> green -> blue -> purple, then dark or
colourless plates last. Colour is measured in OKLab so brown wood counts as muted rather than
as saturated orange. Paste the --json output into THEME_HUE_ORDER in js/themes.js.
Usage: python3 tools/theme-hue-order.py [--json]
"""
import json, re, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'assets/art'
WHEEL_START = 0  # OKLCH hue where the list starts; pinks just below it sort after purple
# Broad OKLCH hue families: red, orange, yellow, green, cyan, blue, purple, pink.
FAMILIES = [(0, 45), (45, 80), (80, 120), (120, 180), (180, 230), (230, 290), (290, 335), (335, 360)]

# Hand calls where the measured hue misreads the plate (OKLCH degrees).
HUE_OVERRIDES = {
    'mint': 145,  # green room under a warm lamp; the lamp outvotes the walls
    'moth': 325,  # velvet purple; the pink highlights pull it round to red
}


def in_family(h, lo, hi):
    return (h >= lo) & (h < hi)


def theme_ids():
    src = (ROOT / 'js/themes.js').read_text()
    core = re.search(r"THEME_ORDER = \[([^\]]*)\.\.\.EXPANSION", src).group(1)
    exp = (ROOT / 'js/theme-expansion.js').read_text()
    retired = set(re.findall(r"'([a-z0-9]+)'", re.search(r"RETIRED_WORLDS = new Set\(\[([^\]]*)\]", exp).group(1)))
    worlds = re.findall(r"^\s*\{\s*id: '([a-z0-9]+)'", exp, re.M)
    return re.findall(r"'([a-z0-9]+)'", core) + [w for w in worlds if w not in retired]


def oklab(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    lms = c @ np.array([[0.4122214708, 0.2119034982, 0.0883024619],
                        [0.5363325363, 0.6806995451, 0.2817188376],
                        [0.0514459929, 0.1073969566, 0.6299787005]])
    lms = np.cbrt(lms)
    return lms @ np.array([[0.2104542553, 1.9779984951, 0.0259040371],
                           [0.7936177850, -2.4285922050, 0.7827717662],
                           [-0.0040720468, 0.4505937099, -0.8086757660]])


def measure(path):
    img = Image.open(path).convert('RGB')
    img.thumbnail((240, 240))
    L, a, b = oklab(np.asarray(img, dtype=np.float64).reshape(-1, 3)).T
    C = np.hypot(a, b)
    h = np.degrees(np.arctan2(b, a)) % 360
    # Muted cream, brown and grey would outvote small vivid areas, so only clearly coloured
    # pixels vote, weighted by how vivid they are.
    w = np.where(C > 0.05, C, 0)
    if not w.any():
        w = C
    # Pick the colour family carrying the most chroma, then average the hue inside it.
    share = [w[in_family(h, lo, hi)].sum() for lo, hi in FAMILIES]
    sel = in_family(h, *FAMILIES[int(np.argmax(share))])
    hue = np.degrees(np.arctan2((np.sin(np.radians(h)) * w)[sel].sum(), (np.cos(np.radians(h)) * w)[sel].sum())) % 360
    return {'hue': float(hue), 'light': float(L.mean()), 'chroma': float(C.mean()), 'vivid': float(np.percentile(C, 90))}


def group(m):
    if (m['light'] > 0.8 and m['vivid'] < 0.1) or (m['light'] > 0.53 and m['vivid'] < 0.045):
        return 0  # pale / white, including light colourless greys
    if m['vivid'] < 0.045 or (m['light'] < 0.33 and m['vivid'] < 0.05):
        return 2  # dark or colourless
    return 1


def ordered():
    rows = [(tid, m, group(m)) for tid in theme_ids() for m in [measure(ART / tid / 'hero.webp')]]
    for tid, m, _ in rows:
        m['hue'] = HUE_OVERRIDES.get(tid, m['hue'])
    rows.sort(key=lambda r: (r[2], (r[1]['hue'] - WHEEL_START) % 360 if r[2] == 1 else -r[1]['light']))
    return rows


if __name__ == '__main__':
    rows = ordered()
    if '--json' in sys.argv:
        print(json.dumps([r[0] for r in rows]))
    else:
        for tid, m, g in rows:
            print(f"{['pale', 'hue ', 'dark'][g]}  {tid:14} hue={m['hue']:6.1f}  L={m['light']:.3f}  C={m['chroma']:.3f}  C90={m['vivid']:.3f}")
