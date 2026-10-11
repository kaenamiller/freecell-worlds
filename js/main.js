import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Game, cloneState, generateMoves, canStackOn, sequenceStart, randomDealNumber, safeFoundationMoves, legalFoundationMoves, canFinishWithFoundationOnly } from './rules.js';
import { buildCardMesh, applyCardStyle, CARD } from './card.js';
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
import { createRun, loadRun, saveRun, runView, boardPlan, upcomingPlans, startBoard, spendUndo, winBoard, pickCharm, loseRun } from './voyage/run.js';
import { BoardEffects } from './voyage/charms.js';
import { findNode } from './voyage/map.js';
import { scoreBoard, starsFor, starThresholds } from './voyage/scoring.js';
import { loadBank, prepare as prepareDeals, dealFor, setBusyProbe } from './voyage/dealer.js';
import { voyageStats, recordRunStart, recordRunEnd, recordBoardCleared, recordCharmPick, resetVoyageStats } from './voyage/stats.js';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const COL = 1.0;
const ROW = 0.34;
const FREE_Z = -2.75;
const TABLEAU_Z = -1.15;
const SURFACE_Y = 0.0; // playing surface; card bottoms rest here
const colX = (i) => (i - 3.5) * COL;
// The top row holds the free cells and the four foundations. Classic FreeCell has 4 cells, so the
// row lines up with the columns. Voyage charms can change the count (1..6): with fewer, the
// missing cells are simply absent; with more, the whole row is re-spaced to fit the table.
let freeCellCount = 4;
const topSpacing = () => (freeCellCount <= 4 ? COL : Math.min(COL, 9 / (freeCellCount + 3)));
const topX = (j) => (freeCellCount <= 4 ? (j - 3.5) * COL : (j - (freeCellCount + 3) / 2) * topSpacing());
const freeX = (i) => topX(i);
const foundX = (i) => topX(Math.max(4, freeCellCount) + i);
const LAYOUT = { surf: { w: 10.9, h: 6.6, cz: -0.8 }, SURFACE_Y, FREE_Z, TABLEAU_Z, colX, freeX, foundX, get freeCells() { return freeCellCount; } };

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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0605);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);

// Rendering quality tiers + adaptive resolution.
const perf = {
  tier: settings.quality === 'auto' ? (isTouch ? 'medium' : 'high') : settings.quality,
  maxDpr: 2,
  dpr: 1,
  acc: 0,
  frames: 0,
  fps: 60,
  downgraded: false,
};
const tierDpr = { ultra: 2, high: 2, medium: 1.5, low: 1 };
function setDpr(v) {
  perf.dpr = Math.min(window.devicePixelRatio || 1, v);
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
  camera.updateProjectionMatrix();
}
frameBoard();

// ---------------------------------------------------------------------------
// Lighting (colours / intensities are set per theme)
// ---------------------------------------------------------------------------
const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.6);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 2);
key.castShadow = true;
key.shadow.mapSize.set(perf.tier === 'low' ? 1024 : 2048, perf.tier === 'low' ? 1024 : 2048);
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
for (let i = 0; i < 4; i++) makeGlow('found', i);
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
  for (let f = 0; f < 4; f++) targets.push({ kind: 'found', index: f });
  for (const t of targets) {
    const g = glows.get(`${t.kind}${t.index}`);
    let ok = !!tryDrop(from, t);
    if (ok && t.kind === 'found' && lead != null) ok = ids.length === 1 && (((lead - 1) / 13) | 0) === t.index;
    if (ok && t.kind === 'col') {
      const len = game.tableau[t.index].length;
      g.position.set(colX(t.index), SURFACE_Y + 0.012 + len * CARD.D, TABLEAU_Z + len * ROW);
    } else if (ok) {
      g.position.set(t.kind === 'free' ? freeX(t.index) : foundX(t.index), SURFACE_Y + 0.012, FREE_Z);
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

function coverBackground() {
  const t = scene.background;
  if (!t || !t.isTexture || !t.image) return;
  const imgA = t.image.width / t.image.height;
  const viewA = window.innerWidth / window.innerHeight;
  t.repeat.set(1, 1);
  t.offset.set(0, 0);
  if (viewA > imgA) {
    t.repeat.y = imgA / viewA;
    t.offset.y = (1 - t.repeat.y) / 2;
  } else {
    t.repeat.x = viewA / imgA;
    t.offset.x = (1 - t.repeat.x) / 2;
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
  if (layer) rebuildTableLayer();
}

async function applyTheme(id) {
  const theme = THEMES[id];
  const art = await loadThemeAssets(theme);
  currentTheme = theme;
  currentArt = art;
  settings.theme = id;
  saveSettings();

  ui.applyThemeCss(theme);
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
  if (scene.background && scene.background.isTexture) scene.background.dispose();
  if (art.backdrop) {
    const bg = new THREE.Texture(art.backdrop);
    bg.colorSpace = THREE.SRGBColorSpace;
    bg.needsUpdate = true;
    scene.background = bg;
    scene.backgroundIntensity = 0.9;
    coverBackground();
  } else {
    scene.background = new THREE.Color(theme.scene.clear);
  }

  for (const g of cardGroups.values()) applyCardStyle(g, theme.card);
  if (highlightRank != null) for (const id of highlightedIds) refreshCardEmissive(id);
  updateScales();
  audio.setTheme(id);
}

async function switchTheme(id) {
  if (id === currentTheme.id && currentArt) return;
  audio.ui();
  const onTitle = !ui.els.title.classList.contains('hidden');
  if (onTitle) await applyTheme(id);
  else await ui.transition(() => applyTheme(id));
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
  if (!dealing) audio.flip(panOf(g.position.x));
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

function computeTargets() {
  const t = new Map();
  const st = game.state;
  for (let c = 0; c < 8; c++) {
    const col = st.tableau[c];
    for (let i = 0; i < col.length; i++) {
      t.set(col[i], { x: colX(c), y: SURFACE_Y + CARD.D / 2 + i * CARD.D, z: TABLEAU_Z + i * ROW, kind: 'col' });
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
  return t;
}

function targetsEqual(a, b) {
  return a && b && Math.abs(a.x - b.x) < 1e-4 && Math.abs(a.y - b.y) < 1e-4 && Math.abs(a.z - b.z) < 1e-4;
}

function applyLayout(_animate = true, opts = {}) {
  const targets = computeTargets();
  if (opts.deal) {
    const offset = opts.delayOffset || 0;
    const delays = new Map();
    let order = 0;
    for (let i = 0; i < 20; i++) {
      for (let c = 0; c < 8; c++) {
        const id = game.state.tableau[c][i];
        if (id !== undefined) delays.set(id, order++ * 0.016);
      }
    }
    for (const [id, tg] of targets) {
      const g = cardGroups.get(id);
      if (!g) continue;
      g.userData.dest = tg.kind;
      if (!delays.has(id)) delays.set(id, order++ * 0.016);
      moveCard(g, tg, {
        delay: offset + delays.get(id),
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
    const dist = Math.hypot(g.position.x - tg.x, g.position.z - tg.z);
    if (dist > 2.2 && !dealing) audio.slide(panOf(g.position.x));
    moveCard(g, tg, { arc: 0.4 + Math.min(0.5, dist * 0.08), stiffness: dist > 3 ? 160 : 190, trail: tg.kind === 'found' });
  }
}

// The board flips down into place; cards are dealt once it has largely landed.
const DEAL_DELAY = 0.58;
function playBoardIntro() {
  const reduced = settings.reducedMotion;
  const start = reduced ? { rx: 0, rz: 0, y: 0, s: 1 } : { rx: -1.25, rz: 0.12, y: -0.6, s: 0.8 };
  const apply = (p) => {
    tableGroup.rotation.x = start.rx * (1 - p);
    tableGroup.rotation.z = start.rz * (1 - p);
    tableGroup.position.y = start.y * (1 - p);
    tableGroup.scale.setScalar(start.s + (1 - start.s) * p);
  };
  apply(0);
  animator.add({
    duration: reduced ? 0.01 : 0.72,
    ease: Easing.backOut,
    onUpdate: (e) => apply(e),
    onComplete: () => {
      tableGroup.rotation.set(0, 0, 0);
      tableGroup.position.y = 0;
      tableGroup.scale.setScalar(1);
    },
  });
  animator.add({
    duration: 0.02,
    delay: reduced ? 0 : DEAL_DELAY,
    onUpdate: () => {
      for (const g of cardGroups.values()) g.visible = true;
    },
  });
}

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
    if (loc.cardIndex < sequenceStart(col)) return null;
    return col.slice(loc.cardIndex);
  }
  if (loc.kind === 'free') return [game.free[loc.index]];
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
  if (target.kind === 'col') {
    if (from.kind === 'col') {
      const col = game.tableau[from.index];
      if (from.cardIndex < sequenceStart(col)) return null;
      const count = col.length - from.cardIndex;
      const card = col[from.cardIndex];
      if (!game.canDropTableau(target.index, card, count)) return null;
      return () => game.moveSequenceToTableau(from.index, from.cardIndex, target.index);
    }
    if (from.kind === 'free') {
      const card = game.free[from.index];
      if (!card || !canStackOn(game.tableau[target.index], card)) return null;
      return () => game.moveFreeToTableau(from.index, target.index);
    }
    return null;
  }
  if (target.kind === 'free') {
    if (from.kind !== 'col') return null;
    const col = game.tableau[from.index];
    if (from.cardIndex !== col.length - 1) return null;
    if (game.free[target.index] !== 0) return null;
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
    if (!card || !game.canDropFoundation(card)) return null;
    return () => game.moveToFoundation(src);
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
  if (!noAuto) scheduleAuto();
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
  let mv = safeFoundationMoves(game.state).find((m) => !held.has(m.card));
  // No individually safe card? If foundation moves alone can still clear the table, the win is
  // guaranteed, so play it out (this is what finishes cross-blocked endgames).
  if (!mv && canFinishWithFoundationOnly(game.state)) mv = legalFoundationMoves(game.state).find((m) => !held.has(m.card));
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
  fn();
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
    const fi = game.free.indexOf(0);
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

function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}

function pickCard(e) {
  setPointer(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  for (const h of hits) {
    const g = cardGroups.get(h.object.userData.cardId);
    if (g && g.visible) return h.object.userData.cardId;
  }
  return null;
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

// Single writer for a card's emissive state: rank highlight beats hover beats
// the theme baseline, so the two effects never stomp on each other.
function refreshCardEmissive(cid) {
  const g = cardGroups.get(cid);
  if (!g) return;
  const m = g.userData.frontMat;
  const base = currentTheme.card.emissive;
  if (highlightedIds.has(cid)) {
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

function setRankHighlight(rank) {
  if (rank === highlightRank) return;
  if (highlightRank != null) {
    for (const id of highlightedIds) refreshCardEmissive(id);
    highlightedIds.clear();
  }
  highlightRank = rank;
  if (rank != null) {
    for (const id of cardGroups.keys()) {
      if ((((id - 1) % 13) + 1) === rank) highlightedIds.add(id);
    }
    for (const id of highlightedIds) refreshCardEmissive(id);
  }
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

function setHover(id) {
  if (id === hoverId) return;
  const prev = hoverId;
  hoverId = id;
  if (prev != null) refreshCardEmissive(prev);
  if (id != null) refreshCardEmissive(id);
}

function updateHover(e) {
  if (drag || e.target !== canvas || e.pointerType === 'touch' || !game) return;
  const id = pickCard(e);
  let movable = null;
  if (id != null) {
    const loc = locateCard(id);
    if (loc && movableCards(loc)) movable = id;
  }
  setHover(movable);
  canvas.style.cursor = movable != null ? 'grab' : 'default';
}

function onPointerDown(e) {
  audio.unlock();
  if (e.target !== canvas || e.button === 2 || !game || won) return;
  const id = pickCard(e);
  if (id == null) return;
  const loc = locateCard(id);
  const ids = loc && movableCards(loc);
  if (!ids || !ids.length) {
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
  updateHover(e);
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6) {
    drag.moved = true;
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
canvas.addEventListener('dblclick', (e) => {
  if (!game || won) return;
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

function requestSolve(options = {}) {
  const id = ++solveSeq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, state: cloneState(game.state), options });
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
  const total = st.found[0] + st.found[1] + st.found[2] + st.found[3];
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

async function doHint() {
  if (busy || !game || won) return;
  busy = true;
  ui.setSolverBusy(true);
  setStatus('Looking for a good move…', 'warn');
  try {
    const r = await requestSolve({ timeLimitMs: 3000 });
    let move = null;
    if (r.solution && r.solution.length) move = r.solution[0];
    else {
      const moves = generateMoves(game.state, { fullOnly: true }).sort((a, b) => b.score - a.score);
      move = moves[0] || null;
    }
    if (!move) {
      setStatus('No moves available.', 'bad');
      audio.invalid();
    } else {
      run.hints++;
      audio.hint();
      game.applyDescriptor(move);
      clearSelection();
      afterMove();
      setStatus('Hint played.', 'ok');
    }
  } catch (err) {
    setStatus('Solver error: ' + err.message, 'bad');
  } finally {
    busy = false;
    ui.setSolverBusy(false);
  }
}

let autoplay = { running: false };
async function doSolve() {
  if (autoplay.running) return stopSolve();
  if (busy || !game || won) return;
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
  if (!game.isWon()) setStatus('Solution playback stopped.', 'warn');
}

function stopSolve() {
  autoplay.running = false;
}

// ---------------------------------------------------------------------------
// New game / win
// ---------------------------------------------------------------------------
function disposeCard(g) {
  scene.remove(g);
  g.userData.frontMat && g.userData.frontMat.dispose();
  g.userData.backMat && g.userData.backMat.dispose();
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
  setFreeCellCount(opts.freeCells ?? 4);
  autoTok++; // cancel any pending auto-play from the previous deal
  cancelCascade();
  animator.clear();
  motion.clear();
  stopSolve();
  hideValidTargets();
  setHover(null);
  setRankHighlight(null);
  for (const g of cardGroups.values()) disposeCard(g);
  cardGroups.clear();
  pickables.length = 0;
  ui.hideWin();
  selection = null;
  won = false;
  isDaily = !!opts.daily;
  game = new Game(dealNumber, { freeCells: freeCellCount });
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

  let k = 0;
  for (let i = 1; i <= 52; i++) {
    const g = buildCardMesh(i, currentTheme.card);
    g.position.set((k % 5) * 0.02 - 0.04, 0.5 + k * 0.016, -0.2);
    g.rotation.x = Math.PI;
    g.userData.target = null;
    g.visible = false;
    scene.add(g);
    cardGroups.set(i, g);
    pickables.push(g.userData.front);
    k++;
  }

  // Deal sequence with sound.
  dealing = true;
  const reduced = settings.reducedMotion;
  audio.shuffle();
  playBoardIntro();
  applyLayout(true, { deal: true, delayOffset: reduced ? 0 : DEAL_DELAY });
  if (!reduced) {
    for (let i = 0; i < 52; i += 2) audio.deal(((i % 8) - 3.5) / 5, DEAL_DELAY + i * 0.016 * 1.0);
  }
  setTimeout(() => {
    dealing = false;
  }, (reduced ? 600 : 1900));
  updateHUD();
  scheduleAuto(reduced ? 800 : 2400);
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
  spawnConfetti();
  setStatus('Victory!', 'ok');
  ui.refreshDaily();
  setTimeout(() => {
    if (!won) return;
    ui.showWin({ time: run.elapsed, moves: manualMoves(), bests: result, daily: isDaily, assisted: run.solved });
    result.unlocked.forEach((a, i) => setTimeout(() => ui.toast(a.icon, 'Achievement unlocked', `${a.name} — ${a.desc}`), 900 + i * 900));
  }, settings.reducedMotion ? 300 : 2600);
}

// ---------------------------------------------------------------------------
// Win cascade: foundations launch cards that bounce across the table, trailing sparks.
// ---------------------------------------------------------------------------
let cascade = null;
function startCascade() {
  if (settings.reducedMotion) return;
  const order = [];
  for (let r = 13; r >= 1; r--) for (let s = 0; s < 4; s++) order.push(s * 13 + r);
  cascade = { order, i: 0, t: 0, live: [] };
}
function cancelCascade() {
  cascade = null;
  for (const m of confetti) {
    scene.remove(m);
    m.material.dispose();
  }
  confetti.length = 0;
}
function updateCascade(dt) {
  if (!cascade) return;
  cascade.t += dt;
  while (cascade.i < cascade.order.length && cascade.t > 0.5 + cascade.i * 0.2) {
    const id = cascade.order[cascade.i++];
    const g = cardGroups.get(id);
    if (!g) continue;
    motion.release(g);
    g.userData.cascade = {
      vx: (Math.random() < 0.5 ? -1 : 1) * (1.4 + Math.random() * 3.6),
      vy: 3.5 + Math.random() * 3.5,
      vz: (Math.random() - 0.3) * 2.2,
      sy: (Math.random() - 0.5) * 3,
      sz: (Math.random() - 0.5) * 2,
    };
    audio.flip(panOf(g.position.x));
  }
  for (let i = 0; i < cascade.i; i++) {
    const g = cardGroups.get(cascade.order[i]);
    const c = g && g.userData.cascade;
    if (!c || c.done) continue;
    c.vy -= 15 * dt;
    g.position.x += c.vx * dt;
    g.position.y += c.vy * dt;
    g.position.z += c.vz * dt;
    g.rotation.y += c.sy * dt;
    g.rotation.z += c.sz * dt * 0.4;
    if (g.position.y < 0.05) {
      g.position.y = 0.05;
      if (Math.abs(c.vy) > 2.2) audio.place(panOf(g.position.x), 3);
      c.vy = -c.vy * 0.78;
    }
    particles.emit({
      x: g.position.x,
      y: g.position.y,
      z: g.position.z,
      color: currentTheme.fx.spark,
      count: 2,
      speed: 0.3,
      size: 0.09,
      life: 0.7,
      drag: 2,
      jitter: 0.5,
    });
    if (Math.abs(g.position.x) > 10 || g.position.z > 8) {
      c.done = true;
      g.visible = false;
    }
  }
}

// Confetti (win burst).
const confetti = [];
const confettiGeo = new THREE.PlaneGeometry(0.12, 0.12);
let confettiActive = 0;
function spawnConfetti() {
  if (settings.reducedMotion) return;
  const colors = currentTheme.confetti;
  for (let i = 0; i < 160; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: colors[(Math.random() * colors.length) | 0], side: THREE.DoubleSide });
    const m = new THREE.Mesh(confettiGeo, mat);
    m.position.set((Math.random() - 0.5) * 8, 6 + Math.random() * 4, (Math.random() - 0.5) * 5);
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 1.5, -1.5 - Math.random() * 2, (Math.random() - 0.5) * 1.5);
    m.userData.spin = new THREE.Vector3(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
    scene.add(m);
    confetti.push(m);
  }
  confettiActive = 8;
}
function updateConfetti(dt) {
  if (!confetti.length) return;
  if (confettiActive > 0) confettiActive -= dt;
  for (let i = confetti.length - 1; i >= 0; i--) {
    const m = confetti[i];
    m.userData.v.y -= 4 * dt;
    m.position.addScaledVector(m.userData.v, dt);
    m.rotation.x += m.userData.spin.x * dt;
    m.rotation.y += m.userData.spin.y * dt;
    if (m.position.y < 0.2 || confettiActive <= 0) {
      scene.remove(m);
      m.material.dispose();
      confetti.splice(i, 1);
    }
  }
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
  if (autoplay.running) stopSolve();
  if (manualMoves() === 0) return audio.invalid();
  if (mode === 'voyage') {
    if (won || !vy.run || vy.run.status !== 'board') return audio.invalid();
    if (vy.run.undos <= 0) {
      setStatus('No undos left on this voyage.', 'bad');
      return audio.invalid();
    }
  }
  autoTok++; // cancel a pending auto-play chain
  if (won) {
    // Reverting a win: restore the table.
    won = false;
    cancelCascade();
    for (const g of cardGroups.values()) {
      g.visible = true;
      g.userData.cascade = null;
      g.userData.target = null;
      g.rotation.set(0, 0, 0);
    }
  }
  // Take back the auto-plays first, then the player's move that triggered them.
  let undone = false;
  while (game.history.length && game.history[game.history.length - 1].auto) {
    game.undo();
    undone = true;
  }
  if (game.undo()) undone = true;
  if (undone) {
    run.undos++;
    if (mode === 'voyage') voyageUndone();
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
  stuckTok: 0,
};

const vyView = () => runView(vy.run);
const vyUsedDeals = () => vy.run.results.map((r) => r.deal);

function enterVoyageMode() {
  mode = 'voyage';
  voyageUI.setMode('voyage');
}

// Back to classic: the Voyage run stays saved and can be continued from the title screen.
function leaveVoyageMode() {
  if (mode !== 'voyage') return;
  voyagePersist();
  mode = 'classic';
  vy.effects = null;
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
}

function voyagePersist() {
  const r = vy.run;
  if (!r) return;
  if (r.status === 'board' && r.current && game && vy.boardLive) {
    r.current.history = game.history.map((m) => ({ ...m }));
    r.current.elapsed = run.elapsed;
  }
  saveRun(r);
}

// Warm the art and sound of every table the player could visit next, and let the dealer pick
// (and if needed verify) their deals in the background.
function voyagePrepareAhead() {
  const r = vy.run;
  if (!r) return;
  const plans = upcomingPlans(r);
  const idx = r.status === 'map' ? r.results.length : r.results.length + (r.status === 'board' ? 1 : 0);
  const exclude = vyUsedDeals().concat(r.current ? [r.current.deal] : []);
  prepareDeals(plans.map((p) => ({ ...p, idx: p.idx ?? idx })), { seed: r.seed, exclude }).catch((e) => console.warn('[voyage] prepare', e));
  for (const t of new Set(plans.map((p) => p.theme))) {
    loadThemeAssets(THEMES[t]);
    audio.preloadTheme(t);
  }
}

function voyageShowMap() {
  voyageUI.showMap(vyView());
  voyageUI.tutorial('map');
  voyagePrepareAhead();
}

async function voyageStart({ daily = false } = {}) {
  audio.unlock();
  const saved = vy.run && ['map', 'board', 'reward'].includes(vy.run.status) ? vy.run : loadRun();
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
  const r = vy.run && ['map', 'board', 'reward'].includes(vy.run.status) ? vy.run : loadRun();
  if (!r) return voyageStart({});
  vy.run = r;
  enterVoyageMode();
  await loadBank();
  if (r.status === 'map') return voyageShowMap();
  if (r.status === 'reward') {
    ui.hideTitle();
    return voyageUI.showResult(vyView());
  }
  // A board in progress: resume it (or bring the table back if it is already live).
  if (vy.boardLive && game && game.dealNumber === r.current.deal && vy.effects) {
    ui.hideTitle();
    voyageHud();
    return;
  }
  ui.hideTitle();
  await switchTheme(r.current.theme);
  voyageDealBoard({ restore: { moves: r.current.history || [], elapsed: r.current.elapsed || 0, undos: 0, hints: 0, counted: true } });
}

async function voyagePickNode(nodeId) {
  const r = vy.run;
  if (!r || r.status !== 'map') return;
  const node = findNode(r.map, nodeId);
  if (!node) return;
  voyageUI.setPreparing(true);
  let pick;
  try {
    pick = await dealFor({ ...boardPlan(r, node.theme) }, { seed: r.seed, exclude: vyUsedDeals() });
  } finally {
    voyageUI.setPreparing(false);
  }
  startBoard(r, nodeId, pick);
  saveRun(r);
  voyageUI.hideMap();
  if (!ui.els.title.classList.contains('hidden')) ui.hideTitle();
  await switchTheme(r.current.theme);
  voyageDealBoard();
  await voyageUI.showBoardIntro(vyView());
  voyageUI.tutorial('board');
}

// Deal run.current onto the table with its charms active.
function voyageDealBoard({ restore = null } = {}) {
  const cur = vy.run.current;
  vy.effects = new BoardEffects(cur.active, {
    seed: vy.run.seed,
    boardIndex: cur.idx,
    memo: (cur.memo ??= {}),
    api: {
      addUndos: (n) => {
        vy.run.undos += n;
        voyageHud();
      },
      notify: (text) => ui.toast('✦', 'Charm', text, 2600),
    },
  });
  const label = `Board ${cur.idx + 1} of 7 — ${THEMES[cur.theme].name}`;
  dealGame(cur.deal, { freeCells: cur.rules.freeCells, restore, voyage: restore ? `Welcome back — ${label}.` : `${label}. Par ${cur.par} moves.` });
  vy.seen = game.history.length;
  vy.emptyCols = new Set(game.tableau.map((c, i) => (c.length ? -1 : i)).filter((i) => i >= 0));
  vy.effects.setup({ state: game.state, deal: cur.deal });
  if (!restore) vy.effects.emit('start', {});
  voyageHud();
  voyagePrepareAhead();
}

function voyageLiveScore() {
  const cur = vy.run?.current;
  if (!cur || !game) return;
  const sb = scoreBoard(game.history, cur.par, vy.effects);
  voyageUI.setLiveScore({ total: sb.total, stars: starsFor(sb.total, cur.par), thresholds: starThresholds(cur.par) });
}

function voyageHud() {
  if (!vy.run) return;
  voyageUI.setHud(vyView());
  voyageLiveScore();
}

// Report new history entries to the charm hooks, update the HUD and watch for a dead end.
function voyageAfterMove() {
  const fx = vy.effects;
  if (!fx || !vy.boardLive || !vy.run || vy.run.status !== 'board') return;
  const h = game.history;
  for (let i = vy.seen; i < h.length; i++) {
    const m = h[i];
    fx.emit('move', { move: m, manual: !m.auto });
    if (m.t === 'F') fx.emit('foundation', { card: m.card, auto: !!m.auto });
    if (m.t === 'C') fx.emit('freecell', { card: m.card });
  }
  vy.seen = h.length;
  const empty = new Set();
  game.tableau.forEach((c, i) => c.length === 0 && empty.add(i));
  for (const i of empty) if (!vy.emptyCols.has(i)) fx.emit('columnEmpty', { col: i });
  vy.emptyCols = empty;
  voyageHud();
  voyageCheckStuck();
}

function voyageUndone() {
  spendUndo(vy.run);
  vy.seen = game.history.length;
  vy.emptyCols = new Set(game.tableau.map((c, i) => (c.length ? -1 : i)).filter((i) => i >= 0));
  vy.effects?.emit('undo', {});
  voyagePersist();
  voyageHud();
}

// With undos left the player can always back out, so we only say when no move exists at all.
// With none left, a position the solver proves unwinnable ends the run.
async function voyageCheckStuck() {
  const tok = ++vy.stuckTok;
  if (won || !game || game.isWon()) return;
  const noMoves = generateMoves(game.state).length === 0;
  if (vy.run.undos > 0) {
    if (noMoves) setStatus('No moves left — undo, or abandon the board.', 'warn');
    return;
  }
  let dead = noMoves;
  if (!dead) {
    await new Promise((r) => setTimeout(r, 900)); // let auto-play settle first
    if (tok !== vy.stuckTok || won) return;
    try {
      const r = await requestSolve({ timeLimitMs: 5000, fullOnly: false });
      dead = r.solvable === false;
    } catch {
      dead = false;
    }
  }
  if (!dead || tok !== vy.stuckTok || won || mode !== 'voyage') return;
  voyageLose('stuck');
}

function voyageLose(reason) {
  const r = vy.run;
  if (!r || r.status === 'lost') return;
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

function voyageWin() {
  const r = vy.run;
  const result = winBoard(r, game.history, vy.effects, { elapsed: run.elapsed });
  vy.effects?.emit('win', { result });
  recordBoardCleared(result);
  if (r.status === 'won') recordRunEnd(r);
  saveRun(r);
  vy.boardLive = false;
  audio.win();
  audio.duck(8);
  post.pulse(1.2);
  startCascade();
  spawnConfetti();
  setStatus(r.status === 'won' ? 'The voyage is complete!' : `Board ${result.idx + 1} cleared — ${'★'.repeat(result.stars)}`, 'ok');
  voyageUI.setHud(vyView());
  setTimeout(() => {
    voyageUI.showResult(vyView());
    if (r.status === 'reward') voyageUI.tutorial('reward');
  }, settings.reducedMotion ? 300 : 2400);
  voyagePrepareAhead();
}

function voyagePickCharm(id) {
  pickCharm(vy.run, id);
  recordCharmPick(id);
  saveRun(vy.run);
  voyageShowMap();
}

setBusyProbe(() => dealing || !!drag || motion.busy || animator.busy);

const voyageHandlers = {
  startVoyage: (o = {}) => voyageStart(o),
  continueVoyage: () => voyageContinue(),
  pickNode: (id) => voyagePickNode(id),
  pickCharm: (id) => voyagePickCharm(id),
  continueToMap: () => voyageShowMap(),
  showRunEnd: () => {
    voyageUI.showRunEnd(vyView());
    voyageRefreshTitle();
  },
  abandonBoard: () => voyageAbandon(),
  openMap: () => voyageUI.showMap(vyView()),
  toMenu: () => voyageToMenu(),
};

ui.handlers = {
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
  settings: (k) => {
    audio.applyVolumes();
    if (k === 'autoRandomTheme') ui.syncThemeSelection();
    if (k === 'quality') {
      perf.downgraded = false;
      perf.tier = settings.quality === 'auto' ? (isTouch ? 'medium' : 'high') : settings.quality;
      post.setQuality(perf.tier);
      setDpr(tierDpr[perf.tier]);
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
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (!game || ui.modalOpen || !ui.els.title.classList.contains('hidden')) return;
  const k = e.key.toLowerCase();
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
  const rank = rankForHeldKey(k);
  if (rank != null) setRankHighlight(rank);
});
window.addEventListener('keyup', (e) => {
  if (rankForHeldKey(e.key.toLowerCase()) != null) setRankHighlight(null);
});
window.addEventListener('blur', () => setRankHighlight(null));
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.resize(window.innerWidth, window.innerHeight, perf.dpr);
  frameBoard();
  coverBackground();
  updateScales();
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
  // Too slow: lower resolution first, then drop post-processing tiers.
  perf.downgraded = true;
  if (perf.dpr > 1.1) {
    setDpr(Math.max(1, perf.dpr - 0.4));
  } else if (perf.tier === 'ultra') {
    perf.tier = 'high';
    post.setQuality('high');
  } else if (perf.tier === 'high') {
    perf.tier = 'medium';
    post.setQuality('medium');
  } else if (perf.tier === 'medium') {
    perf.tier = 'low';
    post.setQuality('low');
  }
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
  updateDrag(dt);
  updateCascade(dt);
  updateConfetti(dt);
  updateGlows(dt);
  particles.update(dt);
  pulses.update(dt);
  layer && layer.update(dt, t);
  updateCursorLight(dt);
  tickTimer();
  adapt(raw);
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
    return game.undo();
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
    // Play the current board to the end with the solver (tests only).
    async finish() {
      const r = await requestSolve({ timeLimitMs: 20000 });
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
  setDpr(Math.min(tierDpr[perf.tier], window.devicePixelRatio || 1));
  post.setQuality(perf.tier);

  ui.setLoading(0.04, 'Loading the table…');
  audio.theme = currentTheme.id;
  audio.unlock(); // creates a suspended context so buffers can be decoded
  await Promise.all([
    applyTheme(currentTheme.id).then(() => ui.setLoading(0.55, 'Tuning the sound…')),
    audio.preload(SHARED_SOUNDS, (p) => ui.setLoading(0.55 + p * 0.4)),
  ]);
  ui.setLoading(0.97, 'Shuffling…');
  // Warm up shaders so the first deal doesn't hitch.
  renderer.compile(scene, camera);

  onResize();
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
