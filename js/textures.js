// Procedural + art-composited canvas textures: card faces/backs, board surface,
// slot outlines. Everything is theme-aware; call setCardTheme() on theme change.
import * as THREE from 'three';

export const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SERIF = "Georgia, 'Times New Roman', 'DejaVu Serif', serif";

export const suitOf = (id) => ((id - 1) / 13) | 0;
export const rankOf = (id) => ((id - 1) % 13) + 1;

// --- active card theme --------------------------------------------------------
let cardTheme = null;
let cardArt = {};
let useFourColor = false;
let highContrast = false;
const faceCache = new Map();
let backTexture = null;

// High-contrast cards ignore the theme's paper/ink: classic white faces, black and red ink, heavy outline.
const HC = {
  paper: ['#ffffff', '#f3f3f3'],
  ink: ['#0a0a0a', '#d4001f', '#d4001f', '#0a0a0a'],
  fourColor: ['#0b4fd0', '#e06a00', '#d4001f', '#0a0a0a'],
  outline: '#000000',
};

// `opts` is { fourColor, highContrast } (a bare boolean still means fourColor).
export function setCardTheme(theme, art, opts = {}) {
  if (typeof opts === 'boolean') opts = { fourColor: opts };
  cardTheme = theme;
  cardArt = art || {};
  useFourColor = !!opts.fourColor;
  highContrast = !!opts.highContrast;
  for (const t of faceCache.values()) t.dispose();
  faceCache.clear();
  if (backTexture) backTexture.dispose();
  backTexture = null;
}

const suitColor = (suit) =>
  highContrast ? (useFourColor ? HC.fourColor : HC.ink)[suit] : (useFourColor ? cardTheme.card.fourColor : cardTheme.card.suits)[suit];
const paperColors = () => (highContrast ? HC.paper : cardTheme.card.paper);
// Pip/index effect: high contrast drops glow and gloss so edges stay crisp.
const fxMode = () => (highContrast ? 'none' : cardTheme.card.fx);
const fontStack = () => `'${cardTheme.card.indexFont}', ${SERIF}`;

// --- drawing helpers ----------------------------------------------------------
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function heartPath(ctx) {
  ctx.moveTo(0, 0.45);
  ctx.bezierCurveTo(-0.55, 0.02, -0.52, -0.45, -0.24, -0.45);
  ctx.bezierCurveTo(-0.08, -0.45, 0, -0.3, 0, -0.16);
  ctx.bezierCurveTo(0, -0.3, 0.08, -0.45, 0.24, -0.45);
  ctx.bezierCurveTo(0.52, -0.45, 0.55, 0.02, 0, 0.45);
  ctx.closePath();
}

function spadeStemPath(ctx) {
  ctx.moveTo(-0.12, 0.15);
  ctx.bezierCurveTo(-0.02, 0.27, -0.03, 0.36, -0.22, 0.45);
  ctx.lineTo(0.22, 0.45);
  ctx.bezierCurveTo(0.03, 0.36, 0.02, 0.27, 0.12, 0.15);
  ctx.closePath();
}

function clubPath(ctx) {
  ctx.moveTo(0.19, -0.2);
  ctx.arc(0, -0.2, 0.19, 0, Math.PI * 2, false);
  ctx.moveTo(-0.03, 0.14);
  ctx.arc(-0.22, 0.14, 0.19, 0, Math.PI * 2, false);
  ctx.moveTo(0.41, 0.14);
  ctx.arc(0.22, 0.14, 0.19, 0, Math.PI * 2, false);
  spadeStemPath(ctx);
}

function suitPath(ctx, suit) {
  ctx.beginPath();
  if (suit === 2) {
    heartPath(ctx);
  } else if (suit === 1) {
    ctx.moveTo(0, -0.5);
    ctx.lineTo(0.35, 0);
    ctx.lineTo(0, 0.5);
    ctx.lineTo(-0.35, 0);
    ctx.closePath();
  } else if (suit === 3) {
    ctx.save();
    ctx.scale(1, -1);
    heartPath(ctx);
    ctx.restore();
    spadeStemPath(ctx);
  } else {
    clubPath(ctx);
  }
}

function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.round(c + (255 - c) * amt);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// Draws a suit glyph centred at (cx, cy). `size` is the glyph height.
export function drawSuit(ctx, suit, cx, cy, size, color, fx = 'none') {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size, size);
  suitPath(ctx, suit);
  if (fx === 'glow') {
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.22;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = size * 0.07;
    ctx.fill();
  } else if (fx === 'gloss' && color.startsWith('#')) {
    const g = ctx.createLinearGradient(0, -0.5, 0, 0.5);
    g.addColorStop(0, lighten(color, 0.45));
    g.addColorStop(0.5, color);
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fill();
    // Specular glint.
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-0.1, -0.2, 0.09, 0.05, -0.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}

// Corner index: rank and suit side by side on one line, so the whole index sits inside the
// narrow strip that stays visible when cards overlap in a column.
function cornerIndex(ctx, rankLabel, suit, color, flip, fx) {
  ctx.save();
  if (flip) {
    ctx.translate(256, 358);
    ctx.rotate(Math.PI);
    ctx.translate(-256, -358);
  }
  const widthScale = { Orbitron: 0.8, 'Lilita One': 0.92, Antonio: 1.12, 'Cormorant Garamond': 1.05 }[cardTheme.card.indexFont] || 1;
  let size = (rankLabel === '10' ? 104 : 120) * widthScale;
  const x0 = 24;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const setFont = () => { ctx.font = `${cardTheme.card.indexWeight || 800} ${size}px ${fontStack()}`; };
  setFont();
  // Font sizes do not describe the actual ink bounds. Keep tall fonts (such as
  // Antonio) and descenders inside the same y=20..104 strip as the other indices.
  let metrics = ctx.measureText(rankLabel);
  const inkHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  if (inkHeight > 84) {
    size *= 84 / inkHeight;
    setFont();
    metrics = ctx.measureText(rankLabel);
  }
  const base = Math.max(20 + metrics.actualBoundingBoxAscent,
    Math.min(104, 104 - metrics.actualBoundingBoxDescent));
  ctx.fillStyle = color;
  if (fx === 'glow') {
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
  }
  ctx.fillText(rankLabel, x0, base);
  const w = metrics.width;
  ctx.shadowBlur = 0;
  drawSuit(ctx, suit, x0 + w + 20 + 38, 64, 78, color, fx);
  ctx.restore();
}

// Standard pip coordinates in a normalised inner area (0..1).
const PIP_LAYOUTS = {
  2: [[0.5, 0, 1], [0.5, 1, -1]],
  3: [[0.5, 0, 1], [0.5, 0.5, 1], [0.5, 1, -1]],
  4: [[0, 0, 1], [1, 0, 1], [0, 1, -1], [1, 1, -1]],
  5: [[0, 0, 1], [1, 0, 1], [0.5, 0.5, 1], [0, 1, -1], [1, 1, -1]],
  6: [[0, 0, 1], [1, 0, 1], [0, 0.5, 1], [1, 0.5, 1], [0, 1, -1], [1, 1, -1]],
  7: [[0, 0, 1], [1, 0, 1], [0.5, 0.25, 1], [0, 0.5, 1], [1, 0.5, 1], [0, 1, -1], [1, 1, -1]],
  8: [
    [0, 0, 1], [1, 0, 1], [0.5, 0.25, 1], [0, 0.5, 1], [1, 0.5, 1],
    [0.5, 0.75, -1], [0, 1, -1], [1, 1, -1],
  ],
  9: [
    [0, 0, 1], [1, 0, 1], [0, 1 / 3, 1], [1, 1 / 3, 1], [0.5, 0.5, 1],
    [0, 2 / 3, -1], [1, 2 / 3, -1], [0, 1, -1], [1, 1, -1],
  ],
  10: [
    [0, 0, 1], [1, 0, 1], [0.5, 1 / 6, 1], [0, 1 / 3, 1], [1, 1 / 3, 1],
    [0, 2 / 3, -1], [1, 2 / 3, -1], [0.5, 5 / 6, -1], [0, 1, -1], [1, 1, -1],
  ],
};

const AREA = { x: 104, y: 150, w: 304, h: 416 };

// Double-ended court figure: the art fills the upper half and is rotated 180° into the lower half.
function drawCourt(ctx, id, suit, rank, color) {
  const th = cardTheme.card;
  const key = ['', 'j', 'q', 'k'][rank - 10];
  const img = cardArt['court_' + key];
  const { x, y, w, h } = AREA;
  const hh = h / 2;
  const frame = highContrast ? '#000' : th.courtFrame;

  ctx.save();
  roundRectPath(ctx, x, y, w, h, 18);
  ctx.clip();
  ctx.fillStyle = '#10101a';
  ctx.fillRect(x, y, w, h);

  if (img) {
    const srcH = (img.naturalHeight || img.height) * (hh / w);
    const sy = Math.max(0, (img.naturalHeight || img.height) * (th.courtFocusY ?? 0.4) - srcH / 2);
    const sw = img.naturalWidth || img.width;
    for (const flip of [false, true]) {
      ctx.save();
      if (flip) {
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(Math.PI);
        ctx.translate(-(x + w / 2), -(y + h / 2));
      }
      ctx.beginPath();
      ctx.rect(x, y, w, hh);
      ctx.clip();
      ctx.drawImage(img, 0, sy, sw, srcH, x, y, w, hh);
      // Suit-coloured wash to tell the four versions apart.
      if (th.courtWash > 0) {
        ctx.globalCompositeOperation = 'soft-light';
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, hh);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      // Fade toward the centre seam.
      const g = ctx.createLinearGradient(0, y + hh - 36, 0, y + hh);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y + hh - 36, w, 36);
      ctx.restore();
    }
  }
  ctx.restore();

  // Frame + seam.
  ctx.save();
  if (fxMode() === 'glow') {
    ctx.shadowColor = frame;
    ctx.shadowBlur = 14;
  }
  ctx.strokeStyle = frame;
  ctx.lineWidth = 6;
  roundRectPath(ctx, x, y, w, h, 18);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y + hh);
  ctx.lineTo(x + w, y + hh);
  ctx.stroke();
  ctx.restore();

  // Suit badges on the seam.
  for (const bx of [x + 34, x + w - 34]) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(bx, y + hh, 26, 0, Math.PI * 2);
    ctx.fillStyle = paperColors()[0];
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = frame;
    ctx.stroke();
    ctx.restore();
    drawSuit(ctx, suit, bx, y + hh, 32, color, fxMode());
  }
}

function drawFace(ctx, id) {
  const suit = suitOf(id);
  const rank = rankOf(id);
  const color = suitColor(suit);
  const label = RANK_LABELS[rank - 1];
  const th = cardTheme.card;
  const fx = fxMode();

  if (rank === 1) {
    drawSuit(ctx, suit, 256, 358, 250, color, fx);
    ctx.save();
    ctx.globalAlpha = fx === 'glow' ? 0.55 : 0.2;
    ctx.strokeStyle = th.border;
    ctx.lineWidth = 6;
    if (fx === 'glow') {
      ctx.shadowColor = th.border;
      ctx.shadowBlur = 16;
    }
    ctx.beginPath();
    if (fx === 'glow') {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        const px = 256 + Math.cos(a) * 176;
        const py = 358 + Math.sin(a) * 176;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
    } else {
      ctx.arc(256, 358, 168, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.restore();
  } else if (rank >= 11) {
    drawCourt(ctx, id, suit, rank, color);
  } else {
    const pips = PIP_LAYOUTS[rank];
    const pipSize = rank >= 9 ? 74 : rank >= 6 ? 82 : 92;
    for (const [px, py, dir] of pips) {
      const cx = AREA.x + px * AREA.w;
      const cy = AREA.y + py * AREA.h;
      ctx.save();
      ctx.translate(cx, cy);
      if (dir === -1) ctx.rotate(Math.PI);
      drawSuit(ctx, suit, 0, 0, pipSize, color, fx);
      ctx.restore();
    }
  }

  cornerIndex(ctx, label, suit, color, false, fx);
  cornerIndex(ctx, label, suit, color, true, fx);
}

function paintPaper(ctx, W, H, r) {
  const th = cardTheme.card;
  const fx = fxMode();
  const paper = paperColors();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, paper[0]);
  grad.addColorStop(1, paper[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  if (fx === 'glow') {
    // Faint circuit grid + scanlines.
    ctx.strokeStyle = 'rgba(53,243,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  } else if (fx === 'gloss') {
    // Glassy diagonal highlight (kept faint: it must not wash out the ink).
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.55);
  }

  // Border.
  ctx.save();
  ctx.strokeStyle = highContrast ? '#000' : th.border;
  if (fx === 'glow') {
    ctx.shadowColor = th.border;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 5;
    roundRectPath(ctx, 12, 12, W - 24, H - 24, r - 12);
    ctx.stroke();
  } else if (fx === 'gloss') {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#ff9ec2');
    bg.addColorStop(0.33, '#ffe38a');
    bg.addColorStop(0.66, '#8dffbf');
    bg.addColorStop(1, '#8fd8ff');
    ctx.strokeStyle = bg;
    ctx.lineWidth = 9;
    roundRectPath(ctx, 8, 8, W - 16, H - 16, r - 6);
    ctx.stroke();
  } else {
    ctx.lineWidth = 4;
    roundRectPath(ctx, 12, 12, W - 24, H - 24, r - 12);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, 20, 20, W - 40, H - 40, r - 18);
    ctx.stroke();
  }
  ctx.restore();

  // Dark outline hugging the card edge (the clip rounds the outer corners): defines the silhouette
  // against any board and keeps stacked cards distinct.
  ctx.save();
  ctx.strokeStyle = highContrast ? HC.outline : th.outline || '#000';
  ctx.lineWidth = (highContrast ? 18 : 11) * 2;
  roundRectPath(ctx, 0, 0, W, H, r);
  ctx.stroke();
  ctx.restore();
}

export function cardFaceTexture(id) {
  if (faceCache.has(id)) return faceCache.get(id);
  const W = 512;
  const H = 716;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const r = cardTheme.card.fx === 'gloss' ? 44 : 34;
  roundRectPath(ctx, 0, 0, W, H, r);
  ctx.save();
  ctx.clip();
  paintPaper(ctx, W, H, r);
  drawFace(ctx, id);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  faceCache.set(id, tex);
  return tex;
}

export function cardBackTexture() {
  if (backTexture) return backTexture;
  const W = 512;
  const H = 716;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const r = cardTheme.card.fx === 'gloss' ? 44 : 34;

  roundRectPath(ctx, 0, 0, W, H, r);
  ctx.save();
  ctx.clip();
  const img = cardArt.back;
  if (img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const s = Math.max(W / iw, H / ih);
    ctx.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
  } else {
    ctx.fillStyle = '#1c3f6f';
    ctx.fillRect(0, 0, W, H);
  }
  // Fine border keeps the edge crisp against the card body.
  ctx.lineWidth = 10;
  ctx.strokeStyle = cardTheme.card.border;
  ctx.globalAlpha = 0.85;
  roundRectPath(ctx, 5, 5, W - 10, H - 10, r - 4);
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  backTexture = tex;
  return tex;
}

// --- material detail maps -----------------------------------------------------
// These describe the material, independently of the printed/painted colour art.
// Periodic, seeded noise keeps repeat seams invisible and theme reloads stable.
const DETAIL_PROFILES = {
  marble: { strength: 1.2, variation: 0.035 },
  carbon: { strength: 1.6, variation: 0.06 },
  water: { strength: 0.8, variation: 0.025 },
  slate: { strength: 2.1, variation: 0.06 },
  wood: { strength: 2.2, variation: 0.055 },
  lacquer: { strength: 0.7, variation: 0.025 },
  cloth: { strength: 2.4, variation: 0.04 },
  glass: { strength: 0.35, variation: 0.015 },
  ceramic: { strength: 0.7, variation: 0.035 },
  laminate: { strength: 0.8, variation: 0.04 },
  felt: { strength: 2.2, variation: 0.025 },
  paint: { strength: 1.3, variation: 0.045 },
  paper: { strength: 2, variation: 0.035 },
};
const detailClamp = (v, a, b) => Math.min(b, Math.max(a, v));
function detailNoise(u, v, cells, seed) {
  const x = u * cells, y = v * cells;
  const ix = Math.floor(x), iy = Math.floor(y);
  const hash = (a, b) => {
    a = ((a % cells) + cells) % cells;
    b = ((b % cells) + cells) % cells;
    let n = Math.imul(a + seed, 374761393) ^ Math.imul(b + seed, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const top = hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx;
  const bottom = hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}
function materialDetailTextures(kind, baseRoughness, size = 512) {
  const profile = DETAIL_PROFILES[kind] || DETAIL_PROFILES.lacquer;
  const heights = new Float32Array(size * size);
  const finishes = new Float32Array(size * size);
  const tau = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const broad = detailNoise(u, v, 8, 17);
      const fine = detailNoise(u, v, 64, 41);
      const fibre = detailNoise(u, v, 128, 79);
      let h = fine * 0.12 + fibre * 0.06;
      if (kind === 'wood' || kind === 'paint') {
        // Long grain/brush strokes with gentle periodic wandering.
        const grain = Math.sin(tau * (u * 28 + 0.45 * Math.sin(tau * v) + broad * 0.3));
        h += grain * (kind === 'wood' ? 0.14 : 0.05);
      } else if (kind === 'cloth' || kind === 'carbon') {
        // Crossing yarns, alternating over/under rather than embossed artwork.
        const warp = Math.sin(tau * u * 32), weft = Math.sin(tau * v * 32);
        h += (warp + weft + warp * weft * 0.5) * 0.065;
      } else if (kind === 'felt' || kind === 'paper') {
        h += fibre * 0.23 + Math.sin(tau * (v * 64 + broad * 0.4)) * 0.025;
      } else if (kind === 'slate') {
        h += broad * 0.16 + Math.sin(tau * (u * 12 + Math.sin(tau * v))) * 0.035;
      } else if (kind === 'water') {
        h = (Math.sin(tau * (u * 3 + Math.sin(tau * v))) + Math.cos(tau * (v * 4 + Math.cos(tau * u)))) * 0.22;
      } else {
        // Polished marble, ceramic, glass and lacquer have very shallow relief.
        h += broad * 0.08;
      }
      const i = y * size + x;
      heights[i] = h;
      finishes[i] = detailClamp(broad * 0.65 + fine * 0.25 + fibre * 0.1, 0, 1);
    }
  }
  const normalCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  normalCanvas.width = normalCanvas.height = roughCanvas.width = roughCanvas.height = size;
  const normalCtx = normalCanvas.getContext('2d');
  const roughCtx = roughCanvas.getContext('2d');
  const normalPixels = normalCtx.createImageData(size, size);
  const roughPixels = roughCtx.createImageData(size, size);
  // Three multiplies roughness by its map. Encode an absolute finish range
  // relative to its upper bound so the map can make surfaces rougher as well.
  const roughness = detailClamp(baseRoughness + profile.variation, 0.04, 1);
  const at = (x, y) => heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * profile.strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * profile.strength;
      const length = Math.hypot(dx, dy, 1);
      const i = y * size + x, o = i * 4;
      normalPixels.data[o] = (-dx / length * 0.5 + 0.5) * 255;
      // Canvas rows run downward; tangent-space +Y runs upward.
      normalPixels.data[o + 1] = (dy / length * 0.5 + 0.5) * 255;
      normalPixels.data[o + 2] = (1 / length * 0.5 + 0.5) * 255;
      normalPixels.data[o + 3] = 255;
      const finish = detailClamp(baseRoughness + (finishes[i] * 2 - 1) * profile.variation, 0.04, 1);
      const value = Math.round(finish / roughness * 255);
      roughPixels.data[o] = roughPixels.data[o + 1] = roughPixels.data[o + 2] = value;
      roughPixels.data[o + 3] = 255;
    }
  }
  normalCtx.putImageData(normalPixels, 0, 0);
  roughCtx.putImageData(roughPixels, 0, 0);
  const normal = new THREE.CanvasTexture(normalCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  for (const texture of [normal, roughnessMap]) {
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
  }
  return { normal, roughnessMap, roughness };
}

// All card faces and backs share one stable, subtle paper finish.
let paperDetail = null;
export function paperDetailTextures() {
  if (!paperDetail) {
    paperDetail = materialDetailTextures('paper', 0.54, 256);
    paperDetail.normal.repeat.set(2, 2.8);
    paperDetail.roughnessMap.repeat.copy(paperDetail.normal.repeat);
  }
  return paperDetail;
}

// Preserve the board artwork only as colour. Fine relief comes from its material.
export function surfaceTextures(img, surface = {}, width = 10.9, height = 6.6) {
  const map = new THREE.Texture(img);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.needsUpdate = true;
  const detail = materialDetailTextures(surface.detail || 'lacquer', surface.roughness ?? 0.5);
  // World-size repeats keep fibres/grain consistent across rectangular boards.
  detail.normal.repeat.set(width / 1.8, height / 1.8);
  detail.roughnessMap.repeat.copy(detail.normal.repeat);
  return { map, ...detail };
}

// --- slot outlines ----------------------------------------------------------------
const SLOT_W = 256;
const SLOT_H = 358;

function slotCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = SLOT_W;
  canvas.height = SLOT_H;
  return [canvas, canvas.getContext('2d')];
}

function finishSlot(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function slotTexture(style) {
  const [canvas, ctx] = slotCanvas();
  roundRectPath(ctx, 8, 8, SLOT_W - 16, SLOT_H - 16, 18);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = style.stroke;
  ctx.setLineDash(style.dash);
  if (style.glow) {
    ctx.shadowColor = style.stroke;
    ctx.shadowBlur = style.glow;
  }
  ctx.stroke();
  return finishSlot(canvas);
}

// Free cell: a "parking pad" with a bullseye.
export function freeCellTexture(style) {
  const [canvas, ctx] = slotCanvas();
  roundRectPath(ctx, 9, 9, SLOT_W - 18, SLOT_H - 18, 20);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = style.stroke;
  ctx.setLineDash(style.dash);
  if (style.glow) {
    ctx.shadowColor = style.stroke;
    ctx.shadowBlur = style.glow;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(SLOT_W / 2, SLOT_H / 2, 40, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = style.mark;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(SLOT_W / 2, SLOT_H / 2, 12, 0, Math.PI * 2);
  ctx.fillStyle = style.mark;
  ctx.fill();
  return finishSlot(canvas);
}

// Foundation: framed pad with a big suit watermark.
export function foundationTexture(style, suit) {
  const [canvas, ctx] = slotCanvas();
  roundRectPath(ctx, 9, 9, SLOT_W - 18, SLOT_H - 18, 20);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = style.stroke;
  if (style.glow) {
    ctx.shadowColor = style.stroke;
    ctx.shadowBlur = style.glow;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  roundRectPath(ctx, 26, 26, SLOT_W - 52, SLOT_H - 52, 13);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = style.inner;
  ctx.stroke();
  // Light ceramic surfaces keep dark ink; dark tables use a light-grey watermark.
  let wm = suitColor(suit);
  if (/^#[0-9a-f]{6}$/i.test(wm)) {
    const n = parseInt(wm.slice(1), 16);
    const luma = 0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255);
    if (luma < 70 && (!style.lightSurface || highContrast)) wm = '#dcdcdc';
  }
  ctx.globalAlpha = style.markOpacity ?? 0.42;
  drawSuit(ctx, suit, SLOT_W / 2, SLOT_H / 2, 158, wm, cardTheme.card.fx === 'glow' ? 'glow' : 'none');
  ctx.globalAlpha = 1;
  return finishSlot(canvas);
}

// --- misc ------------------------------------------------------------------------
// Soft radial blob used for the table's ground shadow and particle sprites.
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
