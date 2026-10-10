// Particle effects: pooled additive sparks/dust, expanding rings and a flash light.
import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;

const FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;
    float a = smoothstep(1.0, 0.0, d);
    a *= a;
    gl_FragColor = vec4(vColor, a * vAlpha);
  }`;

export function makePointMaterial(blending = THREE.AdditiveBlending) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uScale: { value: 800 } },
    transparent: true,
    depthWrite: false,
    blending,
  });
}

// Shaped, optionally rotating point sprites for ambient effects (petals, fireflies, stars).
const SHAPE_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aRot;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying float vRot;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vRot = aRot;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;

const SHAPE_FRAG = {
  // Teardrop petal, spinning, normal-blended so it reads as a solid petal.
  petal: /* glsl */ `
    varying float vAlpha; varying float vRot; varying vec3 vColor;
    void main() {
      vec2 p = gl_PointCoord - 0.5;
      float c = cos(vRot), s = sin(vRot);
      p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
      float tip = smoothstep(-0.5, 0.5, p.y);
      float d = length(vec2(p.x * (1.5 + tip * 1.6), p.y * 0.95)) * 2.0;
      float a = smoothstep(1.0, 0.82, d);
      if (a < 0.01) discard;
      vec3 col = vColor * (0.82 + 0.3 * (1.0 - tip)) ;
      gl_FragColor = vec4(col, a * vAlpha);
    }`,
  // Soft glowing orb with a hot core (fireflies, embers, champagne).
  glow: /* glsl */ `
    varying float vAlpha; varying float vRot; varying vec3 vColor;
    void main() {
      vec2 p = gl_PointCoord - 0.5;
      float d = length(p) * 2.0;
      float halo = pow(max(0.0, 1.0 - d), 2.4);
      float core = smoothstep(0.28, 0.0, d);
      gl_FragColor = vec4(vColor * (halo * 1.2 + core * 1.6), (halo + core) * vAlpha);
    }`,
  // Four-point twinkling star.
  star: /* glsl */ `
    varying float vAlpha; varying float vRot; varying vec3 vColor;
    void main() {
      vec2 p = gl_PointCoord - 0.5;
      float d = length(p) * 2.0;
      float cross = max(0.0, 1.0 - abs(p.x) * 16.0) * max(0.0, 1.0 - abs(p.y) * 2.4) + max(0.0, 1.0 - abs(p.y) * 16.0) * max(0.0, 1.0 - abs(p.x) * 2.4);
      float dot_ = smoothstep(0.35, 0.0, d);
      float a = clamp(cross + dot_, 0.0, 1.0);
      gl_FragColor = vec4(vColor * (0.6 + a), a * vAlpha);
    }`,
};

export function makeShapeMaterial(kind) {
  return new THREE.ShaderMaterial({
    vertexShader: SHAPE_VERT,
    fragmentShader: SHAPE_FRAG[kind],
    uniforms: { uScale: { value: 800 } },
    transparent: true,
    depthWrite: false,
    blending: kind === 'petal' ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
}

export class Particles {
  constructor(scene, max = 2400) {
    this.max = max;
    this.cursor = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.pos.fill(0, 0);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = makePointMaterial();
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    this.geo = geo;
  }

  setScale(viewHeightPx, fovDeg) {
    this.mat.uniforms.uScale.value = (viewHeightPx * 0.5) / Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
  }

  emit({ x, y, z, color = [1, 1, 1], count = 10, speed = 1, spread = 1, up = 0, size = 0.08, life = 0.7, gravity = 0, drag = 1.5, jitter = 0.15 }) {
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const a = Math.random() * Math.PI * 2;
      const e = (Math.random() - 0.3) * spread;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.pos[i * 3] = x + (Math.random() - 0.5) * jitter;
      this.pos[i * 3 + 1] = y + Math.random() * jitter * 0.4;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * jitter;
      this.vel[i * 3] = Math.cos(a) * s * (1 - Math.abs(e) * 0.3);
      this.vel[i * 3 + 1] = up + e * s * 0.6;
      this.vel[i * 3 + 2] = Math.sin(a) * s * (1 - Math.abs(e) * 0.3);
      this.col[i * 3] = color[0];
      this.col[i * 3 + 1] = color[1];
      this.col[i * 3 + 2] = color[2];
      this.maxLife[i] = this.life[i] = life * (0.6 + Math.random() * 0.8);
      this.baseSize[i] = size * (0.6 + Math.random() * 0.8);
      this.grav[i] = gravity;
      this.drag[i] = drag;
    }
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const damp = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= damp;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * damp - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= damp;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = k;
      this.size[i] = this.baseSize[i] * (0.5 + 0.5 * k);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
  }
}

// Expanding ground rings + a decaying flash light.
export class Pulses {
  constructor(scene) {
    this.scene = scene;
    this.rings = [];
    this.geo = new THREE.RingGeometry(0.46, 0.5, 48);
    this.geo.rotateX(-Math.PI / 2);
    this.light = new THREE.PointLight(0xffffff, 0, 6, 2);
    scene.add(this.light);
    this.lightLevel = 0;
    this.lightPeak = 1;
  }

  ring(x, z, colorHex, size = 1) {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(this.geo, mat);
    m.position.set(x, 0.02, z);
    m.userData = { t: 0, size };
    this.scene.add(m);
    this.rings.push(m);
  }

  flash(x, y, z, colorHex, intensity = 14) {
    this.light.position.set(x, y, z);
    this.light.color.setHex(colorHex);
    this.lightPeak = intensity;
    this.lightLevel = 1;
  }

  update(dt) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const m = this.rings[i];
      m.userData.t += dt / 0.7;
      const t = m.userData.t;
      m.scale.setScalar((0.4 + t * 2.2) * m.userData.size);
      m.material.opacity = Math.max(0, 0.9 * (1 - t));
      if (t >= 1) {
        this.scene.remove(m);
        m.material.dispose();
        this.rings.splice(i, 1);
      }
    }
    this.lightLevel = Math.max(0, this.lightLevel - dt * 3.2);
    this.light.intensity = this.lightPeak * this.lightLevel * this.lightLevel;
  }
}
