// Builds the themed table layer: base, board surface, rails, inlays, slot
// outlines, accent lights and ambient effects. Returned object can be disposed
// and rebuilt when the theme changes.
import * as THREE from 'three';
import { surfaceTextures, slotTexture, freeCellTexture, foundationTexture, radialTexture } from './textures.js';
import { makePointMaterial, makeShapeMaterial } from './fx.js';
import { CARD } from './card.js';
import { activeFreeCells, cellIsClosed, cardsHome, rulesForState, suitHomeCount, foundationTop } from './rules.js';

const BUBBLE_FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;
    float rim = smoothstep(0.62, 0.95, d) * smoothstep(1.0, 0.92, d);
    float body = (1.0 - smoothstep(0.0, 1.0, d)) * 0.10;
    vec2 h = p - vec2(-0.16, -0.18);
    float spec = smoothstep(0.14, 0.0, length(h));
    vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (d * 0.9 + vec3(0.0, 0.33, 0.67)));
    vec3 col = mix(vColor, rainbow, 0.45) * (rim * 1.1 + body) + vec3(spec);
    float a = (rim * 0.9 + body + spec) * vAlpha;
    if (d > 1.0) discard;
    gl_FragColor = vec4(col, a);
  }`;

const CAUSTIC_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  float caustic(vec2 p, float t) {
    vec2 i = p;
    float c = 1.0;
    float inten = 0.0065;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
    }
    c /= 4.0;
    c = 1.17 - pow(c, 1.4);
    float r = pow(abs(c), 8.0);
    // Guard: a zero-length term can yield Inf/NaN, which bloom would smear over the whole frame.
    return (r == r) ? clamp(r, 0.0, 0.85) : 0.0;
  }
  void main() {
    vec2 p = vUv * vec2(11.0, 6.6) * 0.55;
    float c = caustic(p, uTime * 0.55 + 23.0);
    gl_FragColor = vec4(uColor * c, c * uOpacity);
  }`;

export function buildTableLayer(theme, art, L, opts = {}) {
  const HC = !!opts.highContrast;
  const group = new THREE.Group();
  const disposables = [];
  const updaters = [];
  const scaleMats = [];
  const T = theme.table;
  const { w: SW, h: SH, cz } = L.surf;

  const track = (o) => (disposables.push(o), o);

  // --- ground shadow blob ----------------------------------------------------
  const blobTex = track(radialTexture('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)', 256));
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(SW + 5, SH + 5),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.8 })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(0, -0.78, cz);
  group.add(blob);

  // --- base slab ---------------------------------------------------------------
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(SW + 0.9, 0.7, SH + 0.9),
    track(new THREE.MeshStandardMaterial({ color: T.base, roughness: 0.8, metalness: 0.1 }))
  );
  base.position.set(0, -0.4, cz);
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  // --- board surface -------------------------------------------------------------
  let surface;
  if (art.board) {
    const s = T.surface;
    const { map, normal, roughnessMap, roughness } = surfaceTextures(art.board, s, SW, SH);
    track(map);
    track(normal);
    track(roughnessMap);
    const mat = track(
      new THREE.MeshPhysicalMaterial({
        map,
        color: new THREE.Color(s.tint ?? 0xffffff).multiplyScalar(HC ? 0.5 : 1),
        normalMap: normal,
        normalScale: new THREE.Vector2(s.normal, s.normal),
        roughnessMap,
        roughness,
        clearcoatNormalMap: normal,
        clearcoatNormalScale: new THREE.Vector2(s.normal * 0.2, s.normal * 0.2),
        clearcoatRoughnessMap: roughnessMap,
        metalness: s.metalness,
        clearcoat: s.clearcoat,
        clearcoatRoughness: s.clearcoatRoughness,
        emissiveMap: s.emissive > 0 ? map : null,
        emissive: new THREE.Color(s.emissive > 0 ? 0xffffff : 0x000000),
        emissiveIntensity: s.emissive,
        envMapIntensity: s.env ?? 0.8,
      })
    );
    surface = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), mat);
  } else {
    surface = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), track(new THREE.MeshStandardMaterial({ color: 0x1f5e34, roughness: 1 })));
  }
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(0, L.SURFACE_Y - 0.006, cz);
  surface.receiveShadow = true;
  group.add(surface);

  // --- rails ----------------------------------------------------------------------
  const R = T.rail;
  const railMat = track(
    new THREE.MeshPhysicalMaterial({
      color: R.color,
      roughness: R.roughness,
      metalness: R.metalness,
      clearcoat: R.clearcoat,
      iridescence: R.iridescence || 0,
      iridescenceIOR: 1.6,
      iridescenceThicknessRange: [200, 700],
      emissive: R.emissive,
      emissiveIntensity: R.emissiveIntensity,
    })
  );
  const railT = 0.5;
  const railH = 0.2;
  const railTop = 0.07;
  const addBox = (mat, w, h, d, x, y, z, shadow = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const hw = SW / 2;
  const hd = SH / 2;
  const ry = railTop - railH / 2;
  addBox(railMat, SW + railT * 2, railH, railT, 0, ry, cz - hd - railT / 2);
  addBox(railMat, SW + railT * 2, railH, railT, 0, ry, cz + hd + railT / 2);
  addBox(railMat, railT, railH, SH, -hw - railT / 2, ry, cz);
  addBox(railMat, railT, railH, SH, hw + railT / 2, ry, cz);

  // Inlay strips along the inner edge (gold / neon / aqua glass).
  const I = T.inlay;
  const inlayMat = track(
    new THREE.MeshStandardMaterial({
      color: I.color,
      roughness: I.roughness,
      metalness: I.metalness,
      emissive: I.emissive || 0x000000,
      emissiveIntensity: I.emissiveIntensity || 0,
    })
  );
  const iy = railTop + 0.005;
  const it = 0.05;
  addBox(inlayMat, SW + it * 2, 0.02, it, 0, iy, cz - hd - it / 2, false);
  addBox(inlayMat, SW + it * 2, 0.02, it, 0, iy, cz + hd + it / 2, false);
  addBox(inlayMat, it, 0.02, SH, -hw - it / 2, iy, cz, false);
  addBox(inlayMat, it, 0.02, SH, hw + it / 2, iy, cz, false);

  // Corner finials.
  const F = T.finial;
  const finMat = track(
    new THREE.MeshPhysicalMaterial({
      color: F.color,
      roughness: F.roughness,
      metalness: F.metalness,
      iridescence: F.iridescence || 0,
      emissive: F.emissive || 0x000000,
      emissiveIntensity: F.emissiveIntensity || 0,
      clearcoat: 0.6,
    })
  );
  const finGeo = track(new THREE.SphereGeometry(0.2, 32, 24));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const m = new THREE.Mesh(finGeo, finMat);
      m.position.set(sx * (hw + railT / 2), railTop + 0.14, cz + sz * (hd + railT / 2));
      m.castShadow = true;
      group.add(m);
    }
  }

  // --- slot outlines -----------------------------------------------------------------
  const mats = [];
  const slotMat = (tex, opacity) => {
    const m = track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity }));
    track(tex);
    mats.push(m);
    return m;
  };
  const colMat = slotMat(slotTexture(theme.slots.col), 0.95);
  const freeMat = slotMat(freeCellTexture(theme.slots.free), 0.98);
  const foundMats = [0, 1, 2, 3].map((s) => slotMat(foundationTexture(theme.slots.found, s), 0.98));
  const slotGeo = track(new THREE.PlaneGeometry(CARD.W, CARD.H));
  const addSlot = (x, z, mat) => {
    const m = new THREE.Mesh(slotGeo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, L.SURFACE_Y - 0.003, z);
    group.add(m);
    return m;
  };
  for (let i = 0; i < Math.max(4, L.freeCells ?? 4); i++) addSlot(L.freeX(i), L.FREE_Z, freeMat);
  for (let i = 0; i < 4; i++) addSlot(L.foundX(i), L.FREE_Z, foundMats[i]);
  for (let c = 0; c < 8; c++) addSlot(L.colX(c), L.TABLEAU_Z, colMat);

  // Theme-neutral rule markers, created lazily so classic tables render identically.
  const ruleMarkers = new Map();
  let ruleTime = 0;
  function marker(key, type, label = '') {
    if (ruleMarkers.has(key)) return ruleMarkers.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = 384; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (type === 'frost') {
      ctx.fillStyle = 'rgba(178,217,232,.52)'; ctx.fillRect(12, 16, 360, 224);
      ctx.strokeStyle = 'rgba(245,253,255,.8)'; ctx.lineWidth = 5;
      // Fixed crystal strokes, independent of theme and random streams.
      for (let i = 0; i < 7; i++) {
        const x = 36 + i * 48;
        ctx.beginPath(); ctx.moveTo(x, 34); ctx.lineTo(x + 30, 100); ctx.lineTo(x - 4, 168); ctx.lineTo(x + 18, 222); ctx.stroke();
      }
      ctx.fillStyle = '#edfaff'; ctx.font = '64px sans-serif'; ctx.fillText('❄', 192, 128);
    } else if (type === 'wet') {
      const sheen = ctx.createLinearGradient(20, 20, 360, 220);
      sheen.addColorStop(0, 'rgba(200,213,210,.06)'); sheen.addColorStop(.5, 'rgba(235,249,246,.42)'); sheen.addColorStop(1, 'rgba(200,213,210,.06)');
      ctx.fillStyle = sheen; ctx.fillRect(12, 16, 360, 224);
      ctx.strokeStyle = 'rgba(232,249,244,.4)'; ctx.lineWidth = 3;
      for (let y = 60; y < 220; y += 44) { ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(360, y - 18); ctx.stroke(); }
    } else if (type === 'shutter') {
      ctx.fillStyle = 'rgba(29,35,43,.5)'; ctx.fillRect(12, 16, 360, 224);
      ctx.strokeStyle = 'rgba(224,230,232,.65)'; ctx.lineWidth = 4;
      for (let y = 30; y < 240; y += 26) { ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(368, y); ctx.stroke(); }
    } else if (type === 'tide') {
      ctx.fillStyle = 'rgba(80,125,145,.35)'; ctx.fillRect(12, 120, 360, 120);
      ctx.strokeStyle = 'rgba(215,237,240,.75)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(12, 118);
      for (let x = 12; x <= 372; x += 4) ctx.lineTo(x, 118 + 8 * Math.sin(x / 24));
      ctx.stroke();
      ctx.font = 'bold 48px sans-serif'; ctx.fillStyle = '#d7edf0'; ctx.fillText('CLOSED', 192, 180);
    } else if (type === 'gate') {
      // Draw the lock as geometry so it does not depend on emoji font support.
      ctx.strokeStyle = '#dbe4eb'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(150, 94, 30, Math.PI, 0); ctx.lineTo(180, 136); ctx.stroke();
      ctx.fillStyle = 'rgba(219,228,235,.8)'; ctx.fillRect(109, 104, 82, 72);
      ctx.font = 'bold 70px sans-serif'; ctx.fillText(label, 270, 142);
    } else if (type === 'seal') {
      ctx.fillStyle = 'rgba(29,35,43,.8)'; ctx.fillRect(8, 40, 368, 176);
      ctx.strokeStyle = '#c2c8d0'; ctx.lineWidth = 9;
      for (let i = 0; i < 11; i++) {
        ctx.beginPath(); ctx.ellipse(24 + i * 33, 128 + (i % 2 ? 14 : -14), 24, 15, i % 2 ? .5 : -.5, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (type === 'pip') {
      ctx.fillStyle = label === 'red' ? '#efb1b1' : '#d0d9e1';
      ctx.font = '120px serif'; ctx.fillText(label === 'red' ? '♦' : '♠', 192, 128);
    } else if (type === 'limit' || type === 'maxrank' || type === 'emptycolor' || type === 'stack' || type === 'spurcap' || type === 'loop') {
      ctx.fillStyle = 'rgba(230,235,239,.75)'; ctx.font = 'bold 92px serif'; ctx.fillText(label, 192, 128);
    } else {
      ctx.fillStyle = 'rgba(230,235,239,.65)'; ctx.font = 'bold 104px serif'; ctx.fillText(label + '+', 192, 128);
    }
    const tex = track(new THREE.CanvasTexture(canvas));
    const mat = track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: .85 }));
    const g = new THREE.Group();
    const pieces = type === 'seal' || type === 'frost' ? 3 : 1;
    const small = ['pip', 'limit', 'gate', 'stack', 'emptycolor', 'spurcap', 'loop'].includes(type);
    const width = small ? (type === 'gate' ? .52 : .34) : CARD.W * .92;
    const height = type === 'seal' ? .23 : small ? .24 : CARD.H * .9;
    for (let i = 0; i < pieces; i++) {
      const geo = new THREE.PlaneGeometry(width / pieces, height);
      const uv = geo.attributes.uv;
      for (let j = 0; j < uv.count; j++) uv.setX(j, (uv.getX(j) + i) / pieces);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.x = width * ((i + .5) / pieces - .5);
      mesh.userData.restX = mesh.position.x;
      mesh.renderOrder = 3;
      g.add(mesh);
    }
    group.add(g); g.visible = false;
    const item = { group: g, mat, type, active: false, release: null };
    ruleMarkers.set(key, item);
    return item;
  }
  function showMarker(item, active, x, y, z) {
    item.group.position.set(x, y, z);
    if (item.active && !active && (item.type === 'seal' || item.type === 'frost')) item.release = ruleTime;
    if (active) {
      item.release = null; item.mat.opacity = .85;
      for (const mesh of item.group.children) { mesh.position.set(mesh.userData.restX, 0, 0); mesh.rotation.z = 0; }
    }
    item.active = active;
    item.group.visible = active || item.release !== null;
  }
  let ceiling = null;
  let foundationBand = null, tellUntil = 0;
  let spurSlot = null, spurSuit = null;
  function flashBossTell() { tellUntil = ruleTime + 2; }
  function setRules(game) {
    if (!game) return;
    const st = game.state, r = rulesForState(st, game.rules);
    for (const item of ruleMarkers.values()) if (['limit', 'gate', 'maxrank', 'emptycolor', 'stack', 'spurcap', 'wet', 'shutter', 'loop'].includes(item.type)) { item.active = false; item.group.visible = false; }
    if (st.spur) {
      if (!spurSlot) { spurSlot = addSlot(L.SPUR_X ?? 4.75, L.SPUR_Z ?? -1, foundMats[st.spur.suit]); spurSlot.name = 'voyage-spur-slot'; }
      spurSlot.visible = true;
      if (spurSuit !== st.spur.suit) spurSlot.material = foundMats[st.spur.suit];
      spurSuit = st.spur.suit;
      showMarker(marker(`spurcap:${st.spur.suit}:${st.spur.base}`, 'spurcap', '≤' + (st.spur.base - 1)), true,
        L.foundX(st.spur.suit), L.SURFACE_Y + st.found[st.spur.suit] * CARD.D + .04, L.FREE_Z + CARD.H * .35);
    } else if (spurSlot) spurSlot.visible = false;
    const active = activeFreeCells(st, r);
    for (let i = 0; i < 4; i++) {
      const key = `cellSeal:${i}`;
      if (i >= st.free.length || ruleMarkers.has(key)) showMarker(marker(key, 'seal'), i >= st.free.length, L.freeX(i), L.SURFACE_Y + .035, L.FREE_Z);
    }
    for (let i = 0; i < st.free.length; i++) {
      const frostKey = `frost:${i}`, pipKey = `pip:${i}:${r.cellColors?.[i]}`;
      if (i >= active || ruleMarkers.has(frostKey)) showMarker(marker(frostKey, 'frost'), i >= active, L.freeX(i), L.SURFACE_Y + .035, L.FREE_Z);
      if (r.cellColors?.[i]) showMarker(marker(pipKey, 'pip', r.cellColors[i]), true, L.freeX(i) + CARD.W * .38, L.SURFACE_Y + .04, L.FREE_Z - CARD.H * .38);
      const shutter = r.cellsNeedEmpty && !st.tableau.some((col) => !col.length) && i < active && i >= Math.max(0, active - r.cellsNeedEmpty);
      if (shutter || ruleMarkers.has(`shutter:${i}`)) showMarker(marker(`shutter:${i}`, 'shutter'), !!shutter, L.freeX(i), L.SURFACE_Y + .039, L.FREE_Z);
      const closeKey = `tide:${i}`, closed = !shutter && cellIsClosed(st, i, r);
      if (closed || ruleMarkers.has(closeKey)) showMarker(marker(closeKey, 'tide'), closed, L.freeX(i), L.SURFACE_Y + .038, L.FREE_Z);
      const limit = r.cellLimits[i];
      if (limit) {
        const label = (limit.minRank != null ? '≥' + limit.minRank : '') + (limit.maxRank != null ? '≤' + limit.maxRank : '') +
          (limit.suits != null ? ['♣', '♦', '♥', '♠'].filter((_, s) => limit.suits & (1 << s)).join('') : '');
        showMarker(marker(`limit:${i}:${label}`, 'limit', label), true, L.freeX(i), L.SURFACE_Y + .045, L.FREE_Z + CARD.H * .36);
      }
      if (i < r.cellStack) showMarker(marker(`stack:${i}`, 'stack', '→'), true, L.freeX(i), L.SURFACE_Y + .045, L.FREE_Z - CARD.H * .38);
    }
    for (const [key, item] of ruleMarkers) if (item.type === 'pip' && !key.endsWith(':' + r.cellColors?.[Number(key.split(':')[1])])) item.group.visible = false;
    for (let c = 0; c < st.tableau.length; c++) {
      if (r.emptyCure && cardsHome(st) < r.emptyCure && !st.tableau[c].length) showMarker(marker(`wet:${c}`, 'wet'), true, L.colX(c), L.SURFACE_Y + .016, L.TABLEAU_Z);
      if (r.noExitCols & (1 << c)) showMarker(marker(`loop:${c}`, 'loop', '↻'), true, L.colX(c) + CARD.W * .4, L.SURFACE_Y + .018, L.TABLEAU_Z - CARD.H * .46);
      const sealed = !!(st.sealed & (1 << c)), sealKey = `seal:${c}`;
      if (sealed || ruleMarkers.has(sealKey)) showMarker(marker(sealKey, 'seal'), sealed, L.colX(c), L.SURFACE_Y + CARD.D + .025, L.TABLEAU_Z - CARD.H * .4);
      const rankKey = `rank:${c}:${r.emptyMinRank}`;
      if (r.emptyMinRank) {
        const label = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][r.emptyMinRank] || String(r.emptyMinRank);
        showMarker(marker(rankKey, 'rank', label), !st.tableau[c].length, L.colX(c), L.SURFACE_Y + .012, L.TABLEAU_Z);
      }
      if (r.emptyMaxRank) {
        const rank = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][r.emptyMaxRank] || String(r.emptyMaxRank);
        showMarker(marker(`maxrank:${c}:${r.emptyMaxRank}`, 'maxrank', '≤' + rank), !st.tableau[c].length, L.colX(c), L.SURFACE_Y + .014, L.TABLEAU_Z);
      }
      if (r.emptyColors[c]) showMarker(marker(`emptycolor:${c}:${r.emptyColors[c]}`, 'emptycolor', r.emptyColors[c] === 'red' ? '♦' : '♠'), !st.tableau[c].length, L.colX(c), L.SURFACE_Y + .018, L.TABLEAU_Z + CARD.H * .35);
    }
    for (const [key, item] of ruleMarkers) if (item.type === 'rank' && !key.endsWith(':' + r.emptyMinRank)) item.group.visible = false;
    if (r.gate) {
      const remaining = Math.max(0, r.gate.after - (cardsHome(st) - suitHomeCount(st, r.gate.suit)));
      if (remaining) showMarker(marker(`gate:${r.gate.suit}:${remaining}`, 'gate', String(remaining)), true,
        L.foundX(r.gate.suit), L.SURFACE_Y + st.found[r.gate.suit] * CARD.D + .045, L.FREE_Z + CARD.H * .35);
    }
    if (r.maxHeight && !ceiling) {
      ceiling = new THREE.Mesh(new THREE.PlaneGeometry(7.9, .018), track(new THREE.MeshBasicMaterial({ color: 0xe3e8eb, transparent: true, opacity: .25, depthWrite: false })));
      ceiling.rotation.x = -Math.PI / 2; group.add(ceiling);
    }
    if (ceiling) {
      ceiling.visible = !!r.maxHeight;
      ceiling.position.set(0, L.SURFACE_Y + r.maxHeight * CARD.D + .035, L.TABLEAU_Z + (r.maxHeight - 1) * .34 + CARD.H / 2);
    }
    if (r.foundationSpread && !foundationBand) {
      const width = L.foundX(3) - L.foundX(0) + CARD.W;
      foundationBand = new THREE.Mesh(track(new THREE.PlaneGeometry(width, .028)), track(new THREE.MeshBasicMaterial({ color: 0xf1d481, transparent: true, opacity: .45, depthWrite: false, depthTest: false })));
      foundationBand.name = 'voyage-foundation-ceiling';
      foundationBand.rotation.x = -Math.PI / 2; foundationBand.renderOrder = 5; group.add(foundationBand);
    }
    if (foundationBand) {
      const rank = Math.min(13, Math.min(...st.found.map((_, s) => foundationTop(st, s))) + (r.foundationSpread || 0));
      foundationBand.visible = !!r.foundationSpread;
      foundationBand.userData.ceilingRank = rank;
      foundationBand.position.set((L.foundX(0) + L.foundX(3)) / 2, L.SURFACE_Y + rank * CARD.D + .035, L.FREE_Z + CARD.H * .42);
    }
  }
  updaters.push((dt, t) => {
    ruleTime = t;
    if (foundationBand) foundationBand.material.opacity = t < tellUntil ? .85 : .45;
    for (const item of ruleMarkers.values()) if (item.active) item.mat.opacity = t < tellUntil ? 1 : .85;
    for (const item of ruleMarkers.values()) if (item.release !== null) {
      const age = t - item.release;
      item.mat.opacity = .85 * Math.max(0, 1 - age / .6);
      item.group.children.forEach((mesh, i) => {
        mesh.position.x = mesh.userData.restX + (i - 1) * age * .5;
        mesh.position.y = age * .35;
        mesh.rotation.z = (i - 1) * age * 1.3;
      });
      if (age >= .6) { item.group.visible = false; item.release = null; }
    }
  });

  // --- fog: one theme-neutral mist quad per concealed column -----------------------
  // Lazily allocated; setFog/update reuse meshes, material and uniforms.
  const fogQuads = [];
  let fogMaterial = null;
  function setFog(state, hidden, peekCol = -1) {
    for (let c = 0; c < 8; c++) {
      const col = state?.tableau[c];
      let first = -1, last = -1;
      if (col && c !== peekCol) for (let i = 0; i < col.length; i++) {
        if (hidden?.has(col[i])) { if (first < 0) first = i; last = i; }
      }
      if (first >= 0 && !fogQuads[c]) {
        if (!fogMaterial) fogMaterial = track(new THREE.ShaderMaterial({
          uniforms: { uTime: { value: 0 } },
          vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
          fragmentShader: `varying vec2 vUv; uniform float uTime;
            void main(){
              float edge = smoothstep(0.0, .16, vUv.x) * smoothstep(0.0, .16, 1.0-vUv.x)
                * smoothstep(0.0, .18, vUv.y) * smoothstep(0.0, .18, 1.0-vUv.y);
              float mist = .5 + .18*sin(vUv.x*12.0+vUv.y*8.0+uTime*.35)
                + .12*sin(vUv.y*19.0-vUv.x*7.0-uTime*.22);
              gl_FragColor=vec4(vec3(.83,.86,.88), edge*mist*.43);
            }`,
          transparent: true, depthWrite: false, depthTest: false,
        }));
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fogMaterial);
        mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 4;
        mesh.userData.fogColumn = c;
        group.add(mesh); fogQuads[c] = mesh;
      }
      const mesh = fogQuads[c];
      if (!mesh) continue;
      mesh.visible = first >= 0;
      if (mesh.visible) {
        // Stop at the next card's strip so the three visible cards stay sharp.
        const start = L.zAt(col.length, first) - CARD.H / 2;
        const end = L.zAt(col.length, last + 1) - CARD.H / 2;
        mesh.position.set(L.colX(c), L.SURFACE_Y + (last + 1) * CARD.D + .04, (start + end) / 2);
        mesh.scale.set(CARD.W * 1.04, end - start, 1);
      }
    }
  }
  updaters.push((dt, t) => { if (fogMaterial) fogMaterial.uniforms.uTime.value = t; });

  // --- accent lights (cyber neon spill) ---------------------------------------------------
  for (const a of theme.scene.accentLights) {
    const light = new THREE.PointLight(a.color, a.intensity, 14, 2);
    light.position.set(...a.pos);
    group.add(light);
    updaters.push((dt, t) => {
      light.intensity = a.intensity * (0.8 + 0.2 * Math.sin(t * a.pulse * 2 + a.pos[0])) * (Math.sin(t * 17.0 + a.pos[2]) > 0.96 ? 0.55 : 1);
    });
  }
  if (theme.id === 'cyber') {
    updaters.push((dt, t) => {
      inlayMat.emissiveIntensity = 1.5 + 0.3 * Math.sin(t * 1.7) + (Math.sin(t * 23) > 0.97 ? -0.7 : 0);
      finMat.emissiveIntensity = 1.6 + 0.4 * Math.sin(t * 2.3 + 1);
    });
  }

  if (theme.id === 'muertos' || theme.id === 'forest' || theme.id === 'riverboat') {
    // Candle / lantern flicker on the corner finials.
    updaters.push((dt, t) => {
      finMat.emissiveIntensity = (F.emissiveIntensity || 1) * (0.78 + 0.22 * Math.sin(t * 9 + 1.3) * Math.sin(t * 5.1));
    });
  }

  // --- ambient effects ---------------------------------------------------------------------
  if (HC) {
    /* high contrast: no ambient effects over the cards */
  } else if (theme.particles === 'motes') {
    const N = theme.ambientCount || 160;
    const baseColor = theme.ambientColor;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const alpha = new Float32Array(N);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 13;
      pos[i * 3 + 1] = Math.random() * 6;
      pos[i * 3 + 2] = cz + (Math.random() - 0.5) * 8;
      col.set(baseColor || [1, 0.82 + Math.random() * 0.1, 0.5], i * 3);
      size[i] = 0.035 + Math.random() * 0.06;
      seed[i] = Math.random() * 10;
    }
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    const mat = track(makePointMaterial());
    scaleMats.push(mat);
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    group.add(pts);
    updaters.push((dt, t) => {
      for (let i = 0; i < N; i++) {
        pos[i * 3] += Math.sin(t * 0.3 + seed[i]) * 0.1 * dt;
        pos[i * 3 + 1] += (0.08 + 0.05 * Math.sin(seed[i])) * dt;
        pos[i * 3 + 2] += Math.cos(t * 0.25 + seed[i]) * 0.08 * dt;
        if (pos[i * 3 + 1] > 6) pos[i * 3 + 1] = 0.2;
        alpha[i] = 0.35 + 0.35 * Math.sin(t * 1.3 + seed[i] * 3);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
    });
  } else if (theme.particles === 'rain') {
    const N = 420;
    const lp = new Float32Array(N * 6);
    const drops = [];
    for (let i = 0; i < N; i++) drops.push({ x: (Math.random() - 0.5) * 15, y: Math.random() * 11, z: cz + (Math.random() - 0.5) * 10, v: 11 + Math.random() * 7 });
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    const mat = track(new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    group.add(lines);
    updaters.push((dt) => {
      for (let i = 0; i < N; i++) {
        const d = drops[i];
        d.y -= d.v * dt;
        if (d.y < 0.05) {
          d.y = 10 + Math.random() * 2;
          d.x = (Math.random() - 0.5) * 15;
          d.z = cz + (Math.random() - 0.5) * 10;
        }
        lp[i * 6] = d.x;
        lp[i * 6 + 1] = d.y;
        lp[i * 6 + 2] = d.z;
        lp[i * 6 + 3] = d.x - 0.02;
        lp[i * 6 + 4] = d.y + 0.55;
        lp[i * 6 + 5] = d.z;
      }
      geo.attributes.position.needsUpdate = true;
    });
  } else if (theme.particles === 'bubbles') {
    const N = 46;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const alpha = new Float32Array(N);
    const seed = new Float32Array(N);
    const rise = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() < 0.5 ? -1 : 1) * (5.3 + Math.random() * 2.6);
      pos[i * 3 + 1] = Math.random() * 7;
      pos[i * 3 + 2] = cz + (Math.random() - 0.5) * 8;
      col.set([0.75, 0.95, 1], i * 3);
      size[i] = 0.18 + Math.random() * 0.42;
      alpha[i] = 0.55 + Math.random() * 0.4;
      seed[i] = Math.random() * 10;
      rise[i] = 0.25 + Math.random() * 0.55;
    }
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    const mat = track(makePointMaterial());
    mat.fragmentShader = BUBBLE_FRAG;
    mat.needsUpdate = true;
    scaleMats.push(mat);
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    group.add(pts);
    updaters.push((dt, t) => {
      for (let i = 0; i < N; i++) {
        pos[i * 3 + 1] += rise[i] * dt;
        pos[i * 3] += Math.sin(t * 0.8 + seed[i]) * 0.12 * dt;
        if (pos[i * 3 + 1] > 8) {
          pos[i * 3 + 1] = 0.1;
          pos[i * 3] = (Math.random() < 0.5 ? -1 : 1) * (5.3 + Math.random() * 2.6);
        }
      }
      geo.attributes.position.needsUpdate = true;
    });
  } else if (['petals', 'fireflies', 'stars', 'champagne'].includes(theme.particles)) {
    const kind = theme.particles;
    const N = theme.ambientCount || 40;
    const base = theme.ambientColor || [1, 1, 1];
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const alpha = new Float32Array(N);
    const rot = new Float32Array(N);
    const seed = new Float32Array(N);
    const fall = new Float32Array(N);
    const spin = new Float32Array(N);
    // Mostly in the margins around the table so the cards stay clean; a few drift over it.
    const spawn = (i, initial) => {
      const side = Math.random() < 0.5 ? -1 : 1;
      const over = kind !== 'petals' && Math.random() < 0.3;
      pos[i * 3] = over ? (Math.random() - 0.5) * 9 : side * (5.2 + Math.random() * 3.2);
      pos[i * 3 + 2] = cz + (Math.random() - 0.5) * (over ? 5.5 : 9);
      if (kind === 'petals') pos[i * 3 + 1] = initial ? Math.random() * 8 : 7.5 + Math.random() * 1.5;
      else if (kind === 'champagne') pos[i * 3 + 1] = initial ? Math.random() * 6 : 0.1;
      else pos[i * 3 + 1] = (over ? 1.8 : 0.3) + Math.random() * (over ? 3 : 4);
    };
    for (let i = 0; i < N; i++) {
      spawn(i, true);
      const v = 0.85 + Math.random() * 0.3;
      col.set([base[0] * v, base[1] * v, base[2] * v], i * 3);
      seed[i] = Math.random() * 10;
      rot[i] = Math.random() * 6.28;
      spin[i] = (Math.random() - 0.5) * 3;
      fall[i] = 0.35 + Math.random() * 0.45;
      size[i] = kind === 'petals' ? 0.18 + Math.random() * 0.12 : kind === 'champagne' ? 0.05 + Math.random() * 0.06 : kind === 'stars' ? 0.06 + Math.random() * 0.08 : 0.1 + Math.random() * 0.1;
    }
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
    const mat = track(makeShapeMaterial(kind === 'petals' ? 'petal' : kind === 'stars' ? 'star' : 'glow'));
    scaleMats.push(mat);
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    group.add(pts);
    updaters.push((dt, t) => {
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        if (kind === 'petals') {
          pos[k + 1] -= fall[i] * dt;
          pos[k] += (Math.sin(t * 0.7 + seed[i]) * 0.3 + 0.12) * dt;
          pos[k + 2] += Math.cos(t * 0.5 + seed[i]) * 0.15 * dt;
          rot[i] += spin[i] * dt;
          alpha[i] = 0.9;
          if (pos[k + 1] < 0.04) spawn(i, false);
        } else if (kind === 'champagne') {
          pos[k + 1] += (0.25 + fall[i] * 0.5) * dt;
          pos[k] += Math.sin(t * 1.3 + seed[i]) * 0.08 * dt;
          alpha[i] = 0.55 * Math.min(1, pos[k + 1] * 2) * Math.max(0, 1 - pos[k + 1] / 6);
          if (pos[k + 1] > 6) spawn(i, false);
        } else if (kind === 'fireflies') {
          pos[k] += Math.sin(t * 0.6 + seed[i] * 2) * 0.35 * dt;
          pos[k + 1] += Math.cos(t * 0.8 + seed[i]) * 0.25 * dt;
          pos[k + 2] += Math.sin(t * 0.5 + seed[i] * 3) * 0.3 * dt;
          alpha[i] = Math.max(0, 0.15 + 0.85 * Math.pow(0.5 + 0.5 * Math.sin(t * 1.6 + seed[i] * 5), 3));
        } else {
          pos[k] += 0.05 * dt;
          alpha[i] = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.1 + seed[i] * 7));
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
      geo.attributes.aRot.needsUpdate = true;
    });
  }

  // Water caustics projected over the surface (under the cards, over the felt art).
  if ((theme.id === 'aero' || T.caustics) && !HC) {
    const cMat = track(
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: T.caustics ? new THREE.Color(T.caustics.color) : new THREE.Color(0.75, 0.95, 1.0) },
          uOpacity: { value: T.caustics?.opacity ?? 0.22 },
        },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: CAUSTIC_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    const cm = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), cMat);
    cm.rotation.x = -Math.PI / 2;
    cm.position.set(0, L.SURFACE_Y - 0.001, cz);
    cm.renderOrder = 1;
    group.add(cm);
    updaters.push((dt, t) => (cMat.uniforms.uTime.value = t));
  }


  // Space: a faint hologram scan band sweeping across the table.
  if (theme.id === 'space' && !HC) {
    const sMat = track(
      new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `varying vec2 vUv; uniform float uT;
          void main(){
            float y = fract(uT * 0.12);
            float band = smoothstep(0.09, 0.0, abs(vUv.y - y)) * 0.35;
            float lines = 0.5 + 0.5 * sin(vUv.y * 900.0);
            gl_FragColor = vec4(vec3(0.45, 0.8, 1.0) * (band * (0.7 + 0.3 * lines)), band);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), sMat);
    sm.rotation.x = -Math.PI / 2;
    sm.position.set(0, L.SURFACE_Y - 0.0015, cz);
    sm.renderOrder = 1;
    group.add(sm);
    updaters.push((dt, t) => (sMat.uniforms.uT.value = t));
  }

  return {
    group,
    setRules,
    flashBossTell,
    setFog,
    update(dt, t) {
      for (const u of updaters) u(dt, t);
    },
    setScale(px, fov) {
      const s = (px * 0.5) / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
      for (const m of scaleMats) m.uniforms.uScale.value = s;
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      for (const d of disposables) d.dispose && d.dispose();
    },
  };
}
