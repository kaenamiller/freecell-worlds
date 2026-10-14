// Volumetric sea fog for the Voyage chart. A small WebGL pass raymarches a
// slab of 3D noise in front of the uncharted tables: each slice drifts at its
// own speed, banks roll through a slow domain warp, and every sample is shaded
// by the fog between it and the moon. Time only moves forward, so nothing
// loops or snaps back. Without WebGL the chart keeps its painted CSS layers.

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform vec2 uWorld;
uniform float uTime;
uniform float uEdge;
uniform float uRamp;
uniform float uPortrait;
uniform vec2 uSeed;
uniform float uPart;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}

const mat3 ROT = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);

float fbm4(vec3 p) {
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 4; i++) { sum += amp * noise(p); p = ROT * p * 2.03; amp *= 0.5; }
  return sum / 0.9375;
}

float fbm2(vec3 p) {
  float sum = 0.5 * noise(p);
  p = ROT * p * 2.03;
  return (sum + 0.25 * noise(p)) / 0.75;
}

// Coverage rises with the envelope: thin wisps at the lookout, a full bank beyond.
float cover(float n, float env, float amp) {
  return clamp((n - (0.70 - 0.32 * sqrt(env))) * 4.2, 0.0, 1.0) * amp;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 world = vec2(uv.x, 1.0 - uv.y) * uWorld;
  vec2 q = world / 185.0 + uSeed;
  float t = uTime;
  vec2 wind = vec2(0.018, -0.005) * t;

  // A slow, coarse warp makes the banks roll and curl instead of sliding as a sheet.
  vec2 warp = vec2(
    fbm2(vec3(q * 0.32 + wind * 0.45, t * 0.011)),
    fbm2(vec3(q * 0.32 - wind * 0.35 + 5.2, t * 0.011 + 3.1))) - 0.5;
  q += warp * 1.4;

  float depth = uPortrait > 0.5 ? uEdge - world.y : world.x - uEdge;
  float frontier = smoothstep(-0.5 * uRamp, uRamp, depth + warp.x * 0.7 * uRamp);
  float haze = 0.05 + 0.2 * fbm2(vec3(q * 0.18 - wind * 0.3 + 9.0, t * 0.008));
  float open = 1.0 - 0.6 * uPart;
  float env = max(frontier, haze * (1.0 - frontier)) * open;
  // Open sea keeps only faint wisps; the bank itself is dense.
  float amp = max(0.35 * haze, sqrt(frontier)) * open;

  vec3 light = normalize(vec3(-0.5, -0.3, 0.8));
  vec3 lit = vec3(0.93, 0.96, 0.94);
  vec3 shade = vec3(0.13, 0.24, 0.29);
  float trans = 1.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    float z = (float(i) + 0.5) / 6.0;
    // Nearer slices drift faster, which gives the bank its parallax depth.
    vec3 p = vec3(q + wind * (0.55 + 0.9 * z), z * 1.3 + t * 0.018);
    float d = cover(fbm4(p), env, amp);
    if (d > 0.003) {
      float occluder = cover(fbm2(p + light * 0.32), env, amp) + cover(fbm2(p + light * 0.75), env, amp) * 0.6;
      float glow = exp(-occluder * 2.2);
      vec3 c = mix(shade, lit, glow) + vec3(0.06, 0.05, 0.02) * z;
      float a = 1.0 - exp(-d * 0.75);
      col += trans * a * c;
      trans *= 1.0 - a;
    }
    if (trans < 0.04) break;
  }
  gl_FragColor = vec4(col, 1.0 - trans) * 0.82;
}`;

const SCALE = 0.5;
const MAX_PIXELS = 420000;
const MIN_PIXELS = 30000;
const BUDGET_MS = 8;
const FRAME_MS = 1000 / 30;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'fog shader');
  return shader;
}

const reducedMotion = () => document.body.classList.contains('voyage-reduced-motion')
  || matchMedia('(prefers-reduced-motion: reduce)').matches;

export class FogVolume {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'voyage-fog-volume';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.time = 0;
    this.part = 0;
    this.partTarget = 0;
    this.frame = 0;
    this.last = 0;
    this.ok = this.init();
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.stop();
      this.ok = false;
      this.canvas.closest('.voyage-chart-world')?.classList.remove('fog-volume');
    });
  }

  init() {
    try {
      const gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
      if (!gl) return false;
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const pos = gl.getAttribLocation(program, 'aPos');
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
      this.gl = gl;
      this.u = Object.fromEntries(['uRes', 'uWorld', 'uTime', 'uEdge', 'uRamp', 'uPortrait', 'uSeed', 'uPart']
        .map((name) => [name, gl.getUniformLocation(program, name)]));
      return this.probe();
    } catch {
      return false;
    }
  }

  // Time one small frame so slow or software GPUs get a smaller canvas, or
  // keep the CSS fog when even that would cost too much.
  probe() {
    const { gl, u } = this;
    this.canvas.width = 256;
    this.canvas.height = 128;
    gl.viewport(0, 0, 256, 128);
    gl.uniform2f(u.uRes, 256, 128);
    gl.uniform2f(u.uWorld, 512, 256);
    gl.uniform1f(u.uEdge, 0);
    gl.uniform1f(u.uRamp, 200);
    gl.uniform1f(u.uPortrait, 0);
    gl.uniform2f(u.uSeed, 0, 0);
    // readPixels waits for the GPU; finish() alone returns early in Chrome.
    const pixel = new Uint8Array(4);
    this.draw();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const start = performance.now();
    this.draw();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const perPixel = Math.max(1e-6, (performance.now() - start) / (256 * 128));
    this.maxPixels = Math.min(MAX_PIXELS, BUDGET_MS / perPixel);
    return this.maxPixels >= MIN_PIXELS;
  }

  // Moves the canvas into a freshly painted chart. Returns false when the
  // chart should keep its CSS fog instead.
  attach(host, { width, height, edge, portrait, seed = 0 }) {
    if (!this.ok || !host) return false;
    const scale = Math.min(SCALE, Math.sqrt(this.maxPixels / Math.max(1, width * height)));
    this.canvas.width = Math.max(1, Math.round(width * scale));
    this.canvas.height = Math.max(1, Math.round(height * scale));
    host.append(this.canvas);
    const { gl, u } = this;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.uWorld, width, height);
    gl.uniform1f(u.uEdge, edge);
    // Portrait charts leave a short strip above the lookout, so the bank thickens faster there.
    gl.uniform1f(u.uRamp, Math.max(130, Math.min(300, (portrait ? edge : width - edge) * 0.7)));
    gl.uniform1f(u.uPortrait, portrait ? 1 : 0);
    gl.uniform2f(u.uSeed, (seed % 997) * 0.37, (seed % 991) * 0.53);
    this.draw();
    this.start();
    return true;
  }

  // Thin the bank while the boat is under way, then let it close again.
  parting(on) { this.partTarget = on ? 1 : 0; }

  draw() {
    const { gl, u } = this;
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uPart, this.part);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  start() {
    if (!this.ok || this.frame || reducedMotion()) return;
    this.last = performance.now();
    const tick = (now) => {
      if (!this.canvas.isConnected || reducedMotion()) { this.frame = 0; return; }
      this.frame = requestAnimationFrame(tick);
      const dt = now - this.last;
      if (dt < FRAME_MS - 2) return;
      this.last = now;
      // Clamp long gaps (a background tab) so the fog resumes where it was.
      const step = Math.min(dt, 100) / 1000;
      this.time += step;
      this.part += (this.partTarget - this.part) * Math.min(1, step * 3.5);
      this.draw();
    };
    this.frame = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
}
