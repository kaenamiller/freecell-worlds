// Post-processing: GTAO ambient occlusion, bloom, then one finishing pass that
// tone-maps to the screen and adds vignette, film grain and edge chromatic
// aberration. Quality tiers drop passes and bloom resolution. The scene buffer
// itself stays full native.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.4 },
    uGrain: { value: 0.03 },
    uAberration: { value: 0.0007 },
    uTime: { value: 0 },
    uFade: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette, uGrain, uAberration, uTime, uFade;
    varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    // This pass draws to the screen, so three.js supplies the renderer's tone
    // mapping and output encoding. Doing it here instead of in a separate
    // OutputPass saves a full-resolution pass per frame.
    vec3 display(vec2 uv) {
      vec3 c = texture2D(tDiffuse, uv).rgb;
      #ifdef TONE_MAPPING
        c = toneMapping(c);
      #endif
      return linearToOutputTexel(vec4(c, 1.0)).rgb;
    }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec2 off = d * r2 * uAberration * 10.0;
      vec3 col = vec3(display(vUv + off).r, display(vUv).g, display(vUv - off).b);
      float vig = smoothstep(0.95, 0.15, length(d * vec2(1.0, 1.1)));
      col *= mix(1.0, vig, uVignette);
      col += (hash(vUv * 1500.0 + fract(uTime) * 91.7) - 0.5) * uGrain;
      gl_FragColor = vec4(col * uFade, 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.quality = 'high';
    this.time = 0;
    this.bloomBoost = 0;
    this.base = { strength: 0.3, radius: 0.7, threshold: 0.85 };

    const msaaQuery = new URLSearchParams(location.search).get('msaa');
    this.msaaOverride = msaaQuery == null || msaaQuery === '' ? null : Number(msaaQuery);
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this._samples = this.samplesFor('high');
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: this._samples });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.ao = new GTAOPass(scene, camera, size.x, size.y);
    this.ao.output = GTAOPass.OUTPUT.Default;
    this.ao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.3, 0.7, 0.85);
    this.finish = new ShaderPass(FinishShader);

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.ao);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.finish);
    this.setQuality('high');
  }

  get enabled() {
    return this.quality !== 'low';
  }

  samplesFor(q) {
    if (this.msaaOverride != null && !Number.isNaN(this.msaaOverride)) return this.msaaOverride;
    return q === 'ultra' || q === 'high' ? 4 : 0;
  }

  setSamples(samples) {
    if (this._samples === samples) return;
    this._samples = samples;
    const pr = this.composer._pixelRatio;
    const rt = new THREE.WebGLRenderTarget(
      Math.max(1, this.composer._width * pr),
      Math.max(1, this.composer._height * pr),
      { type: THREE.HalfFloatType, samples },
    );
    this.composer.reset(rt);
  }

  // Medium keeps the glow, but the blur chain runs at half the native buffer
  // so it does not dominate the frame. The sharp image stays full resolution.
  applyBloomBudget() {
    if (this._cssWidth == null) return;
    const scale = this.quality === 'ultra' || this.quality === 'high' ? 1 : 0.5;
    this.bloom.setSize(Math.max(1, this._cssWidth * this._pixelRatio * scale), Math.max(1, this._cssHeight * this._pixelRatio * scale));
  }

  setQuality(q) {
    this.quality = q;
    // GTAO is only enabled on the explicit 'ultra' tier (experimental, see index.html).
    this.ao.enabled = q === 'ultra';
    this.bloom.enabled = q !== 'low';
    this.setSamples(this.samplesFor(q));
    this.applyBloomBudget();
  }

  setTheme(cfg) {
    this.base = cfg.bloom;
    this.bloom.strength = cfg.bloom.strength;
    this.bloom.radius = cfg.bloom.radius;
    this.bloom.threshold = cfg.bloom.threshold;
    this.ao.blendIntensity = cfg.ao;
    const u = this.finish.uniforms;
    u.uVignette.value = cfg.vignette;
    u.uGrain.value = cfg.grain;
  }

  // Temporary bloom surge (win flare, big foundation moves).
  pulse(amount) {
    this.bloomBoost = Math.max(this.bloomBoost, amount);
  }

  setFade(v) {
    this.finish.uniforms.uFade.value = v;
  }

  resize(w, h, pixelRatio) {
    this._cssWidth = w;
    this._cssHeight = h;
    this._pixelRatio = pixelRatio;
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    this.applyBloomBudget();
  }

  render(dt) {
    this.time += dt;
    this.bloomBoost = Math.max(0, this.bloomBoost - dt * 1.4);
    this.bloom.strength = this.base.strength + this.bloomBoost;
    this.finish.uniforms.uTime.value = this.time;
    this.composer.render(dt);
  }
}
