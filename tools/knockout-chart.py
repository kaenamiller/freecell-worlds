#!/usr/bin/env python3
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
    foggy = Path(path).name.startswith('fog')
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
