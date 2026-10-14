import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Game, cloneState, generateMoves, maxMoveSize, canStackOn, sequenceStart, randomDealNumber, safeFoundationMoves, legalFoundationMoves, canFinishWithFoundationOnly, cardsHome } from './rules.js';
import { buildCardMesh, applyCardStyle, setCardMark, setCardSticker, setCardMods, setCardConcealed, markSigilHit, modHit, cullCardFaces, CARD } from './card.js';
import { setCardTheme } from './textures.js';
import { Animator, Easing, CardMotion } from './animation.js';
import { Post } from './post.js';
import { Particles, Pulses } from './fx.js';
import { buildTableLayer } from './table.js';
import { THEMES, loadThemeAssets, randomThemeId } from './themes.js';
import { audio, SHARED_SOUNDS } from './audio.js';
import { settings, saveSettings, load, save } from './store.js';
import { stats, recordStart, recordWin, recordLoss, resetStats, dailyDealNumber, todayKey } from './stats.js';
import { ui } from './ui.js';
import { voyageUI } from './voyage/ui.js';
import { createRun, loadRun, saveRun, runView, boardPlan, upcomingPlans, laterPlans, startBoard, spendUndo, winBoard, pickCharm, loseRun, scoringContext } from './voyage/run.js';
import { BoardEffects, CHARMS } from './voyage/charms.js';
import { buyBoon, buySticker, upgradeBoon, buyUndo, sellBoon, rerollPort, leavePort, portService } from './voyage/port.js';
import { findNode } from './voyage/map.js';
import { scoreBoard, starsFor, starThresholds } from './voyage/scoring.js';
import { loadBank, prepare as prepareDeals, dealFor, setBusyProbe } from './voyage/dealer.js';
import { voyageStats, recordRunStart, recordRunEnd, recordBoardCleared, recordCharmPick, recordEconomy, resetVoyageStats } from './voyage/stats.js';
import { computeBury, shortSolve } from './difficulty.js';
import { VOYAGE_STUCK_IDLE_MS, VOYAGE_STUCK_PROOF_MS, VOYAGE_STUCK_SETTLE_MS, voyageStuckPlan } from './voyage/stuck.js';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const COL = 1.0;
const ROW = 0.34;
const FREE_Z = -2.75;
const TABLEAU_Z = -1.15;
const SURFACE_Y = 0.0; // playing surface; card bottoms rest here
const colX = (i) => (i - 3.5) * COL;
// Long columns condense so they never run off the table: the fan spans at most MAX_SPAN, and
// the last card always sits at the same place a 9-card column would end. In a condensed column,
// hovering (or tapping) a buried card pushes the cards below it down to reveal it ("peek").
const MAX_SPAN = 2.6;
const colStep = (len) => (len > 1 ? Math.min(ROW, MAX_SPAN / (len - 1)) : ROW);
const zAt = (len, i) => TABLEAU_Z + i * colStep(len);
let peek = null; // { col, idx }
function colZ(c, i, len) {
  const step = colStep(len);
  let z = TABLEAU_Z + i * step;
  if (peek && peek.col === c && step < ROW && i > peek.idx) z += ROW - step;
  return z;
}
// The top row holds the free cells and the four foundations. Classic FreeCell has 4 cells, so the
// row lines up with the columns. Voyage charms can change the count (1..6): with fewer, the
// missing cells are simply absent; with more, the whole row is re-spaced to fit the table.
let freeCellCount = 4;
const topSpacing = () => (freeCellCount <= 4 ? COL : Math.min(COL, 9 / (freeCellCount + 3)));
const topX = (j) => (freeCellCount <= 4 ? (j - 3.5) * COL : (j - (freeCellCount + 3) / 2) * topSpacing());
const freeX = (i) => topX(i);
const foundX = (i) => topX(Math.max(4, freeCellCount) + i);
const SPUR_X = 4.75, SPUR_Z = -1.0;
const LAYOUT = { surf: { w: 10.9, h: 6.6, cz: -0.8 }, SURFACE_Y, FREE_Z, TABLEAU_Z, SPUR_X, SPUR_Z, zAt, colX, freeX, foundX, get freeCells() { return freeCellCount; } };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const noop = () => {};
const isTouch = window.matchMedia('(pointer: coarse)').matches;

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && load('settings', {}).reducedMotion === undefined) {
  settings.reducedMotion = true;
}

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene');
// The canvas is unsmoothed. High and Ultra antialias through the post target;
// a lower tier draws native pixels straight to the screen.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // re-rendered only when a caster moves: see syncShadows()
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0605);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);

// Every quality tier renders at the display's native pixel ratio. Lower tiers
// drop antialiasing, bloom resolution, and shadow cost instead of upscaling.
const perf = {
  tier: settings.quality === 'auto' ? (isTouch ? 'medium' : 'high') : settings.quality,
  dpr: 1,
  acc: 0,
  frames: 0,
  fps: 60,
  downgraded: false,
};
function applyResolution() {
  perf.dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(perf.dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  post && post.resize(window.innerWidth, window.innerHeight, perf.dpr);
  updateScales();
}
let post = null;

// ---------------------------------------------------------------------------
// Camera framing
// ---------------------------------------------------------------------------
const FIELD = { minX: -4.975, maxX: 4.975, minZ: -3.775, maxZ: 2.175, centerZ: -0.8 };

function frameBoard() {
  const elevation = THREE.MathUtils.degToRad(60);
  const dir = new THREE.Vector3(0, Math.sin(elevation), Math.cos(elevation));
  const corners = [
    [FIELD.minX, FIELD.minZ],
    [FIELD.maxX, FIELD.minZ],
    [FIELD.minX, FIELD.maxZ],
    [FIELD.maxX, FIELD.maxZ],
  ];
  const maxFrac = 0.93;
  const tmp = new THREE.Vector3();
  const target = new THREE.Vector3(0, 0, FIELD.centerZ);
  camera.updateProjectionMatrix();

  const evalView = (D, tz) => {
    target.set(0, 0, tz);
    camera.position.copy(target).addScaledVector(dir, D);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, z] of corners) {
      tmp.set(x, 0, z).project(camera);
      minX = Math.min(minX, tmp.x);
      maxX = Math.max(maxX, tmp.x);
      minY = Math.min(minY, tmp.y);
      maxY = Math.max(maxY, tmp.y);
    }
    return { fx: (maxX - minX) / 2, fy: (maxY - minY) / 2, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  };

  const fitDistance = (tz) => {
    let lo = 2;
    let hi = 140;
    let best = hi;
    for (let i = 0; i < 60; i++) {
      const D = (lo + hi) / 2;
      const r = evalView(D, tz);
      if (Math.max(r.fx, r.fy) <= maxFrac) {
        best = D;
        hi = D;
      } else {
        lo = D;
      }
    }
    return best;
  };

  let tz = FIELD.centerZ;
  let D = fitDistance(tz);
  for (let it = 0; it < 12; it++) {
    const r = evalView(D, tz);
    if (Math.abs(r.cy) < 0.002 && Math.abs(r.cx) < 0.002) break;
    const eps = 0.2;
    const r2 = evalView(D, tz + eps);
    const dcy = (r2.cy - r.cy) / eps;
    const dcx = (r2.cx - r.cx) / eps;
    if (Math.abs(dcy) > 1e-4) tz -= r.cy / dcy;
    if (Math.abs(dcx) > 1e-4) tz -= r.cx / dcx;
    D = fitDistance(tz);
  }
  evalView(D, tz);

  // Short cover screens (iPhone Duo ~14:10, Fold 8 ~16:10) and phone landscape.
  // The natural fit above is unchanged when the table already clears the bars.
  const chrome = boardChrome();
  const field = fieldScreenBounds();
  const pad = 8;
  const covered = field.top < chrome.top + pad || (chrome.bottom > 0 && field.bottom > window.innerHeight - chrome.bottom - pad);
  const compact = window.innerWidth <= 760 || window.innerHeight <= 540;
  if (compact && covered) {
    const H = window.innerHeight;
    const y1 = Math.min(maxFrac, 1 - 2 * (chrome.top + pad) / H);
    const y0 = Math.max(-maxFrac, -1 + 2 * (chrome.bottom + pad) / H);
    if (y1 - y0 > 0.28) fitFieldTo(evalView, { x0: -maxFrac, x1: maxFrac, y0, y1 });
  }
  camera.updateProjectionMatrix();
}

// Pixel edges of the bars that sit over the table. Bottom chrome is only reserved on
// short viewports, where the dock and status pill would otherwise cover the columns.
function boardChrome() {
  const hud = document.getElementById('hud');
  let top = 0;
  if (hud && !hud.classList.contains('hidden')) {
    const bottom = hud.getBoundingClientRect().bottom;
    if (bottom > 0) top = bottom;
  }
  let bottom = 0;
  if (window.innerHeight <= 540) {
    const h = window.innerHeight;
    const edge = (el) => {
      if (!el || el.hidden || el.classList.contains('hidden')) return;
      const r = el.getBoundingClientRect();
      if (r.height > 1 && r.top < h && r.top > h * 0.4) bottom = Math.max(bottom, h - r.top);
    };
    if (document.body.dataset.mode === 'voyage') edge(document.getElementById('voyage-dock'));
    edge(document.getElementById('status-bar'));
  }
  return { top, bottom };
}

function fieldScreenBounds() {
  const tmp = new THREE.Vector3();
  const H = window.innerHeight;
  let top = Infinity;
  let bottom = -Infinity;
  for (const x of [FIELD.minX, FIELD.maxX]) {
    for (const z of [FIELD.minZ, FIELD.maxZ]) {
      const y = (1 - tmp.set(x, 0, z).project(camera).y) * 0.5 * H;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return { top, bottom };
}

// Fit the table inside an NDC rectangle and center it there. Used only when the
// natural frame runs under the HUD or, on a short screen, the bottom bars.
function fitFieldTo(evalView, lim) {
  const tx = (lim.x0 + lim.x1) / 2;
  const ty = (lim.y0 + lim.y1) / 2;
  const inside = (r) => r.cx - r.fx >= lim.x0 - 1e-3 && r.cx + r.fx <= lim.x1 + 1e-3
    && r.cy - r.fy >= lim.y0 - 1e-3 && r.cy + r.fy <= lim.y1 + 1e-3;
  const fitDistance = (tz) => {
    let lo = 2;
    let hi = 140;
    let best = hi;
    for (let i = 0; i < 60; i++) {
      const D = (lo + hi) / 2;
      if (inside(evalView(D, tz))) { best = D; hi = D; }
      else lo = D;
    }
    return best;
  };
  let tz = FIELD.centerZ;
  let D = fitDistance(tz);
  for (let it = 0; it < 16; it++) {
    const r = evalView(D, tz);
    if (Math.abs(r.cy - ty) < 0.002 && Math.abs(r.cx - tx) < 0.002) break;
    const eps = 0.2;
    const r2 = evalView(D, tz + eps);
    const dcy = (r2.cy - r.cy) / eps;
    const dcx = (r2.cx - r.cx) / eps;
    if (Math.abs(dcy) > 1e-4) tz -= (r.cy - ty) / dcy;
    else if (Math.abs(dcx) > 1e-4) tz -= (r.cx - tx) / dcx;
    D = fitDistance(tz);
  }
  evalView(D, tz);
}
frameBoard();

// ---------------------------------------------------------------------------
// Lighting (colours / intensities are set per theme)
// ---------------------------------------------------------------------------
const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.6);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 40;
key.shadow.camera.left = -7;
key.shadow.camera.right = 7;
key.shadow.camera.top = 7;
key.shadow.camera.bottom = -7;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.01;
key.shadow.radius = 4;
key.shadow.blurSamples = 12;
scene.add(key);

function applyShadowQuality(tier) {
  const soft = tier === 'ultra' || tier === 'high';
  const type = soft ? THREE.PCFSoftShadowMap : tier === 'medium' ? THREE.PCFShadowMap : THREE.BasicShadowMap;
  const size = soft ? 2048 : tier === 'medium' ? 1024 : 512;
  const radius = soft ? 4 : 1;
  const changed = renderer.shadowMap.type !== type || key.shadow.mapSize.x !== size || key.shadow.radius !== radius;
  renderer.shadowMap.type = type;
  key.shadow.mapSize.set(size, size);
  key.shadow.radius = radius;
  if (changed && key.shadow.map) {
    key.shadow.map.dispose();
    key.shadow.map = null;
  }
  renderer.shadowMap.needsUpdate = true;
}

const fill = new THREE.DirectionalLight(0xffffff, 0.5);
scene.add(fill);
const rim = new THREE.PointLight(0xffffff, 30, 30, 2);
scene.add(rim);

// A local light follows the pointer on the playing plane; the camera stays fixed.
// Keep it in the scene so theme rebuilds do not recreate it. No extra shadow pass.
// A broad emitter spreads reflections instead of creating a pinprick hotspot.
RectAreaLightUniformsLib.init();
const CURSOR_LIGHT = { height: 2.2, intensity: 0.22, size: 3 };
const cursorLight = new THREE.RectAreaLight(0xfff5e8, 0, CURSOR_LIGHT.size, CURSOR_LIGHT.size);
cursorLight.position.set(0, SURFACE_Y + CURSOR_LIGHT.height, FIELD.centerZ);
cursorLight.rotation.x = -Math.PI / 2; // emitter faces down toward the playing surface
scene.add(cursorLight);
const cursorGlow = {
  pointer: new THREE.Vector2(),
  ray: new THREE.Raycaster(),
  plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -SURFACE_Y),
  hit: new THREE.Vector3(),
  target: new THREE.Vector3(),
  active: false,
  tracking: false,
  touchId: null,
  releaseRemaining: 0,
};
function setCursorLightPointer(e) {
  const rect = canvas.getBoundingClientRect();
  cursorGlow.pointer.set(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
}
const hideCursorLight = () => {
  cursorGlow.active = false;
  cursorGlow.touchId = null;
  cursorGlow.releaseRemaining = 0;
};
// Capture phase also sees card taps whose game handler stops propagation.
window.addEventListener('pointerdown', (e) => {
  if (e.isPrimary === false) return;
  if (e.target !== canvas) {
    hideCursorLight();
    return;
  }
  if (e.pointerType !== 'touch') return;
  cursorGlow.touchId = e.pointerId;
  cursorGlow.releaseRemaining = 0;
  cursorGlow.active = true;
  cursorGlow.tracking = false; // each tap lights its new position immediately
  setCursorLightPointer(e);
  updateCursorLight(0);
  // Even a quick tap should be visible before its release fade starts.
  if (settings.cursorLight && cursorGlow.tracking) cursorLight.intensity = CURSOR_LIGHT.intensity;
}, true);
window.addEventListener('pointermove', (e) => {
  if (e.isPrimary === false) return;
  if (e.pointerType === 'touch') {
    if (e.pointerId !== cursorGlow.touchId) return;
    setCursorLightPointer(e);
    return;
  }
  cursorGlow.releaseRemaining = 0;
  cursorGlow.active = e.target === canvas;
  if (cursorGlow.active) setCursorLightPointer(e);
}, true);
window.addEventListener('pointerup', (e) => {
  if (e.pointerId !== cursorGlow.touchId) return;
  setCursorLightPointer(e);
  cursorGlow.touchId = null;
  cursorGlow.releaseRemaining = settings.reducedMotion ? 0 : 0.35;
  if (!cursorGlow.releaseRemaining) cursorGlow.active = false;
}, true);
canvas.addEventListener('pointerleave', (e) => {
  // Touch emits pointerleave after release; allow the tap glow to finish.
  if (e.pointerType !== 'touch') hideCursorLight();
});
window.addEventListener('blur', hideCursorLight);
document.addEventListener('visibilitychange', hideCursorLight);
window.addEventListener('pointercancel', hideCursorLight, true);

function updateCursorLight(dt) {
  if (cursorGlow.releaseRemaining > 0) {
    cursorGlow.releaseRemaining = Math.max(0, cursorGlow.releaseRemaining - dt);
    if (!cursorGlow.releaseRemaining) cursorGlow.active = false;
  }
  let on = settings.cursorLight && cursorGlow.active;
  if (on) {
    cursorGlow.ray.setFromCamera(cursorGlow.pointer, camera);
    const hit = cursorGlow.ray.ray.intersectPlane(cursorGlow.plane, cursorGlow.hit);
    const { w, h, cz } = LAYOUT.surf;
    on = !!hit && Math.abs(hit.x) <= w / 2 && Math.abs(hit.z - cz) <= h / 2;
    if (on) {
      cursorGlow.target.set(hit.x, SURFACE_Y + CURSOR_LIGHT.height, hit.z);
      if (!cursorGlow.tracking || settings.reducedMotion) {
        cursorLight.position.copy(cursorGlow.target);
      } else {
        cursorLight.position.lerp(cursorGlow.target, 1 - Math.exp(-18 * dt));
      }
    }
  }
  cursorGlow.tracking = on;
  const intensity = on ? CURSOR_LIGHT.intensity : 0;
  cursorLight.intensity = settings.reducedMotion
    ? intensity
    : THREE.MathUtils.lerp(cursorLight.intensity, intensity, 1 - Math.exp(-12 * dt));
}

function applyLights(cfg) {
  renderer.toneMappingExposure = cfg.exposure;
  hemi.color.setHex(cfg.hemi[0]);
  hemi.groundColor.setHex(cfg.hemi[1]);
  hemi.intensity = cfg.hemi[2];
  key.color.setHex(cfg.key.color);
  key.intensity = cfg.key.intensity;
  key.position.set(...cfg.key.pos);
  fill.color.setHex(cfg.fill.color);
  fill.intensity = cfg.fill.intensity;
  fill.position.set(...cfg.fill.pos);
  rim.color.setHex(cfg.rim.color);
  rim.intensity = cfg.rim.intensity;
  rim.position.set(...cfg.rim.pos);
  scene.fog = new THREE.Fog(cfg.fog[0], cfg.fog[1], cfg.fog[2]);
  scene.environmentIntensity = cfg.env;
}

// ---------------------------------------------------------------------------
// Table root (flips in on deal) + persistent hit areas / slot glows
// ---------------------------------------------------------------------------
const tableGroup = new THREE.Group();
scene.add(tableGroup);
let layer = null;

const slotHitAreas = [];
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
function addHit(x, z, w, h, pile, index) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), hitMat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, SURFACE_Y + 0.05, z);
  m.userData = { pile, index };
  m.layers.set(1); // picking only: keeps these planes out of the camera and the AO depth pass
  scene.add(m);
  slotHitAreas.push(m);
}
for (let c = 0; c < 8; c++) addHit(colX(c), TABLEAU_Z + 1.15, CARD.W * 1.06, 3.6, 'col', c);
// Top-row hit areas depend on the free-cell count, so they are rebuilt when it changes.
function buildTopRowHits() {
  for (let i = slotHitAreas.length - 1; i >= 0; i--) {
    const m = slotHitAreas[i];
    if (m.userData.pile === 'col') continue;
    scene.remove(m);
    m.geometry.dispose();
    slotHitAreas.splice(i, 1);
  }
  const w = Math.min(CARD.W * 1.1, topSpacing() * 0.98);
  for (let i = 0; i < freeCellCount; i++) addHit(freeX(i), FREE_Z, w, CARD.H * 1.15, 'free', i);
  for (let i = 0; i < 4; i++) addHit(foundX(i), FREE_Z, w, CARD.H * 1.15, 'found', i);
}
buildTopRowHits();
function syncSpurHit() {
  const existing = slotHitAreas.find((m) => m.userData.pile === 'found' && m.userData.index === 4);
  if (game?.state.spur && !existing) addHit(SPUR_X, SPUR_Z, CARD.W * 1.1, CARD.H * 1.15, 'found', 4);
  else if (!game?.state.spur && existing) { scene.remove(existing); existing.geometry.dispose(); slotHitAreas.splice(slotHitAreas.indexOf(existing), 1); }
}

// Glowing landing preview shown for every legal drop while dragging.
const glowTex = (() => {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 180;
  const ctx = c.getContext('2d');
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 16;
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(14, 14, 100, 152, 12);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fill();
  return new THREE.CanvasTexture(c);
})();
const glows = new Map();
function makeGlow(kind, index) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD.W * 1.08, CARD.H * 1.08),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  m.userData.level = 0;
  m.userData.want = 0;
  glows.set(`${kind}${index}`, m); // added to the scene only while highlighted
}
for (let i = 0; i < 6; i++) makeGlow('free', i);
for (let i = 0; i < 5; i++) makeGlow('found', i);
for (let c = 0; c < 8; c++) makeGlow('col', c);

function updateGlows(dt) {
  const t = performance.now() / 1000;
  for (const m of glows.values()) {
    const u = m.userData;
    u.level += (u.want - u.level) * Math.min(1, dt * 12);
    m.material.opacity = u.level * (0.65 + 0.35 * Math.sin(t * 6));
    const on = u.level > 0.01;
    if (on && !m.parent) scene.add(m);
    else if (!on && m.parent) scene.remove(m);
  }
}

function showValidTargets(from) {
  const ids = movableCards({ ...from });
  const lead = ids && ids[0];
  const targets = [];
  for (let c = 0; c < 8; c++) targets.push({ kind: 'col', index: c });
  for (let f = 0; f < freeCellCount; f++) targets.push({ kind: 'free', index: f });
  for (let f = 0; f < (game.state.spur ? 5 : 4); f++) targets.push({ kind: 'found', index: f });
  for (const t of targets) {
    const g = glows.get(`${t.kind}${t.index}`);
    let ok = !!tryDrop(from, t);
    if (ok && t.kind === 'found' && lead != null) ok = ids.length === 1 && (((lead - 1) / 13) | 0) === (t.index === 4 ? game.state.spur.suit : t.index);
    if (ok && t.kind === 'col') {
      const len = game.tableau[t.index].length;
      g.position.set(colX(t.index), SURFACE_Y + 0.012 + len * CARD.D, colZ(t.index, len, len + 1));
    } else if (ok) {
      g.position.set(t.kind === 'free' ? freeX(t.index) : t.index === 4 ? SPUR_X : foundX(t.index), SURFACE_Y + 0.012, t.kind === 'found' && t.index === 4 ? SPUR_Z : FREE_Z);
    }
    g.userData.want = ok ? 1 : 0;
  }
}
function hideValidTargets() {
  for (const g of glows.values()) g.userData.want = 0;
}

// ---------------------------------------------------------------------------
// Post, FX, motion
// ---------------------------------------------------------------------------
post = new Post(renderer, scene, camera);
const particles = new Particles(scene);
const pulses = new Pulses(scene);
const animator = new Animator();
const motion = new CardMotion();
const cardGroups = new Map();
const pickables = [];

function updateScales() {
  const px = window.innerHeight * perf.dpr;
  particles.setScale(px, camera.fov);
  layer && layer.setScale(px, camera.fov);
}

const panOf = (x) => clamp((x / 5) * 0.65, -0.8, 0.8);

// ---------------------------------------------------------------------------
// Theme manager
// ---------------------------------------------------------------------------
let currentTheme = THEMES[settings.autoRandomTheme ? randomThemeId(settings.theme) : settings.theme] || THEMES.roman;
let currentArt = null;
let envTarget = null;
const pmrem = new THREE.PMREMGenerator(renderer);

// Screen-space backdrop drawn as a full-screen quad instead of scene.background,
// so it can be thrown out of focus (mip-biased disc blur) for the deal intro.
const backdropMat = new THREE.ShaderMaterial({
  uniforms: {
    map: { value: null },
    uRepeat: { value: new THREE.Vector2(1, 1) },
    uOffset: { value: new THREE.Vector2(0, 0) },
    uTexel: { value: new THREE.Vector2(1, 1) },
    uBlur: { value: 0 },
    uIntensity: { value: 0.9 },
  },
  vertexShader: /* glsl */ `
    uniform vec2 uRepeat, uOffset;
    varying vec2 vUv;
    void main() { vUv = uv * uRepeat + uOffset; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D map;
    uniform vec2 uTexel;
    uniform float uBlur, uIntensity;
    varying vec2 vUv;
    void main() {
      vec3 col;
      if (uBlur < 0.001) col = texture2D(map, vUv).rgb;
      else {
        float lod = uBlur * 5.0;
        vec2 r = uTexel * exp2(lod) * 2.5;
        col = vec3(0.0);
        for (int i = 0; i < 16; i++) {
          float fi = float(i) + 0.5;
          float a = fi * 2.39996;
          col += texture2D(map, vUv + vec2(cos(a), sin(a)) * sqrt(fi / 16.0) * r, lod).rgb;
        }
        col /= 16.0;
      }
      gl_FragColor = vec4(col * uIntensity, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  depthTest: false,
  depthWrite: false,
  toneMapped: false, // matches three's own sRGB backgrounds
});
const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backdropMat);
backdrop.frustumCulled = false;
backdrop.renderOrder = -1e6;
backdrop.visible = false;
backdrop.raycast = noop;
// The shader ignores the model matrix; parking the mesh far below keeps it out of
// override-material passes (GTAO normals) that do use it.
backdrop.position.y = -1e4;
scene.add(backdrop);
const setBackdropBlur = (v) => { backdropMat.uniforms.uBlur.value = v; };

function coverBackground() {
  const t = backdropMat.uniforms.map.value;
  if (!t || !t.image) return;
  const u = backdropMat.uniforms;
  const imgA = t.image.width / t.image.height;
  const viewA = window.innerWidth / window.innerHeight;
  u.uRepeat.value.set(1, 1);
  u.uOffset.value.set(0, 0);
  u.uTexel.value.set(1 / t.image.width, 1 / t.image.height);
  if (viewA > imgA) {
    u.uRepeat.value.y = imgA / viewA;
    u.uOffset.value.y = (1 - u.uRepeat.value.y) / 2;
  } else {
    u.uRepeat.value.x = viewA / imgA;
    u.uOffset.value.x = (1 - u.uRepeat.value.x) / 2;
  }
}

function rebuildTableLayer() {
  if (layer) {
    tableGroup.remove(layer.group);
    layer.dispose();
  }
  layer = buildTableLayer(currentTheme, currentArt, LAYOUT, { highContrast: settings.highContrast });
  tableGroup.add(layer.group);
}

// Change the number of free cells (Voyage boards). Call before dealing.
function setFreeCellCount(n) {
  if (n === freeCellCount) return;
  freeCellCount = n;
  buildTopRowHits();
  if (layer) {
    rebuildTableLayer();
    // Voyage boards change the count right before dealing: upload the rebuilt
    // table now rather than when it sweeps in mid-intro.
    uploadTextures(layer.group);
  }
}

let themeGen = 0;

async function applyTheme(id, { persist = true, gen, css = true } = {}) {
  const theme = THEMES[id];
  const art = await loadThemeAssets(theme);
  if (gen != null && gen !== themeGen) return;
  currentTheme = theme;
  currentArt = art;
  // Voyage tables are chosen by the run. Saving them would replace the theme
  // the player picked for classic.
  if (persist) {
    settings.theme = id;
    saveSettings();
  }

  // Boot paints the chrome only once the loader is about to reveal the title.
  // Applying it here would restyle the loading screen as soon as the art arrives.
  if (css) ui.applyThemeCss(theme);
  setCardTheme(theme, art, { fourColor: settings.fourColor, highContrast: settings.highContrast });
  applyLights(theme.scene);
  post.setTheme(theme.scene);

  rebuildTableLayer();

  // Environment lighting + screen-space backdrop.
  if (envTarget) envTarget.dispose();
  envTarget = null;
  if (art.env) {
    const e = new THREE.Texture(art.env);
    e.mapping = THREE.EquirectangularReflectionMapping;
    e.colorSpace = THREE.SRGBColorSpace;
    e.needsUpdate = true;
    envTarget = pmrem.fromEquirectangular(e);
    scene.environment = envTarget.texture;
    e.dispose();
  }
  backdropMat.uniforms.map.value?.dispose();
  backdropMat.uniforms.map.value = null;
  if (art.backdrop) {
    const bg = new THREE.Texture(art.backdrop);
    bg.colorSpace = THREE.SRGBColorSpace;
    bg.needsUpdate = true;
    backdropMat.uniforms.map.value = bg;
    backdrop.visible = true;
    scene.background = null;
    coverBackground();
  } else {
    backdrop.visible = false;
    scene.background = new THREE.Color(theme.scene.clear);
  }

  ensureCards();
  for (const g of cardGroups.values()) applyCardStyle(g, theme.card);
  for (const id of new Set([...highlightedIds, ...targetIds, ...targetFocusIds, ...targetChosenIds])) refreshCardEmissive(id);
  updateScales();
  audio.setTheme(id);
  renderer.shadowMap.needsUpdate = true;
  await warmGpu();
}

// Upload every texture and link every shader the theme needs while the theme
// fade (or the loader) still covers the screen. Otherwise the 52 card faces and
// the board art upload, and new shaders compile, in the middle of the deal intro.
async function warmGpu() {
  // Compile against the buffer the scene really renders into. Post-processed
  // tiers draw into a linear half-float target, which selects different shader
  // variants (no tone mapping, linear output) than drawing straight to the screen.
  const target = perf.tier === 'low' ? null : post.composer.renderTarget1;
  const ready = withWholeScene(() => {
    uploadTextures(scene);
    return withRenderTarget(target, () => renderer.compileAsync(scene, camera));
  });
  await ready;
  // A linked program still blocks on its first draw, while three.js reads back
  // its uniforms. Draw once into the offscreen post buffer to take that hit now;
  // nothing reaches the screen, and the next frame overwrites the buffer.
  if (target) withWholeScene(() => withRenderTarget(target, () => renderer.render(scene, camera)));
  renderer.shadowMap.needsUpdate = true;
}

// Push every texture under root to the GPU now (initTexture skips ones already uploaded).
function uploadTextures(root) {
  const seen = new Set();
  const upload = (v) => {
    if (v?.isTexture && !v.isRenderTargetTexture && !seen.has(v)) {
      seen.add(v);
      renderer.initTexture(v);
    }
  };
  root.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      for (const v of Object.values(m)) upload(v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) upload(u.value);
    }
  });
}

// Run fn with every card face, the table and the pooled effects in the scene
// and visible, then restore them. Shader variants depend on the scene's light
// count, which differs per theme, so effects that sit outside the scene until
// used are included too.
function withWholeScene(fn) {
  const shown = [];
  const show = (o) => { if (!o.visible) { o.visible = true; shown.push(o); } };
  show(tableGroup);
  show(particles.points);
  for (const g of cardGroups.values()) {
    show(g);
    show(g.userData.front);
    show(g.userData.back);
  }
  const extras = [...glows.values(), ...pulses.idleMeshes()].filter((m) => !m.parent);
  for (const m of extras) scene.add(m);
  try {
    return fn();
  } finally {
    for (const o of shown) o.visible = false;
    for (const m of extras) scene.remove(m);
  }
}

function withRenderTarget(target, fn) {
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  try {
    return fn();
  } finally {
    renderer.setRenderTarget(prev);
  }
}

async function switchTheme(id, { persist = true, sound = true } = {}) {
  if (!THEMES[id] || (id === currentTheme.id && currentArt)) return;
  const gen = ++themeGen;
  if (sound) audio.ui();
  // A title that is already animating away no longer hides the table, so the
  // heavy swap (texture uploads, shader warm-up) goes behind the fade instead.
  const tl = ui.els.title.classList;
  const onTitle = !tl.contains('hidden') && !tl.contains('leaving');
  const apply = () => applyTheme(id, { persist, gen });
  if (onTitle) await apply();
  else await ui.transition(apply);
}

// ---------------------------------------------------------------------------
// Card management
// ---------------------------------------------------------------------------
let dealing = false;

function moveCard(g, target, opts = {}) {
  motion.move(g, target, opts);
}

motion.onLand = (g, impact) => {
  if (dealing || !g.parent) return;
  const dest = g.userData.dest;
  const pan = panOf(g.position.x);
  if (dest === 'found') {
    celebrateFoundation(g, pan);
  } else {
    audio.place(pan, impact);
    if (!settings.reducedMotion && impact > 1.1) {
      const c = currentTheme.fx.dust;
      particles.emit({
        x: g.position.x,
        y: SURFACE_Y + 0.04,
        z: g.position.z + 0.3,
        color: c,
        count: Math.min(7, 2 + Math.round(impact)),
        speed: 0.5,
        spread: 0.5,
        up: 0.1,
        size: 0.07,
        life: 0.5,
        gravity: -0.1,
        drag: 3,
        jitter: 0.5,
      });
    }
  }
};
motion.onFlip = (g) => {
  if (!dealing && !cascade) audio.flip(panOf(g.position.x));
};
motion.onTrail = (g, speed) => {
  if (g.userData.dest !== 'found' || settings.reducedMotion || speed < 1) return;
  particles.emit({
    x: g.position.x,
    y: g.position.y + 0.05,
    z: g.position.z,
    color: currentTheme.fx.spark,
    count: 2,
    speed: 0.25,
    size: 0.07,
    life: 0.45,
    drag: 2,
    jitter: 0.25,
  });
};

function celebrateFoundation(g, pan) {
  audio.foundation(pan);
  post.pulse(0.35);
  pulses.ring(g.position.x, g.position.z, currentTheme.fx.flash, 1);
  pulses.flash(g.position.x, 1.2, g.position.z, currentTheme.fx.flash, 16);
  if (settings.reducedMotion) return;
  particles.emit({
    x: g.position.x,
    y: SURFACE_Y + 0.12,
    z: g.position.z,
    color: currentTheme.fx.spark,
    count: 34,
    speed: 2.1,
    spread: 1.4,
    up: 1.6,
    size: 0.1,
    life: 0.95,
    gravity: 3.2,
    drag: 1.2,
    jitter: 0.5,
  });
}

function setPeek(col, idx) {
  if (col != null && fogContext()) col = null;
  const next = col == null ? null : { col, idx };
  if ((peek?.col ?? -1) === (next?.col ?? -1) && (peek?.idx ?? -1) === (next?.idx ?? -1)) return;
  peek = next;
  if (game) applyLayout(true, { peek: true });
}
// Peek the card under the pointer when it is buried in a condensed column.
function peekFromCard(id) {
  const loc = id != null && game ? locateCard(id) : null;
  if (loc && loc.kind === 'col') {
    const len = game.state.tableau[loc.index].length;
    if (loc.cardIndex < len - 1 && colStep(len) < ROW) { setPeek(loc.index, loc.cardIndex); return true; }
  }
  setPeek(null);
  return false;
}

function computeTargets() {
  if (peek && (!game || peek.idx >= game.state.tableau[peek.col].length - 1)) peek = null;
  const t = new Map();
  const st = game.state;
  for (let c = 0; c < 8; c++) {
    const col = st.tableau[c];
    for (let i = 0; i < col.length; i++) {
      t.set(col[i], { x: colX(c), y: SURFACE_Y + CARD.D / 2 + i * CARD.D, z: colZ(c, i, col.length), kind: 'col' });
    }
  }
  for (let f = 0; f < st.free.length; f++) {
    const id = st.free[f];
    if (id) t.set(id, { x: freeX(f), y: SURFACE_Y + CARD.D / 2, z: FREE_Z, kind: 'free' });
  }
  for (let s = 0; s < 4; s++) {
    const count = st.found[s];
    for (let r = 1; r <= count; r++) {
      t.set(s * 13 + r, { x: foundX(s), y: SURFACE_Y + CARD.D / 2 + (r - 1) * CARD.D, z: FREE_Z, kind: 'found' });
    }
  }
  if (st.spur) for (let r = st.spur.base; r <= st.spur.top; r++)
    t.set(st.spur.suit * 13 + r, { x: SPUR_X, y: SURFACE_Y + CARD.D / 2 + (r - st.spur.base) * CARD.D, z: SPUR_Z, kind: 'found' });
  // An ability's earlier pick stays lifted, like a selected card, until it finishes;
  // the target under the pointer rises a little so the player sees what a click takes.
  for (const id of new Set([...targetChosenIds, ...targetFocusIds])) {
    const tg = t.get(id);
    if (tg && tg.kind !== 'found') t.set(id, { ...tg, y: tg.y + (targetChosenIds.has(id) ? 0.18 : 0.07) });
  }
  return t;
}

function targetsEqual(a, b) {
  return a && b && Math.abs(a.x - b.x) < 1e-4 && Math.abs(a.y - b.y) < 1e-4 && Math.abs(a.z - b.z) < 1e-4;
}

function applyLayout(_animate = true, opts = {}) {
  syncSpurHit();
  layer?.setRules?.(game);
  const targets = computeTargets();
  if (opts.deal) {
    const order = dealOrder();
    for (let o = 0; o < order.length; o++) {
      const g = cardGroups.get(order[o]);
      const tg = targets.get(order[o]);
      g.userData.dest = tg.kind;
      moveCard(g, tg, {
        delay: o * INTRO.step,
        arc: 1.6,
        spin: (Math.random() - 0.5) * 0.5,
        fromFlip: true,
        stiffness: 120,
        damping: 0.62,
      });
    }
    return;
  }
  for (const [id, tg] of targets) {
    const g = cardGroups.get(id);
    if (!g || g.userData.dragging) continue;
    g.userData.dest = tg.kind;
    if (targetsEqual(g.userData.target, tg)) continue;
    if (opts.peek) {
      // Peek just slides the cards below along the table: no lift, overshoot or landing fx.
      moveCard(g, tg, { arc: 0, damping: 1, stiffness: 260, flat: true, onLand: noop });
      continue;
    }
    const dist = Math.hypot(g.position.x - tg.x, g.position.z - tg.z);
    if (dist > 2.2 && !dealing) audio.slide(panOf(g.position.x));
    moveCard(g, tg, { arc: 0.4 + Math.min(0.5, dist * 0.08), stiffness: dist > 3 ? 160 : 190, trail: tg.kind === 'found' });
  }
}

// Cards in the order they leave the deck: tableau row by row, then anything
// already home or in a cell (restored games, boards that start with cards home).
function dealOrder() {
  const order = [];
  for (let i = 0; i < 20; i++) {
    for (let c = 0; c < 8; c++) {
      const id = game.state.tableau[c][i];
      if (id !== undefined) order.push(id);
    }
  }
  const seen = new Set(order);
  for (const id of computeTargets().keys()) if (!seen.has(id)) order.push(id);
  return order;
}

// ---------------------------------------------------------------------------
// Deal intro: the backdrop opens out of focus, the board sweeps in, the deck
// drops and fans out its backs, then the cards are dealt from the fan while the
// backdrop pulls into focus. A click or Space/Enter/Esc skips to the dealt board.
// ---------------------------------------------------------------------------
const INTRO = {
  boardAt: 0.3, // board sweep (seconds from the start)
  boardDur: 1.2,
  deckAt: 1.25, // deck drops onto the table
  deckDur: 0.5,
  fanAt: 1.8, // deck fans out face down
  fanDur: 0.75,
  fanHold: 0.4,
  step: 0.034, // gap between dealt cards
  settle: 0.65, // after the last card leaves
  focusLead: 0.2, // backdrop starts focusing this long after dealing starts
  focusDur: 1.9,
};
INTRO.dealAt = INTRO.fanAt + INTRO.fanDur + INTRO.fanHold;
const FAN = { pivotZ: 1.75, radius: 3.15, spread: 1.05, y: SURFACE_Y + 0.35, lift: 0.008 };
const DECK = { z: -0.7, y: SURFACE_Y + 0.35, gap: 0.016 };
const intro = { active: false, tweens: [] };
const skipHint = document.getElementById('intro-skip');

function introTween(o) {
  const tw = animator.add(o);
  intro.tweens.push(tw);
  return tw;
}

function resetBoardTransform() {
  tableGroup.visible = true;
  tableGroup.position.set(0, 0, 0);
  tableGroup.rotation.set(0, 0, 0);
  tableGroup.scale.setScalar(1);
}

function playDealIntro() {
  intro.tweens = [];
  intro.active = true;
  dealing = true;
  if (settings.reducedMotion) return finishIntro();
  skipHint?.classList.add('on');

  // 1. Out-of-focus backdrop, empty table.
  setBackdropBlur(1);
  tableGroup.visible = false;

  // 2. The board sweeps in from the left, yawing round and tipping flat.
  const from = { x: -17, y: -1.2, z: 1.5, rx: -0.55, ry: 0.75, rz: 0.22, s: 0.78 };
  introTween({
    delay: INTRO.boardAt,
    duration: INTRO.boardDur,
    ease: Easing.linear,
    onUpdate: (_, t) => {
      const slide = Easing.quartOut(t);
      const turn = Easing.backOut(Math.min(1, t * 1.1));
      tableGroup.visible = true;
      tableGroup.position.set(from.x * (1 - slide), from.y * (1 - slide), from.z * (1 - slide));
      tableGroup.rotation.set(from.rx * (1 - turn), from.ry * (1 - turn), from.rz * (1 - turn));
      tableGroup.scale.setScalar(from.s + (1 - from.s) * Easing.cubicOut(t));
    },
    onComplete: resetBoardTransform,
  });

  // 3. The deck drops in, then fans out so its backs show. The first card dealt
  // sits on top of the deck and at the right-hand end of the fan.
  const order = dealOrder();
  const n = order.length;
  const deckPos = (o) => ({ x: (o % 5) * 0.01 - 0.02, y: DECK.y + (n - 1 - o) * DECK.gap, z: DECK.z });
  const fanPos = (o) => {
    const i = n - 1 - o;
    const a = -FAN.spread + (2 * FAN.spread * i) / Math.max(1, n - 1);
    return { x: FAN.radius * Math.sin(a), y: FAN.y + i * FAN.lift, z: FAN.pivotZ - FAN.radius * Math.cos(a), ry: a };
  };
  order.forEach((id, o) => {
    const g = cardGroups.get(id);
    const d = deckPos(o);
    g.position.set(d.x, d.y + 6, d.z);
    g.rotation.set(Math.PI, 0, 0);
  });
  introTween({
    delay: INTRO.deckAt,
    duration: INTRO.deckDur,
    ease: Easing.linear,
    onUpdate: (_, t) => {
      order.forEach((id, o) => {
        const g = cardGroups.get(id);
        const d = deckPos(o);
        // Lower cards lead slightly so the deck lands as a stack, not a slab.
        const p = Easing.backOut(Math.min(1, Math.max(0, (t - (o / n) * 0.18) / 0.82)));
        g.visible = true;
        g.position.set(d.x, d.y + 6 * (1 - p), d.z);
        g.rotation.z = 0.35 * (1 - p);
      });
    },
    onComplete: () => audio.place(0, 3),
  });
  introTween({
    delay: INTRO.fanAt,
    duration: INTRO.fanDur,
    ease: Easing.linear,
    onUpdate: (_, t) => {
      order.forEach((id, o) => {
        const g = cardGroups.get(id);
        const d = deckPos(o);
        const f = fanPos(o);
        // Cards peel off the deck one after another, bottom of the fan first.
        const lag = ((n - 1 - o) / n) * 0.3;
        const p = Easing.cubicOut(Math.min(1, Math.max(0, (t - lag) / 0.7)));
        g.position.set(d.x + (f.x - d.x) * p, d.y + (f.y - d.y) * p + Math.sin(Math.PI * p) * 0.25, d.z + (f.z - d.z) * p);
        g.rotation.set(Math.PI, f.ry * p, 0);
      });
    },
  });
  introTween({ delay: INTRO.fanAt, duration: 0, onComplete: () => audio.shuffle() });

  // 4. Deal from the fan while the backdrop comes into focus.
  introTween({ delay: INTRO.dealAt, duration: 0, onComplete: () => applyLayout(true, { deal: true }) });
  const targets = computeTargets();
  for (let o = 0; o < n; o += 2) {
    const pan = panOf(targets.get(order[o]).x);
    introTween({ delay: INTRO.dealAt + o * INTRO.step, duration: 0, onComplete: () => audio.deal(pan) });
  }
  introTween({
    delay: INTRO.dealAt + INTRO.focusLead,
    duration: INTRO.focusDur,
    ease: Easing.quadInOut,
    onUpdate: (e) => setBackdropBlur(1 - e),
  });
  introTween({
    delay: INTRO.dealAt + (n - 1) * INTRO.step + INTRO.settle,
    duration: 0,
    onComplete: () => {
      intro.tweens = [];
      endIntro();
    },
  });
}

function endIntro() {
  intro.active = false;
  dealing = false;
  skipHint?.classList.remove('on');
  scheduleAuto(300);
}

// Jump straight to the dealt board: board in place, backdrop sharp, every card
// at rest on its pile.
function finishIntro() {
  for (const tw of intro.tweens) animator.remove(tw);
  intro.tweens = [];
  resetBoardTransform();
  setBackdropBlur(0);
  for (const [id, tg] of computeTargets()) {
    const g = cardGroups.get(id);
    if (!g) continue;
    motion.release(g);
    g.visible = true;
    g.position.set(tg.x, tg.y, tg.z);
    g.rotation.set(0, 0, 0);
    g.userData.rxState = 0;
    g.userData.dest = tg.kind;
    g.userData.target = { x: tg.x, y: tg.y, z: tg.z, rx: 0, ry: 0 };
  }
  endIntro();
}

function skipIntro() {
  if (!intro.active) return false;
  audio.unlock();
  audio.place(0, 3);
  finishIntro();
  return true;
}

// Registered ahead of the game's own pointer handler so the skipping click
// never also picks up a card.
window.addEventListener('pointerdown', (e) => {
  if (e.target !== canvas || e.button === 2 || !intro.active) return;
  skipIntro();
  e.stopImmediatePropagation();
}, true);

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
let game = null;
let selection = null;
let won = false;
let isDaily = false;
const run = { undos: 0, hints: 0, counted: false, timerOn: false, t0: 0, elapsed: 0, solved: false };

function locateCard(id) {
  const st = game.state;
  const suit = ((id - 1) / 13) | 0;
  const rank = ((id - 1) % 13) + 1;
  if (rank <= st.found[suit]) return { kind: 'found', index: suit, cardIndex: rank - 1 };
  if (st.spur?.suit === suit && rank >= st.spur.base && rank <= st.spur.top) return { kind: 'found', index: 4, cardIndex: rank - 1 };
  for (let c = 0; c < 8; c++) {
    const idx = st.tableau[c].indexOf(id);
    if (idx >= 0) return { kind: 'col', index: c, cardIndex: idx };
  }
  for (let f = 0; f < st.free.length; f++) if (st.free[f] === id) return { kind: 'free', index: f, cardIndex: 0 };
  return null;
}

function movableCards(loc) {
  if (loc.kind === 'col') {
    const col = game.tableau[loc.index];
    if (!game.canMoveSequenceStart(loc.index, loc.cardIndex)) return null;
    return col.slice(loc.cardIndex);
  }
  if (loc.kind === 'free') return [game.free[loc.index]];
  if (loc.kind === 'found' && game.rules.foundationReturn) {
    if (loc.index === 4) return game.state.spur.top > game.state.spur.base && loc.cardIndex === game.state.spur.top - 1 ? [game.state.spur.suit * 13 + game.state.spur.top] : null;
    if (loc.cardIndex === game.found[loc.index] - 1) return [loc.index * 13 + game.found[loc.index]];
  }
  return null;
}

// --- selection -------------------------------------------------------------
function clearSelection() {
  if (!selection) return;
  selection = null;
  hideValidTargets();
  applyLayout(true);
}

function selectCard(loc) {
  const ids = movableCards(loc);
  if (!ids || !ids.length) return;
  if (selection) {
    selection = null;
    applyLayout(true);
  }
  selection = { from: loc, ids };
  audio.pickup(panOf(cardGroups.get(ids[0]).position.x));
  showValidTargets(loc);
  const targets = computeTargets();
  ids.forEach((id) => {
    const g = cardGroups.get(id);
    const tg = targets.get(id);
    if (g && tg) moveCard(g, { ...tg, y: tg.y + 0.18 }, { stiffness: 260, damping: 0.8, onLand: noop });
  });
}

// --- move application ------------------------------------------------------
function tryDrop(from, target) {
  if (!target) return null;
  if (from.kind === 'found') {
    const spur = from.index === 4, top = spur ? game.state.spur?.top : game.found[from.index], suit = spur ? game.state.spur?.suit : from.index;
    if (from.cardIndex !== top - 1) return null;
    const to = { kind: target.kind, i: target.index };
    return game.canReturnFoundation(suit, to, spur ? 'spur' : 'original') ? () => game.moveFoundationReturn(suit, to, spur ? 'spur' : 'original') : null;
  }
  if (target.kind === 'col') {
    if (from.kind === 'col') {
      const col = game.tableau[from.index];
      if (from.index === target.index || !game.canMoveSequenceStart(from.index, from.cardIndex)) return null;
      const count = col.length - from.cardIndex;
      const card = col[from.cardIndex];
      if (!game.canDropTableau(target.index, card, count, col.slice(from.cardIndex))) return null;
      return () => game.moveSequenceToTableau(from.index, from.cardIndex, target.index);
    }
    if (from.kind === 'free') {
      const card = game.free[from.index];
      if (!card || !game.canMoveFreeToTableau(from.index, target.index)) return null;
      return () => game.moveFreeToTableau(from.index, target.index);
    }
    return null;
  }
  if (target.kind === 'free') {
    if (from.kind !== 'col') return null;
    const col = game.tableau[from.index];
    if (from.cardIndex !== col.length - 1) return null;
    if (!game.canDropFreeCell(target.index, col[col.length - 1])) return null;
    return () => game.moveToFreeCell({ kind: 'col', i: from.index }, target.index);
  }
  if (target.kind === 'found') {
    let src = null;
    let card = null;
    if (from.kind === 'col') {
      const col = game.tableau[from.index];
      if (from.cardIndex !== col.length - 1) return null;
      src = { kind: 'col', i: from.index };
      card = col[col.length - 1];
    } else if (from.kind === 'free') {
      src = { kind: 'free', i: from.index };
      card = game.free[from.index];
    } else {
      return null;
    }
    const dest = target.index === 4 ? 'spur' : 'original';
    if (!card || (game.state.spur && (((card - 1) / 13) | 0) !== (target.index === 4 ? game.state.spur.suit : target.index)) || !game.canDropFoundation(card, dest)) return null;
    return () => game.moveToFoundation(src, dest);
  }
  return null;
}

function afterMove({ noAuto = false } = {}) {
  hideValidTargets();
  applyLayout(true);
  if (mode === 'voyage') voyageAfterMove();
  updateHUD();
  persistGame();
  checkWin();
  refreshDevPanel();
  if (!noAuto) scheduleAuto();
}

function devMenuOpen() {
  return document.getElementById('modal-dev')?.classList.contains('show');
}

function devSnapshotRows() {
  if (!game) return [['Table', 'No active deal']];
  const st = game.state;
  const home = cardsHome(st);
  const legal = generateMoves(st, { fullOnly: true, rules: game.rules }).length;
  const rows = [
    ['Mode', mode],
    ['Deal #', game.dealNumber],
    ['Cards home', `${home} / 52`],
    ['Manual moves', manualMoves()],
    ['Legal moves', legal],
    ['Bury score', computeBury(st).toFixed(1)],
  ];
  if (mode === 'voyage' && vy.run?.current && vy.boardLive) {
    const cur = vy.run.current;
    const extra = scoringContext(vy.run, { elapsed: run.elapsed, rules: game.rules });
    const sb = scoreBoard(game.history, cur.par, vy.effects, extra);
    rows.push(['Voyage board score', String(sb.total)]);
    rows.push(['Par', String(cur.par)]);
    rows.push(['Star thresholds', starThresholds(cur.par, vy.effects, extra).join(' · ')]);
  }
  return rows;
}

function renderDevReadout(extraRows = []) {
  const rows = [...devSnapshotRows(), ...extraRows];
  const body = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  ui.renderDevReadout(`<dl>${body}</dl>`);
}

function refreshDevPanel() {
  if (!devMenuOpen()) return;
  renderDevReadout();
}

function solvabilityLabel(r) {
  if (r.solvable === true) {
    const n = r.solution?.length ?? 0;
    return `Winnable — solver found a ${n}-move line`;
  }
  if (r.solvable === false) return 'Unwinnable — no solution from here';
  return 'Unknown — search limit reached';
}

async function devAnalyzePosition() {
  if (!game || dealing || busy) return;
  busy = true;
  ui.setSolverBusy(true);
  ui.setDevReadoutBusy(true);
  renderDevReadout([['Analysis', 'Searching…']]);
  try {
    const r = await requestSolve({ timeLimitMs: 8000 });
    const extra = [['Solvability', solvabilityLabel(r)]];
    if (r.solvable === true && r.solution?.length) {
      extra.push(['Remaining solver steps', String(r.solution.length)]);
    }
    if (r.solvable === true) {
      const short = shortSolve(cloneState(game.state), { rules: game.rules, budgetMs: 3000 });
      if (short) {
        extra.push(['Est. manual moves', String(short.manualMoves)]);
        extra.push(['Short-path nodes', String(short.nodes ?? '—')]);
      } else extra.push(['Est. manual moves', '— (short search timed out)']);
    }
    extra.push(['Solver nodes', String(r.nodes ?? '—')]);
    extra.push(['Solver time', `${r.elapsedMs ?? '—'} ms`]);
    renderDevReadout(extra);
  } catch (err) {
    renderDevReadout([['Analysis error', err.message]]);
  } finally {
    busy = false;
    ui.setSolverBusy(false);
    ui.setDevReadoutBusy(false);
  }
}

async function devResetBoard() {
  if (!game || dealing || busy || autoplay.running) return;
  stopSolve();
  clearSelection();
  won = false;
  ui.hideWin();
  autoTok++;
  if (mode === 'voyage' && vy.boardLive && vy.run?.current) {
    const cur = vy.run.current;
    cur.history = [];
    cur.elapsed = 0;
    cur.override = null;
    cur.liveRules = null;
    run.elapsed = 0;
    run.timerOn = false;
    lastTimerText = -1;
    tickTimer();
    voyageDealBoard({ restore: null });
    setStatus('Board reset to opening deal.', 'ok');
    refreshDevPanel();
    return;
  }
  game.state = cloneState(game.initial);
  game.history = [];
  game.override = null;
  run.solved = false;
  introDismissed = false;
  applyLayout(true);
  updateHUD();
  persistGame();
  setStatus('Board reset to opening deal.', 'ok');
  refreshDevPanel();
}

// ---------------------------------------------------------------------------
// Auto-play to the foundations ("safe" moves only; see safeFoundationMoves in rules.js).
// Auto-played moves are tagged `auto` in the history so undo reverts them together with the
// player's move that triggered them, and the Moves counter only counts the player's own moves.
// ---------------------------------------------------------------------------
let autoTok = 0;
const manualMoves = () => (game ? game.history.reduce((n, m) => n + (m.auto ? 0 : 1), 0) : 0);

function scheduleAuto(delay = 260) {
  if (!settings.autoFoundation || !game || won) return;
  const tok = ++autoTok; // supersedes any chain already waiting
  setTimeout(() => stepAuto(tok), delay);
}

function stepAuto(tok) {
  if (tok !== autoTok || !game || won || !settings.autoFoundation) return;
  // Hold off while cards are dealing, a card is held, or the solver is playing.
  if (dealing || autoplay.running || drag) {
    setTimeout(() => stepAuto(tok), 250);
    return;
  }
  const held = new Set(selection ? selection.ids : []);
  let mv = safeFoundationMoves(game.state, game.rules).find((m) => !held.has(m.card));
  // No individually safe card? If foundation moves alone can still clear the table, the win is
  // guaranteed, so play it out (this is what finishes cross-blocked endgames).
  if (!mv && canFinishWithFoundationOnly(game.state, game.rules)) mv = legalFoundationMoves(game.state, game.rules).find((m) => !held.has(m.card));
  if (!mv) return;
  const m = game.moveToFoundation(mv.src);
  if (!m) return;
  m.auto = true;
  if (selection) {
    selection = null;
    hideValidTargets();
  }
  afterMove({ noAuto: true });
  setTimeout(() => stepAuto(tok), 170);
}

function commitMove(fn) {
  if (!fn) return false;
  if (!fn()) return false;
  selection = null;
  afterMove();
  return true;
}

function autoMove(id) {
  const loc = locateCard(id);
  if (!loc || loc.kind === 'found') return false;
  let card;
  let src;
  if (loc.kind === 'col') {
    const col = game.tableau[loc.index];
    if (loc.cardIndex !== col.length - 1) return false;
    card = col[col.length - 1];
    src = { kind: 'col', i: loc.index };
  } else {
    card = game.free[loc.index];
    src = { kind: 'free', i: loc.index };
  }
  if (game.canDropFoundation(card)) {
    game.moveToFoundation(src);
    afterMove();
    return true;
  }
  if (loc.kind === 'col') {
    const fi = game.free.findIndex((_, i) => game.canDropFreeCell(i, card));
    if (fi >= 0) {
      game.moveToFreeCell(src, fi);
      afterMove();
      return true;
    }
  }
  audio.invalid();
  return false;
}

// ---------------------------------------------------------------------------
// Pointer input
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dragPoint = new THREE.Vector3();

let drag = null;
let lastTap = { id: 0, time: 0 };
let hoverId = null;

import { spendFogPeek, refundFogPeek } from './voyage/content/special/boss.fog.js';

// Fog peek is a temporary visual effect. The kernel's concealed ids stay intact,
// so saving during peek, undo and resume preserve exactly the same information.
const fogInput = { effects: null, ctx: null, hiddenRef: null, hidden: new Set(), peek: null, pointer: null, pDown: false, armed: false, suppressClickUntil: 0 };
function fogContext() {
  const effects = mode === 'voyage' && vy.boardLive && vy.run?.status === 'board' ? vy.effects : null;
  if (effects !== fogInput.effects) {
    endFogPeek(); cancelFogPointer();
    fogInput.effects = effects;
    fogInput.ctx = effects?.ctxs.find((ctx) => ctx.id === 'boss.fog') || null;
    fogInput.hiddenRef = null;
  }
  const ids = fogInput.ctx?.memo._runtime.concealed;
  if (ids !== fogInput.hiddenRef) {
    fogInput.hiddenRef = ids;
    fogInput.hidden = new Set(ids || []);
  }
  return fogInput.ctx;
}
function syncFog() {
  const ctx = fogContext();
  if (fogInput.peek && (fogInput.peek.game !== game || !ctx || ui.modalOpen || won || !ui.els.title.classList.contains('hidden'))) endFogPeek();
  const peek = fogInput.peek;
  let revealed = false;
  if (peek) for (const id of peek.ids) {
    const g = cardGroups.get(id);
    if (g?.userData.concealed) { setCardConcealed(g, false); revealed = true; }
  }
  layer?.setFog?.(ctx ? game.state : null, fogInput.hidden, peek?.col ?? -1);
  if (revealed) syncRankHighlight();
}
function endFogPeek() {
  const peek = fogInput.peek;
  if (!peek) return;
  fogInput.peek = null;
  // Read the CURRENT kernel set: undo/moves may have permanently revealed ids.
  if (peek.game === game) {
    const hidden = new Set(peek.ctx.memo._runtime.concealed);
    for (const id of peek.ids) {
      const g = cardGroups.get(id);
      if (g) setCardConcealed(g, hidden.has(id));
    }
    syncRankHighlight();
  }
}
function beginFogPeek(col, source) {
  const ctx = fogContext();
  endFogPeek();
  if (!ctx || !game.tableau[col]) return false;
  const ids = game.tableau[col].filter((id) => fogInput.hidden.has(id));
  if (!ids.length || !spendFogPeek(ctx)) return false;
  fogInput.peek = { col, source, ids, ctx, game };
  clearSelection(); setRankHighlight(null); syncFog();
  return true;
}
function toggleFogPeek(col) {
  if (fogInput.peek?.col === col) { endFogPeek(); syncFog(); }
  else beginFogPeek(col, 'toggle');
}
function cancelFogPointer() {
  if (fogInput.pointer) clearTimeout(fogInput.pointer.timer);
  fogInput.pointer = null;
}
function startFogPointer(e, loc) {
  if (!fogContext() || ui.modalOpen || dealing || loc?.kind !== 'col' || !game.tableau[loc.index].some((id) => fogInput.hidden.has(id))) return false;
  cancelFogPointer();
  const pending = { id: e.pointerId, col: loc.index, x: e.clientX, y: e.clientY, held: false, timer: null };
  fogInput.pointer = pending;
  canvas.setPointerCapture(e.pointerId);
  if (!settings.tapToPeek) pending.timer = setTimeout(() => {
    if (fogInput.pointer !== pending || drag?.moved || !fogContext() || ui.modalOpen) return;
    pending.held = true; // An exhausted hold is still a peek gesture, not a card tap.
    beginFogPeek(pending.col, 'hold');
    lastTap = { id: 0, time: 0 }; fogInput.suppressClickUntil = performance.now() + 400;
  }, 250);
  return true;
}
function finishFogPointer(e) {
  const pending = fogInput.pointer;
  if (!pending || pending.id !== e.pointerId) return false;
  cancelFogPointer();
  const consume = pending.held || (!!settings.tapToPeek && !drag?.moved);
  if (pending.held) endFogPeek();
  else if (consume) toggleFogPeek(pending.col);
  if (consume) {
    drag = null; lastTap = { id: 0, time: 0 };
    fogInput.suppressClickUntil = performance.now() + 400;
    canvas.style.cursor = 'default'; syncFog();
  }
  return consume;
}

function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}

// skip(id): pass through cards that should not catch the pointer (a lifted ability pick).
function pickCardHit(e, skip = null) {
  setPointer(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  for (const h of hits) {
    const g = cardGroups.get(h.object.userData.cardId);
    if (g && g.visible && !skip?.(h.object.userData.cardId)) return h;
  }
  return null;
}

function pickCard(e) {
  return pickCardHit(e)?.object.userData.cardId ?? null;
}

function pickTarget(e) {
  setPointer(e);
  raycaster.setFromCamera(pointer, camera);
  raycaster.layers.set(1);
  const hits = raycaster.intersectObjects(slotHitAreas, false);
  raycaster.layers.set(0);
  if (hits.length) return { kind: hits[0].object.userData.pile, index: hits[0].object.userData.index };
  return null;
}

// --- rank highlight (hold a key to light up every card of that rank) --------
let highlightRank = null;
const highlightedIds = new Set();
// Ability targeting (below) shares this highlight: legal targets, the aimed one, earlier picks.
const targetIds = new Set();
const targetFocusIds = new Set();
const targetChosenIds = new Set();

// Single writer for a card's emissive state: the shared blue highlight (a held rank
// key, or an ability's targets) beats hover, which beats the theme baseline, so the
// effects never stomp on each other. Aimed and chosen targets rise instead of
// glowing harder, which would bleach the face the player needs to read.
function refreshCardEmissive(cid) {
  const g = cardGroups.get(cid);
  if (!g) return;
  const m = g.userData.frontMat;
  const base = currentTheme.card.emissive;
  if (highlightedIds.has(cid) || targetIds.has(cid) || targetFocusIds.has(cid) || targetChosenIds.has(cid)) {
    if (base > 0) m.emissiveIntensity = base + 0.9;
    else { m.emissive.setHex(0x66d9ff); m.emissiveIntensity = 0.5; }
  } else if (cid === hoverId) {
    if (base > 0) m.emissiveIntensity = base * 1.6;
    else { m.emissive.setHex(0xffffff); m.emissiveIntensity = 0.1; }
  } else if (base > 0) {
    m.emissiveIntensity = base;
  } else {
    m.emissive.setHex(0x000000);
    m.emissiveIntensity = 0;
  }
}

function faceDown(id) {
  return !!cardGroups.get(id)?.userData.concealed;
}

function sameIds(a, b) {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

function setRankHighlight(rank) {
  const next = new Set();
  if (rank != null) {
    for (const id of cardGroups.keys()) {
      // Face-down cards keep the back texture on the visible face. Lighting
      // them would mark which hidden cards match the held rank.
      if ((((id - 1) % 13) + 1) === rank && !faceDown(id)) next.add(id);
    }
  }
  if (rank === highlightRank && sameIds(next, highlightedIds)) return;
  // Drop the old set before refreshing. refreshCardEmissive treats membership
  // as the highlight, so painting first would leave the glow stuck on.
  const stale = [...highlightedIds];
  highlightedIds.clear();
  for (const id of next) highlightedIds.add(id);
  highlightRank = rank;
  for (const id of stale) {
    if (!highlightedIds.has(id)) refreshCardEmissive(id);
  }
  for (const id of highlightedIds) refreshCardEmissive(id);
}

// Concealment can change while a rank key is still held (reveal, undo, peek).
function syncRankHighlight() {
  if (highlightRank != null) setRankHighlight(highlightRank);
}

// '1'/'a' -> ace, '2'..'9' -> number, '0' -> ten, 'j'/'q'/'k' -> court.
function rankForHeldKey(key) {
  if (key === 'a' || key === '1') return 1;
  if (key >= '2' && key <= '9') return parseInt(key, 10);
  if (key === '0') return 10;
  if (key === 'j') return 11;
  if (key === 'q') return 12;
  if (key === 'k') return 13;
  return null;
}

// Physical key, so release still matches when Shift turns "5" into "%".
function rankForCode(code) {
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  if (digit) return digit[1] === '0' ? 10 : parseInt(digit[1], 10);
  if (code === 'KeyA') return 1;
  if (code === 'KeyJ') return 11;
  if (code === 'KeyQ') return 12;
  if (code === 'KeyK') return 13;
  return null;
}

const heldRankCodes = new Set();

function rankFromEvent(e) {
  return rankForCode(e.code) ?? rankForHeldKey(e.key.toLowerCase());
}

function syncHeldRankHighlight() {
  let rank = null;
  for (const code of heldRankCodes) rank = rankForCode(code);
  setRankHighlight(rank);
}

function clearHeldRankHighlight() {
  heldRankCodes.clear();
  setRankHighlight(null);
}

// --- ability targeting -------------------------------------------------------
// A charm ability that needs a target lights every legal card the way a held rank
// key does, and every legal empty cell or column end pulses like a drop target.
// Click (or Tab/arrows + Enter) to pick; Esc, right-click, the Cancel button, the
// charm tray or any other control cancels. Nothing is spent until the pick lands.
let targeting = null;
let targetClick = { at: 0, x: 0, y: 0 }; // where and when the last pick was clicked
const SUITS = ['♣', '♦', '♥', '♠'];
const cardLabel = (id) => `${({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[((id - 1) % 13) + 1] || ((id - 1) % 13) + 1}${SUITS[((id - 1) / 13) | 0]}`;

function targetLabel(kind, value) {
  if (kind === 'card') return cardLabel(value);
  if (kind === 'freecell') return game.free[value] ? `Free cell ${value + 1} · ${cardLabel(game.free[value])}` : `Free cell ${value + 1}`;
  const top = game.tableau[value].at(-1);
  return top ? `Column ${value + 1} · ${faceDown(top) ? 'face-down card' : cardLabel(top)} on top` : `Column ${value + 1} · empty`;
}

function setTargetGlows() {
  const t = targeting;
  for (const g of glows.values()) g.userData.want = 0;
  if (!t) return;
  for (const value of t.values) {
    if (t.lit.get(value).length) continue;
    const g = glows.get(`${t.kind === 'freecell' ? 'free' : 'col'}${value}`);
    if (t.kind === 'freecell') g.position.set(freeX(value), SURFACE_Y + 0.012, FREE_Z);
    else {
      const len = game.tableau[value].length;
      g.position.set(colX(value), SURFACE_Y + 0.012 + len * CARD.D, colZ(value, len, len + 1));
    }
    g.userData.want = value === t.focus ? 1 : 0.7;
  }
}

// Raise or lower target cards in place: a flat slide like peek, never the hop of a real move.
function settleTargets(ids) {
  if (!game) return;
  const targets = computeTargets();
  for (const id of ids) {
    const g = cardGroups.get(id), tg = targets.get(id);
    if (g && tg && !g.userData.dragging && !targetsEqual(g.userData.target, tg)) moveCard(g, tg, { arc: 0, damping: 1, stiffness: 260, flat: true, onLand: noop });
  }
}

function setTargetFocus(value) {
  const t = targeting;
  if (!t || value === t.focus) return;
  t.focus = value;
  const stale = [...targetFocusIds];
  targetFocusIds.clear();
  if (value != null) for (const id of t.group.get(value)) targetFocusIds.add(id);
  const changed = new Set([...stale, ...targetFocusIds]);
  for (const id of changed) refreshCardEmissive(id);
  setTargetGlows();
  settleTargets(changed);
  voyageUI.updateTargetPrompt?.(value == null ? '' : targetLabel(t.kind, value));
}

// The legal target under the pointer: for column and cell picks, any card in that
// pile or its empty slot counts, so the whole column is one big hit area.
function targetValueAt(e) {
  const t = targeting;
  if (!t || e.target !== canvas) return null;
  // An earlier pick is lifted over the card resting on it; aim through it at that card.
  const id = pickCardHit(e, (cid) => targetChosenIds.has(cid) && !t.values.includes(cid))?.object.userData.cardId ?? null;
  const loc = id != null ? locateCard(id) : null, slot = loc ? null : pickTarget(e);
  let value = null;
  if (t.kind === 'card') value = id;
  else if (t.kind === 'freecell') value = loc ? (loc.kind === 'free' ? loc.index : null) : slot?.kind === 'free' ? slot.index : null;
  else value = loc ? (loc.kind === 'col' ? loc.index : null) : slot?.kind === 'col' ? slot.index : null;
  return t.values.includes(value) ? value : null;
}

function endTargeting(value = null) {
  const t = targeting;
  if (!t) return;
  targeting = null;
  const lit = [...targetIds, ...targetFocusIds];
  targetIds.clear(); targetFocusIds.clear();
  if (value != null && vy.ability) {
    // Keep this pick lifted and lit while the same ability asks for its next target.
    for (const id of t.kind === 'column' ? t.lit.get(value) : t.group.get(value)) targetChosenIds.add(id);
    lastTap = { id: null, time: 0 };
    audio.pickup(0);
  }
  const changed = new Set([...lit, ...targetChosenIds]);
  for (const id of changed) refreshCardEmissive(id);
  setTargetGlows();
  canvas.style.cursor = 'default';
  voyageUI.clearTargetPrompt?.();
  settleTargets(changed);
  t.resolve(value);
}

// settle = false when a real move is about to lay the board out (and animate) anyway.
function clearTargetChosen(settle = true) {
  if (!targetChosenIds.size) return;
  const ids = [...targetChosenIds];
  targetChosenIds.clear();
  for (const id of ids) refreshCardEmissive(id);
  if (settle) settleTargets(ids);
}

function onTargetingPointer(e) {
  if (e.target !== canvas) {
    // Undo, Menu, Map… abandon the pick first. The prompt and the charm tray cancel themselves.
    if (!e.target.closest?.('.voyage-target-prompt, [data-ability]')) endTargeting(null);
    return;
  }
  e.stopPropagation();
  if (e.button === 2) { endTargeting(null); return; }
  const value = targetValueAt(e);
  if (value == null) { audio.invalid(); voyageUI.nudgeTargetPrompt?.(); return; }
  targetClick = { at: performance.now(), x: e.clientX, y: e.clientY };
  endTargeting(value);
}

function onTargetingKey(e) {
  const t = targeting;
  if (!t || e.metaKey || e.ctrlKey || e.altKey) return;
  // The board is paused on this choice: game hotkeys (undo, rank keys…) wait.
  e.stopImmediatePropagation();
  const k = e.key;
  if (k === 'Escape') { e.preventDefault(); endTargeting(null); return; }
  if (k === 'Enter' || k === ' ') {
    e.preventDefault();
    if (t.focus != null) endTargeting(t.focus);
    else setTargetFocus(t.values[0]);
    return;
  }
  const step = k === 'Tab' ? (e.shiftKey ? -1 : 1) : (k === 'ArrowRight' || k === 'ArrowDown') ? 1 : (k === 'ArrowLeft' || k === 'ArrowUp') ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  const i = t.values.indexOf(t.focus);
  setTargetFocus(t.values[i < 0 ? (step > 0 ? 0 : t.values.length - 1) : (i + step + t.values.length) % t.values.length]);
}
window.addEventListener('keydown', onTargetingKey, true);
canvas.addEventListener('contextmenu', (e) => { if (targeting) e.preventDefault(); });

// Reading order for keyboard focus: free cells, then columns left to right, top to bottom.
function targetOrder(kind, value) {
  if (kind !== 'card') return value;
  const loc = locateCard(value);
  return loc.kind === 'free' ? loc.index : 100 + loc.index * 100 + loc.cardIndex;
}

function startTargeting({ kind, values, prompt, cards, group }) {
  clearHeldRankHighlight();
  setHover(null);
  const st = game.state;
  const lit = new Map(), focus = new Map();
  for (const value of values) {
    let ids;
    if (kind === 'card') ids = [value];
    else if (kind === 'freecell') ids = st.free[value] ? [st.free[value]] : [];
    else ids = cards ? cards(value, st) || [] : [];
    lit.set(value, ids.filter((id) => cardGroups.has(id)));
    // Like the rank keys, a card pick never lights a face-down card it did not name:
    // that would tell which hidden cards match. A column pick lights its whole pile.
    const hover = (group ? group(value, st) || [] : kind === 'column' ? st.tableau[value] : ids).filter((id) => kind === 'column' || ids.includes(id) || !faceDown(id));
    focus.set(value, [...new Set([...hover, ...ids])].filter((id) => cardGroups.has(id)));
  }
  values = values.slice().sort((a, b) => targetOrder(kind, a) - targetOrder(kind, b));
  return new Promise((resolve) => {
    targeting = { kind, values, lit, group: focus, focus: null, resolve };
    for (const ids of lit.values()) for (const id of ids) targetIds.add(id);
    for (const id of targetIds) refreshCardEmissive(id);
    setTargetGlows();
    const charm = vy.ability && CHARMS[vy.ability.id];
    voyageUI.showTargetPrompt?.({
      ability: vy.ability?.id || null, icon: charm?.icon || '✦', name: charm?.name || 'Charm',
      text: prompt || `Choose a ${kind === 'freecell' ? 'free cell' : kind}`,
      avoidTop: topRowScreenY(),
    }, () => endTargeting(null));
  });
}

// Screen y of the top edge of the free-cell / foundation row: the banner must stay above it.
function topRowScreenY() {
  const v = new THREE.Vector3(freeX(0), SURFACE_Y, FREE_Z - CARD.H / 2).project(camera);
  return (-v.y * 0.5 + 0.5) * window.innerHeight;
}

function cancelTargeting() {
  endTargeting(null);
  voyageUI.cancelChoice?.();
  clearTargetChosen();
}

function setHover(id) {
  if (id === hoverId) return;
  const prev = hoverId;
  hoverId = id;
  if (prev != null) refreshCardEmissive(prev);
  if (id != null) refreshCardEmissive(id);
}

let markTipAt = null;

// Rules that bind a whole column draw a lane under it (table.js); these explain each kind.
const LANE_TIPS = {
  sealed: { name: 'Sealed column', text: 'No card can be placed here. Move every card off this column to break the seal.' },
  noexit: { name: 'No Exit', text: 'The bottom card of this column can only leave to its foundation.' },
  open: { name: 'Pincushion', text: 'This column takes any card on top, whatever its rank or colour.' },
};
const lanePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SURFACE_Y), lanePoint = new THREE.Vector3();

function laneTipAt(clientX, clientY) {
  setPointer({ clientX, clientY });
  raycaster.setFromCamera(pointer, camera);
  const p = raycaster.ray.intersectPlane(lanePlane, lanePoint);
  const lane = p && layer?.laneAt?.(p.x, p.z);
  return lane ? LANE_TIPS[lane.kind] : null;
}

function syncMarkTip(clientX, clientY, hit) {
  const group = hit && cardGroups.get(hit.object.userData.cardId);
  const style = group?.userData.mark;
  const tip = !group ? laneTipAt(clientX, clientY)
    : group.userData.concealed ? null
    : group.userData.mods?.length && modHit(hit.uv, !!style) ? vy.effects?.modTip(group.userData.cardId)
    : style && !String(style).startsWith('sticker-') && markSigilHit(hit.uv) ? vy.effects?.markTip(group.userData.cardId, style)
    : null;
  if (!tip) voyageUI.hideMarkTip();
  else voyageUI.showMarkTip(clientX, clientY, tip.name, tip.text);
}

function updateHover(e) {
  if (targeting) {
    if (e.pointerType === 'touch') return;
    const value = targetValueAt(e);
    if (value != null || e.target === canvas) setTargetFocus(value);
    if (e.target === canvas) canvas.style.cursor = value != null ? 'pointer' : 'not-allowed';
    return;
  }
  if (drag || e.pointerType === 'touch' || !game) {
    markTipAt = null;
    voyageUI.hideMarkTip();
    return;
  }
  if (e.target !== canvas) {
    markTipAt = null;
    voyageUI.hideMarkTip();
    if (peek && e.pointerType === 'mouse') setPeek(null);
    return;
  }
  const hit = pickCardHit(e);
  const id = hit?.object.userData.cardId ?? null;
  if (e.pointerType !== 'touch') peekFromCard(id);
  let movable = null;
  if (id != null) {
    const loc = locateCard(id);
    if (loc && movableCards(loc)) movable = id;
  }
  setHover(movable);
  canvas.style.cursor = movable != null ? 'grab' : 'default';
  if (mode === 'voyage' && vy.boardLive) {
    markTipAt = { x: e.clientX, y: e.clientY };
    syncMarkTip(e.clientX, e.clientY, hit);
  } else {
    markTipAt = null;
    voyageUI.hideMarkTip();
  }
}

function onPointerDown(e) {
  audio.unlock();
  markTipAt = null;
  voyageUI.hideMarkTip();
  if (targeting) { onTargetingPointer(e); return; }
  if (fogInput.peek?.source !== 'toggle' || e.target !== canvas) endFogPeek();
  cancelFogPointer();
  if (e.target !== canvas || e.button === 2 || !game || won) return;
  const id = pickCard(e);
  if (id == null) {
    setPeek(null);
    const target = pickTarget(e);
    startFogPointer(e, target && { kind: target.kind, index: target.index });
    return;
  }
  const buried = peekFromCard(id);
  const loc = locateCard(id);
  const fogCandidate = startFogPointer(e, loc);
  const ids = loc && movableCards(loc);
  if (!ids || !ids.length) {
    if (fogCandidate) return;
    if (buried) return; // tapping a buried card just fans it out
    audio.invalid();
    return;
  }
  e.stopPropagation();
  setPointer(e);
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(dragPlane, dragPoint);
  const now = performance.now();
  const dbl = now - lastTap.time < 320 && lastTap.id === id;
  drag = {
    moved: false,
    ids,
    from: loc,
    startX: e.clientX,
    startY: e.clientY,
    lastX: e.clientX,
    vx: 0,
    vy: 0,
    lastY: e.clientY,
    offset: new THREE.Vector3(dragPoint.x - cardGroups.get(id).position.x, 0, dragPoint.z - cardGroups.get(id).position.z),
    dbl,
  };
  lastTap = { id, time: now };
}

function onPointerMove(e) {
  const pending = fogInput.pointer;
  if (pending?.id === e.pointerId && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > 6) {
    if (drag && pending.held && fogInput.peek?.source === 'hold') refundFogPeek(fogInput.peek.ctx);
    cancelFogPointer(); endFogPeek(); syncFog();
  }
  updateHover(e);
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6) {
    drag.moved = true;
    setPeek(null);
    if (selection) clearSelection();
    drag.ids.forEach((id) => {
      const g = cardGroups.get(id);
      g.userData.dragging = true;
      motion.release(g);
    });
    audio.pickup(panOf(cardGroups.get(drag.ids[0]).position.x));
    showValidTargets(drag.from);
    canvas.style.cursor = 'grabbing';
  }
  if (!drag.moved) return;
  drag.vx = drag.vx * 0.6 + (e.clientX - drag.lastX) * 0.4;
  drag.vy = drag.vy * 0.6 + (e.clientY - drag.lastY) * 0.4;
  drag.lastX = e.clientX;
  drag.lastY = e.clientY;
  setPointer(e);
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(dragPlane, dragPoint);
  const bx = dragPoint.x - drag.offset.x;
  const bz = dragPoint.z - drag.offset.z;
  drag.ids.forEach((id, j) => {
    const g = cardGroups.get(id);
    g.position.x = bx;
    g.position.z = bz + j * ROW * 0.58 + 0.02;
  });
}

// Smoothly lift + tilt dragged cards (called every frame).
function updateDrag(dt) {
  syncFog();
  if (!drag || !drag.moved) return;
  const k = Math.min(1, dt * 18);
  drag.ids.forEach((id, j) => {
    const g = cardGroups.get(id);
    g.position.y += (0.55 + j * CARD.D - g.position.y) * k;
    const tz = settings.reducedMotion ? 0 : clamp(-drag.vx * 0.012, -0.3, 0.3);
    const tx = settings.reducedMotion ? 0 : clamp(drag.vy * 0.01, -0.25, 0.25);
    g.rotation.z += (tz - g.rotation.z) * k;
    g.rotation.x += (tx - g.rotation.x) * k;
    g.rotation.y += (-0.06 - g.rotation.y) * k;
  });
  drag.vx *= 1 - Math.min(1, dt * 6);
  drag.vy *= 1 - Math.min(1, dt * 6);
}

function onPointerUp(e) {
  if (targeting) return;
  if (finishFogPointer(e)) return;
  if (!drag) {
    if (e.target !== canvas || !game || won) return;
    const target = pickTarget(e);
    if (target && selection) {
      if (!commitMove(tryDrop(selection.from, target))) {
        audio.invalid();
        clearSelection();
      }
    } else if (!target && selection) {
      clearSelection();
    }
    return;
  }
  const d = drag;
  drag = null;
  canvas.style.cursor = 'default';

  if (!d.moved) {
    if (d.dbl) {
      autoMove(d.ids[0]);
      clearSelection();
      return;
    }
    const loc = locateCard(d.ids[0]);
    if (selection && selection.ids.includes(d.ids[0])) {
      clearSelection();
      return;
    }
    const target = { kind: d.from.kind, index: d.from.index };
    if (selection) {
      const fn = tryDrop(selection.from, target);
      if (commitMove(fn)) return;
    }
    selectCard(loc);
    return;
  }

  const target = pickTarget(e);
  const fn = tryDrop(d.from, target);
  d.ids.forEach((id) => {
    const g = cardGroups.get(id);
    g.userData.dragging = false;
    g.userData.target = null;
    g.rotation.set(0, g.rotation.y, 0);
  });
  if (fn) {
    commitMove(fn);
  } else {
    if (target) audio.invalid();
    hideValidTargets();
    applyLayout(true);
  }
}

window.addEventListener('pointerdown', onPointerDown, true);
window.addEventListener('pointermove', onPointerMove, true);
window.addEventListener('pointerup', onPointerUp, true);
window.addEventListener('pointercancel', () => {
  cancelFogPointer(); endFogPeek();
  // A second finger (pinch-zoom) cancels the drag pointer. Put the cards back
  // instead of leaving them stuck above the table.
  if (drag) {
    for (const id of drag.ids) {
      const g = cardGroups.get(id);
      if (g) { g.userData.dragging = false; g.userData.target = null; g.rotation.set(0, g.rotation.y, 0); }
    }
    drag = null; hideValidTargets(); applyLayout(true);
    canvas.style.cursor = 'default';
  }
}, true);
canvas.addEventListener('lostpointercapture', () => {
  cancelFogPointer();
  if (fogInput.peek?.source === 'hold') endFogPeek();
});
window.addEventListener('blur', () => { cancelFogPointer(); endFogPeek(); fogInput.pDown = false; fogInput.armed = false; });
document.getElementById('set-tap-peek').addEventListener('change', () => { cancelFogPointer(); endFogPeek(); });
canvas.addEventListener('dblclick', (e) => {
  if (!game || won) return;
  // A double-click whose first click picked an ability target (same spot, just now) is not an auto-move.
  if (targeting || vy.ability || (performance.now() - targetClick.at < 600 && Math.hypot(e.clientX - targetClick.x, e.clientY - targetClick.y) < 10)) return;
  if (fogContext() && (settings.tapToPeek || performance.now() < fogInput.suppressClickUntil)) { e.preventDefault(); return; }
  const id = pickCard(e);
  if (id == null) return;
  e.preventDefault();
  autoMove(id);
  clearSelection();
});

// ---------------------------------------------------------------------------
// Solver worker
// ---------------------------------------------------------------------------
const worker = new Worker(new URL('./solver.worker.js', import.meta.url), { type: 'module' });
let solveSeq = 0;
const pending = new Map();
worker.onmessage = (e) => {
  const { id, result, error } = e.data || {};
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  if (error) p.reject(new Error(error));
  else p.resolve(result);
};
worker.onerror = (e) => {
  for (const p of pending.values()) p.reject(new Error(e.message || 'solver worker error'));
  pending.clear();
};

function solverOptions(extra = {}) {
  if (mode === 'voyage') {
    return {
      fullOnly: false,
      maxDepth: 320,
      timeLimitMs: extra.timeLimitMs ?? 8000,
      ...extra,
    };
  }
  return extra;
}

function requestSolve(options = {}) {
  const id = ++solveSeq;
  const merged = solverOptions(options);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, state: cloneState(game.state), rules: game.rules, options: merged });
  });
}

// ---------------------------------------------------------------------------
// HUD + timer + persistence
// ---------------------------------------------------------------------------
const setStatus = (t, k) => ui.setStatus(t, k);

// The deal intro ("Deal #… — drag cards…") is dismissed once the player makes
// their first manual move; restored games start already dismissed.
let introDismissed = true;

function updateHUD() {
  if (!game) return;
  const st = game.state;
  const total = cardsHome(st);
  const moves = manualMoves();
  ui.updateHUD({ moves, found: total, deal: game.dealNumber });
  if (moves > 0 && !introDismissed) {
    introDismissed = true;
    ui.clearStatus();
  }
  if (moves > 0 && !run.timerOn && !won) {
    run.timerOn = true;
    run.t0 = performance.now() - run.elapsed * 1000;
    if (!run.counted) {
      run.counted = true;
      if (mode === 'classic') recordStart();
    }
  }
}

let lastTimerText = -1;
function tickTimer() {
  if (run.timerOn) run.elapsed = (performance.now() - run.t0) / 1000;
  const s = Math.floor(run.elapsed);
  if (s !== lastTimerText) {
    lastTimerText = s;
    ui.setTimer(s);
  }
}

function persistGame() {
  if (mode === 'voyage') return voyagePersist();
  if (!game || won) {
    save('game', null);
    return;
  }
  if (manualMoves() === 0) return;
  save('game', {
    deal: game.dealNumber,
    theme: currentTheme.id,
    moves: game.history,
    elapsed: run.elapsed,
    undos: run.undos,
    hints: run.hints,
    daily: isDaily,
    counted: run.counted,
  });
}
const savedGame = () => {
  const g = load('game', null);
  return g && g.moves && g.moves.length ? g : null;
};

function formatResult(r) {
  if (r.solvable === true) return { text: `Solvable — solution found (${r.solution.length} moves)`, kind: 'ok' };
  if (r.solvable === false) return { text: 'Not solvable — no solution exists from here', kind: 'bad' };
  return { text: 'Unknown — search limit reached, could not decide', kind: 'warn' };
}

let busy = false;
async function doCheck() {
  if (busy || !game) return;
  busy = true;
  ui.setSolverBusy(true);
  setStatus('Searching for a solution…', 'warn');
  try {
    const r = await requestSolve({ timeLimitMs: 8000 });
    const f = formatResult(r);
    setStatus(f.text, f.kind);
    if (r.solvable === true) audio.hint();
    else if (r.solvable === false) audio.invalid();
  } catch (err) {
    setStatus('Solver error: ' + err.message, 'bad');
  } finally {
    busy = false;
    ui.setSolverBusy(false);
  }
}

async function doHint({ dev = false, charm = false } = {}) {
  if (busy || !game || won) return false;
  if (mode === 'voyage' && !dev && !charm) return false;
  const board = game, history = game.history.slice();
  busy = true;
  ui.setSolverBusy(true);
  setStatus('Looking for a good move…', 'warn');
  try {
    const r = await requestSolve({ timeLimitMs: 3000 });
    if (game !== board || won || history.length !== game.history.length || history.some((m, i) => m !== game.history[i])) return false;
    let move = null;
    if (r.solution && r.solution.length) move = r.solution[0];
    else {
      const moves = generateMoves(game.state, { fullOnly: true, rules: game.rules }).sort((a, b) => b.score - a.score);
      move = moves[0] || null;
    }
    if (!move) {
      setStatus('No moves available.', 'bad');
      audio.invalid();
    } else {
      if (mode !== 'voyage') run.hints++;
      audio.hint();
      const played = game.applyDescriptor(move);
      if (charm && vy.ability) played.voyageAbility = { ...vy.ability };
      clearSelection();
      afterMove({ noAuto: mode === 'voyage' });
      setStatus('Hint played.', 'ok');
      refreshDevPanel();
      return true;
    }
  } catch (err) {
    setStatus('Solver error: ' + err.message, 'bad');
  } finally {
    busy = false;
    ui.setSolverBusy(false);
  }
  return false;
}

let autoplay = { running: false };
async function doSolve({ dev = false } = {}) {
  if (autoplay.running) return stopSolve();
  if (busy || !game || won) return;
  if (mode === 'voyage' && !dev && !ui.devUnlocked) return;
  busy = true;
  ui.setSolverBusy(true);
  setStatus('Solving…', 'warn');
  let solution = null;
  try {
    const r = await requestSolve({ timeLimitMs: 15000 });
    solution = r.solution;
    if (!r.solution) {
      setStatus(formatResult(r).text, 'warn');
      return;
    }
  } catch (err) {
    setStatus('Solver error: ' + err.message, 'bad');
    return;
  } finally {
    busy = false;
    ui.setSolverBusy(false);
  }

  autoplay.running = true;
  run.solved = true; // machine-played wins don't count toward stats or achievements
  ui.setSolveActive(true);
  motion.speed = 0.6;
  const step = Math.max(45, Math.min(130, Math.round(9000 / solution.length)));
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  for (const m of solution) {
    if (!autoplay.running) break;
    game.applyDescriptor(m);
    applyLayout(true);
    updateHUD();
    await sleep(step);
  }
  motion.speed = 1;
  autoplay.running = false;
  ui.setSolveActive(false);
  persistGame();
  checkWin();
  refreshDevPanel();
  if (!game.isWon()) setStatus('Solution playback stopped.', 'warn');
}

function stopSolve() {
  autoplay.running = false;
}

// ---------------------------------------------------------------------------
// New game / win
// ---------------------------------------------------------------------------
// The 52 cards are built once and reused for every deal. Rebuilding them freed
// the card materials, which made three.js recompile the card shaders mid-intro.
function ensureCards() {
  for (let i = 1; i <= 52; i++) {
    if (cardGroups.has(i)) continue;
    const g = buildCardMesh(i, currentTheme.card);
    g.visible = false;
    scene.add(g);
    cardGroups.set(i, g);
    pickables.push(g.userData.front);
  }
}

// Clear everything a deal leaves on a card: board state, motion, Voyage marks.
function resetCard(g) {
  const u = g.userData;
  motion.release(g);
  delete u.dest;
  delete u.dragging;
  delete u.rxState;
  u.target = null;
  setCardMark(g, null);
  setCardSticker(g, null);
  setCardMods(g, []);
  if (u.concealed) setCardConcealed(g, false);
  g.scale.setScalar(1);
  // Back to the theme baseline, exactly as a freshly built card would be.
  const base = currentTheme.card.emissive;
  u.frontMat.emissive.setHex(base > 0 ? 0xffffff : 0x000000);
  u.frontMat.emissiveIntensity = base > 0 ? base : 0;
}

let startingGame = false;
async function newGame(dealNumber, opts = {}) {
  if (startingGame) return;
  startingGame = true;
  try {
    autoTok++;
    stopSolve();
    if (settings.autoRandomTheme && opts.restore && THEMES[opts.restore.theme]) {
      await switchTheme(opts.restore.theme);
    }
    if (settings.autoRandomTheme && !opts.restore) {
      await switchTheme(randomThemeId(currentTheme.id));
    }
    dealGame(dealNumber, opts);
  } finally {
    startingGame = false;
  }
}

function dealGame(dealNumber, opts = {}) {
  // Walking away from a classic game in progress breaks the streak.
  if (game && !won && run.counted && !opts.restore && !vy.boardLive) recordLoss();
  vy.boardLive = mode === 'voyage';
  const boardRules = opts.rules ?? (mode === 'voyage' ? vy.run?.current?.rules : undefined);
  setFreeCellCount(opts.freeCells ?? boardRules?.freeCells ?? 4);
  autoTok++; // cancel any pending auto-play from the previous deal
  cancelCascade();
  animator.clear();
  motion.clear();
  stopSolve();
  hideValidTargets();
  setHover(null);
  setRankHighlight(null);
  ui.hideWin();
  selection = null;
  won = false;
  isDaily = !!opts.daily;
  game = new Game(dealNumber, { freeCells: freeCellCount, rules: boardRules });
  if (opts.restore) {
    for (const m of opts.restore.moves) {
      const c = game.applyDescriptor(m);
      if (m.auto) c.auto = true;
    }
  }
  run.undos = opts.restore ? opts.restore.undos || 0 : 0;
  run.hints = opts.restore ? opts.restore.hints || 0 : 0;
  run.elapsed = opts.restore ? opts.restore.elapsed || 0 : 0;
  run.counted = opts.restore ? !!opts.restore.counted : false;
  run.timerOn = false;
  run.solved = false;
  introDismissed = !!opts.restore;
  lastTimerText = -1;
  tickTimer();
  save('game', null);

  ensureCards();
  for (const [i, g] of cardGroups) {
    resetCard(g);
    const k = i - 1;
    g.position.set((k % 5) * 0.02 - 0.04, 0.5 + k * 0.016, -0.2);
    g.rotation.set(Math.PI, 0, 0);
    g.visible = false;
  }

  playDealIntro();
  updateHUD();
  setStatus(
    opts.voyage
      ? opts.voyage
      : opts.restore
      ? `Welcome back — deal #${dealNumber}.`
      : opts.daily
      ? `Daily challenge — deal #${dealNumber}.`
      : `Deal #${dealNumber} — drag cards, double-click to auto-move.`
  );
}

function checkWin() {
  if (game && !won && game.isWon()) handleWin();
}

function handleWin() {
  won = true;
  run.timerOn = false;
  tickTimer();
  clearSelection();
  if (mode === 'voyage') return voyageWin();
  save('game', null);
  const result = run.solved
    ? { newBestTime: false, newBestMoves: false, unlocked: [] }
    : recordWin({
        time: run.elapsed,
        moves: manualMoves(),
        undos: run.undos,
        hints: run.hints,
        theme: currentTheme.id,
        daily: isDaily,
      });
  audio.win();
  audio.duck(8);
  post.pulse(1.2);
  startCascade();
  setStatus('Victory!', 'ok');
  ui.refreshDaily();
  setTimeout(() => {
    if (!won) return;
    ui.showWin({ time: run.elapsed, moves: manualMoves(), bests: result, daily: isDaily, assisted: run.solved });
    result.unlocked.forEach((a, i) => setTimeout(() => ui.toast(a.icon, 'Achievement unlocked', `${a.name} — ${a.desc}`), 900 + i * 900));
  }, settings.reducedMotion ? 300 : REVEAL.panelAt * 1000);
}

// ---------------------------------------------------------------------------
// Win reveal: the finished deck deals itself face down into a 4 x 13 grid (one
// suit per row, Ace to King), a diagonal wave flips it face up with a shimmer,
// and the four Kings glow last.
// ---------------------------------------------------------------------------
const REVEAL = {
  gatherAt: 0.25, // cards leave the foundations
  gatherStep: 0.026, // between launches
  hold: 0.2, // after the last card lands
  waveStep: 0.045, // per grid diagonal
  flipDur: 0.46,
  kingsAfter: 0.12, // after the wave finishes
  colGap: 0.74, // overlapping columns, like a spread
  rowGap: CARD.H * 1.1,
};
// When the results panel comes up, measured from the win.
REVEAL.panelAt = REVEAL.gatherAt + 51 * REVEAL.gatherStep + 0.55 + REVEAL.hold + (12 + 3 * 1.5) * REVEAL.waveStep + REVEAL.flipDur + REVEAL.kingsAfter + 0.35;

let cascade = null;
const gridPos = (suit, rank) => ({
  x: (rank - 7) * REVEAL.colGap,
  y: SURFACE_Y + CARD.D / 2 + rank * 0.004, // later ranks sit on the overlap
  z: FIELD.centerZ + (suit - 1.5) * REVEAL.rowGap,
});

function startCascade() {
  if (settings.reducedMotion) return;
  cascade = { tweens: [], emissive: new Map() };
  const tween = (o) => cascade.tweens.push(animator.add(o));
  const ids = [];
  for (let r = 1; r <= 13; r++) for (let s = 0; s < 4; s++) ids.push(s * 13 + r);

  // 1. Gather: each card lifts off its foundation and turns face down on the way
  // to its slot, Aces first.
  const softLand = (g) => audio.place(panOf(g.position.x), 0.6);
  ids.forEach((id, i) => {
    const g = cardGroups.get(id);
    if (!g) return;
    const suit = ((id - 1) / 13) | 0;
    const rank = ((id - 1) % 13) + 1;
    g.visible = true;
    g.userData.dest = 'grid';
    motion.move(g, { ...gridPos(suit, rank), rx: Math.PI }, {
      delay: REVEAL.gatherAt + i * REVEAL.gatherStep,
      arc: 1.1,
      stiffness: 150,
      damping: 0.78,
      onLand: i % 3 === 0 ? softLand : noop,
    });
  });

  // 2. Wave: flip face up along the diagonals, top-left to bottom-right.
  const waveAt = REVEAL.gatherAt + 51 * REVEAL.gatherStep + 0.55 + REVEAL.hold;
  for (const id of ids) {
    const g = cardGroups.get(id);
    if (!g) continue;
    const suit = ((id - 1) / 13) | 0;
    const rank = ((id - 1) % 13) + 1;
    const home = gridPos(suit, rank);
    let started = false;
    let sparked = false;
    tween({
      delay: waveAt + (rank - 1 + suit * 1.5) * REVEAL.waveStep,
      duration: REVEAL.flipDur,
      ease: Easing.cubicInOut,
      onUpdate: (e) => {
        if (!started) { started = true; motion.release(g); }
        g.position.set(home.x, home.y + Math.sin(Math.PI * e) * 0.45, home.z);
        g.rotation.set(Math.PI * (1 - e), 0, 0);
        g.userData.rxState = g.rotation.x;
        if (!sparked && e > 0.55) {
          sparked = true;
          if (rank % 3 === 1) audio.flip(panOf(home.x));
          particles.emit({ x: home.x, y: home.y + 0.1, z: home.z, color: currentTheme.fx.spark, count: 5, speed: 0.6, spread: 0.5, up: 0.5, size: 0.06, life: 0.5, drag: 2.5, jitter: 0.4 });
        }
      },
      onComplete: () => {
        g.position.set(home.x, home.y, home.z);
        g.rotation.set(0, 0, 0);
        g.userData.rxState = 0;
        g.userData.target = { x: home.x, y: home.y, z: home.z, rx: 0, ry: 0 };
      },
    });
  }

  // 3. The Kings rise a touch and glow.
  const kingsAt = waveAt + (12 + 3 * 1.5) * REVEAL.waveStep + REVEAL.flipDur + REVEAL.kingsAfter;
  const glow = new THREE.Color(currentTheme.fx.flash);
  for (let s = 0; s < 4; s++) {
    const id = s * 13 + 13;
    const g = cardGroups.get(id);
    if (!g) continue;
    const home = gridPos(s, 13);
    const m = g.userData.frontMat;
    const baseEmissive = m.emissive.clone();
    const baseIntensity = m.emissiveIntensity;
    cascade.emissive.set(m, baseEmissive);
    let started = false;
    tween({
      delay: kingsAt + s * 0.08,
      duration: 1.3,
      ease: Easing.linear,
      onUpdate: (_, t) => {
        if (!started) {
          started = true;
          pulses.ring(home.x, home.z, currentTheme.fx.flash, 1);
          pulses.flash(home.x, 1.2, home.z, currentTheme.fx.flash, 12);
          if (s === 0) post.pulse(0.6);
          audio.foundation(panOf(home.x));
        }
        const rise = Easing.backOut(Math.min(1, t * 2.5));
        const hl = Math.sin(Math.PI * Math.min(1, t * 1.2));
        g.position.y = home.y + 0.12 * rise;
        m.emissive.copy(baseEmissive).lerp(glow, hl);
        m.emissiveIntensity = baseIntensity + (0.55 - baseIntensity) * hl;
      },
      onComplete: () => {
        g.userData.target = { x: home.x, y: g.position.y, z: home.z, rx: 0, ry: 0 };
        m.emissive.copy(baseEmissive);
        refreshCardEmissive(id);
      },
    });
  }
}
function cancelCascade() {
  if (cascade) {
    for (const tw of cascade.tweens) animator.remove(tw);
    for (const [m, color] of cascade.emissive) m.emissive.copy(color);
    for (let s = 0; s < 4; s++) refreshCardEmissive(s * 13 + 13);
  }
  cascade = null;
}

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------
function startGameFromTitle(num, opts) {
  audio.unlock();
  ui.hideTitle();
  return newGame(num ?? randomDealNumber(), opts);
}

function doUndo() {
  if (!game) return;
  if (won) return audio.invalid(); // a finished board is final
  if (mode === 'voyage' && (busy || vy.effects?.using)) return;
  if (mode === 'voyage') voyageClearPreview();
  if (autoplay.running) stopSolve();
  if (manualMoves() === 0) return audio.invalid();
  if (mode === 'voyage') {
    if (!vy.run || vy.run.status !== 'board') return audio.invalid();
    if (vy.run.undos <= 0 && !vy.run.current?.memo?._undoWindow) {
      setStatus('No undos left on this voyage.', 'bad');
      return audio.invalid();
    }
  }
  autoTok++; // cancel a pending auto-play chain
  // Take back the auto-plays first, then the player's move that triggered them.
  let undone = false;
  while (game.history.length && game.history[game.history.length - 1].auto) {
    game.undo();
    undone = true;
  }
  if (game.undo()) undone = true;
  if (undone) {
    const free = mode === 'voyage' && !!vy.run.current?.memo?._undoWindow;
    if (!free) run.undos++;
    if (mode === 'voyage') voyageUndone({ free });
    audio.undo();
    clearSelection();
    ui.hideWin();
    afterMove({ noAuto: true });
  }
}

// ---------------------------------------------------------------------------
// Voyage mode: a 7-board roguelite run (js/voyage/*). The run object is the source of truth and is
// saved after every change; this section connects it to the table, the HUD and the Voyage screens.
// ---------------------------------------------------------------------------
let mode = 'classic'; // 'classic' | 'voyage'
const vy = {
  run: null,
  effects: null,
  boardLive: false, // the table currently holds a Voyage board (not a classic deal)
  seen: 0, // history entries already reported to charm hooks
  emptyCols: new Set(),
  lastHistory: [],
  settingUp: false,
  ability: null,
  applyingCharm: false,
  stuckTok: 0,
  stuckIdle: 0,
  stuckWarned: false,
};

const vyView = () => {
  const view = runView(vy.run, vy.effects);
  if (view.current && game && vy.boardLive) {
    view.current.freeCells = game.state.free.length;
    view.current.override = game.override || null;
    const capacity = maxMoveSize(game.state, false, game.rules);
    view.current.moveCapacity = game.rules.emptyFactor !== 2 || game.rules.emptyMinRank >= 2 || capacity !== maxMoveSize(game.state, false) ? capacity : null;
  }
  return view;
};
const vyUsedDeals = () => vy.run.results.map((r) => r.deal);

function enterVoyageMode() {
  mode = 'voyage';
  voyageUI.setMode('voyage');
}

// Back to classic: the Voyage run stays saved and can be continued from the title screen.
function leaveVoyageMode() {
  if (mode !== 'voyage') return;
  voyageDisarmStuck();
  voyageClearStuckWarning();
  voyagePersist();
  mode = 'classic';
  vy.effects = null;
  cancelTargeting();
  voyageUI.hideAll();
  voyageUI.setMode('classic');
}

function voyageRefreshTitle() {
  const saved = vy.run && ['map', 'board', 'reward'].includes(vy.run.status) ? vy.run : loadRun();
  const key = todayKey();
  voyageUI.refreshTitle({ run: saved ? runView(saved) : null, daily: { key, result: voyageStats.daily[key] || null } });
}

function voyageToMenu() {
  if (mode === 'voyage') voyagePersist();
  voyageUI.hideAll();
  ui.showTitle();
  voyageRefreshTitle();
  if (ui.titleMode === 'classic') ui.handlers.restoreClassicTheme?.();
}

// The run names each table. Apply that look without replacing the classic theme.
function applyVoyageBoardTheme(id) {
  return switchTheme(id, { persist: false });
}

function restoreClassicTheme() {
  if (ui.titleMode !== 'classic' || !THEMES[settings.theme]) return;
  return switchTheme(settings.theme, { sound: false });
}

function voyagePersist() {
  const r = vy.run;
  if (!r) return;
  if (r.status === 'board' && r.current && game && vy.boardLive) {
    r.current.history = game.history.map((m) => ({ ...m }));
    r.current.elapsed = run.elapsed;
    r.current.override = game.override || null;
    r.current.liveRules = JSON.parse(JSON.stringify(game.rules));
  }
  recordEconomy(r);
  saveRun(r);
}

// Warm the art and sound of every table the player could visit next, and let the dealer pick
// (and if needed verify) their deals in the background.
function voyagePrepareAhead() {
  const r = vy.run;
  if (!r) return;
  const plans = upcomingPlans(r);
  const idx = r.status === 'map' || r.status === 'port' ? r.results.length : r.results.length + (r.status === 'board' ? 1 : 0);
  const exclude = vyUsedDeals().concat(r.current ? [r.current.deal] : []);
  prepareDeals(plans.map((p) => ({ ...p, idx: p.idx ?? idx })), { seed: r.seed, exclude })
    // Then the tables after those, so their slow checks are done before they are picked.
    .then(() => vy.run === r && prepareDeals(laterPlans(r), { seed: r.seed, exclude }))
    .catch((e) => console.warn('[voyage] prepare', e));
  for (const t of new Set(plans.map((p) => p.theme))) {
    loadThemeAssets(THEMES[t]);
    audio.preloadTheme(t);
  }
}

async function voyageShowMap() {
  const view = vyView();
  for (const n of view.map.flat()) n.strength = boardPlan(vy.run, n.theme, { idx: n.row, nodeId: n.id }).strength;
  // A market row ends on the chart with the market as the only open stop;
  // the player sails in from there.
  voyageUI.showMap(view);
  voyageUI.tutorial('map');
  voyagePrepareAhead();
}

async function voyageStart({ daily = false } = {}) {
  audio.unlock();
  const saved = vy.run && ['map', 'board', 'reward', 'port'].includes(vy.run.status) ? vy.run : loadRun();
  if (saved) {
    if (daily && saved.daily === todayKey()) return voyageContinue();
    const ok = await voyageUI.confirm({
      title: 'Abandon your voyage?',
      text: `Your current voyage is on board ${Math.min(7, saved.results.length + 1)} of 7. Starting a new one ends it as a loss.`,
      ok: 'Abandon and start',
      cancel: 'Keep it',
    });
    if (!ok) return;
    loseRun(saved, 'abandoned');
    recordRunEnd(saved);
    saveRun(saved);
  }
  await loadBank();
  vy.run = createRun({ daily });
  recordRunStart();
  saveRun(vy.run);
  enterVoyageMode();
  voyageShowMap();
}

async function voyageContinue() {
  audio.unlock();
  const r = vy.run && ['map', 'board', 'reward', 'port'].includes(vy.run.status) ? vy.run : loadRun();
  if (!r) return voyageStart({});
  vy.run = r;
  enterVoyageMode();
  await loadBank();
  if (r.status === 'map') return voyageShowMap();
  if (r.status === 'port') {
    vy.effects = null;
    vy.boardLive = false;
    return voyageShowMap();
  }
  if (r.status === 'reward') {
    ui.hideTitle();
    return voyageUI.showResult(vyView());
  }
  // A board in progress: resume it (or bring the table back if it is already live).
  // The title screen can change the classic theme while this board is still dealt,
  // so the table has to be put back on the run's theme either way.
  if (vy.boardLive && game && r.current && game.dealNumber === r.current.deal && vy.effects) {
    ui.hideTitle();
    await applyVoyageBoardTheme(r.current.theme);
    voyageHud();
    return;
  }
  ui.hideTitle();
  await applyVoyageBoardTheme(r.current.theme);
  voyageDealBoard({ restore: { moves: r.current.history || [], elapsed: r.current.elapsed || 0, undos: 0, hints: 0, counted: true } });
}

async function voyagePickNode(nodeId) {
  const r = vy.run;
  if (!r || r.status !== 'map' || voyageUI.preparing) return;
  const node = findNode(r.map, nodeId);
  if (!node || !runView(r).map.flat().some(n => n.id === nodeId && n.state === 'available')) return;
  voyageUI.setPreparing(true);
  // The boat always sails the whole lane. If the table is still being dealt when
  // it arrives, a loading screen says so instead of leaving the chart still.
  const dealt = dealFor({ ...boardPlan(r, node.theme, { nodeId }) }, { seed: r.seed, exclude: vyUsedDeals() });
  let ready = false;
  dealt.then(() => { ready = true; }, () => {});
  let pick;
  try {
    await (voyageUI.sailTo?.(nodeId) || Promise.resolve());
    if (!ready) voyageUI.showLoading?.('Preparing board…');
    pick = await dealt;
  } catch (error) {
    voyageUI.chart?.cancel();
    ui.toast('⚓', 'Course unavailable', error.message);
    return;
  } finally {
    voyageUI.hideLoading?.();
    voyageUI.setPreparing(false);
  }
  if (vy.run !== r || r.status !== 'map') return;
  startBoard(r, nodeId, pick);
  saveRun(r);
  voyageUI.hideMap();
  if (!ui.els.title.classList.contains('hidden')) ui.hideTitle();
  await applyVoyageBoardTheme(r.current.theme);
  await voyageUI.showBossIntro(runView(r));
  await voyageUI.showBoardIntro(vyView());
  voyageDealBoard();
  if (r.current?.boss) {
    voyageUI.flashBossTell(vyView());
    layer?.flashBossTell?.();
    if (!settings.reducedMotion) {
      // Marks are still in the deck until the entrance and deal land.
      setTimeout(() => {
        if (vy.run?.current !== r.current) return;
        for (const g of cardGroups.values()) if (g.userData.mark === 'crown' || g.userData.mark === 'thorn') {
          pulses.ring(g.position.x, g.position.z, currentTheme.fx.flash, .6);
        }
      }, 1900);
    }
  }
  if (r.current?.finaleStipend) ui.toast('✦', 'Finale stipend', `+${r.current.finaleStipend} undos for the final table.`, 3200);
  voyageUI.tutorial('board');
}

// Charm effects are scoped by BoardEffects; these primitives act on the live table.
import { VOYAGE } from './voyage/config.js';

// Preview visuals have their own lifetime and never alter selection, marks or history.
let voyagePreviewUI = null;
let voyagePreviewToken = 0;
function voyageClearPreview() {
  voyagePreviewToken++;
  if (!voyagePreviewUI) return;
  cancelAnimationFrame(voyagePreviewUI.frame);
  for (const glow of voyagePreviewUI.glows) {
    scene.remove(glow); glow.geometry.dispose(); glow.material.dispose();
  }
  voyagePreviewUI.element.remove();
  voyagePreviewUI = null;
}

function voyageShowPreview(moves) {
  const element = document.createElement('div');
  element.id = 'voyage-preview'; element.setAttribute('role', 'status');
  element.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:30;color:white';
  const names = moves.map((m, i) => {
    const rank = ((m.card - 1) % 13) + 1;
    const card = `${({1:'A',11:'J',12:'Q',13:'K'})[rank] || rank}${['♣','♦','♥','♠'][Math.floor((m.card - 1) / 13)]}`;
    const to = m.t === 'F' ? 'home' : m.t === 'C' ? `cell ${m.fi + 1}` : m.t === 'R' ? `${m.to.kind === 'col' ? 'column' : 'cell'} ${m.to.i + 1}` : `column ${m.to + 1}`;
    return `${i + 1}. ${card}${m.count > 1 ? ` + ${m.count - 1}` : ''} → ${to}`;
  });
  element.setAttribute('aria-label', names.join('; '));
  const line = document.createElement('div');
  line.textContent = names.join(' · ');
  line.style.cssText = 'position:absolute;bottom:110px;left:50%;transform:translateX(-50%);max-width:90vw;width:max-content;padding:8px 12px;border-radius:8px;background:#152331ee;font:600 14px/1.5 system-ui;border:1px solid #ffffff70';
  element.append(line);
  const badges = moves.slice(1, 3).map((m, i) => {
    const badge = document.createElement('span');
    badge.dataset.previewCard = m.card; badge.textContent = String(i + 2);
    badge.style.cssText = 'position:absolute;transform:translate(-50%,-50%);width:24px;height:24px;text-align:center;border-radius:50%;background:#152331;color:white;border:2px solid white;font:700 16px/24px system-ui;box-shadow:0 0 10px #ffffff90';
    element.append(badge); return { card: m.card, badge, offset: i * 26 };
  });
  const glows = [0, 1].map(() => {
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(CARD.W * 1.08, CARD.H * 1.08), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: .9, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2; glow.renderOrder = 3;
    scene.add(glow); return glow;
  });
  document.body.append(element);
  const preview = voyagePreviewUI = { element, glows, frame: 0 };
  const first = moves[0];
  const dest = first.t === 'F' ? { kind: 'found', i: Math.floor((first.card - 1) / 13) }
    : first.t === 'C' ? { kind: 'free', i: first.fi }
    : first.t === 'R' ? first.to : { kind: 'col', i: first.to };
  const update = () => {
    if (preview !== voyagePreviewUI) return;
    if (mode !== 'voyage' || !vy.boardLive || vy.run?.status !== 'board') { voyageClearPreview(); return; }
    const source = cardGroups.get(first.card);
    if (source) { glows[0].position.copy(source.position); glows[0].position.y += CARD.D + .018; }
    if (dest.kind === 'col') {
      const top = cardGroups.get(game.tableau[dest.i].at(-1));
      if (top) { glows[1].position.copy(top.position); glows[1].position.y += CARD.D + .018; }
      else glows[1].position.set(colX(dest.i), SURFACE_Y + .018, TABLEAU_Z);
    } else glows[1].position.set(dest.kind === 'free' ? freeX(dest.i) : foundX(dest.i), SURFACE_Y + .018, FREE_Z);
    for (const {card, badge, offset} of badges) {
      const point = window.FreeCell.projectCard(card, true);
      if (point) { badge.style.left = `${point.x + offset}px`; badge.style.top = `${point.y}px`; }
    }
    preview.frame = requestAnimationFrame(update);
  };
  update();
  setStatus(names.join(' · '), 'ok');
}

async function voyagePreview(n = 3) {
  if (busy || !game || won || !vy.boardLive || vy.run?.status !== 'board') return null;
  n = Number.isFinite(Number(n)) ? Math.max(1, Math.floor(Number(n))) : 3;
  voyageClearPreview(); clearSelection(); autoTok++;
  const token = voyagePreviewToken, board = game;
  const history = game.history.slice();
  busy = true; ui.setSolverBusy(true);
  setStatus('Looking ahead…', 'warn');
  try {
    const result = await requestSolve({ timeLimitMs: 5000 });
    if (token !== voyagePreviewToken || game !== board || mode !== 'voyage' || !vy.boardLive || won || history.length !== game.history.length || history.some((m, i) => m !== game.history[i])) return null;
    if (!result.solution?.length) { setStatus('No preview found within the search limit.', 'warn'); return null; }
    const moves = result.solution.slice(0, n).map((m) => JSON.parse(JSON.stringify(m)));
    voyageShowPreview(moves);
    return moves;
  } catch (error) {
    setStatus('Solver error: ' + error.message, 'bad'); return null;
  } finally { busy = false; ui.setSolverBusy(false); }
}

async function voyageSolvable() {
  if (!game || mode !== 'voyage' || !vy.boardLive || busy) return null;
  if (game.isWon()) return true;
  const board = game, history = game.history.slice();
  busy = true;
  try {
    const result = await requestSolve({ timeLimitMs: 5000 });
    if (game !== board || mode !== 'voyage' || !vy.boardLive || history.length !== game.history.length || history.some((m, i) => m !== game.history[i])) return null;
    return typeof result.solvable === 'boolean' ? result.solvable : null;
  } catch { return null; }
  finally { busy = false; }
}

function voyageRuntimeAPI() {
  return {
    get state() { return game?.state; },
    get rules() { return game?.rules || vy.run?.current?.rules; },
    get history() { return game?.history || []; },
    get stickers() { return { ...(vy.run?.stickers || {}) }; },
    addSticker: (cardId, type) => {
      if (!vy.run || !Number.isInteger(cardId) || cardId < 1 || cardId > 52 || !['wild', 'fool', 'key', 'gold', 'lucky'].includes(type)) return false;
      (vy.run.stickers ??= {})[cardId] = type;
      saveRun(vy.run); return true;
    },
    get undoGrants() { return vy.run?.current?.memo?._undoGrants || 0; },
    get undoCap() { return VOYAGE.charmUndoCap; },
    get undoWindowUsed() { return !!vy.run?.current?.memo?._undoWindowUsed; },
    abilityUses: () => vy.effects?.abilityUses() || Object.freeze({}),
    beginAbility: (id, uses) => {
      voyageClearPreview();
      vy.ability = { id, uses, grants: vy.run.current.memo[id]._runtime.abilityGrants || 0 };
    },
    endAbility: () => { vy.ability = null; clearTargetChosen(); },
    addUndos: (n) => { vy.run.undos += Math.max(0, Math.floor(Number(n) || 0)); voyageRefresh(); },
    addCoins: (n) => { vy.run.coins = (vy.run.coins || 0) + Math.max(0, Math.floor(Number(n) || 0)); voyageRefresh(); },
    concedeBoard: () => {
      if (!game || won || !vy.boardLive || vy.run?.status !== 'board' || vy.run.current.idx >= VOYAGE.boards - 1) return false;
      return voyageWin({ conceded: true });
    },
    spendCoins: (n) => {
      if (!game || won || !vy.boardLive || vy.run?.status !== 'board' || !Number.isInteger(n) || n < 0 || n > vy.run.coins) return false;
      vy.run.coins -= n; (vy.run.economy ??= {}).coinsSpent = (vy.run.economy.coinsSpent || 0) + n;
      voyageRefresh(); return true;
    },
    grantUse: (id = '*', n = 1) => vy.effects?.grantUse(id, n) || 0,
    spendUndos: (n) => { const spent = Math.min(vy.run.undos, Math.max(0, Math.floor(Number(n) || 0))); vy.run.undos -= spent; voyageRefresh(); return spent; },
    notify: (text) => ui.toast('✦', 'Charm', text, 2600),
    mark: (ids, style) => { for (const id of ids) { const g = cardGroups.get(id); if (g) setCardMark(g, style); } },
    clearMarks: () => { for (const g of cardGroups.values()) { setCardMark(g, null); setCardSticker(g, null); setCardMods(g, []); } },
    conceal: (ids) => {
      for (const id of ids) { const g = cardGroups.get(id); if (g) setCardConcealed(g, true); }
      syncRankHighlight();
    },
    reveal: (ids) => {
      const targets = computeTargets();
      for (const id of ids) {
        const g = cardGroups.get(id), target = targets.get(id);
        if (!g || !target) continue;
        setCardConcealed(g, false);
        if (!settings.reducedMotion) { g.rotation.x = Math.PI; g.userData.rxState = Math.PI; }
        moveCard(g, target, { arc: settings.reducedMotion ? 0 : 0.22, onLand: noop });
      }
      syncRankHighlight();
    },
    hint: () => doHint({ charm: true }),
    preview: voyagePreview,
    solvable: voyageSolvable,
    resetBoard: () => {
      if (!game || won || !vy.boardLive || vy.run?.status !== 'board' || !manualMoves()) return false;
      voyageClearPreview(); clearSelection(); autoTok++;
      const keepUse = vy.effects?.using;
      while (game.history.length) game.undo();
      game.override = null;
      voyageUndone({ reset: true, keepUse });
      audio.undo(); afterMove({ noAuto: true }); return true;
    },
    openUndoWindow: () => {
      if (!game || won || !vy.boardLive || vy.run?.status !== 'board' || !manualMoves()) return false;
      const memo = (vy.run.current.memo ??= {});
      if (memo._undoWindowUsed) return false;
      memo._undoWindow = true; memo._undoWindowUsed = true;
      voyageRefresh(); return true;
    },
    autoHome: () => {
      if (!game || won) return false;
      autoTok++;
      let count = 0, next;
      while ((next = legalFoundationMoves(game.state, game.rules)[0])) {
        const m = game.moveToFoundation(next.src);
        if (!m) break;
        if (vy.ability) m.voyageAbility = { ...vy.ability };
        count++; // consecutive player foundation moves form one scoring chain
      }
      if (count) { selection = null; afterMove({ noAuto: true }); }
      return count > 0;
    },
    override: (o) => {
      if (!game || won || !('override' in game) || game.override) return false;
      game.override = { ...o, ...(vy.ability ? { voyageAbility: { ...vy.ability } } : {}) };
      voyageRefresh(); return true;
    },
    charmMove: (op, data = {}) => {
      if (!game?.applyCharmMove || won) return false;
      autoTok++;
      let m;
      vy.applyingCharm = true;
      try { m = game.applyCharmMove({ ...data, t: 'X', op, ...(vy.ability ? { voyageAbility: { ...vy.ability } } : {}) }); }
      finally { vy.applyingCharm = false; }
      if (!m) return false;
      selection = null;
      clearTargetChosen(false);
      voyageRelayout();
      audio.place(0, 1);
      afterMove({ noAuto: true });
      return m;
    },
    setFreeCells: (n) => {
      n = Math.min(6, Math.floor(Number(n)));
      if (!game || !Number.isFinite(n) || n <= game.state.free.length) return false;
      if (vy.applyingCharm) {
        while (game.state.free.length < n) game.state.free.push(0);
        game.rules.freeCells = n;
        return true;
      }
      return !!voyageRuntimeAPI().charmMove('voyage.cells', { count: n });
    },
    refresh: voyageRefresh,
    pick: voyagePickTarget,
    choose: voyageChoose,
    rewind: (n) => {
      if (!game || won || !vy.boardLive || vy.run?.status !== 'board') return false;
      n = Math.min(game.history.length, Math.max(0, Math.floor(n)));
      if (!n || vy.run.undos <= 0) return false;
      voyageClearPreview(); clearSelection();
      autoTok++;
      while (n--) game.undo();
      voyageUndone();
      audio.undo(); afterMove({ noAuto: true }); return true;
    },
  };
}

function voyageRelayout() {
  if (!game || !vy.boardLive) return;
  if (freeCellCount !== game.state.free.length) setFreeCellCount(game.state.free.length);
  layer?.setRules?.(game);
  applyLayout(true);
}

function voyageRefresh() {
  if (vy.settingUp || !vy.run || !vy.boardLive) return;
  voyageRelayout(); voyageHud(); voyagePersist();
  voyageUndoWindowHUD();
}

function voyageUndoWindowHUD() {
  if (vy.run.current?.memo?._undoWindow) {
    const undo = document.getElementById('btn-undo');
    const label = undo?.querySelector('span');
    if (label) label.textContent = 'Undo · free';
    undo?.setAttribute('aria-label', 'Undo move for free. The next move closes the window. Press U.');
    undo?.setAttribute('data-tip-text', 'Free undo window: step back without spending a run undo. The next move closes it.');
  }
}

function voyageRevealExposed(moves = []) {
  const exposed = game.tableau.filter((col) => col.length).map((col) => col.at(-1));
  // Comparing all card locations also covers X moves that do not declare m.cards.
  const before = vy.positions || new Map();
  const now = new Map();
  game.tableau.forEach((col, c) => col.forEach((id) => now.set(id, `c${c}`)));
  game.free.forEach((id, i) => id && now.set(id, `f${i}`));
  game.found.forEach((rank, suit) => { for (let r = 1; r <= rank; r++) now.set(suit * 13 + r, `h${suit}:${r}`); });
  if (before.size) for (const [id, pos] of now) if (before.get(id) !== pos) exposed.push(id);
  for (const m of moves) exposed.push(...(m.cards || (m.card ? [m.card] : [])));
  vy.positions = now;
  vy.effects?.reveal(exposed);
}

async function voyagePickTarget({ kind, filter = () => true, prompt = null, cards = null, group = null }) {
  if (!game || !vy.boardLive || won) return null;
  endTargeting(null);
  const pool = kind === 'column' ? game.tableau.map((_, i) => i) : kind === 'freecell' ? game.free.map((_, i) => i)
    : [...cardGroups.keys()].filter((id) => { const loc = locateCard(id); return loc && loc.kind !== 'found' && !faceDown(id); });
  const values = pool.filter((value) => filter(value, game.state));
  if (!values.length) { ui.toast('✦', 'Charm', 'Nothing on the table can be chosen right now.', 2200); return null; }
  clearSelection(); setPeek(null);
  return startTargeting({ kind, values, prompt, cards, group });
}

// A small menu for choices that are not places on the table (a direction, a sticker, a suit).
async function voyageChoose({ prompt = '', options = [], card = null } = {}) {
  if (!game || !vy.boardLive || won || !options.some((o) => !o.disabled)) return null;
  const point = card != null ? window.FreeCell.projectCard(card, true) : null;
  const charm = vy.ability && CHARMS[vy.ability.id];
  return voyageUI.choose({ icon: charm?.icon || '✦', name: charm?.name || 'Charm', text: prompt, options, at: point });
}

// Deal run.current onto the table with its charms active.
function voyageDealBoard({ restore = null } = {}) {
  const cur = vy.run.current;
  voyageClearPreview();
  voyageDisarmStuck();
  voyageClearStuckWarning();
  vy.settingUp = true;
  vy.positions = null;
  cancelTargeting();
  voyageUI.setHud(vyView());
  frameBoard();
  vy.effects = new BoardEffects(cur.active, {
    seed: vy.run.seed, boardIndex: cur.idx, memo: (cur.memo ??= {}), run: vy.run, api: voyageRuntimeAPI(),
  });
  const label = `Board ${cur.idx + 1} of 7 — ${THEMES[cur.theme].name}`;
  dealGame(cur.deal, { rules: JSON.parse(JSON.stringify(cur.rules)), freeCells: cur.rules.freeCells, restore, voyage: restore ? `Welcome back — ${label}.` : `${label}. Par ${cur.par} moves.` });
  // Preserve refund markers that Game.cleanMove omits from normal descriptors.
  if (restore) game.history.forEach((move, i) => {
    if (restore.moves?.[i]?.voyageAbility) move.voyageAbility = { ...restore.moves[i].voyageAbility };
  });
  cur.initial ??= cloneState(new Game(cur.deal, { rules: cur.rules, freeCells: cur.rules.freeCells }).state);
  if (restore && cur.liveRules) game.rules = JSON.parse(JSON.stringify(cur.liveRules));
  if (cur.override) game.override = { ...cur.override };
  vy.seen = game.history.length;
  vy.lastHistory = game.history.slice();
  vy.emptyCols = new Set(game.tableau.map((c, i) => (c.length ? -1 : i)).filter((i) => i >= 0));
  const initial = cloneState(cur.initial);
  vy.effects.setup({ state: initial, initial, deal: cur.deal, restored: !!restore });
  voyageRevealExposed();
  if (!restore) vy.effects.emit('start', {});
  vy.settingUp = false;
  voyageRefresh();
  voyagePrepareAhead();
}

function voyageLiveScore() {
  const cur = vy.run?.current;
  if (!cur || !game) return;
  const extra = scoringContext(vy.run, { elapsed: run.elapsed, rules: game.rules });
  const sb = scoreBoard(game.history, cur.par, vy.effects, extra);
  voyageUI.setLiveScore({ total: sb.total, stars: starsFor(sb.total, cur.par, vy.effects, { ...extra, sb }), thresholds: starThresholds(cur.par, vy.effects, extra) });
}

let voyageScoreSecond = -1;
setInterval(() => {
  if (mode !== 'voyage' || !vy.boardLive || vy.run?.status !== 'board' || vy.settingUp) return;
  const second = Math.floor(run.elapsed);
  if (second !== voyageScoreSecond) { voyageScoreSecond = second; voyageLiveScore(); }
}, 1000);

function voyageHud() {
  if (!vy.run) return;
  voyageUI.setHud(vyView());
  voyageLiveScore();
  frameBoard();
}

// Report new history entries to the charm hooks, update the HUD and watch for a dead end.
function voyageAfterMove() {
  const fx = vy.effects;
  if (!fx || !vy.boardLive || !vy.run || vy.run.status !== 'board') return;
  const h = game.history;
  const newMoves = h.slice(vy.seen);
  if (newMoves.length) voyageClearPreview();
  vy.seen = h.length; // advance before hooks, which may themselves apply a charm move
  for (const m of newMoves) {
    if (!m.auto) vy.run.current.memo._undoWindow = false;
    fx.emit('move', { move: m, manual: !m.auto });
    if (m.t === 'F') fx.emit('foundation', { card: m.card, move: m, src: m.src, auto: !!m.auto });
    if (m.t === 'C' || (m.t === 'R' && m.to?.kind === 'free')) fx.emit('freecell', { card: m.card, move: m });
  }
  voyageRevealExposed(newMoves);
  vy.seen = h.length;
  vy.lastHistory = h.slice();
  const empty = new Set();
  game.tableau.forEach((c, i) => c.length === 0 && empty.add(i));
  for (const i of empty) if (!vy.emptyCols.has(i)) fx.emit('columnEmpty', { col: i });
  vy.emptyCols = empty;
  voyageHud();
  voyageUndoWindowHUD();
  voyageCheckStuck();
}

function voyageUndone({ free = false, reset = false, keepUse = null } = {}) {
  voyageClearPreview();
  if (!free && !reset) spendUndo(vy.run);
  vy.seen = game.history.length;
  vy.emptyCols = new Set(game.tableau.map((c, i) => (c.length ? -1 : i)).filter((i) => i >= 0));
  const moves = vy.lastHistory.slice(game.history.length).reverse();
  for (const move of moves) {
    const meta = move.voyageAbility || move.override?.voyageAbility;
    if (meta && meta.id !== keepUse) vy.effects?.refundAbility(meta);
    if (move.override) game.override = null;
  }
  vy.lastHistory = game.history.slice();
  vy.effects?.emit('undo', { move: moves.find((m) => !m.auto) || moves[0], moves, free, reset });
  voyageRelayout();
  voyageRevealExposed();
  voyagePersist();
  voyageHud();
  voyageUndoWindowHUD();
}

// A dead end with undos left is a warning: undo can still reach a live position. With none left,
// a position the solver proves unwinnable ends the run. See voyageStuckPlan in js/voyage/stuck.js.
function voyageDisarmStuck() {
  vy.stuckTok++;
  if (vy.stuckIdle) {
    clearTimeout(vy.stuckIdle);
    vy.stuckIdle = 0;
  }
}

function voyageClearStuckWarning() {
  if (!vy.stuckWarned) return;
  vy.stuckWarned = false;
  ui.clearStatus();
}

function voyageStuckBlocked() {
  return mode !== 'voyage' || won || !vy.boardLive || vy.settingUp || !vy.run || vy.run.status !== 'board'
    || !game || game.isWon() || busy || vy.effects?.using || vy.effects?.hasAvailableAbility() || game.override
    || (vy.run.current?.memo?._undoWindow && manualMoves() > 0);
}

function voyageWarnStuck(text) {
  vy.stuckWarned = true;
  setStatus(text, 'warn');
}

async function voyageProveStuck(tok, { settle = true } = {}) {
  if (settle) {
    await new Promise((r) => setTimeout(r, VOYAGE_STUCK_SETTLE_MS));
    if (tok !== vy.stuckTok || voyageStuckBlocked()) return;
  }
  let dead = false;
  try {
    const result = await requestSolve({ timeLimitMs: VOYAGE_STUCK_PROOF_MS, fullOnly: false });
    dead = result.solvable === false;
  } catch {
    dead = false;
  }
  if (tok !== vy.stuckTok || voyageStuckBlocked()) return;
  if (!dead) {
    voyageClearStuckWarning();
    return;
  }
  if (vy.run.undos > 0) {
    voyageWarnStuck('No way forward from here — undo, or abandon the board.');
    return;
  }
  const cancelled = vy.effects?.emit('stuck');
  if (vy.run?.status !== 'board') return; // Cliffhanger already entered the result flow.
  voyageRefresh();
  if (cancelled || tok !== vy.stuckTok || vy.run.undos > 0 || vy.effects?.hasAvailableAbility() || voyageStuckBlocked()) return;
  voyageLose('stuck');
}

async function voyageCheckStuck() {
  voyageDisarmStuck();
  const tok = vy.stuckTok;
  if (voyageStuckBlocked()) return;
  const moves = generateMoves(game.state, { rules: game.rules });
  const plan = voyageStuckPlan(moves, vy.run.undos);
  if (plan === 'warn') {
    voyageWarnStuck('No moves left — undo, or abandon the board.');
    return;
  }
  if (plan === 'lose') {
    const cancelled = vy.effects?.emit('stuck');
    if (vy.run?.status !== 'board') return; // Cliffhanger already entered the result flow.
    voyageRefresh();
    if (cancelled || tok !== vy.stuckTok || vy.run.undos > 0 || vy.effects?.hasAvailableAbility() || voyageStuckBlocked()) return;
    voyageLose('stuck');
    return;
  }
  if (plan === 'idle') {
    voyageClearStuckWarning();
    vy.stuckIdle = setTimeout(() => {
      vy.stuckIdle = 0;
      if (tok !== vy.stuckTok || voyageStuckBlocked()) return;
      voyageProveStuck(tok, { settle: false });
    }, VOYAGE_STUCK_IDLE_MS);
    return;
  }
  voyageProveStuck(tok);
}

function voyageLose(reason) {
  const r = vy.run;
  if (!r || r.status === 'lost') return;
  voyageDisarmStuck();
  voyageClearStuckWarning();
  loseRun(r, reason);
  recordRunEnd(r);
  saveRun(r);
  vy.boardLive = false;
  vy.effects = null;
  audio.invalid();
  voyageUI.showRunEnd(vyView());
  voyageRefreshTitle();
}

async function voyageAbandon() {
  const ok = await voyageUI.confirm({
    title: 'Abandon this board?',
    text: 'There are no restarts in a voyage. Abandoning the board ends the whole run.',
    ok: 'Abandon voyage',
    cancel: 'Keep playing',
  });
  if (ok) voyageLose('abandoned');
}

function voyageWin({ conceded = false } = {}) {
  const r = vy.run;
  if (!r || r.status !== 'board' || (conceded && r.current.idx >= VOYAGE.boards - 1)) return false;
  voyageDisarmStuck();
  voyageClearStuckWarning();
  const result = winBoard(r, game.history, vy.effects, { elapsed: run.elapsed, rules: game.rules, conceded });
  vy.effects?.emit('win', { result });
  recordBoardCleared(result);
  recordEconomy(r);
  if (r.status === 'won') recordRunEnd(r);
  saveRun(r);
  vy.boardLive = false;
  audio.win();
  audio.duck(8);
  post.pulse(1.2);
  if (!conceded) startCascade();
  setStatus(conceded ? 'Stepped out — to be continued' : r.status === 'won' ? 'The voyage is complete!' : `Board ${result.idx + 1} cleared — ${'★'.repeat(result.stars)}`, 'ok');
  voyageUI.setHud(vyView());
  setTimeout(() => {
    voyageUI.showResult(vyView());
    if (r.status === 'reward') voyageUI.tutorial('reward');
  }, conceded || settings.reducedMotion ? 300 : REVEAL.panelAt * 1000);
  voyagePrepareAhead();
  return true;
}

function voyagePickCharm(id) {
  if (vy.run?.status !== 'reward') return false;
  pickCharm(vy.run, id, { api: voyageRuntimeAPI() });
  recordCharmPick(id);
  recordEconomy(vy.run);
  saveRun(vy.run);
  vy.effects = null;
  if (vy.run.status === 'reward') {
    voyageUI.showResult(vyView());
    voyagePrepareAhead();
    return true;
  }
  voyageShowMap();
  return true;
}

function voyagePortShow() {
  if (vy.run?.status !== 'port') return;
  if (voyageUI.showPort) {
    voyageUI.showPort?.(vyView());
    voyagePrepareAhead();
  } else {
    // K2b may still be landing the port screen on the shared checkout.
    leavePort(vy.run);
    voyagePersist();
    voyageShowMap();
  }
}

function voyagePortAction(action, ...args) {
  if (vy.run?.status !== 'port') return false;
  const changed = action(vy.run, ...args);
  recordEconomy(vy.run);
  saveRun(vy.run);
  voyagePortShow();
  return changed;
}

function voyagePortLeave() {
  if (!vy.run || !leavePort(vy.run)) return false;
  voyagePersist();
  voyageShowMap();
  return true;
}

setBusyProbe(() => dealing || !!drag || motion.busy || animator.busy);

const voyageHandlers = {
  useAbility: async (id) => {
    if (mode !== 'voyage' || vy.run?.status !== 'board' || dealing || drag || busy || motion.busy || animator.busy) return;
    try { await vy.effects?.useAbility(id); }
    catch (error) { console.error('[voyage] ability', error); ui.toast('✦', 'Charm', error.message); }
    voyageRefresh(); voyageCheckStuck();
  },
  startVoyage: (o = {}) => voyageStart(o),
  continueVoyage: () => voyageContinue(),
  pickNode: (id) => voyagePickNode(id),
  pickCharm: (id) => voyagePickCharm(id),
  portBuyBoon: (id) => voyagePortAction(buyBoon, id, voyageRuntimeAPI()),
  portBuySticker: (offerIdx, cardId) => voyagePortAction(buySticker, offerIdx, cardId),
  portUpgrade: (id) => voyagePortAction(upgradeBoon, id),
  portBuyUndo: () => voyagePortAction(buyUndo),
  portSell: (id) => voyagePortAction(sellBoon, id),
  portReroll: () => voyagePortAction(rerollPort),
  portService: (serviceId, arg) => voyagePortAction(portService, serviceId, arg),
  portLeave: () => voyagePortLeave(),
  enterPort: () => {
    if (vy.run?.status !== 'port') return;
    voyageUI.hideMap();
    if (!ui.els.title.classList.contains('hidden')) ui.hideTitle();
    voyagePortShow();
  },
  continueToMap: () => voyageShowMap(),
  showRunEnd: () => {
    voyageUI.showRunEnd(vyView());
    voyageRefreshTitle();
  },
  abandonBoard: () => voyageAbandon(),
  openMap: () => {
    const view = vyView();
    for (const n of view.map.flat()) n.strength = boardPlan(vy.run, n.theme, { idx: n.row, nodeId: n.id }).strength;
    voyageUI.showMap(view);
  },
  toMenu: () => voyageToMenu(),
};

ui.handlers = {
  reframe: () => frameBoard(),
  click: () => {
    audio.unlock();
    audio.ui();
  },
  play: () => {
    if (mode === 'voyage') leaveVoyageMode();
    if (game && !won && !vy.boardLive) {
      audio.unlock();
      ui.hideTitle();
      return;
    }
    const sg = savedGame();
    if (sg) startGameFromTitle(sg.deal, { restore: sg, daily: sg.daily });
    else startGameFromTitle();
  },
  daily: () => {
    if (mode === 'voyage') leaveVoyageMode();
    return startGameFromTitle(dailyDealNumber(), { daily: true });
  },
  dealNumber: (n) => {
    if (n == null) return;
    if (mode === 'voyage') leaveVoyageMode();
    const onTitle = !ui.els.title.classList.contains('hidden');
    if (onTitle) startGameFromTitle(n);
    else newGame(n);
  },
  theme: (id) => {
    settings.autoRandomTheme = false;
    saveSettings();
    ui.syncThemeSelection();
    return switchTheme(id);
  },
  randomTheme: () => {
    settings.autoRandomTheme = true;
    saveSettings();
    ui.syncThemeSelection();
    return switchTheme(randomThemeId(currentTheme.id));
  },
  home: () => voyageToMenu(),
  restoreClassicTheme: () => restoreClassicTheme(),
  newGame: () => {
    if (mode === 'voyage') leaveVoyageMode();
    return newGame(randomDealNumber());
  },
  undo: doUndo,
  hint: () => mode === 'classic' && doHint(),
  check: () => mode === 'classic' && doCheck(),
  solve: () => mode === 'classic' && doSolve(),
  hasResume: () => (game && !won && !vy.boardLive && manualMoves() > 0) || !!savedGame(),
  statsOpened: () => voyageUI.renderStats(voyageStats),
  resetStats: () => {
    resetStats();
    resetVoyageStats();
    ui.renderStats();
    voyageUI.renderStats(voyageStats);
    voyageRefreshTitle();
    ui.toast('✓', 'Statistics reset', 'Fresh start.');
  },
  devMenuOpened: () => refreshDevPanel(),
  devSolve: () => doSolve({ dev: true }),
  devHint: () => doHint({ dev: true }),
  devAnalyze: () => devAnalyzePosition(),
  devResetBoard: () => devResetBoard(),
  settings: (k) => {
    audio.applyVolumes();
    if (k === 'autoRandomTheme') ui.syncThemeSelection();
    if (k === 'quality') {
      perf.downgraded = false;
      applyTier(settings.quality === 'auto' ? (isTouch ? 'medium' : 'high') : settings.quality);
    }
    if (k === 'autoFoundation') {
      if (settings.autoFoundation) scheduleAuto(200);
      else autoTok++;
    }
    if (k === 'fourColor' || k === 'highContrast') applyTheme(currentTheme.id);
    if (k === 'reducedMotion') motion.reduced = settings.reducedMotion;
  },
};

window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.code === 'Backquote' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    // The menu exists only on localhost, or with ?dev=1 plus the local dev opt-in.
    if (!document.getElementById('modal-dev')) return;
    e.preventDefault();
    if (!e.repeat) ui.toggleDevMenu();
    return;
  }
  if (!game || ui.modalOpen || !ui.els.title.classList.contains('hidden')) return;
  const k = e.key.toLowerCase();
  if (intro.active && (k === ' ' || k === 'enter' || k === 'escape')) {
    e.preventDefault();
    skipIntro();
    return;
  }
  if (fogContext() && !e.metaKey && !e.ctrlKey && !e.altKey) {
    if (k === 'escape') { cancelFogPointer(); endFogPeek(); fogInput.armed = false; return; }
    if (k === 'p') {
      e.preventDefault();
      if (!e.repeat) { fogInput.pDown = true; fogInput.armed = true; }
      return;
    }
    if (/^[1-8]$/.test(k) && (fogInput.pDown || fogInput.armed) && !e.shiftKey) {
      e.preventDefault();
      if (!e.repeat && !drag?.moved) {
        const col = Number(k) - 1;
        if (settings.tapToPeek || !fogInput.pDown) toggleFogPeek(col);
        else beginFogPeek(col, 'keyboard');
      }
      fogInput.armed = false;
      return;
    }
    fogInput.armed = false;
    cancelFogPointer(); endFogPeek();
  }
  if (k === 'u' || k === 'z') doUndo();
  if (k === 'h' && mode === 'classic') doHint();
  if (k === 'n' && mode === 'classic') newGame(randomDealNumber());
  if (k === 'm') document.getElementById('btn-mute').click();
  // Shift+1..8 drops the selected card into that column (e.key is the shifted
  // symbol, so match the physical key via e.code).
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  if (e.shiftKey && digit) {
    const col = parseInt(digit[1], 10) - 1;
    if (col < 8 && selection) commitMove(tryDrop(selection.from, { kind: 'col', index: col }));
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const rank = rankFromEvent(e);
  if (rank != null) {
    if (!e.repeat && rankForCode(e.code) != null) heldRankCodes.add(e.code);
    setRankHighlight(rank);
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key.toLowerCase() === 'p') {
    fogInput.pDown = false;
    if (fogInput.peek?.source === 'keyboard') endFogPeek();
  }
  if (fogInput.peek?.source === 'keyboard' && /^[1-8]$/.test(e.key)) endFogPeek();
  if (heldRankCodes.delete(e.code) || rankFromEvent(e) != null) syncHeldRankHighlight();
});
window.addEventListener('blur', clearHeldRankHighlight);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearHeldRankHighlight();
});
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applyResolution();
  frameBoard();
  coverBackground();
}
window.addEventListener('resize', onResize);

// ---------------------------------------------------------------------------
// Render loop with adaptive quality
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
let t = 0;
function adapt(raw) {
  perf.acc += raw;
  perf.frames++;
  if (perf.frames < 90) return;
  const avg = perf.acc / perf.frames;
  perf.fps = Math.round(1 / avg);
  perf.acc = 0;
  perf.frames = 0;
  ui.setPerfReadout(`${perf.tier} · ${perf.dpr.toFixed(2)}× · ${perf.fps} fps`);
  if (settings.quality !== 'auto' || avg < 0.026) return;
  const next = { ultra: 'high', high: 'medium', medium: 'low' }[perf.tier];
  if (!next) return;
  // Too slow: drop effects. Resolution stays at the display's native pixel ratio.
  perf.downgraded = true;
  applyTier(next);
}

function applyTier(tier) {
  perf.tier = tier;
  post.setQuality(tier);
  applyShadowQuality(tier);
}

// The shadow map only changes when a caster moves: a card, the table (it sweeps
// in during the intro) or the key light. Static frames reuse the last map, which
// skips a full depth pass over every card.
let shadowState = new Float64Array(0);
let shadowSpare = new Float64Array(0);
let shadowLayer = null;
function syncShadows() {
  const n = 9 * (cardGroups.size + 1) + 3;
  const prev = shadowState.length === n ? shadowState : null;
  const next = shadowSpare.length === n ? shadowSpare : new Float64Array(n);
  let i = 0;
  const put = (o) => {
    next[i++] = o.visible ? 1 : 0;
    next[i++] = o.position.x; next[i++] = o.position.y; next[i++] = o.position.z;
    next[i++] = o.quaternion.x; next[i++] = o.quaternion.y; next[i++] = o.quaternion.z; next[i++] = o.quaternion.w;
    next[i++] = o.scale.x;
  };
  put(tableGroup);
  for (const g of cardGroups.values()) put(g);
  next[i++] = key.position.x; next[i++] = key.position.y; next[i++] = key.position.z;
  let changed = !prev || layer !== shadowLayer;
  for (let j = 0; !changed && j < n; j++) changed = prev[j] !== next[j];
  shadowSpare = shadowState;
  shadowState = next;
  shadowLayer = layer;
  if (changed) renderer.shadowMap.needsUpdate = true;
}

function loop() {
  requestAnimationFrame(loop);
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  const tl = ui.els.title.classList;
  if (!tl.contains('hidden') && !tl.contains('leaving')) return; // title open: 3D view hidden
  t += dt;
  animator.update(dt);
  motion.update(dt);
  if (markTipAt && voyageUI.markTipVisible() && !drag) syncMarkTip(markTipAt.x, markTipAt.y, pickCardHit({ clientX: markTipAt.x, clientY: markTipAt.y }));
  updateDrag(dt);
  updateGlows(dt);
  particles.update(dt);
  pulses.update(dt);
  layer && layer.update(dt, t);
  updateCursorLight(dt);
  tickTimer();
  adapt(raw);
  for (const g of cardGroups.values()) if (g.visible) cullCardFaces(g, camera.position);
  syncShadows();
  if (perf.tier === 'low') renderer.render(scene, camera);
  else post.render(dt);
}

// ---------------------------------------------------------------------------
// Public API — solvability check
// ---------------------------------------------------------------------------
window.FreeCell = {
  isSolvable(options) {
    return requestSolve({ timeLimitMs: 8000, ...options }).then((r) => r.solvable);
  },
  solve(options) {
    return requestSolve({ timeLimitMs: 8000, ...options });
  },
  getState() {
    return cloneState(game.state);
  },
  getDealNumber() {
    return game.dealNumber;
  },
  async newGame(dealNumber) {
    ui.els.title.classList.contains('hidden') || ui.hideTitle();
    await newGame(dealNumber ?? randomDealNumber());
    return game.dealNumber;
  },
  undo() {
    return !won && game.undo();
  },
  isWon() {
    return game.isWon();
  },
  autoCheck() {
    return requestSolve({ timeLimitMs: 6000 });
  },
  // `topStrip` aims at the part of the card that stays visible when cards overlap in a column.
  projectCard(id, topStrip = false) {
    const g = cardGroups.get(id);
    if (!g) return null;
    const p = g.position.clone();
    if (topStrip) p.z += -CARD.H / 2 + ROW * 0.45;
    const v = p.project(camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  },
  projectSlot(kind, index) {
    const m = slotHitAreas.find((s) => s.userData.pile === kind && s.userData.index === index);
    if (!m) return null;
    const v = m.position.clone().project(camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  },
  perf,
  post,
  scene,
  audio,
  // Test helper: apply the first n solver moves in one go (n < 0 leaves |n| moves unplayed).
  async advance(n) {
    const r = await requestSolve({ timeLimitMs: 20000 });
    const sol = r.solution || [];
    let k;
    if (n === 'endgame') {
      // Stop where only foundation moves remain in the solution.
      k = sol.length;
      while (k > 0 && sol[k - 1].t === 'F') k--;
    } else {
      k = Math.max(0, Math.min(sol.length, n < 0 ? sol.length + n : n));
    }
    for (let i = 0; i < k; i++) game.applyDescriptor(sol[i]);
    afterMove();
    return { applied: k, total: sol.length, remaining: sol.length - k };
  },
  historyInfo() {
    const auto = game.history.filter((m) => m.auto).length;
    return { total: game.history.length, auto, manual: game.history.length - auto };
  },
  get busy() {
    return startingGame || motion.busy || animator.busy || dealing;
  },
  setTheme: (id) => switchTheme(id),
  stats,
  // Voyage test hooks.
  voyage: {
    get mode() {
      return mode;
    },
    run: () => vy.run,
    view: () => (vy.run ? runView(vy.run) : null),
    // The open ability target pick, if any: its kind, legal values and lit card ids.
    targeting: () => targeting && { kind: targeting.kind, values: targeting.values.slice(), lit: Object.fromEntries(targeting.lit), chosen: [...targetChosenIds] },
    pickTarget(value) {
      if (!targeting?.values.includes(value)) return false;
      endTargeting(value);
      return true;
    },
    // Use the dealer's complete variant search in Voyage tests; classic pruning
    // can miss the partial runs a restricted board needs.
    async advance(n) {
      const r = await requestSolve({ timeLimitMs: 20000, fullOnly: false, maxDepth: 320 });
      const solution = r.solution || [];
      const count = Math.max(0, Math.min(solution.length, n < 0 ? solution.length + n : n));
      for (const m of solution.slice(0, count)) game.applyDescriptor(m);
      afterMove();
      return { applied: count, total: solution.length, remaining: solution.length - count };
    },
    // Play the current board to the end with the solver (tests only).
    async finish() {
      const r = await requestSolve({ timeLimitMs: 20000, fullOnly: false, maxDepth: 320 });
      for (const m of r.solution || []) game.applyDescriptor(m);
      afterMove();
      return !!r.solution;
    },
  },
};

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  ui.init();
  voyageUI.init(voyageHandlers);
  voyageUI.renderStats(voyageStats);
  motion.reduced = settings.reducedMotion;
  applyResolution();
  applyTier(perf.tier);

  ui.setLoading(0.04, 'Loading the table…');
  audio.theme = currentTheme.id;
  audio.unlock(); // creates a suspended context so buffers can be decoded
  await Promise.all([
    applyTheme(currentTheme.id, { css: false }).then(() => ui.setLoading(0.55, 'Tuning the sound…')),
    audio.preload(SHARED_SOUNDS, (p) => ui.setLoading(0.55 + p * 0.4)),
  ]);
  ui.setLoading(0.97, 'Shuffling…');

  onResize();
  // Draw one frame behind the loader. The loop skips rendering while the title
  // is up, so otherwise the post-processing passes and the shadow pass would
  // compile on the first frame of the first deal.
  syncShadows();
  if (perf.tier === 'low') renderer.render(scene, camera);
  else post.render(0);
  ui.applyThemeCss(currentTheme);
  ui.showTitle();
  voyageRefreshTitle();
  loop();
  ui.setLoading(1, 'Ready');
  setTimeout(() => ui.hideLoader(), 250);
}

boot().catch((err) => {
  console.error(err);
  ui.setLoading(1, 'Something went wrong — see console');
});

// Service worker (offline / installable).
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
