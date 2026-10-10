#!/usr/bin/env bash
# Converts generated PNGs in assets-src/art into compressed WebP in assets/art.
# Originals live outside the served tree. usage: bash tools/optimize-assets.sh [theme]
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=assets-src/art
OUT=assets/art
w() { ffmpeg -v error -y -i "$1" -vf "$2" -c:v libwebp -quality "$3" -compression_level 6 "$4"; }
for dir in "$SRC"/*/; do
  t=$(basename "$dir")
  if [[ -n "${1:-}" && "$t" != "$1" ]]; then continue; fi
  mkdir -p "$OUT/$t"
  w "$dir/board.png"    "scale=2048:1152:flags=lanczos"                              86 "$OUT/$t/board.webp"
  # Screen-space backdrop: pre-blurred (soft depth-of-field look) and slightly darkened.
  w "$dir/backdrop.png" "scale=1600:900:flags=lanczos,gblur=sigma=7,eq=brightness=-0.06" 80 "$OUT/$t/backdrop.webp"
  # Environment map for reflections (2:1 equirect, unblurred; PMREM prefilters it).
  w "$dir/backdrop.png" "scale=1024:512:flags=lanczos"                               80 "$OUT/$t/env.webp"
  w "$dir/hero.png"     "scale=1920:1080:flags=lanczos"                              80 "$OUT/$t/hero.webp"
  w "$dir/hero.png"     "scale=640:360:flags=lanczos"                                78 "$OUT/$t/thumb.webp"
  w "$dir/back.png"     "scale=768:1024:flags=lanczos"                               88 "$OUT/$t/back.webp"
  for r in j q k; do w "$dir/court_$r.png" "scale=768:768:flags=lanczos" 88 "$OUT/$t/court_$r.webp"; done
done
echo done
