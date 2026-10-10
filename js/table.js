// Builds the themed table layer: base, board surface, rails, inlays, slot
// outlines, accent lights and ambient effects. Returned object can be disposed
// and rebuilt when the theme changes.
import * as THREE from 'three';
import { surfaceTextures, slotTexture, freeCellTexture, foundationTexture, radialTexture } from './textures.js';
import { makePointMaterial, makeShapeMaterial } from './fx.js';
import { CARD } from './card.js';

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
    const { map, normal } = surfaceTextures(art.board);
    track(map);
    track(normal);
    const s = T.surface;
    const mat = track(
      new THREE.MeshPhysicalMaterial({
        map,
        color: new THREE.Color(s.tint ?? 0xffffff).multiplyScalar(HC ? 0.5 : 1),
        normalMap: normal,
        normalScale: new THREE.Vector2(s.normal, s.normal),
        roughness: s.roughness,
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
  };
  for (let i = 0; i < 4; i++) {
    addSlot(L.freeX(i), L.FREE_Z, freeMat);
    addSlot(L.foundX(i), L.FREE_Z, foundMats[i]);
  }
  for (let c = 0; c < 8; c++) addSlot(L.colX(c), L.TABLEAU_Z, colMat);

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
  if (theme.id === 'aero' && !HC) {
    const cMat = track(
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.75, 0.95, 1.0) }, uOpacity: { value: 0.22 } },
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
