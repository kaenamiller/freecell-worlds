// 3D card mesh: bevelled extruded body plus textured face planes. Materials are
// theme-driven and can be re-skinned in place with applyCardStyle().
import * as THREE from 'three';
import { cardFaceTexture, cardBackTexture, paperDetailTextures } from './textures.js';

export const CARD = { W: 0.9, H: 1.26, R: 0.085, D: 0.022 };
const BEVEL = 0.0035;

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

let shared = null;

function getShared() {
  if (shared) return shared;
  const shape = roundedRectShape(CARD.W - BEVEL * 2, CARD.H - BEVEL * 2, CARD.R);
  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: CARD.D - BEVEL * 2,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 2,
    curveSegments: 8,
  });
  bodyGeo.translate(0, 0, -(CARD.D - BEVEL * 2) / 2);
  bodyGeo.rotateX(-Math.PI / 2);
  bodyGeo.computeVertexNormals();

  const frontGeo = new THREE.PlaneGeometry(CARD.W, CARD.H);
  frontGeo.rotateX(-Math.PI / 2);
  const backGeo = new THREE.PlaneGeometry(CARD.W, CARD.H);
  backGeo.rotateX(Math.PI / 2);

  // Bodies and backs look the same on every card, so they share one material each:
  // consecutive draws then skip re-uploading uniforms. A marked card gets its own
  // body material for the mark's edge colour.
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf6f6f4, roughness: 0.6, metalness: 0.02 });
  const backMat = new THREE.MeshPhysicalMaterial({ alphaTest: 0.5 });
  shared = { bodyGeo, frontGeo, backGeo, bodyMat, backMat, style: null };
  return shared;
}

function styleFace(mat, style, map) {
  mat.map = map;
  const paper = paperDetailTextures();
  mat.normalMap = paper.normal;
  mat.normalScale.set(0.16, 0.16);
  mat.roughnessMap = paper.roughnessMap;
  mat.roughness = paper.roughness;
  mat.clearcoatNormalMap = paper.normal;
  mat.clearcoatNormalScale.set(0.06, 0.06);
  mat.clearcoat = style.clearcoat;
  mat.clearcoatRoughness = 0.45;
  mat.envMapIntensity = 0.55; // keep the HDRI from veiling the ink
  if (style.emissive > 0) {
    // Neon faces: the face art drives emission so indices and pips bloom.
    mat.emissiveMap = map;
    mat.emissive.set(0xffffff);
    mat.emissiveIntensity = style.emissive;
  } else {
    mat.emissiveMap = null;
    mat.emissive.set(0x000000);
    mat.emissiveIntensity = 0;
  }
  mat.needsUpdate = true;
}

export function buildCardMesh(id, style) {
  const { bodyGeo, frontGeo, backGeo, bodyMat, backMat } = getShared();
  const group = new THREE.Group();
  group.userData.cardId = id;

  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const frontMat = new THREE.MeshPhysicalMaterial({ alphaTest: 0.5 });
  const front = new THREE.Mesh(frontGeo, frontMat);
  front.position.y = CARD.D / 2 + 0.0012;
  front.receiveShadow = true;
  front.userData.cardId = id;
  group.add(front);

  const back = new THREE.Mesh(backGeo, backMat);
  back.position.y = -CARD.D / 2 - 0.0012;
  group.add(back);

  group.userData.body = body;
  group.userData.front = front;
  group.userData.back = back;
  group.userData.frontMat = frontMat;
  group.userData.backMat = backMat;
  applyCardStyle(group, style);
  return group;
}

// Re-skin a card for the active theme (call after setCardTheme()).
export function applyCardStyle(group, style) {
  const id = group.userData.cardId;
  styleFace(group.userData.frontMat, style, group.userData.concealed ? cardBackTexture() : cardFaceTexture(id));
  // The shared back only needs restyling once per theme (setCardTheme() replaces the back texture).
  const s = getShared();
  if (s.style !== style || s.backMat.map !== cardBackTexture()) {
    s.style = style;
    styleFace(s.backMat, style, cardBackTexture());
  }
  group.userData.edge = style.edge;
  setCardMark(group, group.userData.mark || null);
  setCardSticker(group, group.userData.sticker || null);
  setCardMods(group, group.userData.mods || []);
}

// Voyage marks use both an edge colour and a distinct monochrome corner sigil.
// `cap` is a full-face overlay (honey foil, drips, hazard rim, wax seal) for Capped Comb.
export const CARD_MARKS = {
  gold: { color: '#d9a62c', sigil: '◆' },
  glow: { color: '#95d657', sigil: '✦' }, crack: { color: '#ad7255', sigil: 'ϟ' },
  frost: { color: '#67c8ef', sigil: '❄' }, hot: { color: '#ee7637', sigil: '▲' },
  curse: { color: '#b081e9', sigil: '☾' }, wanted: { color: '#ce9a60', sigil: '⊕' },
  fragile: { color: '#e58eab', sigil: '◇' }, camera: { color: '#54b7a9', sigil: '▣' },
  crown: { color: '#c49b36', sigil: '♛' }, thorn: { color: '#8774a3', sigil: '⌁' },
  cap: { color: '#e8a317', paint: paintCap },
  lock: { color: '#2f6fad', paint: paintLock },
  bar: { color: '#8a4632', paint: paintBar },
  oneway: { color: '#1f8a78', paint: paintOneway },
  wild: { color: '#7a5cff', paint: paintWild },
  star: { color: '#eac447', paint: paintStar },
  'sticker-wild': { color: '#7a5cff', paint: (ctx) => paintSticker(ctx, 'wild') },
  'sticker-fool': { color: '#8c6a40', paint: (ctx) => paintSticker(ctx, 'fool') },
  'sticker-key': { color: '#267878', paint: (ctx) => paintSticker(ctx, 'key') },
  'sticker-gold': { color: '#c49427', paint: (ctx) => paintSticker(ctx, 'gold') },
  'sticker-lucky': { color: '#42764a', paint: (ctx) => paintSticker(ctx, 'lucky') },
};

// Hazard tape, a honey wash and drips along the top (the part that stays visible in a
// column), plus a hexagonal wax seal. Indices sit in the top-left, so the seal stays top-right.
function paintCap(ctx) {
  const W = 256;
  const H = 360;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.62);
  ctx.fillStyle = 'rgba(255, 214, 110, 0.28)';
  ctx.fillRect(-240, -18, 480, 16);
  ctx.fillStyle = 'rgba(255, 236, 180, 0.16)';
  ctx.fillRect(-240, 36, 480, 8);
  ctx.restore();

  const wash = ctx.createLinearGradient(0, 0, 0, 108);
  wash.addColorStop(0, 'rgba(255, 186, 42, 0.40)');
  wash.addColorStop(0.62, 'rgba(214, 140, 24, 0.14)');
  wash.addColorStop(1, 'rgba(214, 140, 24, 0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, 108);

  for (const [x, len, w] of [[118, 38, 12], [150, 54, 16], [178, 30, 10]]) {
    const drip = ctx.createLinearGradient(x, 0, x, len);
    drip.addColorStop(0, 'rgba(255, 206, 72, 0.96)');
    drip.addColorStop(1, 'rgba(176, 96, 12, 0.92)');
    ctx.fillStyle = drip;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, 0);
    ctx.lineTo(x + w / 2, 0);
    ctx.quadraticCurveTo(x + w * 0.58, len * 0.74, x, len);
    ctx.quadraticCurveTo(x - w * 0.58, len * 0.74, x - w / 2, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(x - w * 0.16, len * 0.32, Math.max(1.5, w * 0.14), len * 0.1, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(2, 2, W - 4, H - 4, 22);
  ctx.roundRect(15, 15, W - 30, H - 30, 16);
  ctx.clip('evenodd');
  ctx.fillStyle = '#16120c';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#f2c014';
  ctx.lineWidth = 8;
  ctx.lineCap = 'square';
  for (let x = -H; x < W + H; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 90, H);
    ctx.stroke();
  }
  ctx.restore();

  paintHoneySeal(ctx, 222, 38, 27);
}

function paintHoneySeal(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  const hex = (radius) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      const px = Math.cos(a) * radius;
      const py = Math.sin(a) * radius;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  };
  hex(r);
  ctx.fillStyle = '#f0b429';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1a1408';
  ctx.stroke();
  hex(r - 6);
  ctx.fillStyle = '#1a1408';
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.beginPath();
  ctx.ellipse(-6, -3, 8, 4.2, -0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6, -3, 8, 4.2, 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c014';
  ctx.beginPath();
  ctx.ellipse(0, 3, 4.6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a1408';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-4.2, 0);
  ctx.lineTo(4.2, 0);
  ctx.moveTo(-4.4, 3.4);
  ctx.lineTo(4.4, 3.4);
  ctx.moveTo(-3.6, 6.8);
  ctx.lineTo(3.6, 6.8);
  ctx.stroke();
  ctx.fillStyle = '#1a1408';
  ctx.beginPath();
  ctx.arc(0, -5.5, 3.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f2c014';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-1.4, -8.2);
  ctx.lineTo(-3.6, -12);
  ctx.moveTo(1.4, -8.2);
  ctx.lineTo(3.6, -12);
  ctx.stroke();
  ctx.restore();
}

// Shared status overlay: a tinted top strip (the part that stays visible in a column),
// a coloured rim, and a round seal in the top-right, clear of the corner index.
function paintStatus(ctx, { color, wash, emblem, lid = false }) {
  const W = 256;
  const H = 360;
  const fade = ctx.createLinearGradient(0, 0, 0, 100);
  fade.addColorStop(0, wash);
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, 100);
  if (lid) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(108, 0, 78, 16, [0, 0, 6, 6]);
    ctx.fill();
  }
  ctx.save();
  ctx.lineWidth = 9;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.roundRect(5, 5, W - 10, H - 10, 20);
  ctx.stroke();
  ctx.translate(216, 38);
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#14120e';
  ctx.stroke();
  emblem(ctx);
  ctx.restore();
}

function paintLock(ctx) {
  paintStatus(ctx, {
    color: '#2f6fad',
    wash: 'rgba(70, 150, 220, 0.40)',
    emblem(g) {
      g.strokeStyle = '#f4f8fc';
      g.fillStyle = '#f4f8fc';
      g.lineWidth = 3.2;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(0, -5, 7, Math.PI, 0);
      g.stroke();
      g.beginPath();
      g.roundRect(-8, -3, 16, 13, 2);
      g.fill();
    },
  });
}

function paintBar(ctx) {
  paintStatus(ctx, {
    color: '#8a4632',
    wash: 'rgba(176, 84, 52, 0.34)',
    lid: true,
    emblem(g) {
      g.strokeStyle = '#fff6ee';
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-8, -8);
      g.lineTo(8, 8);
      g.moveTo(8, -8);
      g.lineTo(-8, 8);
      g.stroke();
    },
  });
}

function paintOneway(ctx) {
  paintStatus(ctx, {
    color: '#1f8a78',
    wash: 'rgba(40, 170, 150, 0.36)',
    emblem(g) {
      g.fillStyle = '#f3fffb';
      g.beginPath();
      g.moveTo(0, -12);
      g.lineTo(9, 1);
      g.lineTo(4, 1);
      g.lineTo(4, 12);
      g.lineTo(-4, 12);
      g.lineTo(-4, 1);
      g.lineTo(-9, 1);
      g.closePath();
      g.fill();
    },
  });
}

function paintWild(ctx) {
  ctx.save();
  ctx.translate(128, 180);
  ctx.rotate(-0.55);
  ['rgba(255, 90, 90, 0.18)', 'rgba(255, 210, 70, 0.18)', 'rgba(80, 210, 140, 0.18)', 'rgba(90, 140, 255, 0.18)'].forEach((band, i) => {
    ctx.fillStyle = band;
    ctx.fillRect(-220, -78 + i * 22, 440, 9);
  });
  ctx.restore();
  paintStatus(ctx, {
    color: '#7a5cff',
    wash: 'rgba(150, 120, 255, 0.28)',
    emblem(g) {
      g.fillStyle = '#f7f4ff';
      g.beginPath();
      g.moveTo(0, -12);
      g.lineTo(9, 0);
      g.lineTo(0, 12);
      g.lineTo(-9, 0);
      g.closePath();
      g.fill();
    },
  });
}

function paintStar(ctx) {
  paintStatus(ctx, {
    color: '#e0a820',
    wash: 'rgba(240, 190, 50, 0.34)',
    emblem(g) {
      g.fillStyle = '#fff8e4';
      g.beginPath();
      for (let i = 0; i < 5; i++) {
        const outer = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const inner = outer + Math.PI / 5;
        const ox = Math.cos(outer) * 12;
        const oy = Math.sin(outer) * 12;
        if (i) g.lineTo(ox, oy);
        else g.moveTo(ox, oy);
        g.lineTo(Math.cos(inner) * 5, Math.sin(inner) * 5);
      }
      g.closePath();
      g.fill();
    },
  });
}

// Stickers occupy the lower-left corner, opposite the upper-right charm seal.
// Draw paths, rather than font glyphs, so all five remain distinct on every device.
function paintSticker(ctx, type) {
  ctx.save();
  ctx.translate(29, 329);
  ctx.fillStyle = 'rgba(255, 252, 237, .94)';
  ctx.strokeStyle = '#343029';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(-19, -19, 38, 38, 8); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = CARD_MARKS[`sticker-${type}`].color;
  ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (type === 'wild') {
    ctx.moveTo(0, -12); ctx.lineTo(10, 0); ctx.lineTo(0, 12); ctx.lineTo(-10, 0); ctx.closePath();
    ctx.moveTo(0, -6); ctx.lineTo(0, 6);
  } else if (type === 'fool') {
    ctx.moveTo(0, -12); ctx.lineTo(11, 10); ctx.lineTo(-11, 10); ctx.closePath();
    ctx.moveTo(0, -3); ctx.lineTo(0, 3); ctx.moveTo(0, 7); ctx.lineTo(0, 7.2);
  } else if (type === 'key') {
    ctx.arc(-4, -6, 5, 0, Math.PI * 2); ctx.moveTo(0, -2); ctx.lineTo(10, 8);
    ctx.lineTo(6, 12); ctx.moveTo(6, 4); ctx.lineTo(2, 8);
  } else if (type === 'gold') {
    ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.moveTo(-5, -6); ctx.lineTo(5, -6);
    ctx.moveTo(-5, 6); ctx.lineTo(5, 6); ctx.moveTo(0, -6); ctx.lineTo(0, 6);
  } else {
    for (const [x, y] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
      ctx.moveTo(x + 4, y); ctx.arc(x, y, 4, 0, Math.PI * 2);
    }
    ctx.moveTo(0, 4); ctx.lineTo(3, 13);
  }
  ctx.stroke(); ctx.restore();
}

// Upper-right seal on the 256×360 mark texture (sigil chip, status disc, or honey seal).
// Canvas y grows downward; texture flipY puts that edge at uv.y near 1.
const MARK_FACE = { w: 256, h: 360 };
const MARK_SIGIL_PX = { x: 178, y: 0, w: 78, h: 80 };

export function markSigilHit(uv) {
  if (!uv) return false;
  const { x, y, w, h } = MARK_SIGIL_PX;
  const u0 = x / MARK_FACE.w;
  const u1 = (x + w) / MARK_FACE.w;
  const v0 = 1 - (y + h) / MARK_FACE.h;
  const v1 = 1 - y / MARK_FACE.h;
  return uv.x >= u0 && uv.x <= u1 && uv.y >= v0 && uv.y <= v1;
}

const markTextures = new Map();
function markTexture(style) {
  if (markTextures.has(style)) return markTextures.get(style);
  const mark = CARD_MARKS[style];
  const c = document.createElement('canvas'); c.width = 256; c.height = 360;
  const ctx = c.getContext('2d');
  if (mark.paint) mark.paint(ctx);
  else {
    ctx.lineWidth = 7; ctx.strokeStyle = mark.color;
    ctx.beginPath(); ctx.roundRect(5, 5, 246, 350, 23); ctx.stroke();
    ctx.fillStyle = mark.color; ctx.beginPath(); ctx.roundRect(202, 8, 44, 47, 10); ctx.fill();
    ctx.fillStyle = '#171821'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 34px sans-serif'; ctx.fillText(mark.sigil, 224, 33);
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  markTextures.set(style, tex); return tex;
}
export function setCardMark(group, style = null) {
  // Compatibility with runtime api.mark(id, 'sticker-*'): use the independent slot.
  if (style?.startsWith('sticker-')) { setCardSticker(group, style); return; }
  if (style?.startsWith('mod-')) { addCardMod(group, style); return; }
  if (style && !CARD_MARKS[style]) throw new Error(`Unknown card mark: ${style}`);
  const u = group.userData;
  const resealed = !!u.mark !== !!style;
  u.mark = style;
  if (resealed && u.mods?.length) setCardMods(group, u.mods);
  if (style && !u.markMesh) {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    u.markMesh = new THREE.Mesh(getShared().frontGeo, mat);
    u.markMesh.position.y = CARD.D / 2 + 0.0025;
    group.add(u.markMesh);
  }
  if (u.markMesh) {
    u.markMesh.visible = !!style && !u.concealed;
    if (style) { u.markMesh.material.map = markTexture(style); u.markMesh.material.needsUpdate = true; }
  }
  const { bodyMat } = getShared();
  if (style) {
    if (u.body.material === bodyMat) u.body.material = bodyMat.clone();
    u.body.material.color.set(CARD_MARKS[style].color);
  } else {
    if (u.body.material !== bodyMat) {
      u.body.material.dispose();
      u.body.material = bodyMat;
    }
    bodyMat.color.set(u.edge);
  }
}

// Only one face of a card can point at the camera. Hiding the other skips a full
// physical-material draw per card; the GPU would have back-face culled it anyway.
const _up = new THREE.Vector3();
const _toEye = new THREE.Vector3();
export function cullCardFaces(group, eye) {
  const u = group.userData;
  _up.set(0, 1, 0).applyQuaternion(group.quaternion);
  const facing = _up.dot(_toEye.subVectors(eye, group.position));
  u.front.visible = facing > -0.05;
  u.back.visible = facing < 0.05;
}
// type is wild/fool/key/gold/lucky (sticker-* is also accepted); null clears only the sticker.
export function setCardSticker(group, type = null) {
  const style = type ? (type.startsWith('sticker-') ? type : `sticker-${type}`) : null;
  if (style && !CARD_MARKS[style]) throw new Error(`Unknown card sticker: ${type}`);
  const u = group.userData;
  u.sticker = style;
  if (style && !u.stickerMesh) {
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    u.stickerMesh = new THREE.Mesh(getShared().frontGeo, material);
    u.stickerMesh.position.y = CARD.D / 2 + 0.003;
    group.add(u.stickerMesh);
  }
  if (u.stickerMesh) {
    u.stickerMesh.visible = !!style && !u.concealed;
    if (style) { u.stickerMesh.material.map = markTexture(style); u.stickerMesh.material.needsUpdate = true; }
  }
}
// Ability modifications (Glaze, Redaction, Double Exposure…) are tabs along the top
// edge, between the index and the seal, so they stay readable in a fanned column and
// never compete with a challenge seal or a sticker. Several can stack on one card.
//   mod-wild            ignores colour (same diamond as the Wild seal and sticker)
//   mod-anchor          anything may be placed on this card
//   mod-rank-up-<r>     stacks as rank r (Glaze raised it)
//   mod-rank-down-<r>   stacks as rank r (Glaze lowered it)
// After the corner index (a "10" and its suit end near x≈118) and before the seal (from
// x≈190), inside the top strip a fanned column still shows. A card with no seal also
// gets the seal's corner.
const MOD_TAB = { x0: 122, x1: 188, x1Open: 248, y: 6, h: 54 };
const RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
export const isModStyle = (style) => /^mod-(wild|anchor|rank-(up|down)-([1-9]|1[0-3]))$/.test(String(style));

export function modHit(uv, sealed = true) {
  if (!uv) return false;
  const u0 = MOD_TAB.x0 / MARK_FACE.w, u1 = (sealed ? MOD_TAB.x1 : MOD_TAB.x1Open) / MARK_FACE.w;
  const v0 = 1 - (MOD_TAB.y + MOD_TAB.h + 8) / MARK_FACE.h, v1 = 1;
  return uv.x >= u0 && uv.x <= u1 && uv.y >= v0 && uv.y <= v1;
}

function paintModTab(ctx, style, x, w) {
  const { y, h } = MOD_TAB;
  const rank = /^mod-rank-(up|down)-(\d+)$/.exec(style);
  const fill = rank ? '#1d4fa6' : style === 'mod-anchor' ? '#22242c' : '#7a5cff';
  ctx.save();
  ctx.fillStyle = fill; ctx.strokeStyle = '#fffdf6'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#fffdf6';
  const cx = x + w / 2, cy = y + h / 2;
  if (rank) {
    // Azulejo-style corner flourishes, an arrow for the direction and the new rank.
    ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5;
    for (const [px, py, sx, sy] of [[x + 5, y + 5, 1, 1], [x + w - 5, y + 5, -1, 1], [x + 5, y + h - 5, 1, -1], [x + w - 5, y + h - 5, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(px, py + sy * 8); ctx.quadraticCurveTo(px, py, px + sx * 8, py); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const label = RANK_LABEL[rank[2]] || rank[2];
    // Shrink the label (not the arrow) until it fits a narrow tab, e.g. "10" beside another tab.
    let size = 40;
    do { ctx.font = `bold ${size}px sans-serif`; size -= 2; } while (ctx.measureText(label).width + 26 > w - 10 && size > 18);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const tw = ctx.measureText(label).width, ax = cx - (tw + 24) / 2;
    ctx.beginPath();
    if (rank[1] === 'up') { ctx.moveTo(ax, cy + 8); ctx.lineTo(ax + 9, cy - 9); ctx.lineTo(ax + 18, cy + 8); }
    else { ctx.moveTo(ax, cy - 8); ctx.lineTo(ax + 9, cy + 9); ctx.lineTo(ax + 18, cy - 8); }
    ctx.closePath(); ctx.fill();
    ctx.fillText(label, ax + 24, cy + 2);
  } else {
    // Icons are drawn for a 44px tab and shrink with a narrower one.
    const k = Math.min(1, (w - 6) / 38);
    ctx.translate(cx, cy); ctx.scale(k, k);
    if (style === 'mod-anchor') {
      // Redaction bars: the face is blacked out, so anything may land here.
      for (const [dy, bw] of [[-13, 32], [0, 24], [13, 28]]) ctx.fillRect(-16, dy - 4, bw, 8);
    } else {
      ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(14, 0); ctx.lineTo(0, 18); ctx.lineTo(-14, 0); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

const modTextures = new Map();
function modTexture(styles, sealed) {
  const key = `${styles.join('|')}${sealed ? '#' : ''}`;
  if (modTextures.has(key)) return modTextures.get(key);
  const c = document.createElement('canvas'); c.width = MARK_FACE.w; c.height = MARK_FACE.h;
  const ctx = c.getContext('2d');
  // A rank tab carries a label, so it gets twice the width of an icon tab.
  const gap = 5, span = (sealed ? MOD_TAB.x1 : MOD_TAB.x1Open) - MOD_TAB.x0;
  const weight = (style) => style.startsWith('mod-rank-') ? 2 : 1;
  const unit = Math.min(44, (span - gap * (styles.length - 1)) / styles.reduce((n, style) => n + weight(style), 0));
  let x = MOD_TAB.x0;
  for (const style of styles) { const w = unit * weight(style); paintModTab(ctx, style, x, w); x += w + gap; }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  modTextures.set(key, tex); return tex;
}

// Wild, then anchor, then rank tabs, so a card's tabs keep their order between redraws.
const MOD_ORDER = (style) => style === 'mod-wild' ? 0 : style === 'mod-anchor' ? 1 : 2;
export function setCardMods(group, styles = []) {
  const u = group.userData;
  const next = [...new Set(styles)].filter(isModStyle).sort((a, b) => MOD_ORDER(a) - MOD_ORDER(b) || a.localeCompare(b));
  u.mods = next;
  if (next.length && !u.modMesh) {
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    u.modMesh = new THREE.Mesh(getShared().frontGeo, material);
    u.modMesh.position.y = CARD.D / 2 + 0.0035;
    group.add(u.modMesh);
  }
  if (u.modMesh) {
    u.modMesh.visible = next.length > 0 && !u.concealed;
    if (next.length) { u.modMesh.material.map = modTexture(next, !!u.mark); u.modMesh.material.needsUpdate = true; }
  }
}
export const addCardMod = (group, style) => setCardMods(group, [...(group.userData.mods || []), style]);

export function setCardConcealed(group, concealed) {
  const u = group.userData;
  u.concealed = !!concealed;
  u.frontMat.map = concealed ? cardBackTexture() : cardFaceTexture(u.cardId);
  if (u.frontMat.emissiveMap) u.frontMat.emissiveMap = u.frontMat.map;
  u.frontMat.needsUpdate = true;
  if (u.markMesh) u.markMesh.visible = !!u.mark && !concealed;
  if (u.stickerMesh) u.stickerMesh.visible = !!u.sticker && !concealed;
  if (u.modMesh) u.modMesh.visible = !!u.mods?.length && !concealed;
}
