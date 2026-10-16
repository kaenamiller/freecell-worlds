#!/usr/bin/env python3
"""Cut the approved brand masters into serving assets.

Logo: knock the flat #0d0806 backdrop out to alpha and crop.
Icon: export PWA, maskable and Apple touch sizes.
Usage: python3 tools/cut-brand.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SRC = Path('assets-src/art-staging/brand')
LOGO_OUT = Path('assets/art/brand')
ICON_OUT = Path('assets/icons')


def cut_logo():
    im = np.asarray(Image.open(SRC / 'logo-o-globe.png').convert('RGB')).astype(np.float32)
    # Sample the backdrop from the corners rather than trusting the prompt hex.
    h, w, _ = im.shape
    bg = np.concatenate([im[:40, :40], im[:40, -40:], im[-40:, :40], im[-40:, -40:]]).reshape(-1, 3).mean(0)
    dist = np.sqrt(((im - bg) ** 2).sum(-1))
    alpha = np.clip((dist - 8) / 52, 0, 1)
    alpha[alpha < 0.06] = 0
    # Un-blend so soft edges carry the true ink colour instead of a dark fringe.
    safe = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip(bg + (im - bg) / safe, 0, 255)
    out = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), 'RGBA')
    # Crop to rows/columns with real ink; faint backdrop texture would otherwise widen the box.
    solid = alpha > 0.5
    ys, xs = np.nonzero(solid.sum(1) > 3)[0], np.nonzero(solid.sum(0) > 3)[0]
    l, t, r, b = xs[0], ys[0], xs[-1] + 1, ys[-1] + 1
    pad = 24
    out = out.crop((max(l - pad, 0), max(t - pad, 0), min(r + pad, w), min(b + pad, h)))
    LOGO_OUT.mkdir(parents=True, exist_ok=True)
    out.save(SRC / 'logo-cut.png')
    small = out.copy()
    small.thumbnail((1400, 1400), Image.LANCZOS)
    small.save(LOGO_OUT / 'logo.webp', quality=88, method=6)
    print('logo', out.size, '->', small.size)


def cut_icon():
    src = Image.open(SRC / 'icon-spade-world.png').convert('RGB')
    size = src.size[0]
    ICON_OUT.mkdir(parents=True, exist_ok=True)
    for px, name in [(192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png'), (48, 'favicon-48.png')]:
        src.resize((px, px), Image.LANCZOS).save(ICON_OUT / name, optimize=True)
    # Maskable: the spade tip touches the 80% safe circle, so shrink the art and
    # feather it into a backdrop sampled from the master's own border.
    scale = 0.84
    inner = src.resize((round(size * scale),) * 2, Image.LANCZOS)
    edge = np.asarray(src).astype(np.float32)
    bg = tuple(int(v) for v in np.concatenate([edge[:24].reshape(-1, 3), edge[-24:].reshape(-1, 3), edge[:, :24].reshape(-1, 3), edge[:, -24:].reshape(-1, 3)]).mean(0))
    canvas = Image.new('RGB', src.size, bg)
    mask = Image.new('L', inner.size, 0)
    feather = inner.size[0] // 14
    ImageDraw.Draw(mask).rectangle((feather, feather, inner.size[0] - feather, inner.size[1] - feather), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(feather / 2))
    off = (size - inner.size[0]) // 2
    canvas.paste(inner, (off, off), mask)
    canvas.resize((512, 512), Image.LANCZOS).save(ICON_OUT / 'icon-maskable-512.png', optimize=True)
    print('icons done, maskable bg', bg)


cut_logo()
cut_icon()
