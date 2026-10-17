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


def tighten_w(img, bg, shift=100, seed=(621, 900)):
    """Slide the "W" right so its right arm tucks behind the globe.

    The W is flood-filled from a seed inside it, erased, redrawn `shift` px to
    the right, and the globe, ring and other letters are laid back on top.
    """
    im = np.asarray(img).astype(np.float32)
    d = np.sqrt(((im - bg) ** 2).sum(-1))
    m = Image.fromarray(((d > 10) * 255).astype(np.uint8)).copy()
    ImageDraw.floodfill(m, seed, 128)
    w = np.array(m) == 128
    w_mask = Image.fromarray((w * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3))
    rest = Image.fromarray((((d > 6) & (np.array(w_mask) < 8)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))
    out = img.copy()
    out.paste(Image.new('RGB', img.size, tuple(int(v) for v in bg)), (0, 0), w_mask)
    out.paste(img, (shift, 0), w_mask)
    out.paste(img, (0, 0), rest)
    return out


def ink_center(solid):
    xs = np.nonzero(solid.sum(0) > 3)[0]
    return (xs[0] + xs[-1]) / 2


def center_worlds(out):
    """Center the "Worlds" line (with its globe and ring) under "FREECELL".

    Sliding the W shortens the line on the left. Each line's glow is assigned
    by distance to that line's solid ink, so moving one line leaves no seam.
    """
    rgba = np.asarray(out).astype(np.float32) / 255
    alpha = rgba[..., 3]
    solid = alpha > 0.5
    ys = np.nonzero(solid.sum(1) > 3)[0]
    top, bottom = ys[0], ys[-1] + 1
    lo, hi = top + (bottom - top) * 3 // 10, top + (bottom - top) * 11 // 20
    split = lo + int(np.argmin(solid[lo:hi].sum(1)))
    dx = round(ink_center(solid[top:split]) - ink_center(solid[split:bottom]))
    if not dx:
        return out

    def reach(mask):
        img = Image.fromarray((mask * 255).astype(np.uint8))
        return np.asarray(img.filter(ImageFilter.MaxFilter(41)).filter(ImageFilter.GaussianBlur(12))).astype(np.float32)

    rows = np.arange(alpha.shape[0])[:, None]
    near_upper, near_lower = reach(solid & (rows < split)) ** 4, reach(solid & (rows >= split)) ** 4
    weight = np.where(near_upper + near_lower > 0, near_lower / np.maximum(near_upper + near_lower, 1e-3), (rows >= split).astype(np.float32))
    pre = np.dstack([rgba[..., :3] * alpha[..., None], alpha])
    lower = np.roll(pre * weight[..., None], dx, axis=1)
    merged = np.clip(pre * (1 - weight[..., None]) + lower, 0, 1)
    a = merged[..., 3:]
    rgb = merged[..., :3] / np.maximum(a, 1e-4)
    print('centered Worlds by', dx, 'px')
    return Image.fromarray((np.dstack([rgb, a]) * 255).round().astype(np.uint8), 'RGBA')


def cut_logo():
    src = Image.open(SRC / 'logo-spade-ring-front.png').convert('RGB')
    raw = np.asarray(src).astype(np.float32)
    # Sample the backdrop from the corners rather than trusting the prompt hex.
    bg = np.concatenate([raw[:40, :40], raw[:40, -40:], raw[-40:, :40], raw[-40:, -40:]]).reshape(-1, 3).mean(0)
    im = np.asarray(tighten_w(src, bg)).astype(np.float32)
    h, w, _ = im.shape
    dist = np.sqrt(((im - bg) ** 2).sum(-1))
    alpha = np.clip((dist - 8) / 52, 0, 1)
    alpha[alpha < 0.06] = 0
    # Un-blend so soft edges carry the true ink colour instead of a dark fringe.
    safe = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip(bg + (im - bg) / safe, 0, 255)
    out = center_worlds(Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), 'RGBA'))
    alpha = np.asarray(out.getchannel('A')) / 255
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
    src = Image.open(SRC / 'icon-gs-classic.png').convert('RGB')
    size = src.size[0]
    ICON_OUT.mkdir(parents=True, exist_ok=True)
    for px, name in [(192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png'), (48, 'favicon-48.png')]:
        src.resize((px, px), Image.LANCZOS).save(ICON_OUT / name, optimize=True)
    # Maskable: the globe rim runs past the 80% safe circle, so shrink the art and
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
